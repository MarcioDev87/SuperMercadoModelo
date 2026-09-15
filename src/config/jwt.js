const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { getQuery } = require('../../db');

let developmentSecret;

function getJwtSecret() {
  const configured = process.env.JWT_SECRET;
  if (configured) {
    if (configured.length < 32) throw new Error('JWT_SECRET deve ter pelo menos 32 caracteres.');
    return configured;
  }
  if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET é obrigatório em produção.');
  developmentSecret ||= crypto.randomBytes(48).toString('base64url');
  return developmentSecret;
}

function generateToken(user) {
  return jwt.sign({ sub: String(user.id), role: user.role }, getJwtSecret(), {
    expiresIn: '8h', issuer: 'super-mercado-modelo', audience: 'modelo-web'
  });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, getJwtSecret(), { issuer: 'super-mercado-modelo', audience: 'modelo-web' });
  } catch { return null; }
}

async function authenticateToken(req, res, next) {
  try {
    const match = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '');
    const decoded = match ? verifyToken(match[1]) : null;
    if (!decoded || !decoded.sub) return res.status(401).json({ error: 'Autenticação inválida ou expirada.' });
    const user = await getQuery('SELECT id, fullname, email, phone, role FROM users WHERE id = ?', [decoded.sub]);
    if (!user || user.role !== decoded.role) return res.status(401).json({ error: 'Sessão não é mais válida.' });
    req.user = user;
    return next();
  } catch (error) { return next(error); }
}

function authenticateAdmin(req, res, next) {
  return authenticateToken(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso restrito ao gestor.' });
    return next();
  });
}

module.exports = { generateToken, verifyToken, authenticateToken, authenticateAdmin, getJwtSecret };
