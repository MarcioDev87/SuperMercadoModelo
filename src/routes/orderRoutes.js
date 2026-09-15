const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authenticateAdmin } = require('../config/jwt');

router.post('/', orderController.createOrder);
router.get('/', authenticateAdmin, orderController.listOrders);
router.get('/:id', orderController.getOrderDetails);
router.patch('/:id/status', authenticateAdmin, orderController.updateOrderStatus);

module.exports = router;
