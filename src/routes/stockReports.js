import express from 'express';
import { stockReportsController } from '../controllers/stockReportsController.js';

const router = express.Router();

router.get('/', stockReportsController.getAllReports);
router.get('/current', stockReportsController.getCurrentWeekReport);
router.get('/additional-stock', stockReportsController.getWeeklyAdditionalStock);
router.get('/:id', stockReportsController.getReport);
router.get('/:id/variance', stockReportsController.getStockVariance);
router.post('/', stockReportsController.createReport);
router.post('/additional-stock/record', stockReportsController.createAdditionalStock);
router.patch('/additional-stock/:id', stockReportsController.updateAdditionalStock);
router.delete('/additional-stock/:id', stockReportsController.deleteAdditionalStock);
router.patch('/:id/close', stockReportsController.closeReport);

export default router;
