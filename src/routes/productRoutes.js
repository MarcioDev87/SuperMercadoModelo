const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticateAdmin } = require('../config/jwt');

router.get('/', productController.getAllProducts);
router.get('/:id', productController.getProductById);
router.post('/', authenticateAdmin, productController.saveProduct);
router.patch('/:id/stock', authenticateAdmin, productController.updateProductStock);
router.put('/:id/stock', authenticateAdmin, productController.updateProductStock);
router.delete('/:id', authenticateAdmin, productController.deleteProduct);

module.exports = router;
