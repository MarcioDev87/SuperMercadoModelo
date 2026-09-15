const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const { initDB } = require('./db');

const authRoutes = require('./src/routes/authRoutes');
const productRoutes = require('./src/routes/productRoutes');
const orderRoutes = require('./src/routes/orderRoutes');
const evolutionRoutes = require('./src/routes/evolutionRoutes');

const app = express();
const PORT = process.env.PORT || 3051;

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: false
}));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static Assets & Web App
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname)));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/evolution', evolutionRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', app: 'Super Mercado Modelo' });
});
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    store: 'Super Mercado Modelo',
    timestamp: new Date().toISOString()
  });
});

async function startServer() {
  await initDB();
  if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
      console.log(`🚀 Super Mercado Modelo rodando na porta ${PORT}: http://localhost:${PORT}`);
    });
  }
}

startServer().catch(err => {
  console.error('Fatal Server Init Error:', err);
  process.exit(1);
});

module.exports = { app, startServer };
