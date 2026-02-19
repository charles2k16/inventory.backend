import express from 'express';
import { stockReportsController } from '../controllers/stockReportsController.js';
import { roleMiddleware } from '../middleware/auth.js';
import { CAN_MANAGE_REPORTS } from '../constants/roles.js';

const router = express.Router();

router.get('/', roleMiddleware(CAN_MANAGE_REPORTS), stockReportsController.getAllReports);
router.get('/current', roleMiddleware(CAN_MANAGE_REPORTS), stockReportsController.getCurrentWeekReport);
router.get('/additional-stock', roleMiddleware(CAN_MANAGE_REPORTS), stockReportsController.getWeeklyAdditionalStock);
router.get('/:id', roleMiddleware(CAN_MANAGE_REPORTS), stockReportsController.getReport);
router.get('/:id/variance', roleMiddleware(CAN_MANAGE_REPORTS), stockReportsController.getStockVariance);
router.post('/', roleMiddleware(CAN_MANAGE_REPORTS), stockReportsController.createReport);
router.post('/additional-stock/record', roleMiddleware(CAN_MANAGE_REPORTS), stockReportsController.createAdditionalStock);
router.patch('/additional-stock/:id', roleMiddleware(CAN_MANAGE_REPORTS), stockReportsController.updateAdditionalStock);
router.delete('/additional-stock/:id', roleMiddleware(CAN_MANAGE_REPORTS), stockReportsController.deleteAdditionalStock);
router.patch('/:id/close', roleMiddleware(CAN_MANAGE_REPORTS), stockReportsController.closeReport);

export default router;
