# Integration Readiness Notes

Date: 2026-06-30
Branch: `codex/integration-readiness-qa`

This note tracks integration work around Co-work's PR-03 stream. It is not a product claim and does not replace `docs/LAUNCH_READINESS.md`.

## Current Scope

This branch keeps clear of PR-03 SMS rescue implementation files. Co-work can work on:

- `src/services/digest.ts`
- `src/services/follow-up.ts`
- `src/services/action-engine.ts`
- `src/adapters/integrations/twilio-sms.ts`
- `src/app/api/cron/digest/route.ts`
- `src/app/api/sms/incoming/route.ts`
- related PR-03 tests

This branch focuses on integration safety:

- brand-domain redirects and security headers;
- DNS runbook;
- ROI provenance on the dashboard;
- schema comment truthfulness;
- ConversationRelay A/B prototype rebased without regressing the champion voice path;
- public-route and readiness audit.

## Public Route Matrix

| Surface | Middleware status | In-route guard | Notes |
|---|---|---|---|
| `/api/health` | public | none | May run `verifyLive()` only with `?live=1`; safe for uptime checks. |
| `/api/cron/purge` | public | `Authorization: Bearer CRON_SECRET` | Returns 503 if secret missing. |
| `/api/cron/digest` | public | `Authorization: Bearer CRON_SECRET` | PR-03 work should preserve this contract. |
| `/api/billing/webhook` | public | Stripe HMAC | No Clerk session expected on webhooks. |
| `/api/billing/checkout` | public | rate limit + Stripe config | Public funnel route; tenant fallback is intentional for anonymous pricing checkout. |
| `/api/voice/incoming` | public | Twilio signature when configured + `resolveTwilioTenant()` | Must never fall back to an arbitrary tenant for real inbound calls. |
| `/api/sms/incoming` | public | Twilio signature when configured + `resolveTwilioTenant()` | Owner data only goes to the owner's configured phone. |
| `/api/voice/context` and `/api/voice/complete` | public | `REALTIME_SHARED_SECRET` in production | Used by long-lived realtime/relay services. |
| `/api/mobile/*` | public | route-level mobile auth | Store readiness remains blocked until native user auth exists. |

## Current Local Results

- `npm run typecheck`: PASS
- `npm test`: PASS
- `npm run build`: PASS
- `npm run demo:check`: local READY, commercial preview NOT READY without verified Postgres
- `npm run mobile:check`: structure READY, store submission NOT READY because native auth is not complete
- `npm audit --omit=dev`: 0 vulnerabilities
- `npm run pilot:check`: FAIL locally because `DATABASE_URL` points to `localhost:5432` and no Postgres server is reachable

## Operational Notes

- `allomaude.ca` and `www.allomaude.ca` resolved and answered over HTTPS during the integration pass.
- `allomaude.com` and `www.allomaude.com` were still NXDOMAIN during the integration pass.
- Do not move Twilio webhooks, Clerk production URLs, or `SCALY_PUBLIC_URL` to a brand domain until that exact hostname resolves publicly and Vercel reports it configured.
- ConversationRelay is A/B only: it requires `SCALY_VOICE_ENGINE=relay` and `SCALY_RELAY_WS_URL`. Removing the flag returns the app to the champion voice path.

## PR-03 Review Checklist

When Co-work delivers PR-03, verify:

- no tenant fallback in voice/SMS webhooks;
- idempotent SMS actions per call/action;
- contact-hour rules are respected for non-urgent client SMS;
- revocation/refusal consent states stop follow-up;
- owner SMS can include operational data, third-party SMS cannot;
- `CRON_SECRET`, Twilio signature, and route-level guards remain intact;
- no false READY/Verified language was introduced.
