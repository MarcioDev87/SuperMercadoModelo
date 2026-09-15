require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { initDB } = require('./db');
const { getJwtSecret } = require('./src/config/jwt');
const authRoutes = require('./src/routes/authRoutes');
const productRoutes = require('./src/routes/productRoutes');
const orderRoutes = require('./src/routes/orderRoutes');
const evolutionRoutes = require('./src/routes/evolutionRoutes');

const app = express();
const PORT = Number(process.env.PORT) || 3051;
const publicPages = new Set(['index.html','login_cliente.html','login_gestor.html','meu_carrinho.html','forma_de_pagamento.html','pedido_confirmado.html','visao_geral.html','lista_de_pedidos.html','admin_produtos.html','gestao_de_estoque.html','admin_whatsapp.html','configuracoes_loja.html']);

app.disable('x-powered-by');
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
app.use(helmet({ contentSecurityPolicy: { directives: {
  defaultSrc: ["'self'"], scriptSrc: ["'self'", "'unsafe-inline'"],
  scriptSrcAttr: ["'unsafe-inline'"],
  styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'], fontSrc: ["'self'", 'https://fonts.gstatic.com'],
  imgSrc: ["'self'", 'data:', 'https:'], connectSrc: ["'self'", ...allowedOrigins], objectSrc: ["'none'"], baseUri: ["'self'"], frameAncestors: ["'none'"]
} }, crossOriginResourcePolicy: { policy: 'same-site' } }));
app.use(cors({ origin(origin, callback) { return callback(null, !origin || allowedOrigins.includes(origin)); }, methods: ['GET','POST','PUT','PATCH','DELETE'], allowedHeaders: ['Content-Type','Authorization','Idempotency-Key'] }));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Limite de requisições excedido.' } }));

app.use('/assets', express.static(path.join(__dirname, 'assets'), { dotfiles: 'deny', fallthrough: false, maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0 }));
app.use('/downloads', express.static(path.join(__dirname, 'downloads'), { dotfiles: 'deny', fallthrough: false }));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/:page', (req, res, next) => publicPages.has(req.params.page) ? res.sendFile(path.join(__dirname, req.params.page)) : next());

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/evolution', evolutionRoutes);
app.get(['/health', '/api/health'], (req, res) => res.json({ status: 'ok', app: 'Super Mercado Modelo', timestamp: new Date().toISOString() }));
app.use('/api', (req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  console.error('Request error:', error);
  return res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Erro interno do servidor.' });
});

async function startServer() {
  getJwtSecret();
  await initDB();
  return app.listen(PORT, '0.0.0.0', () => console.log(`Super Mercado Modelo disponível na porta ${PORT}.`));
}

if (require.main === module) startServer().catch(error => { console.error('Fatal Server Init Error:', error); process.exit(1); });
module.exports = { app, startServer };
