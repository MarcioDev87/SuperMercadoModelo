const { allQuery, getQuery, runQuery, withTransaction } = require('../../db');

async function createOrder(req, res) {
  const customerName = req.body.customer_name || (req.body.customer && req.body.customer.name);
  const customerPhone = req.body.customer_phone || (req.body.customer && req.body.customer.phone);
  const deliveryAddress = req.body.delivery_address || (req.body.delivery && req.body.delivery.address) || '';
  const deliveryBairro = req.body.delivery_bairro || (req.body.delivery && req.body.delivery.bairro) || 'Centro';
  const deliveryCity = req.body.delivery_city || (req.body.delivery && req.body.delivery.city) || 'Cascavel - CE';
  const deliveryType = req.body.delivery_type || (req.body.delivery && req.body.delivery.type) || 'entrega';
  const paymentMethod = req.body.payment_method || req.body.paymentMethod || 'PIX';
  const notes = req.body.notes || '';
  const items = req.body.items;

  if (!customerName || !customerPhone) {
    return res.status(400).json({ error: 'Dados do cliente (nome e telefone) são obrigatórios.' });
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'A sacola de compras está vazia.' });
  }

  try {
    const result = await withTransaction(async (tx) => {
      let subtotal = 0;
      const verifiedItems = [];

      for (const item of items) {
        const prod = await tx.getQuery("SELECT * FROM products WHERE id = ? AND is_active = 1", [item.id]);
        if (!prod) {
          throw new Error(`Produto '${item.name || item.id}' não está disponível no catálogo.`);
        }
        const qty = parseFloat(item.quantity) || 1;
        const itemTotal = prod.price * qty;
        subtotal += itemTotal;
        verifiedItems.push({
          id: prod.id,
          name: prod.name,
          quantity: qty,
          unit_price: prod.price,
          total_price: itemTotal,
          unit: prod.unit
        });

        // Baixa de estoque
        await tx.runQuery("UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?", [qty, prod.id]);
      }

      const deliveryFee = req.body.delivery_fee !== undefined ? parseFloat(req.body.delivery_fee) : (deliveryType === 'retirada' ? 0 : 5.00);
      const total = subtotal + deliveryFee;
      const orderNumber = 'MOD-' + Date.now().toString().slice(-6);
      const pickupCode = Math.random().toString(36).substring(2, 6).toUpperCase();

      const orderInsert = await tx.runQuery(`
        INSERT INTO orders (
          order_number, customer_name, customer_phone, delivery_type,
          delivery_address, delivery_bairro, delivery_city, delivery_fee,
          subtotal, total, payment_method, pickup_code, notes, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CRIADO')
      `, [
        orderNumber,
        customerName,
        customerPhone.replace(/\D/g, ''),
        deliveryType,
        deliveryAddress,
        deliveryBairro,
        deliveryCity,
        deliveryFee,
        subtotal,
        total,
        paymentMethod,
        pickupCode,
        notes
      ]);

      const orderId = orderInsert.lastID;

      for (const it of verifiedItems) {
        await tx.runQuery(`
          INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, total_price, unit)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [orderId, it.id, it.name, it.quantity, it.unit_price, it.total_price, it.unit]);
      }

      return {
        id: orderId,
        order_number: orderNumber,
        orderNumber,
        pickupCode,
        subtotal,
        deliveryFee,
        total,
        total_amount: total,
        status: 'CRIADO'
      };
    });

    return res.status(201).json({
      success: true,
      message: 'Pedido realizado com sucesso no Super Mercado Modelo!',
      order: result
    });
  } catch (err) {
    console.error('Order creation error:', err);
    return res.status(400).json({ error: err.message || 'Erro ao processar pedido.' });
  }
}

async function listOrders(req, res) {
  try {
    const orders = await allQuery(`
      SELECT o.*, o.total as total_amount,
             (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as items_count
      FROM orders o
      ORDER BY o.id DESC LIMIT 100
    `);

    for (const ord of orders) {
      ord.items = await allQuery("SELECT * FROM order_items WHERE order_id = ?", [ord.id]);
      ord.address = {
        name: ord.customer_name,
        phone: ord.customer_phone,
        street: ord.delivery_address,
        bairro: ord.delivery_bairro || 'Centro',
        city: ord.delivery_city || 'Cascavel - CE'
      };
      ord.address_json = JSON.stringify(ord.address);
      ord.items_json = JSON.stringify(ord.items);
      ord.delivery_method = ord.delivery_type || 'entrega';
    }

    return res.json(orders);
  } catch (err) {
    console.error('listOrders error:', err);
    return res.status(500).json({ error: 'Erro ao listar pedidos.' });
  }
}

async function getOrderDetails(req, res) {
  try {
    const order = await getQuery("SELECT *, total as total_amount FROM orders WHERE id = ? OR order_number = ?", [req.params.id, req.params.id]);
    if (!order) {
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }
    const items = await allQuery("SELECT * FROM order_items WHERE order_id = ?", [order.id]);
    order.items = items;
    order.address = {
      name: order.customer_name,
      phone: order.customer_phone,
      street: order.delivery_address,
      bairro: order.delivery_bairro || 'Centro',
      city: order.delivery_city || 'Cascavel - CE'
    };
    return res.json({ order, items });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao buscar pedido.' });
  }
}

async function updateOrderStatus(req, res) {
  const rawStatus = (req.body.status || '').toLowerCase();
  
  // Normalize status mapping to allow both old and new conventions
  const statusMap = {
    'criado': 'recebido',
    'recebido': 'recebido',
    'confirmado': 'confirmado',
    'separacao': 'separacao',
    'em_separacao': 'separacao',
    'substituicao': 'substituicao',
    'aguardando_substituicao': 'substituicao',
    'pronto': 'pronto',
    'entrega': 'entrega',
    'saiu_entrega': 'entrega',
    'finalizado': 'finalizado',
    'entregue': 'finalizado',
    'cancelado': 'cancelado'
  };

  const normalizedStatus = statusMap[rawStatus] || rawStatus;
  const valid = ['recebido', 'confirmado', 'separacao', 'substituicao', 'pronto', 'entrega', 'finalizado', 'cancelado'];

  if (!valid.includes(normalizedStatus)) {
    return res.status(400).json({ error: `Status '${rawStatus}' inválido.` });
  }

  try {
    await runQuery("UPDATE orders SET status = ? WHERE id = ? OR order_number = ?", [normalizedStatus, req.params.id, req.params.id]);
    const updated = await getQuery("SELECT *, total as total_amount FROM orders WHERE id = ? OR order_number = ?", [req.params.id, req.params.id]);
    return res.json({ success: true, message: `Status atualizado para '${normalizedStatus}'.`, order: updated });
  } catch (err) {
    console.error('updateOrderStatus error:', err);
    return res.status(500).json({ error: 'Erro ao atualizar status do pedido.' });
  }
}

async function substituteOrderItem(req, res) {
  const { itemId, itemName, substituteItem } = req.body;
  try {
    const order = await getQuery("SELECT * FROM orders WHERE id = ? OR order_number = ?", [req.params.id, req.params.id]);
    if (!order) {
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }

    const subNote = `[SUBSTITUIÇÃO SOLICITADA: ${itemName} -> ${substituteItem ? substituteItem.name : 'Substituto'} (R$ ${substituteItem ? substituteItem.price : ''})]`;
    const newNotes = order.notes ? `${order.notes} | ${subNote}` : subNote;

    await runQuery(
      "UPDATE orders SET status = 'substituicao', notes = ? WHERE id = ?",
      [newNotes, order.id]
    );

    const updated = await getQuery("SELECT *, total as total_amount FROM orders WHERE id = ?", [order.id]);
    return res.json({
      success: true,
      message: 'Substituição registrada e status alterado para Aguardando Substituição.',
      order: updated
    });
  } catch (err) {
    console.error('substituteOrderItem error:', err);
    return res.status(500).json({ error: 'Erro ao registrar substituição de produto.' });
  }
}

module.exports = {
  createOrder,
  listOrders,
  getOrderDetails,
  updateOrderStatus,
  substituteOrderItem
};
