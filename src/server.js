const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ─── In-Memory Store ────────────────────────────────────────────────────────
let orders = [];
let orderCounter = 1001;

// ─── Helpers ────────────────────────────────────────────────────────────────
const PRICES = {
  Shirt: 50, Pants: 60, Saree: 120, Suit: 200,
  Jacket: 150, Kurta: 80, Dress: 100, Blazer: 180,
  Bedsheet: 90, Curtain: 150
};

const VALID_STATUSES = ['RECEIVED', 'PROCESSING', 'READY', 'DELIVERED'];

function calcTotal(garments) {
  return garments.reduce((sum, g) => {
    const price = PRICES[g.name] || g.price || 0;
    return sum + price * g.qty;
  }, 0);
}

function estimateDelivery(garments) {
  const needsExtra = garments.some(g => ['Saree', 'Suit', 'Blazer', 'Curtain'].includes(g.name));
  const d = new Date();
  d.setDate(d.getDate() + (needsExtra ? 3 : 2));
  return d.toISOString().split('T')[0];
}

function generateId() {
  return 'WD' + (orderCounter++);
}

// ─── Seed some demo data ─────────────────────────────────────────────────────
function seedDemoData() {
  const demos = [
    { name: 'Priya Sharma', phone: '9876543210', garments: [{ name: 'Saree', qty: 2 }, { name: 'Blouse', qty: 3 }], status: 'DELIVERED' },
    { name: 'Rahul Verma', phone: '9812345678', garments: [{ name: 'Shirt', qty: 4 }, { name: 'Pants', qty: 2 }], status: 'READY' },
    { name: 'Anjali Mehta', phone: '9001234567', garments: [{ name: 'Suit', qty: 1 }, { name: 'Shirt', qty: 2 }], status: 'PROCESSING' },
    { name: 'Deepak Gupta', phone: '8765432109', garments: [{ name: 'Kurta', qty: 3 }, { name: 'Jacket', qty: 1 }], status: 'RECEIVED' },
    { name: 'Sneha Patel', phone: '9654321098', garments: [{ name: 'Dress', qty: 2 }, { name: 'Blazer', qty: 1 }], status: 'PROCESSING' },
  ];
  demos.forEach((d, i) => {
    const garments = d.garments.map(g => ({ ...g, price: PRICES[g.name] || 80 }));
    const created = new Date();
    created.setDate(created.getDate() - (5 - i));
    orders.push({
      id: generateId(),
      name: d.name,
      phone: d.phone,
      garments,
      total: calcTotal(garments),
      status: d.status,
      delivery: estimateDelivery(garments),
      createdAt: created.toISOString(),
      updatedAt: created.toISOString(),
    });
  });
}
seedDemoData();

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET /api/prices — returns price config
app.get('/api/prices', (req, res) => {
  res.json({ prices: PRICES });
});

// POST /api/orders — create order
app.post('/api/orders', (req, res) => {
  const { name, phone, garments } = req.body;

  if (!name || !name.trim()) return res.status(400).json({ error: 'Customer name is required' });
  if (!phone || !/^\d{10}$/.test(phone)) return res.status(400).json({ error: 'Valid 10-digit phone number required' });
  if (!garments || !Array.isArray(garments) || garments.length === 0)
    return res.status(400).json({ error: 'At least one garment is required' });

  const enrichedGarments = garments.map(g => ({
    name: g.name,
    qty: parseInt(g.qty) || 1,
    price: PRICES[g.name] || g.price || 0,
  }));

  const order = {
    id: generateId(),
    name: name.trim(),
    phone,
    garments: enrichedGarments,
    total: calcTotal(enrichedGarments),
    status: 'RECEIVED',
    delivery: estimateDelivery(enrichedGarments),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  orders.push(order);
  res.status(201).json({ success: true, order });
});

// GET /api/orders — list with filters
app.get('/api/orders', (req, res) => {
  const { status, search, garment } = req.query;
  let result = [...orders];

  if (status && VALID_STATUSES.includes(status.toUpperCase())) {
    result = result.filter(o => o.status === status.toUpperCase());
  }
  if (search) {
    const q = search.toLowerCase();
    result = result.filter(o =>
      o.name.toLowerCase().includes(q) || o.phone.includes(q) || o.id.toLowerCase().includes(q)
    );
  }
  if (garment) {
    const g = garment.toLowerCase();
    result = result.filter(o => o.garments.some(x => x.name.toLowerCase().includes(g)));
  }

  res.json({ orders: result.reverse(), total: result.length });
});

// GET /api/orders/:id — single order
app.get('/api/orders/:id', (req, res) => {
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json({ order });
});

// PATCH /api/orders/:id/status — update status
app.patch('/api/orders/:id/status', (req, res) => {
  const { status } = req.body;
  if (!status || !VALID_STATUSES.includes(status.toUpperCase()))
    return res.status(400).json({ error: 'Invalid status. Must be one of: ' + VALID_STATUSES.join(', ') });

  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  order.status = status.toUpperCase();
  order.updatedAt = new Date().toISOString();
  res.json({ success: true, order });
});

// DELETE /api/orders/:id — remove order
app.delete('/api/orders/:id', (req, res) => {
  const idx = orders.findIndex(o => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Order not found' });
  orders.splice(idx, 1);
  res.json({ success: true });
});

// GET /api/dashboard — stats
app.get('/api/dashboard', (req, res) => {
  const counts = { RECEIVED: 0, PROCESSING: 0, READY: 0, DELIVERED: 0 };
  orders.forEach(o => { if (counts[o.status] !== undefined) counts[o.status]++; });

  const today = new Date().toISOString().split('T')[0];
  const todayOrders = orders.filter(o => o.createdAt.startsWith(today));

  res.json({
    total: orders.length,
    revenue: orders.reduce((s, o) => s + o.total, 0),
    todayOrders: todayOrders.length,
    todayRevenue: todayOrders.reduce((s, o) => s + o.total, 0),
    byStatus: counts,
    recentOrders: [...orders].reverse().slice(0, 5),
  });
});

// Catch-all → serve frontend
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`WashDesk running at http://localhost:${PORT}`));
