import express from 'express';
import { returnsController } from '../controllers/returnsController.js';
import { roleMiddleware } from '../middleware/auth.js';
import { CAN_MANAGE_RETURNS } from '../constants/roles.js';

const router = express.Router();

router.get('/', roleMiddleware(CAN_MANAGE_RETURNS), returnsController.getAllReturns);
router.post('/', roleMiddleware(CAN_MANAGE_RETURNS), returnsController.createReturn);
router.patch('/:id/approve', roleMiddleware(CAN_MANAGE_RETURNS), returnsController.approveReturn);
router.patch('/:id/complete', roleMiddleware(CAN_MANAGE_RETURNS), returnsController.completeReturn);

export default router;
