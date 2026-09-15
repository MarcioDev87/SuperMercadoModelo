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
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

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
      INSERT INTO store_info (name, legal_name, cnpj, phone, email, address, bairro, city, state, delivery_radius_km, initial_delivery_fee)
      VALUES ('Super Mercado Modelo', 'Super Mercado Modelo Ltda', '12.345.678/0001-90', '85996249271', 'contato@supermercadomodelo.com.br', 'Av. Principal, 1000', 'Centro', 'Cascavel - CE', 'CE', 8.0, 5.00)
    `);
  } else {
    await runQuery("UPDATE store_info SET city = 'Cascavel - CE' WHERE id = ?", [store.id]);
  }

  // Seed Manager user if not present
  const manager = await getQuery("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  if (!manager) {
    const hash = await bcrypt.hash('admin123', 10);
    await runQuery(`
      INSERT INTO users (fullname, email, phone, password, role, address, bairro, city)
      VALUES ('Gestor Modelo', 'admin@supermercadomodelo.com.br', '85996249271', ?, 'admin', 'Av. Principal, 1000', 'Centro', 'Cascavel - CE')
    `, [hash]);
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
