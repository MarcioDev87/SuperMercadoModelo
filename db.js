const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DB_PATH = path.resolve(process.env.DB_PATH || path.join(__dirname, 'data', 'modelo.db'));
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new sqlite3.Database(DB_PATH);

function runOn(database, sql, params = []) {
  return new Promise((resolve, reject) => {
    database.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function getOn(database, sql, params = []) {
  return new Promise((resolve, reject) => {
    database.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function allOn(database, sql, params = []) {
  return new Promise((resolve, reject) => {
    database.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

const runQuery = (sql, params = []) => runOn(db, sql, params);
const getQuery = (sql, params = []) => getOn(db, sql, params);
const allQuery = (sql, params = []) => allOn(db, sql, params);
const environmentNumber = (name, fallback) => {
  if (process.env[name] === undefined || process.env[name] === '') return fallback;
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
};

async function ensureColumn(table, column, definition) {
  const columns = await allQuery(`PRAGMA table_info(${table})`);
  if (!columns.some(item => item.name === column)) {
    await runQuery(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

async function withTransaction(work) {
  const transactionDb = new sqlite3.Database(DB_PATH);
  const tx = {
    runQuery: (sql, params = []) => runOn(transactionDb, sql, params),
    getQuery: (sql, params = []) => getOn(transactionDb, sql, params),
    allQuery: (sql, params = []) => allOn(transactionDb, sql, params)
  };

  try {
    await tx.runQuery('PRAGMA foreign_keys = ON');
    await tx.runQuery('PRAGMA busy_timeout = 10000');
    await tx.runQuery('BEGIN IMMEDIATE');
    const result = await work(tx);
    await tx.runQuery('COMMIT');
    return result;
  } catch (error) {
    try { await tx.runQuery('ROLLBACK'); } catch {}
    throw error;
  } finally {
    transactionDb.close();
  }
}

async function initDB() {
  await runQuery('PRAGMA foreign_keys = ON');
  await runQuery('PRAGMA busy_timeout = 10000');
  await runQuery('PRAGMA journal_mode = WAL');

  // Store Configuration (Single Dedicated Store: Super Mercado Modelo)
  await runQuery(`
    CREATE TABLE IF NOT EXISTS store_info (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      legal_name TEXT,
      cnpj TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      bairro TEXT,
      city TEXT,
      state TEXT,
      delivery_radius_km REAL DEFAULT 8.0,
      initial_delivery_fee REAL DEFAULT 5.00,
      min_order_value REAL DEFAULT 20.00,
      whatsapp_connected INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Users (Manager & Customers)
  await runQuery(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fullname TEXT NOT NULL,
      email TEXT UNIQUE,
      phone TEXT UNIQUE,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      address TEXT,
      bairro TEXT,
      city TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Products
  await runQuery(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      old_price REAL,
      category TEXT NOT NULL,
      subcategory TEXT,
      unit TEXT DEFAULT 'un',
      brand TEXT,
      ean TEXT,
      img TEXT,
      stock REAL DEFAULT 50,
      safety_stock REAL DEFAULT 2,
      min_stock REAL DEFAULT 5,
      reserved_stock REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Orders
  await runQuery(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT UNIQUE NOT NULL,
      customer_id INTEGER,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      delivery_type TEXT DEFAULT 'entrega',
      delivery_address TEXT,
      delivery_bairro TEXT,
      delivery_city TEXT,
      delivery_fee REAL DEFAULT 0,
      subtotal REAL NOT NULL,
      discount REAL DEFAULT 0,
      total REAL NOT NULL,
      payment_method TEXT NOT NULL,
      payment_status TEXT DEFAULT 'pending',
      status TEXT DEFAULT 'recebido',
      pickup_code TEXT,
      idempotency_key TEXT,
      inventory_restored INTEGER DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await ensureColumn('orders', 'idempotency_key', 'TEXT');
  await ensureColumn('orders', 'inventory_restored', 'INTEGER DEFAULT 0');
  await runQuery('CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency_key ON orders(idempotency_key) WHERE idempotency_key IS NOT NULL');
  await runQuery('CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id)');
  await runQuery('CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at)');

  // Order Items
  await runQuery(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      total_price REAL NOT NULL,
      unit TEXT,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    )
  `);
  await runQuery('CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id)');

  // Legal Consents
  await runQuery(`
    CREATE TABLE IF NOT EXISTS legal_consents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      accepted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ip_address TEXT,
      user_agent TEXT
    )
  `);

  // Password Resets
  await runQuery(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      used_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Seed default store if not present
  const store = await getQuery("SELECT id FROM store_info LIMIT 1");
  if (!store) {
    await runQuery(`
      INSERT INTO store_info (name, legal_name, cnpj, phone, email, address, bairro, city, state, delivery_radius_km, initial_delivery_fee, min_order_value)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      process.env.STORE_NAME || 'Super Mercado Modelo', process.env.STORE_LEGAL_NAME || null,
      process.env.STORE_CNPJ || null, (process.env.STORE_PHONE || '').replace(/\D/g, '') || null,
      process.env.STORE_EMAIL || null, process.env.STORE_ADDRESS || null,
      process.env.STORE_BAIRRO || 'Centro', process.env.STORE_CITY || 'Cascavel - CE',
      process.env.STORE_STATE || 'CE', environmentNumber('DELIVERY_RADIUS_KM', 8),
      environmentNumber('DELIVERY_FEE', 5), environmentNumber('MIN_ORDER_VALUE', 20)
    ]);
  }

  const productCount = await getQuery('SELECT COUNT(*) AS total FROM products');
  const catalogPath = path.join(__dirname, 'data', 'catalog-seed.json');
  if ((!productCount || productCount.total === 0) && fs.existsSync(catalogPath)) {
    const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    await withTransaction(async tx => {
      for (const product of catalog) {
        await tx.runQuery(`INSERT INTO products
          (id, name, price, old_price, category, subcategory, unit, brand, ean, img, stock, safety_stock, min_stock, reserved_stock, is_active)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
          product.id, product.name, product.price, product.old_price, product.category,
          product.subcategory, product.unit, product.brand, product.ean, product.img,
          product.stock, product.safety_stock, product.min_stock, 0, 1
        ]);
      }
    });
  }

  // O primeiro gestor é criado somente quando credenciais foram fornecidas pelo ambiente.
  const manager = await getQuery("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  if (!manager) {
    const managerEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const managerPassword = process.env.ADMIN_PASSWORD || '';
    if (process.env.NODE_ENV === 'production' && (!managerEmail || managerPassword.length < 12)) {
      throw new Error('ADMIN_EMAIL e ADMIN_PASSWORD (mínimo 12 caracteres) são obrigatórios no primeiro início.');
    }
    if (!managerEmail || managerPassword.length < 12) return;
    const hash = await bcrypt.hash(managerPassword, 12);
    await runQuery(`
      INSERT INTO users (fullname, email, phone, password, role, address, bairro, city)
      VALUES (?, ?, ?, ?, 'admin', ?, ?, ?)
    `, [
      (process.env.ADMIN_NAME || 'Gestor Modelo').trim(), managerEmail,
      (process.env.ADMIN_PHONE || '').replace(/\D/g, '') || null, hash,
      process.env.STORE_ADDRESS || '', process.env.STORE_BAIRRO || 'Centro', process.env.STORE_CITY || 'Cascavel - CE'
    ]);
  }
}

module.exports = {
  runQuery,
  getQuery,
  allQuery,
  withTransaction,
  initDB,
  closeDB: () => new Promise(resolve => db.close(resolve))
};
