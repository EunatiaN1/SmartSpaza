# SmartSpaza

### Smarter Spaza Shop Management. Safer Food. Less Waste.

## Project Overview

SmartSpaza is a digital shop-management and supply-chain coordination platform designed to support spaza shop owners and informal retailers. It brings together inventory management, food-expiry monitoring, sales reporting, supplier coordination, and demonstration digital-payment workflows.

A central purpose of SmartSpaza is to help address the risks associated with expired food remaining on shop shelves. In busy small retail environments, manually tracking the expiry dates of many products can be difficult. When expired products are not identified and removed in time, consumers may be exposed to food-safety risks, including foodborne illness.

SmartSpaza is designed to help retailers act before products expire: it flags products seven days before their recorded expiry date so they can be considered for discounted sale while still within their permitted sale period. On the recorded expiry date, the product is flagged for disposal and must be removed from sale. Disposal is recorded and the quantity is deducted from available inventory.

Alongside this food-safety focus, SmartSpaza aims to give small retailers practical tools to manage stock, record sales, understand business performance, coordinate with suppliers, and explore digital payment options.

## The Problems We Aim to Address

- **Food-safety risks:** Products can remain on shelves past their expiry dates when expiry monitoring is inconsistent.
- **Preventable food waste:** Products approaching expiry may go unsold and eventually need to be discarded.
- **Unreliable stock visibility:** Retailers may not have an accurate, up-to-date view of available inventory.
- **Manual sales administration:** Paper-based or informal records can make it difficult to track sales and business performance.
- **Supplier coordination:** Managing stock requirements, supplier information, and payments can be time-consuming.
- **Limited access to digital tools:** Small retailers need practical and accessible systems to support day-to-day business operations.

## Core Features

### 1. Food Expiry Management and Food Safety

Food safety and responsible expiry management are central to SmartSpaza.

The intended expiry workflow is:

1. **Track expiry dates:** Retailers record the expiry date for each applicable product or batch.
2. **Flag products seven days before expiry:** Products approaching their recorded expiry date are highlighted for the retailer's attention.
3. **Encourage timely sales:** Eligible products can be offered at a discounted price before expiry, while they are still safe and permitted to be sold.
4. **Flag products on the expiry date:** On the recorded expiry date, the product is marked for disposal and must no longer be available for sale.
5. **Record disposal:** The retailer records the quantity disposed of, and that quantity is removed from available inventory.
6. **Maintain visibility:** Retailers can identify products approaching expiry, products requiring action, and products awaiting disposal.

**Food-safety safeguard:** Discounting is only an option before the recorded expiry date and does not override food-safety requirements. Products that have reached their expiry date must be blocked from sale and removed from saleable stock. The system supports responsible stock management; it does not replace proper food handling, storage, or compliance with applicable food-safety requirements.

### 2. Inventory Management

- Add and manage products and stock quantities.
- Update inventory when products are sold.
- Monitor available stock.
- Track products approaching expiry.
- Record expired, damaged, or otherwise disposed stock.
- Keep inventory quantities aligned with recorded sales and disposals.

### 3. Sales and Business Reporting

- Record the quantity of each product sold.
- Reduce inventory when sales are recorded.
- View weekly sales information.
- Compare current and previous sales periods.
- Review revenue and profit information where supported by recorded costs and sales data.

### 4. Supplier Management

- Maintain supplier information.
- Monitor stock requirements and supplier-related activity.
- Support supplier coordination and payment workflows.

### 5. Demonstration Digital Wallet and Payments

SmartSpaza includes a demonstration wallet experience for exploring digital payment workflows for small retailers.

The intended demonstration functionality includes:

- ZAR demo-wallet deposits and balances.
- RLUSD demo-wallet balances.
- ZAR-to-RLUSD conversion based on an applicable exchange rate rather than assuming a one-to-one conversion.
- RLUSD supplier-payment workflows.
- Transaction history for recorded demo deposits and payments.
- Demo card-payment records that do not charge a real card and retain only limited card details, such as the cardholder name and last four digits.

**Test environment:** Blockchain functionality is intended for the XRP Ledger (XRPL) Testnet only. The demonstration is not intended for real-money settlement or XRPL Mainnet transactions.

## Who Benefits

### Spaza shop owners and informal retailers
- Better visibility of stock and expiry dates.
- A practical process for discounting eligible products before expiry.
- A disposal record for expired stock.
- Easier sales tracking and business reporting.
- More organised supplier and payment workflows.

### Consumers and local communities
- Reduced risk of expired products being offered for sale.
- Support for safer food-retail practices.
- Potential access to discounted products before their expiry dates.

### Suppliers
- Improved coordination with participating retailers.
- Better visibility of retailer stock needs.
- More organised supplier-related workflows.

## Public Benefit and Social Impact

SmartSpaza is intended to create meaningful public benefit by addressing a practical community challenge: the safe management of food products in small and informal retail businesses.

Its potential public-benefit contributions include:

- **Protecting consumers:** Helping retailers identify and remove expired products from sale.
- **Reducing food waste:** Encouraging the timely sale of eligible products before expiry and recording products that must be disposed of.
- **Supporting small businesses:** Giving informal retailers accessible tools to manage inventory, sales, and suppliers.
- **Strengthening local economies:** Supporting more organised and informed day-to-day business decisions.
- **Promoting responsible retail practices:** Encouraging consistent expiry monitoring and stock accountability.

The project's intended impact is to contribute to healthier communities, less avoidable food waste, and more resilient local businesses. These are intended outcomes; their real-world impact will depend on adoption, accurate product data, and correct use of the system.

## Technology and Architecture

SmartSpaza is a web-based application. Its implementation may include:

- **Frontend:** React and related web technologies.
- **Authentication:** Privy integration.
- **Blockchain demonstration:** XRP Ledger Testnet.
- **Digital asset demonstration:** RLUSD.
- **Deployment:** AppDeploy.

The exact implementation and available integrations may evolve as the project develops. Refer to the application source code and configuration for the current technical details.

## Getting Started

### Prerequisites

- Node.js 18 or later.
- Git.
- npm.
- The environment variables required by the current application setup.

### Installation

Clone the repository:

\`\`\`bash
git clone https://github.com/EunatiaN1/SmartSpaza.git
\`\`\`

Move into the project directory:

\`\`\`bash
cd SmartSpaza
\`\`\`

Install dependencies:

\`\`\`bash
npm install
\`\`\`

Configure the required environment variables using the project's environment template or deployment instructions, then start the application using the development script defined in \`package.json\`.

## Development Priorities

SmartSpaza's ongoing priorities include:

1. Making the seven-day pre-expiry alert and discount workflow reliable.
2. Ensuring products are blocked from sale on their recorded expiry date.
3. Recording disposal quantities and keeping inventory accurate.
4. Keeping inventory, sales, and reports consistent.
5. Improving supplier coordination and payment tracking.
6. Strengthening the ZAR/RLUSD demonstration wallet while keeping blockchain activity on XRPL Testnet.
7. Making the platform practical and accessible for informal retailers.

## Contributing

Contributions, feedback, and suggestions are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Make and test your changes.
4. Submit a pull request explaining the changes.

Please keep food-safety safeguards in mind when contributing to expiry, discount, inventory, or disposal functionality.

## License

This project is licensed under the MIT License. See the \`LICENSE\` file for details.

---

**SmartSpaza — Smarter stock management. Safer food. Stronger local businesses.**
