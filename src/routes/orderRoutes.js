const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authenticateAdmin } = require('../config/jwt');

router.post('/', orderController.createOrder);
router.get('/', authenticateAdmin, orderController.listOrders);
router.get('/:id', orderController.getOrderDetails);
router.patch('/:id/status', authenticateAdmin, orderController.updateOrderStatus);
router.put('/:id/status', authenticateAdmin, orderController.updateOrderStatus);
router.put('/:id/substitute', authenticateAdmin, orderController.substituteOrderItem);
router.post('/:id/substitute', authenticateAdmin, orderController.substituteOrderItem);

module.exports = router;
