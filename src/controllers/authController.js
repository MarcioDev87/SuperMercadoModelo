const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { runQuery, getQuery } = require('../../db');
const { generateToken } = require('../config/jwt');

async function loginManager(req, res) {
  const { email, phone, password } = req.body;
  const identifier = (email || phone || '').trim();

  if (!identifier || !password) {
    return res.status(400).json({ error: 'Usuário/E-mail e senha são obrigatórios.' });
  }

  try {
    const isEmail = identifier.includes('@');
    const user = isEmail
      ? await getQuery("SELECT * FROM users WHERE email = ? COLLATE NOCASE", [identifier])
      : await getQuery("SELECT * FROM users WHERE phone = ?", [identifier.replace(/\D/g, '')]);

    if (!user || user.role !== 'admin') {
      return res.status(401).json({ error: 'Credenciais inválidas ou acesso não autorizado como gestor.' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Senha incorreta.' });
    }

    delete user.password;
    const store = await getQuery("SELECT * FROM store_info LIMIT 1");
    const token = generateToken(user);

    return res.json({
      success: true,
      message: 'Bem-vindo ao Painel do Super Mercado Modelo!',
      token,
      user,
      store
    });
  } catch (err) {
    console.error('Manager Login Error:', err);
    return res.status(500).json({ error: 'Erro interno ao realizar login do gestor.' });
  }
}

async function loginCustomer(req, res) {
  const { email, phone, identifier, username, password } = req.body;
  const rawIdentifier = (identifier || email || phone || username || '').trim();

  if (!rawIdentifier || !password) {
    return res.status(400).json({ error: 'WhatsApp ou E-mail e senha são obrigatórios.' });
  }

  try {
    const isEmail = rawIdentifier.includes('@');
    const cleanPhone = rawIdentifier.replace(/\D/g, '');
    const user = isEmail
      ? await getQuery("SELECT * FROM users WHERE email = ? COLLATE NOCASE", [rawIdentifier])
      : await getQuery("SELECT * FROM users WHERE phone = ? OR phone = ?", [cleanPhone, rawIdentifier]);

    if (!user) {
      return res.status(401).json({ error: 'Cadastro não encontrado no Super Mercado Modelo.' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Senha incorreta.' });
    }

    delete user.password;
    const token = generateToken(user);
    const store = await getQuery("SELECT * FROM store_info LIMIT 1");

    return res.json({
      success: true,
      message: 'Login realizado com sucesso no Super Mercado Modelo!',
      token,
      user,
      store
    });
  } catch (err) {
    console.error('Customer Login Error:', err);
    return res.status(500).json({ error: 'Erro ao autenticar cliente.' });
  }
}

async function registerCustomer(req, res) {
  const fullname = req.body.fullname || req.body.name;
  const { phone, email, address, bairro, city, password } = req.body;
  const cleanPhone = (phone || '').replace(/\D/g, '');

  if (!fullname || !cleanPhone || !password || password.length < 6) {
    return res.status(400).json({ error: 'Nome, WhatsApp e senha de no mínimo 6 dígitos são obrigatórios.' });
  }

  try {
    const exists = await getQuery("SELECT id FROM users WHERE phone = ?", [cleanPhone]);
    if (exists) {
      return res.status(400).json({ error: 'Este WhatsApp já está cadastrado no Super Mercado Modelo.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await runQuery(`
      INSERT INTO users (fullname, phone, email, address, bairro, city, password, role)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'user')
    `, [
      fullname.trim(),
      cleanPhone,
      email ? email.trim().toLowerCase() : null,
      address || 'Av. Principal, 1000',
      bairro || 'Centro',
      city || 'Cascavel - CE',
      passwordHash
    ]);

    const createdUser = await getQuery("SELECT id, fullname, phone, email, address, bairro, city, role FROM users WHERE id = ?", [result.lastID]);
    const token = generateToken(createdUser);
    const store = await getQuery("SELECT * FROM store_info LIMIT 1");

    return res.status(201).json({
      success: true,
      message: 'Cadastro realizado com sucesso!',
      token,
      user: createdUser,
      store
    });
  } catch (err) {
    console.error('Customer Registration Error:', err);
    return res.status(500).json({ error: 'Erro ao cadastrar cliente.' });
  }
}

async function getStoreInfo(req, res) {
  try {
    const store = await getQuery("SELECT * FROM store_info LIMIT 1");
    return res.json({ store });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao carregar dados da loja.' });
  }
}

module.exports = {
  loginManager,
  loginCustomer,
  registerCustomer,
  getStoreInfo
};
