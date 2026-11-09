# SmartSpaza

SmartSpaza is a South African spaza-shop retail and payments demo built with React, TypeScript, Vite and the AppDeploy SDK.

## Features
- Retail inventory and expiry markdown workflows.
- Sales and shop performance reporting.
- Supplier management and demo supplier payments.
- Internal RLUSD demo transfers and demo funding flows.
- XRPL public-address lookup and separate on-chain balance display.
- South African language catalogue and interface bundles.
- Demo transaction history and payment status records.

## Demo and security boundaries
- Internal demo RLUSD balances are database ledger entries, not real RLUSD tokens.
- Demo card deposits do not charge a bank card or move real money.
- Real XRPL settlement requires a secure wallet signer, verified wallet ownership, a funded account, an RLUSD trust line and validated ledger checks.
- Never commit seed phrases, private keys, API secrets, access tokens, card numbers or CVVs.
- Biometric approval in a demo flow is not proof of biometric identity verification.

## Development
Install dependencies with `npm install`, then run `npm run dev`.
