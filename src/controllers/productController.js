const { allQuery, getQuery, runQuery } = require('../../db');

async function getAllProducts(req, res) {
  const { q, category, subcategory, promo } = req.query;

  try {
    let whereClause = ' WHERE is_active = 1';
    const params = [];

    if (q) {
      whereClause += ' AND (name LIKE ? OR brand LIKE ? OR category LIKE ? OR ean LIKE ?)';
      const term = `%${q}%`;
      params.push(term, term, term, term);
    }

    if (category) {
      whereClause += ' AND category = ?';
      params.push(category);
    }

    if (subcategory) {
      whereClause += ' AND subcategory = ?';
      params.push(subcategory);
    }

    if (promo === 'true') {
      whereClause += ' AND old_price IS NOT NULL AND old_price > price';
    }

    const pageParam = req.query.page ? parseInt(req.query.page, 10) : null;
    const limitParam = req.query.limit ? parseInt(req.query.limit, 10) : null;
    const isPaged = (pageParam !== null && !isNaN(pageParam)) || (limitParam !== null && !isNaN(limitParam));

    if (isPaged) {
      const countRow = await getQuery(`SELECT COUNT(*) as total FROM products ${whereClause}`, params);
      const total = countRow ? countRow.total : 0;
      const page = Math.max(1, pageParam || 1);
      const limit = Math.max(1, Math.min(100, limitParam || 40));
      const offset = (page - 1) * limit;
      const totalPages = Math.ceil(total / limit) || 1;

      const querySql = `SELECT * FROM products ${whereClause} ORDER BY name ASC LIMIT ? OFFSET ?`;
      const queryParams = [...params, limit, offset];
      const products = await allQuery(querySql, queryParams);

      res.setHeader('X-Total-Count', String(total));
      res.setHeader('X-Page', String(page));
      res.setHeader('X-Total-Pages', String(totalPages));
      res.setHeader('X-Per-Page', String(limit));
      return res.json(products);
    }

    const querySql = `SELECT * FROM products ${whereClause} ORDER BY name ASC`;
    const products = await allQuery(querySql, params);
    res.setHeader('X-Total-Count', String(products.length));
    return res.json(products);
  } catch (err) {
    console.error('Error fetching products:', err);
    return res.status(500).json({ error: 'Erro ao consultar catálogo do Super Mercado Modelo.' });
  }
}

async function getProductById(req, res) {
  try {
    const product = await getQuery("SELECT * FROM products WHERE id = ? AND is_active = 1", [req.params.id]);
    if (!product) {
      return res.status(404).json({ error: 'Produto não encontrado.' });
    }
    return res.json(product);
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao buscar detalhes do produto.' });
  }
}

async function saveProduct(req, res) {
  const { id, name, price, old_price, category, subcategory, unit, brand, ean, img, stock, safety_stock, min_stock } = req.body;

  if (!id || !name || price === undefined) {
    return res.status(400).json({ error: 'ID, Nome e Preço são obrigatórios.' });
  }

  try {
    const priceNum = parseFloat(price);
    const oldPriceNum = old_price ? parseFloat(old_price) : null;
    const stockNum = stock !== undefined ? parseFloat(stock) : 50;

    await runQuery(`
      INSERT INTO products (id, name, price, old_price, category, subcategory, unit, brand, ean, img, stock, safety_stock, min_stock, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        price = excluded.price,
        old_price = excluded.old_price,
        category = excluded.category,
        subcategory = excluded.subcategory,
        unit = excluded.unit,
        brand = excluded.brand,
        ean = excluded.ean,
        img = excluded.img,
        stock = excluded.stock,
        safety_stock = excluded.safety_stock,
        min_stock = excluded.min_stock,
        updated_at = CURRENT_TIMESTAMP
    `, [id, name, priceNum, oldPriceNum, category || 'Mercearia', subcategory || '', unit || 'un', brand || '', ean || '', img || '', stockNum, safety_stock || 2, min_stock || 5]);

    const updated = await getQuery("SELECT * FROM products WHERE id = ?", [id]);
    return res.json({ success: true, message: 'Produto salvo com sucesso!', product: updated });
  } catch (err) {
    console.error('Error saving product:', err);
    return res.status(500).json({ error: 'Erro ao salvar produto.' });
  }
}

async function deleteProduct(req, res) {
  try {
    await runQuery("UPDATE products SET is_active = 0 WHERE id = ?", [req.params.id]);
    return res.json({ success: true, message: 'Produto desativado com sucesso.' });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao excluir produto.' });
  }
}

module.exports = {
  getAllProducts,
  getProductById,
  saveProduct,
  deleteProduct
};
