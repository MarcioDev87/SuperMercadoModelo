const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/login-manager', authController.loginManager);
router.post('/manager/login', authController.loginManager);
router.post('/login-customer', authController.loginCustomer);
router.post('/customer/login', authController.loginCustomer);
router.post('/login', authController.loginCustomer); // alias
router.post('/register', authController.registerCustomer);
router.post('/customer/register', authController.registerCustomer);
router.get('/store-info', authController.getStoreInfo);

module.exports = router;
