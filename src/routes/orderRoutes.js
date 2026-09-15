const express = require('express');
const rateLimit = require('express-rate-limit');
const orderController = require('../controllers/orderController');
const { authenticateAdmin, authenticateToken } = require('../config/jwt');

const router = express.Router();
const orderLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Muitos pedidos enviados. Aguarde antes de tentar novamente.' } });

router.post('/', orderLimiter, authenticateToken, orderController.createOrder);
router.get('/', authenticateAdmin, orderController.listOrders);
router.get('/:id', authenticateToken, orderController.getOrderDetails);
router.patch('/:id/status', authenticateAdmin, orderController.updateOrderStatus);
router.put('/:id/status', authenticateAdmin, orderController.updateOrderStatus);
router.put('/:id/substitute', authenticateAdmin, orderController.substituteOrderItem);
router.post('/:id/substitute', authenticateAdmin, orderController.substituteOrderItem);

module.exports = router;
