# WashDesk — Mini Laundry Order Management System

A lightweight full-stack web app for a dry cleaning store to create orders, track statuses, calculate billing, and view dashboard analytics.

---

## Setup Instructions

### Prerequisites
- Node.js v18+ installed

### Run locally

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start

# 3. Open in browser
http://localhost:3000
```

For development with auto-restart on file changes:
```bash
npm run dev
```

> Data is stored **in-memory**. Orders reset when the server restarts. See "Tradeoffs" for DB upgrade path.

---

## Features Implemented

### Core
- **Create Order** — Customer name, phone, garments (type + qty), auto-calculated total, unique Order ID (WD1001, WD1002...)
- **Order Status Management** — RECEIVED → PROCESSING → READY → DELIVERED; inline update from table or detail modal
- **View Orders** — Full orders table with search (name/phone/ID), filter by status, filter by garment type
- **Basic Dashboard** — Total orders, total revenue, today's orders + revenue, orders per status, recent orders list

### Bonus
- **Frontend UI** — Full responsive single-page app with sidebar navigation
- **Estimated Delivery Date** — Auto-calculated (2 days standard, 3 days for Sarees/Suits/Curtains/Blazers)
- **Order Detail Modal** — Full itemized receipt with inline status update
- **Delete Orders** — Remove orders from the system
- **Price List** — Visible in sidebar, loaded from API
- **Demo Data** — 5 seeded orders on startup to populate the dashboard

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/prices` | Get garment price config |
| POST | `/api/orders` | Create a new order |
| GET | `/api/orders` | List orders (supports `?search=`, `?status=`, `?garment=`) |
| GET | `/api/orders/:id` | Get single order |
| PATCH | `/api/orders/:id/status` | Update order status |
| DELETE | `/api/orders/:id` | Delete order |
| GET | `/api/dashboard` | Dashboard stats |

### Example: Create Order
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Rahul Verma",
    "phone": "9876543210",
    "garments": [
      { "name": "Shirt", "qty": 3 },
      { "name": "Pants", "qty": 2 }
    ]
  }'
```

### Example: Update Status
```bash
curl -X PATCH http://localhost:3000/api/orders/WD1001/status \
  -H "Content-Type: application/json" \
  -d '{ "status": "READY" }'
```

---

## Price Configuration

Prices are hardcoded in `src/server.js` (easy to move to a DB or config file):

| Garment | Price |
|---------|-------|
| Shirt | ₹50 |
| Pants | ₹60 |
| Saree | ₹120 |
| Suit | ₹200 |
| Jacket | ₹150 |
| Kurta | ₹80 |
| Dress | ₹100 |
| Blazer | ₹180 |
| Bedsheet | ₹90 |
| Curtain | ₹150 |

---

## AI Usage Report

### Tools Used
- **Claude (Anthropic)** — primary tool for scaffolding, UI design, and code generation

### Sample Prompts Used
- *"Build a Node.js Express server with in-memory storage for a laundry order management system with routes for create, list, update status, delete, and dashboard stats"*
- *"Build a modern dark-themed management UI for this backend — warm industrial aesthetic with charcoal + amber palette, sidebar nav, stat cards, and a filterable orders table"*
- *"Add inline status update dropdowns, order detail modal with itemized receipt, estimated delivery date logic"*

### What AI Got Right
- Full Express server structure with validation in one pass
- Responsive HTML/CSS layout with consistent design tokens
- Filter logic for the orders list (search + status + garment type)
- Dashboard stats aggregation

### What I Had to Fix / Improve
- Corrected the `grid-template-columns` overflow bug in responsive mode (needed `minmax(0, 1fr)` not `1fr`)
- Adjusted the garment-row layout to keep calc column from overflowing on small widths
- Added `position: sticky` to topbar and sidebar after noticing scroll behavior
- Tweaked the demo seed data to have realistic spread across statuses and dates

---

## Tradeoffs

### What was skipped
- **Authentication** — No login/auth. Would add JWT + bcrypt with a users table for prod
- **Persistent DB** — In-memory only. MongoDB or SQLite would be a 1-file addition
- **Edit order** — Can update status but not garment details after creation
- **Pagination** — No pagination on the orders table (fine for a store with <1000 orders/day)
- **Input sanitization** — Basic validation only; a real app needs express-validator

### What I'd improve with more time
- **MongoDB integration** — `mongoose` model takes ~30 mins; swap `orders` array for `Order.find()`
- **Authentication** — Basic JWT auth with a hardcoded admin user
- **Order editing** — Allow adding/removing garments post-creation
- **Print receipt** — `window.print()` with a styled receipt view per order
- **Deploy** — Railway.app one-click deploy (already structured for it — just add `PORT` env var)
- **Real-time updates** — Socket.io for live dashboard refresh when a new order comes in
