const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const source = path.resolve(process.env.DB_PATH || path.join(__dirname, '..', 'data', 'modelo.db'));
const destination = path.join(__dirname, '..', 'data', 'catalog-seed.json');
const db = new sqlite3.Database(source, sqlite3.OPEN_READONLY);

db.all(`SELECT id, name, price, old_price, category, subcategory, unit, brand, ean, img,
  stock, safety_stock, min_stock FROM products WHERE is_active = 1 ORDER BY name`, [], (error, products) => {
  if (error) throw error;
  fs.writeFileSync(destination, `${JSON.stringify(products, null, 2)}\n`, 'utf8');
  console.log(`Catálogo exportado: ${products.length} produtos, sem usuários ou pedidos.`);
  db.close();
});
