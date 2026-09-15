const { allQuery, getQuery, runQuery } = require('../../db');

const cleanText = (value, max) => typeof value === 'string' ? value.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max) : '';
const finiteNumber = value => value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value));

async function getAllProducts(req, res) {
  const q = cleanText(req.query.q, 100);
  const category = cleanText(req.query.category, 80);
  const subcategory = cleanText(req.query.subcategory, 80);
  try {
    let where = ' WHERE is_active = 1';
    const params = [];
    if (q) { where += ' AND (name LIKE ? OR brand LIKE ? OR category LIKE ? OR ean LIKE ?)'; const term = `%${q}%`; params.push(term, term, term, term); }
    if (category) { where += ' AND category = ?'; params.push(category); }
    if (subcategory) { where += ' AND subcategory = ?'; params.push(subcategory); }
    if (req.query.promo === 'true') where += ' AND old_price IS NOT NULL AND old_price > price';
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, Number.parseInt(req.query.limit, 10) || 40));
    const total = (await getQuery(`SELECT COUNT(*) AS total FROM products ${where}`, params)).total;
    const products = await allQuery(`SELECT * FROM products ${where} ORDER BY name ASC LIMIT ? OFFSET ?`, [...params, limit, (page - 1) * limit]);
    res.setHeader('X-Total-Count', String(total));
    res.setHeader('X-Page', String(page));
    res.setHeader('X-Total-Pages', String(Math.max(1, Math.ceil(total / limit))));
    res.setHeader('X-Per-Page', String(limit));
    return res.json(products);
  } catch (error) { console.error('Error fetching products:', error); return res.status(500).json({ error: 'Erro ao consultar catálogo.' }); }
}

async function getProductById(req, res) {
  try {
    const product = await getQuery('SELECT * FROM products WHERE id = ? AND is_active = 1', [req.params.id]);
    return product ? res.json(product) : res.status(404).json({ error: 'Produto não encontrado.' });
  } catch { return res.status(500).json({ error: 'Erro ao buscar produto.' }); }
}

async function saveProduct(req, res) {
  const id = cleanText(req.body.id, 100);
  const name = cleanText(req.body.name, 150);
  const category = cleanText(req.body.category, 80);
  const price = Number(req.body.price);
  const oldPrice = finiteNumber(req.body.old_price) ? Number(req.body.old_price) : null;
  const suppliedStock = finiteNumber(req.body.stock) ? Number(req.body.stock) : null;
  const safetyStock = finiteNumber(req.body.safety_stock) ? Number(req.body.safety_stock) : 2;
  const minStock = finiteNumber(req.body.min_stock) ? Number(req.body.min_stock) : 5;
  if (!/^[A-Za-z0-9._:-]{1,100}$/.test(id) || name.length < 2 || !category || !Number.isFinite(price) || price < 0 || price > 100000) return res.status(400).json({ error: 'ID, nome, categoria e preço válido são obrigatórios.' });
  if ((oldPrice !== null && (oldPrice < 0 || oldPrice > 100000)) || (suppliedStock !== null && (suppliedStock < 0 || suppliedStock > 100000)) || safetyStock < 0 || minStock < 0) return res.status(400).json({ error: 'Preço anterior ou estoque inválido.' });
  const img = cleanText(req.body.img, 500);
  if (img && !/^(https:\/\/|assets\/)/i.test(img)) return res.status(400).json({ error: 'URL de imagem inválida.' });
  try {
    const existing = await getQuery('SELECT stock FROM products WHERE id = ?', [id]);
    const stock = suppliedStock === null ? (existing ? existing.stock : 0) : suppliedStock;
    await runQuery(`INSERT INTO products (id,name,price,old_price,category,subcategory,unit,brand,ean,img,stock,safety_stock,min_stock,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,price=excluded.price,old_price=excluded.old_price,category=excluded.category,
      subcategory=excluded.subcategory,unit=excluded.unit,brand=excluded.brand,ean=excluded.ean,img=excluded.img,
      stock=excluded.stock,safety_stock=excluded.safety_stock,min_stock=excluded.min_stock,is_active=1,updated_at=CURRENT_TIMESTAMP`, [
      id, name, price, oldPrice, category, cleanText(req.body.subcategory, 80), cleanText(req.body.unit, 20) || 'un',
      cleanText(req.body.brand, 100), cleanText(req.body.ean, 30), img, stock, safetyStock, minStock
    ]);
    return res.json({ success: true, product: await getQuery('SELECT * FROM products WHERE id = ?', [id]) });
  } catch (error) { console.error('Error saving product:', error); return res.status(500).json({ error: 'Erro ao salvar produto.' }); }
}

async function deleteProduct(req, res) {
  try {
    const result = await runQuery('UPDATE products SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
    return result.changes ? res.json({ success: true }) : res.status(404).json({ error: 'Produto não encontrado.' });
  } catch { return res.status(500).json({ error: 'Erro ao desativar produto.' }); }
}

async function updateProductStock(req, res) {
  const id = cleanText(req.params.id, 100);
  const hasStock = finiteNumber(req.body.stock);
  const hasDelta = finiteNumber(req.body.delta);
  if (hasStock === hasDelta) return res.status(400).json({ error: 'Informe apenas stock ou delta.' });
  const value = Number(hasStock ? req.body.stock : req.body.delta);
  if (Math.abs(value) > 100000 || (hasStock && value < 0)) return res.status(400).json({ error: 'Valor de estoque inválido.' });
  try {
    const result = hasStock
      ? await runQuery('UPDATE products SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [value, id])
      : await runQuery('UPDATE products SET stock = MAX(0, stock + ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?', [value, id]);
    if (!result.changes) return res.status(404).json({ error: 'Produto não encontrado.' });
    return res.json({ success: true, product: await getQuery('SELECT * FROM products WHERE id = ?', [id]) });
  } catch { return res.status(500).json({ error: 'Erro ao atualizar estoque.' }); }
}

module.exports = { getAllProducts, getProductById, saveProduct, deleteProduct, updateProductStock };
