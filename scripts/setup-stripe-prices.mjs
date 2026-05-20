import fs from "node:fs"
import path from "node:path"
import Stripe from "stripe"

const ENV_PATH = path.join(process.cwd(), ".env.local")

const PRICE_CONFIGS = [
  {
    envKey: "STRIPE_STARTUP_MONTHLY_PRICE_ID",
    lookupKey: "geminispark_startup_monthly",
    productName: "GeminiSpark Startup",
    plan: "STARTUP",
    unitAmount: 10000,
    interval: "month",
  },
  {
    envKey: "STRIPE_STARTUP_YEARLY_PRICE_ID",
    lookupKey: "geminispark_startup_yearly",
    productName: "GeminiSpark Startup",
    plan: "STARTUP",
    unitAmount: 100000,
    interval: "year",
  },
  {
    envKey: "STRIPE_PRO_MONTHLY_PRICE_ID",
    lookupKey: "geminispark_pro_monthly",
    productName: "GeminiSpark Pro",
    plan: "PRO",
    unitAmount: 20000,
    interval: "month",
  },
  {
    envKey: "STRIPE_PRO_YEARLY_PRICE_ID",
    lookupKey: "geminispark_pro_yearly",
    productName: "GeminiSpark Pro",
    plan: "PRO",
    unitAmount: 200000,
    interval: "year",
  },
]

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return { entries: new Map(), lines: [] }
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/)
  const entries = new Map()

  lines.forEach((line, index) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      return
    }

    const key = trimmed.slice(0, trimmed.indexOf("=")).trim()
    entries.set(key, { index, value: trimmed.slice(trimmed.indexOf("=") + 1).trim() })
  })

  return { entries, lines }
}

function upsertEnv(filePath, values) {
  const { entries, lines } = parseEnvFile(filePath)
  const nextLines = [...lines]

  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${value}`
    const entry = entries.get(key)
    if (entry) {
      nextLines[entry.index] = line
    } else {
      nextLines.push(line)
    }
  }

  fs.writeFileSync(filePath, `${nextLines.join("\n").replace(/\n+$/, "")}\n`)
}

function readEnvValue(filePath, key) {
  const { entries } = parseEnvFile(filePath)
  const entry = entries.get(key)
  if (!entry) {
    return ""
  }

  const value = entry.value
  if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1)
  }

  return value
}

async function findPriceByLookupKey(stripe, lookupKey) {
  const prices = await stripe.prices.list({
    active: true,
    lookup_keys: [lookupKey],
    limit: 1,
  })

  return prices.data[0] || null
}

async function ensureProduct(stripe, productsByPlan, config) {
  if (productsByPlan.has(config.plan)) {
    return productsByPlan.get(config.plan)
  }

  const product = await stripe.products.create({
    name: config.productName,
    metadata: {
      app: "geminispark",
      plan: config.plan,
    },
  })
  productsByPlan.set(config.plan, product.id)
  return product.id
}

async function main() {
  const secretKey = process.env.STRIPE_SECRET_KEY || readEnvValue(ENV_PATH, "STRIPE_SECRET_KEY")
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is missing.")
  }

  const stripe = new Stripe(secretKey)
  const productsByPlan = new Map()
  const envUpdates = {}

  for (const config of PRICE_CONFIGS) {
    const existing = await findPriceByLookupKey(stripe, config.lookupKey)
    if (existing) {
      envUpdates[config.envKey] = existing.id
      productsByPlan.set(config.plan, typeof existing.product === "string" ? existing.product : existing.product.id)
      console.log(`${config.envKey}: reused ${existing.id}`)
      continue
    }

    const productId = await ensureProduct(stripe, productsByPlan, config)
    const price = await stripe.prices.create({
      currency: "usd",
      lookup_key: config.lookupKey,
      product: productId,
      unit_amount: config.unitAmount,
      recurring: {
        interval: config.interval,
      },
      metadata: {
        app: "geminispark",
        plan: config.plan,
        interval: config.interval,
      },
    })

    envUpdates[config.envKey] = price.id
    console.log(`${config.envKey}: created ${price.id}`)
  }

  upsertEnv(ENV_PATH, envUpdates)
  console.log("Updated .env.local with Stripe price ids.")
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
