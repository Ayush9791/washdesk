const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ─── Config ──────────────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'washdesk-super-secret-2024';
const JWT_EXPIRES = '8h';

// ─── Users (hardcoded; swap for DB in prod) ───────────────────────────────────
const USERS = [
  { id: 1, username: 'admin', passwordHash: bcrypt.hashSync('admin123', 10), role: 'admin', name: 'Admin User' },
  { id: 2, username: 'staff', passwordHash: bcrypt.hashSync('staff123', 10), role: 'staff', name: 'Staff Member' },
];

// ─── Store ────────────────────────────────────────────────────────────────────
let orders = [];
let orderCounter = 1001;

const PRICES = {
  Shirt: 50, Pants: 60, Saree: 120, Suit: 200,
  Jacket: 150, Kurta: 80, Dress: 100, Blazer: 180,
  Bedsheet: 90, Curtain: 150,
};
const VALID_STATUSES = ['RECEIVED', 'PROCESSING', 'READY', 'DELIVERED'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function calcTotal(g) { return g.reduce((s, x) => s + (PRICES[x.name] || x.price || 0) * x.qty, 0); }
function estimateDelivery(g) {
  const d = new Date();
  d.setDate(d.getDate() + (g.some(x => ['Saree','Suit','Blazer','Curtain'].includes(x.name)) ? 3 : 2));
  return d.toISOString().split('T')[0];
}
function generateId() { return 'WD' + (orderCounter++); }
function dateOffset(daysBack) {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  // randomise hour so daily grouping looks natural
  d.setHours(Math.floor(Math.random() * 12) + 8);
  return d.toISOString();
}

// ─── Seed Data ────────────────────────────────────────────────────────────────
function seedDemoData() {
  const names = ['Priya Sharma','Rahul Verma','Anjali Mehta','Deepak Gupta','Sneha Patel',
    'Vikram Singh','Meera Nair','Arjun Das','Kavita Rao','Suresh Kumar',
    'Neha Joshi','Rohan Malik','Pooja Iyer','Amit Choudhary','Sunita Reddy',
    'Karan Kapoor','Ritika Sinha','Manoj Tiwari','Divya Pandey','Sanjay Shah'];
  const phones = ['9876543210','9812345678','9001234567','8765432109','9654321098',
    '9123456780','8901234567','9345678901','8123456789','9567890123',
    '8345678901','9789012345','8567890123','9901234567','8123490567',
    '9345012678','8901456723','9567234890','8123789456','9456012378'];
  const garmentSets = [
    [{name:'Shirt',qty:3},{name:'Pants',qty:2}],
    [{name:'Saree',qty:2},{name:'Kurta',qty:2}],
    [{name:'Suit',qty:1},{name:'Shirt',qty:2}],
    [{name:'Kurta',qty:4}],
    [{name:'Dress',qty:2},{name:'Jacket',qty:1}],
    [{name:'Blazer',qty:1},{name:'Pants',qty:2}],
    [{name:'Bedsheet',qty:3}],
    [{name:'Curtain',qty:2}],
    [{name:'Shirt',qty:5}],
    [{name:'Saree',qty:1},{name:'Kurta',qty:2}],
    [{name:'Suit',qty:2},{name:'Blazer',qty:1}],
    [{name:'Dress',qty:3},{name:'Shirt',qty:1}],
    [{name:'Pants',qty:3},{name:'Jacket',qty:1}],
    [{name:'Saree',qty:3}],
    [{name:'Shirt',qty:2},{name:'Kurta',qty:2}],
  ];
  const statusPool = ['DELIVERED','DELIVERED','DELIVERED','DELIVERED','READY','PROCESSING','RECEIVED'];

  for (let i = 0; i < 150; i++) {
    const daysBack = Math.floor(Math.random() * 365);
    const gs = garmentSets[i % garmentSets.length];
    const garments = gs.map(g => ({ ...g, price: PRICES[g.name] || 80 }));
    const createdAt = dateOffset(daysBack);
    const status = daysBack < 2
      ? statusPool[Math.floor(Math.random() * 3) + 4]
      : statusPool[Math.floor(Math.random() * 4)];
    orders.push({
      id: generateId(), name: names[i % names.length], phone: phones[i % phones.length],
      garments, total: calcTotal(garments), status,
      delivery: estimateDelivery(garments),
      createdAt, updatedAt: createdAt, createdBy: 'admin',
    });
  }
}
seedDemoData();

// ─── Auth Middleware ──────────────────────────────────────────────────────────
function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer '))
    return res.status(401).json({ error: 'Authentication required' });
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}

// ─── Auth Routes ──────────────────────────────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  const user = USERS.find(u => u.username === username);
  if (!user || !bcrypt.compareSync(password, user.passwordHash))
    return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, name: user.name },
    JWT_SECRET, { expiresIn: JWT_EXPIRES }
  );
  res.json({ token, user: { id: user.id, username: user.username, role: user.role, name: user.name } });
});

app.get('/api/auth/me', authenticate, (req, res) => res.json({ user: req.user }));
app.post('/api/auth/logout', authenticate, (req, res) => res.json({ success: true }));

// ─── Prices ───────────────────────────────────────────────────────────────────
app.get('/api/prices', authenticate, (req, res) => res.json({ prices: PRICES }));

// ─── Orders ───────────────────────────────────────────────────────────────────
app.post('/api/orders', authenticate, (req, res) => {
  const { name, phone, garments } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Customer name is required' });
  if (!/^\d{10}$/.test(phone)) return res.status(400).json({ error: 'Valid 10-digit phone required' });
  if (!Array.isArray(garments) || !garments.length) return res.status(400).json({ error: 'At least one garment required' });
  const enriched = garments.map(g => ({ name: g.name, qty: parseInt(g.qty)||1, price: PRICES[g.name]||g.price||0 }));
  const order = {
    id: generateId(), name: name.trim(), phone, garments: enriched,
    total: calcTotal(enriched), status: 'RECEIVED',
    delivery: estimateDelivery(enriched),
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    createdBy: req.user.username,
  };
  orders.push(order);
  res.status(201).json({ success: true, order });
});

app.get('/api/orders', authenticate, (req, res) => {
  const { status, search, garment } = req.query;
  let result = [...orders];
  if (status && VALID_STATUSES.includes(status.toUpperCase()))
    result = result.filter(o => o.status === status.toUpperCase());
  if (search) {
    const q = search.toLowerCase();
    result = result.filter(o => o.name.toLowerCase().includes(q) || o.phone.includes(q) || o.id.toLowerCase().includes(q));
  }
  if (garment) result = result.filter(o => o.garments.some(x => x.name.toLowerCase().includes(garment.toLowerCase())));
  res.json({ orders: result.reverse(), total: result.length });
});

app.get('/api/orders/:id', authenticate, (req, res) => {
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json({ order });
});

app.patch('/api/orders/:id/status', authenticate, (req, res) => {
  const { status } = req.body;
  if (!VALID_STATUSES.includes(status?.toUpperCase())) return res.status(400).json({ error: 'Invalid status' });
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  order.status = status.toUpperCase();
  order.updatedAt = new Date().toISOString();
  res.json({ success: true, order });
});

app.delete('/api/orders/:id', authenticate, requireAdmin, (req, res) => {
  const idx = orders.findIndex(o => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Order not found' });
  orders.splice(idx, 1);
  res.json({ success: true });
});

// ─── Dashboard ────────────────────────────────────────────────────────────────
app.get('/api/dashboard', authenticate, (req, res) => {
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

// ─── Stats ────────────────────────────────────────────────────────────────────
app.get('/api/stats', authenticate, (req, res) => {
  const now = new Date();
  const currentYear = now.getFullYear();

  // Monthly (current year)
  const monthlyData = Array.from({ length: 12 }, (_, i) => ({
    month: new Date(currentYear, i).toLocaleString('en-IN', { month: 'short' }),
    revenue: 0, orders: 0,
  }));
  orders.filter(o => new Date(o.createdAt).getFullYear() === currentYear)
    .forEach(o => {
      const m = new Date(o.createdAt).getMonth();
      monthlyData[m].revenue += o.total;
      monthlyData[m].orders += 1;
    });

  // Daily last 30 days
  const dailyMap = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString('en-IN', { day:'2-digit', month:'short' });
    dailyMap[key] = { date: key, label, revenue: 0, orders: 0 };
  }
  orders.forEach(o => {
    const key = o.createdAt.split('T')[0];
    if (dailyMap[key]) { dailyMap[key].revenue += o.total; dailyMap[key].orders += 1; }
  });
  const dailyData = Object.values(dailyMap);

  // Garment breakdown
  const garmentMap = {};
  orders.forEach(o => o.garments.forEach(g => {
    if (!garmentMap[g.name]) garmentMap[g.name] = { name: g.name, qty: 0, revenue: 0, orders: 0 };
    garmentMap[g.name].qty += g.qty;
    garmentMap[g.name].revenue += g.price * g.qty;
    garmentMap[g.name].orders += 1;
  }));
  const garmentStats = Object.values(garmentMap).sort((a, b) => b.revenue - a.revenue);

  // Yearly comparison
  const yearlyComparison = [currentYear, currentYear - 1].map(yr => ({
    year: yr,
    revenue: orders.filter(o => new Date(o.createdAt).getFullYear() === yr).reduce((s, o) => s + o.total, 0),
    orders: orders.filter(o => new Date(o.createdAt).getFullYear() === yr).length,
  }));

  // Status counts
  const statusCounts = { RECEIVED: 0, PROCESSING: 0, READY: 0, DELIVERED: 0 };
  orders.forEach(o => { if (statusCounts[o.status] !== undefined) statusCounts[o.status]++; });

  // Top customers
  const custMap = {};
  orders.forEach(o => {
    if (!custMap[o.phone]) custMap[o.phone] = { name: o.name, phone: o.phone, orders: 0, revenue: 0 };
    custMap[o.phone].orders += 1; custMap[o.phone].revenue += o.total;
  });
  const topCustomers = Object.values(custMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  // KPIs
  const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
  const now_m = now.getMonth(), now_y = now.getFullYear();
  const last_m = now_m === 0 ? 11 : now_m - 1;
  const last_y = now_m === 0 ? now_y - 1 : now_y;
  const thisMonth = orders.filter(o => { const d = new Date(o.createdAt); return d.getMonth()===now_m && d.getFullYear()===now_y; });
  const lastMonth = orders.filter(o => { const d = new Date(o.createdAt); return d.getMonth()===last_m && d.getFullYear()===last_y; });

  res.json({
    kpis: {
      totalRevenue, totalOrders: orders.length,
      avgOrderValue: orders.length ? Math.round(totalRevenue / orders.length) : 0,
      thisMonthRevenue: thisMonth.reduce((s,o)=>s+o.total,0), thisMonthOrders: thisMonth.length,
      lastMonthRevenue: lastMonth.reduce((s,o)=>s+o.total,0), lastMonthOrders: lastMonth.length,
      bestGarment: garmentStats[0] || null,
      currentYear,
    },
    monthlyData, dailyData, garmentStats, yearlyComparison, statusCounts, topCustomers,
  });
});

// ─── Catch-all ────────────────────────────────────────────────────────────────
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`WashDesk running at http://localhost:${PORT}`));
