import express from 'express';
import { stockReportsController } from '../controllers/stockReportsController.js';

const router = express.Router();

router.get('/', stockReportsController.getAllReports);
router.get('/current', stockReportsController.getCurrentWeekReport);
router.get('/additional-stock', stockReportsController.getWeeklyAdditionalStock);
router.get('/:id', stockReportsController.getReport);
router.get('/:id/variance', stockReportsController.getStockVariance);
router.post('/', stockReportsController.createReport);
router.patch('/:id/close', stockReportsController.closeReport);

export default router;
