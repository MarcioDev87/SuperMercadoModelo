const crypto = require('crypto');
const { allQuery, getQuery, withTransaction } = require('../../db');

const PAYMENT_METHODS = new Set(['PIX', 'CARTAO_ENTREGA', 'DINHEIRO']);
const DELIVERY_TYPES = new Set(['entrega', 'retirada']);
const STATUS_ALIASES = { criado: 'recebido', em_separacao: 'separacao', aguardando_substituicao: 'substituicao', saiu_entrega: 'entrega', entregue: 'finalizado' };
const TRANSITIONS = {
  recebido: new Set(['confirmado', 'cancelado']), confirmado: new Set(['separacao', 'cancelado']),
  separacao: new Set(['substituicao', 'pronto', 'cancelado']), substituicao: new Set(['separacao', 'cancelado']),
  pronto: new Set(['entrega', 'cancelado']), entrega: new Set(['finalizado']), finalizado: new Set(), cancelado: new Set()
};

function httpError(statusCode, message) { const error = new Error(message); error.statusCode = statusCode; return error; }
function cleanText(value, max) { return typeof value === 'string' ? value.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max) : ''; }
function roundMoney(value) { return Math.round((value + Number.EPSILON) * 100) / 100; }
function normalizeStatus(value) { const status = cleanText(value, 40).toLowerCase(); return STATUS_ALIASES[status] || status; }

async function loadOrder(tx, id) {
  return tx.getQuery('SELECT *, total AS total_amount FROM orders WHERE id = ? OR order_number = ?', [id, id]);
}

async function createOrder(req, res) {
  const items = req.body.items;
  const idempotencyKey = cleanText(req.headers['idempotency-key'], 128);
  const deliveryType = cleanText(req.body.delivery_type || (req.body.delivery && req.body.delivery.type) || 'entrega', 20).toLowerCase();
  const deliveryAddress = cleanText(req.body.delivery_address || (req.body.delivery && req.body.delivery.address), 250);
  const deliveryBairro = cleanText(req.body.delivery_bairro || (req.body.delivery && req.body.delivery.bairro), 100);
  const deliveryCity = cleanText(req.body.delivery_city || (req.body.delivery && req.body.delivery.city) || 'Cascavel - CE', 100);
  const paymentMethod = cleanText(req.body.payment_method || req.body.paymentMethod || 'PIX', 30).toUpperCase();
  const notes = cleanText(req.body.notes, 500);

  if (!Array.isArray(items) || items.length === 0 || items.length > 100) return res.status(400).json({ error: 'A sacola deve ter entre 1 e 100 itens.' });
  if (!/^[A-Za-z0-9._:-]{16,128}$/.test(idempotencyKey)) return res.status(400).json({ error: 'Idempotency-Key válida é obrigatória.' });
  if (!DELIVERY_TYPES.has(deliveryType)) return res.status(400).json({ error: 'Forma de entrega inválida.' });
  if (!PAYMENT_METHODS.has(paymentMethod)) return res.status(400).json({ error: 'Forma de pagamento inválida.' });
  if (deliveryType === 'entrega' && deliveryAddress.length < 8) return res.status(400).json({ error: 'Informe o endereço completo de entrega.' });

  try {
    const previous = await getQuery('SELECT *, total AS total_amount FROM orders WHERE idempotency_key = ? AND customer_id = ?', [idempotencyKey, req.user.id]);
    if (previous) return res.status(200).json({ success: true, duplicate: true, order: previous });

    const result = await withTransaction(async tx => {
      const customer = await tx.getQuery("SELECT id, fullname, phone, bairro FROM users WHERE id = ? AND role = 'user'", [req.user.id]);
      if (!customer) throw httpError(403, 'Somente clientes podem criar pedidos.');
      const store = await tx.getQuery('SELECT initial_delivery_fee, min_order_value FROM store_info LIMIT 1');
      let subtotal = 0;
      const verifiedItems = [];

      for (const item of items) {
        const productId = cleanText(item && item.id, 100);
        const quantity = Number(item && item.quantity);
        if (!productId || !Number.isFinite(quantity) || quantity <= 0 || quantity > 999 || Math.round(quantity * 1000) !== quantity * 1000) {
          throw httpError(400, 'Quantidade de produto inválida.');
        }
        const product = await tx.getQuery('SELECT * FROM products WHERE id = ? AND is_active = 1', [productId]);
        if (!product || !Number.isFinite(product.price) || product.price < 0) throw httpError(400, `Produto '${productId}' indisponível.`);
        if (['un', 'und', 'pct', 'cx'].includes(String(product.unit).toLowerCase()) && !Number.isInteger(quantity)) throw httpError(400, `O produto '${product.name}' exige quantidade inteira.`);
        const stockUpdate = await tx.runQuery('UPDATE products SET stock = ROUND(stock - ?, 3), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND stock >= ?', [quantity, product.id, quantity]);
        if (!stockUpdate.changes) throw httpError(409, `Estoque insuficiente para '${product.name}'.`);
        const itemTotal = roundMoney(product.price * quantity);
        subtotal = roundMoney(subtotal + itemTotal);
        verifiedItems.push({ id: product.id, name: product.name, quantity, unitPrice: product.price, totalPrice: itemTotal, unit: product.unit });
      }

      const minimum = Number(store && store.min_order_value);
      if (!Number.isFinite(minimum) || minimum < 0) throw httpError(500, 'O valor mínimo configurado é inválido.');
      if (subtotal < minimum) throw httpError(400, `O pedido mínimo é R$ ${minimum.toFixed(2).replace('.', ',')}.`);
      const configuredFee = Number(store && store.initial_delivery_fee);
      if (!Number.isFinite(configuredFee) || configuredFee < 0) throw httpError(500, 'A taxa de entrega configurada é inválida.');
      const deliveryFee = deliveryType === 'retirada' ? 0 : roundMoney(configuredFee);
      const total = roundMoney(subtotal + deliveryFee);
      const orderNumber = `MOD-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
      const pickupCode = crypto.randomInt(100000, 1000000).toString();
      const insert = await tx.runQuery(`INSERT INTO orders
        (order_number, customer_id, customer_name, customer_phone, delivery_type, delivery_address, delivery_bairro,
         delivery_city, delivery_fee, subtotal, total, payment_method, pickup_code, notes, status, idempotency_key)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'recebido', ?)`, [
        orderNumber, customer.id, customer.fullname, customer.phone, deliveryType, deliveryAddress,
        deliveryBairro || customer.bairro || 'Centro', deliveryCity, deliveryFee, subtotal, total,
        paymentMethod, pickupCode, notes, idempotencyKey
      ]);
      for (const item of verifiedItems) await tx.runQuery(`INSERT INTO order_items
        (order_id, product_id, product_name, quantity, unit_price, total_price, unit) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [insert.lastID, item.id, item.name, item.quantity, item.unitPrice, item.totalPrice, item.unit]);
      return { id: insert.lastID, order_number: orderNumber, orderNumber, pickupCode, subtotal, deliveryFee, total, total_amount: total, status: 'recebido' };
    });
    return res.status(201).json({ success: true, message: 'Pedido realizado com sucesso!', order: result });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT') {
      const previous = await getQuery('SELECT *, total AS total_amount FROM orders WHERE idempotency_key = ? AND customer_id = ?', [idempotencyKey, req.user.id]);
      if (previous) return res.status(200).json({ success: true, duplicate: true, order: previous });
    }
    if (!error.statusCode) console.error('Order creation error:', error);
    return res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Erro ao processar pedido.' });
  }
}

async function listOrders(req, res) {
  try {
    const orders = await allQuery(`SELECT o.*, o.total AS total_amount,
      (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS items_count FROM orders o ORDER BY o.id DESC LIMIT 100`);
    for (const order of orders) {
      order.items = await allQuery('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
      order.address = { name: order.customer_name, phone: order.customer_phone, street: order.delivery_address, bairro: order.delivery_bairro, city: order.delivery_city };
    }
    return res.json(orders);
  } catch (error) { console.error('listOrders error:', error); return res.status(500).json({ error: 'Erro ao listar pedidos.' }); }
}

async function getOrderDetails(req, res) {
  try {
    const order = await getQuery('SELECT *, total AS total_amount FROM orders WHERE id = ? OR order_number = ?', [req.params.id, req.params.id]);
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado.' });
    if (req.user.role !== 'admin' && Number(order.customer_id) !== Number(req.user.id)) return res.status(403).json({ error: 'Você não pode consultar este pedido.' });
    const items = await allQuery('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
    order.items = items;
    order.address = { name: order.customer_name, phone: order.customer_phone, street: order.delivery_address, bairro: order.delivery_bairro, city: order.delivery_city };
    return res.json({ order, items });
  } catch { return res.status(500).json({ error: 'Erro ao buscar pedido.' }); }
}

async function updateOrderStatus(req, res) {
  const nextStatus = normalizeStatus(req.body.status);
  if (!Object.hasOwn(TRANSITIONS, nextStatus)) return res.status(400).json({ error: 'Status inválido.' });
  try {
    const updated = await withTransaction(async tx => {
      const order = await loadOrder(tx, req.params.id);
      if (!order) throw httpError(404, 'Pedido não encontrado.');
      const currentStatus = normalizeStatus(order.status);
      if (currentStatus === nextStatus) return order;
      if (!TRANSITIONS[currentStatus] || !TRANSITIONS[currentStatus].has(nextStatus)) throw httpError(409, `Não é possível alterar de '${currentStatus}' para '${nextStatus}'.`);
      if (nextStatus === 'cancelado' && !order.inventory_restored) {
        const items = await tx.allQuery('SELECT product_id, quantity FROM order_items WHERE order_id = ?', [order.id]);
        for (const item of items) await tx.runQuery('UPDATE products SET stock = ROUND(stock + ?, 3), updated_at = CURRENT_TIMESTAMP WHERE id = ?', [item.quantity, item.product_id]);
      }
      await tx.runQuery('UPDATE orders SET status = ?, inventory_restored = CASE WHEN ? = \'cancelado\' THEN 1 ELSE inventory_restored END WHERE id = ?', [nextStatus, nextStatus, order.id]);
      return loadOrder(tx, order.id);
    });
    return res.json({ success: true, message: `Status atualizado para '${nextStatus}'.`, order: updated });
  } catch (error) { return res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Erro ao atualizar status.' }); }
}

async function substituteOrderItem(req, res) {
  const itemId = Number(req.body.itemId);
  const substituteId = cleanText(req.body.substituteItem && req.body.substituteItem.id, 100);
  try {
    const updated = await withTransaction(async tx => {
      const order = await loadOrder(tx, req.params.id);
      if (!order) throw httpError(404, 'Pedido não encontrado.');
      const item = await tx.getQuery('SELECT * FROM order_items WHERE id = ? AND order_id = ?', [itemId, order.id]);
      const substitute = await tx.getQuery('SELECT id, name, price FROM products WHERE id = ? AND is_active = 1', [substituteId]);
      if (!item || !substitute) throw httpError(400, 'Item original ou substituto inválido.');
      const note = `[SUBSTITUIÇÃO PROPOSTA: ${item.product_name} -> ${substitute.name} (R$ ${Number(substitute.price).toFixed(2)})]`;
      await tx.runQuery("UPDATE orders SET status = 'substituicao', notes = CASE WHEN notes IS NULL OR notes = '' THEN ? ELSE notes || ' | ' || ? END WHERE id = ?", [note, note, order.id]);
      return loadOrder(tx, order.id);
    });
    return res.json({ success: true, message: 'Proposta de substituição registrada.', order: updated });
  } catch (error) { return res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Erro ao registrar substituição.' }); }
}

module.exports = { createOrder, listOrders, getOrderDetails, updateOrderStatus, substituteOrderItem };
