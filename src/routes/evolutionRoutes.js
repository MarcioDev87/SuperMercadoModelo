const express = require('express');
const router = express.Router();
const evolutionController = require('../controllers/evolutionController');
const { authenticateAdmin } = require('../config/jwt');

router.get('/dashboard-stats', authenticateAdmin, evolutionController.getDashboardStats);
router.get('/whatsapp-status', authenticateAdmin, evolutionController.getWhatsAppStatus);

module.exports = router;
