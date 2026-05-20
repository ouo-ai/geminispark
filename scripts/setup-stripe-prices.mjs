import fs from "node:fs"
import path from "node:path"
import Stripe from "stripe"

const ENV_PATH = path.join(process.cwd(), ".env.local")

const PRICE_CONFIGS = [
  {
    envKey: "STRIPE_STARTUP_MONTHLY_PRICE_ID",
    lookupKey: "geminispark_startup_monthly",
    productName: "GeminiSpark Startup",
    productKey: "STARTUP",
    metadata: { plan: "STARTUP", interval: "month" },
    unitAmount: 3900,
    interval: "month",
  },
  {
    envKey: "STRIPE_STARTUP_YEARLY_PRICE_ID",
    lookupKey: "geminispark_startup_yearly",
    productName: "GeminiSpark Startup",
    productKey: "STARTUP",
    metadata: { plan: "STARTUP", interval: "year" },
    unitAmount: 39000,
    interval: "year",
  },
  {
    envKey: "STRIPE_PRO_MONTHLY_PRICE_ID",
    lookupKey: "geminispark_pro_monthly",
    productName: "GeminiSpark Pro",
    productKey: "PRO",
    metadata: { plan: "PRO", interval: "month" },
    unitAmount: 20000,
    interval: "month",
  },
  {
    envKey: "STRIPE_PRO_YEARLY_PRICE_ID",
    lookupKey: "geminispark_pro_yearly",
    productName: "GeminiSpark Pro",
    productKey: "PRO",
    metadata: { plan: "PRO", interval: "year" },
    unitAmount: 200000,
    interval: "year",
  },
  {
    envKey: "STRIPE_CREDIT_PACK_BOOST_50_PRICE_ID",
    lookupKey: "geminispark_credit_pack_boost_50",
    productName: "GeminiSpark Credit Packs",
    productKey: "CREDIT_PACKS",
    metadata: { checkoutKind: "credit_pack", pack: "BOOST_50", credits: "50" },
    unitAmount: 6000,
  },
  {
    envKey: "STRIPE_CREDIT_PACK_STUDIO_150_PRICE_ID",
    lookupKey: "geminispark_credit_pack_studio_150",
    productName: "GeminiSpark Credit Packs",
    productKey: "CREDIT_PACKS",
    metadata: { checkoutKind: "credit_pack", pack: "STUDIO_150", credits: "150" },
    unitAmount: 15000,
  },
  {
    envKey: "STRIPE_CREDIT_PACK_LAUNCH_400_PRICE_ID",
    lookupKey: "geminispark_credit_pack_launch_400",
    productName: "GeminiSpark Credit Packs",
    productKey: "CREDIT_PACKS",
    metadata: { checkoutKind: "credit_pack", pack: "LAUNCH_400", credits: "400" },
    unitAmount: 36000,
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

function priceMatchesConfig(price, config) {
  const priceInterval = price.recurring?.interval || null
  const configInterval = config.interval || null

  return price.currency === "usd" && price.unit_amount === config.unitAmount && priceInterval === configInterval
}

async function ensureProduct(stripe, productsByPlan, config) {
  if (productsByPlan.has(config.productKey)) {
    return productsByPlan.get(config.productKey)
  }

  const product = await stripe.products.create({
    name: config.productName,
    metadata: {
      app: "geminispark",
      productKey: config.productKey,
    },
  })
  productsByPlan.set(config.productKey, product.id)
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
      productsByPlan.set(config.productKey, typeof existing.product === "string" ? existing.product : existing.product.id)
      if (priceMatchesConfig(existing, config)) {
        envUpdates[config.envKey] = existing.id
        console.log(`${config.envKey}: reused ${existing.id}`)
        continue
      }

      console.log(`${config.envKey}: replacing ${existing.id} because amount or interval changed`)
    }

    const productId =
      existing && typeof existing.product === "string"
        ? existing.product
        : existing?.product?.id || (await ensureProduct(stripe, productsByPlan, config))
    const priceConfig = {
      currency: "usd",
      lookup_key: config.lookupKey,
      transfer_lookup_key: Boolean(existing),
      product: productId,
      unit_amount: config.unitAmount,
      metadata: {
        app: "geminispark",
        ...config.metadata,
      },
    }

    if (config.interval) {
      priceConfig.recurring = {
        interval: config.interval,
      }
    }

    const price = await stripe.prices.create(priceConfig)

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
