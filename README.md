# CreditClub

A Shopify loyalty app that rewards customers with store credit (gift cards) on every purchase. Works across Admin, Storefront, Customer Accounts, POS, and Shopify Flow.

## Features

- **Automatic Store Credit**: Customers earn a configurable percentage of their order total as store credit
- **Loyalty Tiers**: Optional tier system (Level 1/2/3) with increasing credit percentages based on total spending
- **Gift Card Based**: Store credit is issued as Shopify gift cards — works natively at checkout and POS
- **Theme Editor Customizable**: Liquid blocks with full theme editor settings (colors, images, text)
- **Customer Account Page**: Profile block, order status block, and full rewards page in customer accounts
- **POS Extension**: Smart grid tile, modal, and customer details block for in-store staff
- **Shopify Flow**: Trigger ("Store credit earned") and Action ("Add store credit") for automation with review apps, referrals, etc.
- **Admin Dashboard**: Configure credit percentages, tiers, and view customer loyalty activity

## Architecture

```
loyalty-credits/
├── app/                          # React Router app (Admin backend)
│   ├── routes/
│   │   ├── app._index.tsx        # Settings page (credit %, tiers)
│   │   ├── app.customers.tsx     # Customer loyalty overview
│   │   ├── app.tsx               # App layout with Polaris
│   │   ├── webhooks.tsx          # ORDERS_PAID handler
│   │   └── flow-action.tsx       # Flow action endpoint
│   ├── loyalty.server.ts         # Core loyalty logic (gift cards, metafields)
│   ├── shopify.server.ts         # Shopify auth & config
│   └── db.server.ts              # Prisma database
├── extensions/
│   ├── loyalty-widget/           # Theme App Extension (Liquid)
│   │   └── blocks/
│   │       ├── loyalty-card.liquid
│   │       └── loyalty-banner.liquid
│   ├── loyalty-account/          # Customer Account UI Extension
│   │   └── src/
│   │       ├── ProfileBlock.jsx
│   │       ├── OrderStatusBlock.jsx
│   │       └── RewardsPage.jsx
│   ├── loyalty-pos/              # POS UI Extension
│   │   └── src/
│   │       ├── Tile.tsx
│   │       ├── Modal.tsx
│   │       ├── CustomerBlock.tsx
│   │       └── PostPurchaseBlock.tsx
│   ├── add-store-credit/         # Flow Action
│   └── store-credit-earned/      # Flow Trigger
├── prisma/
│   └── schema.prisma             # Session + LoyaltyLog models
└── shopify.app.toml              # App config
```

## Setup

### Prerequisites

- Node.js >= 20.0.0
- Shopify CLI >= 3.85
- A Shopify Partner account with a dev store

### Getting Started

```bash
# Install dependencies
npm install

# Set up database
npx prisma migrate dev

# Start development
shopify app dev
```

### Required Access Scopes

- `read_orders`, `write_orders`
- `read_customers`, `write_customers`
- `read_gift_cards`, `write_gift_cards`

### Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
SHOPIFY_APP_URL=your_app_url
DATABASE_URL=file:../prisma/dev.db
```

## How It Works

1. **Customer places an order** and it gets paid
2. The `ORDERS_PAID` webhook fires and the app:
   - Reads the loyalty config (credit percentage, tier settings)
   - Calculates the customer's tier based on total spending
   - Computes the credit amount (order total × tier percentage)
   - Creates or credits a gift card for the customer
   - Updates customer metafields (total earned, total spent)
   - Fires the "Store credit earned" Flow trigger
3. **The customer** can use their gift card balance at checkout or POS
4. **Shopify Flow** can also add credit via the "Add store credit" action

## Flow Integration

- **Trigger**: "Store credit earned" — fires after every purchase credit
- **Action**: "Add store credit to customer" — add credit from any Flow workflow
  - Use with review apps: "When review created → Add $5 store credit"
  - Use with referrals: "When referral completed → Add $10 store credit"

## Deployment

```bash
shopify app deploy
```

> **Note**: Requires PII approval for `read_customers` and `write_customers` scopes.
