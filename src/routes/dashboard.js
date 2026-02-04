import express from 'express';
import { dashboardController } from '../controllers/dashboardController.js';

const router = express.Router();

router.get('/stats', dashboardController.getDashboardStats);
router.get('/sales-chart', dashboardController.getSalesChartData);
router.get('/inventory-by-category', dashboardController.getInventoryByCategory);

export default router;
