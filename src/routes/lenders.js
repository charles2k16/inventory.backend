import express from 'express';
import { lendersController } from '../controllers/lendersController.js';

const router = express.Router();

router.get('/', lendersController.getAllLenders);
router.get('/with-debt', lendersController.getLendersWithDebt);
router.get('/:id', lendersController.getLender);
router.post('/', lendersController.createLender);
router.put('/:id', lendersController.updateLender);
router.post('/:id/payment', lendersController.recordPayment);
router.patch('/:id/status', lendersController.updateStatus);

export default router;
