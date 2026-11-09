SmartSpaza 

A South African spaza-shop retail and payments demo — built with React, TypeScript, Vite, and the AppDeploy SDK.

---

What is SmartSpaza?

SmartSpaza is a hands-on demo that puts the everyday rhythm of a South African spaza shop into a modern web app. From tracking stock and marking down expiring goods to managing suppliers and exploring demo payment flows, it's a sandbox for the retail and payments ideas that matter most to township and community commerce.

Think of it as a working sketchbook: realistic enough to show how the pieces fit together, clearly scoped enough that nobody mistakes a demo for a live financial system.

---

Features

· Retail inventory & expiry markdown workflows — keep shelves honest and waste low.
· Sales & shop performance reporting — see how the shop is actually doing.
· Supplier management & demo supplier payments — organise the people behind the products.
· Internal RLUSD demo transfers & funding flows — explore stablecoin-style flows safely.
· XRPL public-address lookup — with a separate on-chain balance display.
· South African language catalogue & interface bundles — because local means local.
· Demo transaction history & payment status records — follow the money (the demo money, that is).

---

Demo and security boundaries

Read these carefully — they define what this project is and is not:

· Internal demo RLUSD balances are database ledger entries, not real RLUSD tokens.
· Demo card deposits do not charge a bank card or move real money.
· Real XRPL settlement requires a secure wallet signer, verified wallet ownership, a funded account, an RLUSD trust line, and validated ledger checks.
· Never commit seed phrases, private keys, API secrets, access tokens, card numbers, or CVVs.
· Biometric approval in a demo flow is not proof of biometric identity verification.

In short: this is a demonstration environment. Treat every balance, payment, and approval as a simulation unless and until real settlement infrastructure is deliberately and securely integrated.

---

Development

Get up and running in two steps:

```bash
npm install
npm run dev
```

Then open the local URL Vite prints in your terminal and start exploring.

---

A note on scope

SmartSpaza is designed to be interesting to explore and honest about its limits. It's a place to prototype retail workflows, payments UX, and localisation — not a production payment processor. If you're building toward real settlement, the security boundaries above are your starting checklist.

---

Built for the spaza shop around the corner. 🇿🇦
