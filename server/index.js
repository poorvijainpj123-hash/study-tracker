require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { Item, Milestone } = require('./models');

const app = express();
app.set('trust proxy', 1); // so secure cookies work behind Render's proxy
app.use(cors());
app.use(express.json());

const wrap = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    console.error(err);
    res.status(400).json({ error: err.message });
  });

const touch = (id) => Item.findByIdAndUpdate(id, { lastTouched: new Date() });
const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => k in obj).map((k) => [k, obj[k]]));

// ---- Password gate (single user) ----
const PASSWORD = process.env.APP_PASSWORD || '';
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

if (process.env.NODE_ENV === 'production' && !PASSWORD) {
  console.error('APP_PASSWORD is required in production.');
  process.exit(1);
}

const sign = (value) => crypto.createHmac('sha256', SECRET).update(value).digest('hex');
const same = (a, b) =>
  crypto.timingSafeEqual(
    crypto.createHash('sha256').update(String(a)).digest(),
    crypto.createHash('sha256').update(String(b)).digest()
  );
const makeToken = () => {
  const exp = String(Date.now() + SESSION_MS);
  return `${exp}.${sign(exp)}`;
};
const validToken = (token = '') => {
  const [exp, sig] = token.split('.');
  return Boolean(exp && sig) && Number(exp) > Date.now() && same(sig, sign(exp));
};
const readCookie = (req) => {
  const found = (req.headers.cookie || '').split(';').map((c) => c.trim()).find((c) => c.startsWith('session='));
  return found ? decodeURIComponent(found.slice(8)) : '';
};
const isAuthed = (req) => !PASSWORD || validToken(readCookie(req));
const cookie = (value, maxAgeSec, secure) =>
  `session=${encodeURIComponent(value)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSec}${secure ? '; Secure' : ''}`;

const attempts = new Map(); // ip -> { count, resetAt }

app.get('/api/session', (req, res) => res.json({ required: Boolean(PASSWORD), authenticated: isAuthed(req) }));

app.post('/api/login', (req, res) => {
  const now = Date.now();
  const found = attempts.get(req.ip);
  const record = found && found.resetAt > now ? found : { count: 0, resetAt: now + 15 * 60 * 1000 };
  if (record.count >= 10) return res.status(429).json({ error: 'Too many tries. Wait 15 minutes.' });
  if (!PASSWORD || !same((req.body && req.body.password) || '', PASSWORD)) {
    record.count += 1;
    attempts.set(req.ip, record);
    return res.status(401).json({ error: 'Wrong password' });
  }
  attempts.delete(req.ip);
  res.setHeader('Set-Cookie', cookie(makeToken(), SESSION_MS / 1000, req.secure));
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  res.setHeader('Set-Cookie', cookie('', 0, req.secure));
  res.json({ ok: true });
});

// Everything below this line needs a login
app.use('/api', (req, res, next) => (isAuthed(req) ? next() : res.status(401).json({ error: 'Not logged in' })));

// All items with their milestones, most recently touched first
app.get('/api/items', wrap(async (req, res) => {
  const [items, milestones] = await Promise.all([
    Item.find().sort({ lastTouched: -1 }).lean(),
    Milestone.find().sort({ order: 1 }).lean(),
  ]);
  const byItem = {};
  milestones.forEach((m) => (byItem[String(m.itemId)] ||= []).push(m));
  res.json(items.map((i) => ({ ...i, milestones: byItem[String(i._id)] || [] })));
}));

app.post('/api/items', wrap(async (req, res) => {
  const item = await Item.create(pick(req.body, ['title', 'kind']));
  res.status(201).json(item);
}));

app.patch('/api/items/:id', wrap(async (req, res) => {
  const update = { ...pick(req.body, ['title', 'kind', 'status', 'leftOffAt', 'links']), lastTouched: new Date() };
  const item = await Item.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json(item);
}));

app.delete('/api/items/:id', wrap(async (req, res) => {
  await Milestone.deleteMany({ itemId: req.params.id });
  await Item.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
}));

app.post('/api/items/:id/milestones', wrap(async (req, res) => {
  const count = await Milestone.countDocuments({ itemId: req.params.id });
  const milestone = await Milestone.create({ itemId: req.params.id, title: req.body.title, order: count });
  await touch(req.params.id);
  res.status(201).json(milestone);
}));

app.patch('/api/milestones/:id', wrap(async (req, res) => {
  const milestone = await Milestone.findByIdAndUpdate(
    req.params.id, pick(req.body, ['title', 'done', 'note']), { new: true, runValidators: true });
  if (!milestone) return res.status(404).json({ error: 'Milestone not found' });
  await touch(milestone.itemId);
  res.json(milestone);
}));

app.delete('/api/milestones/:id', wrap(async (req, res) => {
  const milestone = await Milestone.findByIdAndDelete(req.params.id);
  if (milestone) await touch(milestone.itemId);
  res.json({ ok: true });
}));

// In Docker, the built React app is served from here
const publicDir = path.join(__dirname, 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.get('*', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));
}

const port = process.env.PORT || 5000;
mongoose
  .connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/study-tracker')
  .then(() => app.listen(port, () => console.log(`API running on http://localhost:${port}`)))
  .catch((err) => {
    console.error('Could not connect to MongoDB:', err.message);
    process.exit(1);
  });