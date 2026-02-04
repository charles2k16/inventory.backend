import express from 'express';
import { salesController } from '../controllers/salesController.js';

const router = express.Router();

router.get('/', salesController.getAllSales);
router.get('/summary', salesController.getSalesSummary);
router.get('/:id', salesController.getSale);
router.post('/', salesController.createSale);
router.patch('/:id/payment', salesController.updatePayment);

export default router;
