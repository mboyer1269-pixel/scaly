# Allô Maude DNS Runbook

Canonical domain: `allomaude.ca`

## Current Routing

`allomaude.ca` is the public brand domain. `www.allomaude.ca`, `allomaude.com`, and `www.allomaude.com` should redirect to `https://allomaude.ca`.

Do not move Twilio webhooks, Clerk production URLs, or `SCALY_PUBLIC_URL` to a brand domain until that exact hostname resolves publicly and responds over HTTPS.

## Registrar Records

Use Vercel DNS nameservers when possible:

- `ns1.vercel-dns.com`
- `ns2.vercel-dns.com`

If using A records instead, set the apex domains to Vercel's apex target:

- `allomaude.ca` -> `76.76.21.21`
- `allomaude.com` -> `76.76.21.21`

For `www`, prefer CNAME records to the Vercel-provided target for the project. If the registrar does not support CNAME flattening, verify the exact record in Vercel before changing production URLs.

## Verification

```powershell
Resolve-DnsName allomaude.ca
Resolve-DnsName www.allomaude.ca
Resolve-DnsName allomaude.com
Resolve-DnsName www.allomaude.com

Invoke-WebRequest https://allomaude.ca -Method Head
Invoke-WebRequest https://www.allomaude.ca -Method Head -MaximumRedirection 0
```

Expected before switching operational URLs:

- apex and `www` resolve publicly;
- HTTPS responds without certificate errors;
- Vercel shows the domains as configured;
- `/api/health` returns successfully on the intended production host;
- Twilio signature validation is retested after any `SCALY_PUBLIC_URL` change.
