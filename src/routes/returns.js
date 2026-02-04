import express from 'express';
import { returnsController } from '../controllers/returnsController.js';

const router = express.Router();

router.get('/', returnsController.getAllReturns);
router.post('/', returnsController.createReturn);
router.patch('/:id/approve', returnsController.approveReturn);
router.patch('/:id/complete', returnsController.completeReturn);

export default router;
