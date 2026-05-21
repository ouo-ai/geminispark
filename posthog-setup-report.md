<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the Gemini Spark Next.js 16 App Router project.

**Changes made:**

- **`instrumentation-client.ts`** (new) — initializes `posthog-js` on the client using the `instrumentation-client` pattern for Next.js 15.3+, with `capture_exceptions: true` for automatic error tracking and a reverse proxy via `/ingest`.
- **`next.config.mjs`** — added `/ingest/*` and `/ingest/static/*` and `/ingest/array/*` rewrites routing PostHog traffic through the Next.js server, plus `skipTrailingSlashRedirect: true`.
- **`lib/posthog-server.ts`** (new) — singleton server-side `PostHog` client from `posthog-node`, used by all API routes.
- **`.env.local`** — `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` populated.
- **`components/pricing-page.tsx`** — added `pricing_page_viewed` on mount, user identify on session load, `user_signed_in` on Google OAuth initiation, `subscription_checkout_started` on plan button click, `credit_pack_checkout_started` on pack button click, and `captureException` on sign-in error.
- **`app/api/billing/webhook/route.ts`** — added server-side `subscription_activated` event inside `syncSubscription` after credits are granted, and `credit_pack_purchased` inside `syncCheckoutSession` after pack credits are granted.
- **`app/api/gemini-spark/tasks/route.ts`** — added server-side `agent_task_submitted` event after a task is successfully proxied to the agent API.
- **`app/api/gemini-spark/bootstrap/route.ts`** — added server-side `workspace_initialized` event after workspace and messages are resolved.

| Event | Description | File |
|---|---|---|
| `pricing_page_viewed` | User lands on the pricing page — top of conversion funnel | `components/pricing-page.tsx` |
| `user_signed_in` | User initiates Google OAuth sign-in from pricing page | `components/pricing-page.tsx` |
| `subscription_checkout_started` | User clicks to start a paid subscription checkout | `components/pricing-page.tsx` |
| `credit_pack_checkout_started` | User clicks to start a one-time credit pack checkout | `components/pricing-page.tsx` |
| `subscription_activated` | Stripe webhook confirms subscription payment and credits are granted | `app/api/billing/webhook/route.ts` |
| `credit_pack_purchased` | Stripe webhook confirms credit pack payment and credits are granted | `app/api/billing/webhook/route.ts` |
| `agent_task_submitted` | User submits a message/task to the Gemini Spark AI agent | `app/api/gemini-spark/tasks/route.ts` |
| `workspace_initialized` | User's agent workspace bootstrap endpoint is called | `app/api/gemini-spark/bootstrap/route.ts` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics dashboard](/dashboard/1612149)
- [Pricing → Checkout → Subscription funnel](/insights/AJWZ0ihN) — conversion funnel from pricing page to paid subscriber
- [Agent tasks submitted (daily)](/insights/uox9RWdR) — daily task volume, core engagement metric
- [Revenue events over time](/insights/POpMSWTc) — weekly subscriptions activated + credit packs purchased
- [Unique users initializing workspace (daily)](/insights/o0HRfbme) — daily active workspace users
- [Top-of-funnel: pricing views vs checkout starts](/insights/gC1TOuFX) — pricing interest vs intent

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
