const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const { authenticateAdmin } = require('../config/jwt');

const router = express.Router();
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Muitas tentativas. Aguarde antes de tentar novamente.' } });
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Limite de cadastros excedido. Tente mais tarde.' } });

router.post(['/login-manager', '/manager/login'], loginLimiter, authController.loginManager);
router.post(['/login-customer', '/customer/login', '/login'], loginLimiter, authController.loginCustomer);
router.post(['/register', '/customer/register'], registerLimiter, authController.registerCustomer);
router.get('/store-info', authController.getStoreInfo);
router.put('/store-info', authenticateAdmin, authController.updateStoreInfo);

module.exports = router;
