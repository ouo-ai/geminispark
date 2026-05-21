import { createHash, createHmac } from "node:crypto"

const REGION = "auto"
const SERVICE = "s3"

type R2Config = {
  endpoint: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  publicBaseUrl: string
}

export class R2NotConfiguredError extends Error {
  constructor() {
    super("R2 storage is not configured.")
    this.name = "R2NotConfiguredError"
  }
}

export function readR2Config(): R2Config {
  const endpoint = (process.env.R2_ACCOUNT_ENDPOINT || "").replace(/\/$/, "")
  const bucket = process.env.R2_BUCKET || ""
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || ""
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || ""
  const publicBaseUrl = (process.env.R2_PUBLIC_BASE_URL || "").replace(/\/$/, "")

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey || !publicBaseUrl) {
    throw new R2NotConfiguredError()
  }

  return { endpoint, bucket, accessKeyId, secretAccessKey, publicBaseUrl }
}

function sha256Hex(data: Buffer | string) {
  return createHash("sha256").update(data).digest("hex")
}

function hmac(key: Buffer | string, data: string) {
  return createHmac("sha256", key).update(data).digest()
}

function deriveSigningKey(secret: string, dateStamp: string) {
  const kDate = hmac("AWS4" + secret, dateStamp)
  const kRegion = hmac(kDate, REGION)
  const kService = hmac(kRegion, SERVICE)
  return hmac(kService, "aws4_request")
}

function encodeKeyForUrl(key: string) {
  return key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")
}

export type PresignedPut = {
  url: string
  publicUrl: string
  headers: Record<string, string>
  key: string
  expiresAt: string
}

export function presignPutUrl(params: {
  key: string
  contentType: string
  expiresSeconds?: number
}): PresignedPut {
  const config = readR2Config()
  const expires = Math.max(60, Math.min(3600, params.expiresSeconds ?? 600))

  const host = new URL(config.endpoint).host
  const encodedKey = encodeKeyForUrl(params.key)
  const pathname = `/${encodeURIComponent(config.bucket)}/${encodedKey}`
  const baseUrl = `${config.endpoint}${pathname}`

  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "")
  const dateStamp = amzDate.slice(0, 8)
  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`
  const signedHeaders = "host"
  const canonicalHeaders = `host:${host}\n`

  const queryEntries: Array<[string, string]> = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", `${config.accessKeyId}/${credentialScope}`],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(expires)],
    ["X-Amz-SignedHeaders", signedHeaders],
  ]
  const canonicalQueryString = queryEntries
    .slice()
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&")

  const canonicalRequest = [
    "PUT",
    pathname,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n")

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n")

  const signingKey = deriveSigningKey(config.secretAccessKey, dateStamp)
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex")

  const url = `${baseUrl}?${canonicalQueryString}&X-Amz-Signature=${signature}`
  const publicUrl = `${config.publicBaseUrl}/${params.key}`
  const expiresAt = new Date(Date.now() + expires * 1000).toISOString()

  return {
    url,
    publicUrl,
    key: params.key,
    headers: { "Content-Type": params.contentType },
    expiresAt,
  }
}

export async function putToR2(params: {
  key: string
  body: Buffer
  contentType: string
}): Promise<string> {
  const config = readR2Config()
  const url = new URL(`${config.endpoint}/${encodeURIComponent(config.bucket)}/${params.key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")}`)

  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "")
  const dateStamp = amzDate.slice(0, 8)
  const payloadHash = sha256Hex(params.body)

  const headerEntries: Array<[string, string]> = [
    ["host", url.host],
    ["x-amz-content-sha256", payloadHash],
    ["x-amz-date", amzDate],
  ]
  const canonicalHeaders =
    headerEntries.map(([name, value]) => `${name}:${value}`).join("\n") + "\n"
  const signedHeaders = headerEntries.map(([name]) => name).join(";")

  const canonicalRequest = [
    "PUT",
    url.pathname,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n")

  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n")

  const signingKey = deriveSigningKey(config.secretAccessKey, dateStamp)
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex")
  const authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  const response = await fetch(url.toString(), {
    method: "PUT",
    headers: {
      "Content-Type": params.contentType,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      Authorization: authorization,
    },
    body: params.body,
  })

  if (!response.ok) {
    const text = await response.text().catch(() => "")
    throw new Error(`R2 upload failed (${response.status}): ${text || response.statusText}`)
  }

  return `${config.publicBaseUrl}/${params.key}`
}
