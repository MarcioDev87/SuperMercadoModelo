const { allQuery, getQuery } = require('../../db');

async function getDashboardStats(req, res) {
  try {
    const ordersTodayRow = await getQuery(`
      SELECT COUNT(*) as total, COALESCE(SUM(total), 0) as revenue
      FROM orders
      WHERE date(created_at, 'localtime') = date('now', 'localtime') AND status != 'cancelado'
    `);
    const pendingRow = await getQuery("SELECT COUNT(*) as total FROM orders WHERE status IN ('recebido', 'criado', 'CRIADO')");
    const separationRow = await getQuery("SELECT COUNT(*) as total FROM orders WHERE status = 'separacao'");
    const readyRow = await getQuery("SELECT COUNT(*) as total FROM orders WHERE status IN ('pronto', 'entrega', 'saiu_entrega')");
    const lowStockRow = await getQuery("SELECT COUNT(*) as total FROM products WHERE is_active = 1 AND stock <= min_stock AND stock > 0");
    const noStockRow = await getQuery("SELECT COUNT(*) as total FROM products WHERE is_active = 1 AND stock <= 0");

    const totalOrdersToday = ordersTodayRow ? ordersTodayRow.total : 0;
    const revenueToday = ordersTodayRow ? ordersTodayRow.revenue : 0;
    const avgTicket = totalOrdersToday > 0 ? (revenueToday / totalOrdersToday) : 0;

    return res.json({
      success: true,
      stats: {
        totalOrdersToday,
        revenueToday,
        avgTicket,
        pendingConfirm: pendingRow ? pendingRow.total : 0,
        inSeparation: separationRow ? separationRow.total : 0,
        ready: readyRow ? readyRow.total : 0,
        lowStockProducts: lowStockRow ? lowStockRow.total : 0,
        noStockProducts: noStockRow ? noStockRow.total : 0
      }
    });
  } catch (err) {
    console.error('Stats error:', err);
    return res.status(500).json({ error: 'Erro ao carregar estatísticas do dashboard.' });
  }
}

async function getWhatsAppStatus(req, res) {
  try {
    const store = await getQuery("SELECT whatsapp_connected, phone FROM store_info LIMIT 1");
    return res.json({
      success: true,
      connected: !!(store && store.whatsapp_connected),
      phone: store ? store.phone : '85996249271',
      instanceName: 'super-mercado-modelo'
    });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao consultar status WhatsApp.' });
  }
}

module.exports = {
  getDashboardStats,
  getWhatsAppStatus
};
