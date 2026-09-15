const bcrypt = require('bcryptjs');
const { runQuery, getQuery } = require('../../db');
const { generateToken } = require('../config/jwt');

const text = (value, max = 200) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const normalizePhone = value => text(value, 30).replace(/\D/g, '');
const validEmail = value => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

async function loginByRole(req, res, role) {
  const identifier = text(req.body.email || req.body.phone || req.body.identifier || req.body.username, 254);
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!identifier || !password) return res.status(400).json({ error: 'Identificação e senha são obrigatórias.' });

  try {
    const isEmail = identifier.includes('@');
    const user = isEmail
      ? await getQuery('SELECT * FROM users WHERE email = ? COLLATE NOCASE AND role = ?', [identifier, role])
      : await getQuery('SELECT * FROM users WHERE phone = ? AND role = ?', [normalizePhone(identifier), role]);
    const validPassword = user ? await bcrypt.compare(password, user.password) : await bcrypt.compare(password, '$2a$10$wBWWO3T7s4oMLfwIqhxkeOGKXGzvWOt1V5aVbdAEYzY6yjxb4q4Zq');
    if (!user || !validPassword) return res.status(401).json({ error: 'Credenciais inválidas.' });

    delete user.password;
    const store = await getQuery('SELECT * FROM store_info LIMIT 1');
    return res.json({ success: true, token: generateToken(user), user, store });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Erro interno ao realizar login.' });
  }
}

const loginManager = (req, res) => loginByRole(req, res, 'admin');
const loginCustomer = (req, res) => loginByRole(req, res, 'user');

async function registerCustomer(req, res) {
  const fullname = text(req.body.fullname || req.body.name, 120);
  const phone = normalizePhone(req.body.phone);
  const email = text(req.body.email, 254).toLowerCase() || null;
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const address = text(req.body.address, 250);
  const bairro = text(req.body.bairro, 100);
  const city = text(req.body.city, 100);

  if (fullname.length < 3 || phone.length < 10 || phone.length > 13) return res.status(400).json({ error: 'Informe nome completo e WhatsApp válido.' });
  if (!validEmail(email)) return res.status(400).json({ error: 'E-mail inválido.' });
  if (password.length < 8 || password.length > 128) return res.status(400).json({ error: 'A senha deve ter entre 8 e 128 caracteres.' });

  try {
    const exists = await getQuery('SELECT id FROM users WHERE phone = ? OR (? IS NOT NULL AND email = ? COLLATE NOCASE)', [phone, email, email]);
    if (exists) return res.status(409).json({ error: 'WhatsApp ou e-mail já cadastrado.' });
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await runQuery(`INSERT INTO users (fullname, phone, email, address, bairro, city, password, role)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'user')`, [fullname, phone, email, address, bairro, city, passwordHash]);
    const user = await getQuery('SELECT id, fullname, phone, email, address, bairro, city, role FROM users WHERE id = ?', [result.lastID]);
    const store = await getQuery('SELECT * FROM store_info LIMIT 1');
    return res.status(201).json({ success: true, token: generateToken(user), user, store });
  } catch (error) {
    console.error('Customer registration error:', error);
    return res.status(500).json({ error: 'Erro ao cadastrar cliente.' });
  }
}

async function getStoreInfo(req, res) {
  try {
    const store = await getQuery(`SELECT name, phone, email, address, bairro, city, state,
      delivery_radius_km, initial_delivery_fee, min_order_value FROM store_info LIMIT 1`);
    return res.json({ store });
  } catch { return res.status(500).json({ error: 'Erro ao carregar dados da loja.' }); }
}

async function updateStoreInfo(req, res) {
  const deliveryFee = Number(req.body.initial_delivery_fee);
  const minOrder = Number(req.body.min_order_value);
  const phone = normalizePhone(req.body.phone);
  if (!Number.isFinite(deliveryFee) || deliveryFee < 0 || deliveryFee > 100) return res.status(400).json({ error: 'Taxa de entrega inválida.' });
  if (!Number.isFinite(minOrder) || minOrder < 0 || minOrder > 10000) return res.status(400).json({ error: 'Pedido mínimo inválido.' });
  if (phone.length < 10 || phone.length > 13) return res.status(400).json({ error: 'WhatsApp inválido.' });
  try {
    await runQuery('UPDATE store_info SET initial_delivery_fee = ?, min_order_value = ?, phone = ? WHERE id = (SELECT id FROM store_info LIMIT 1)', [deliveryFee, minOrder, phone]);
    const store = await getQuery('SELECT * FROM store_info LIMIT 1');
    return res.json({ success: true, store });
  } catch { return res.status(500).json({ error: 'Erro ao salvar configurações.' }); }
}

module.exports = { loginManager, loginCustomer, registerCustomer, getStoreInfo, updateStoreInfo };
