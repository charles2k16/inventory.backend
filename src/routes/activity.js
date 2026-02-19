import express from 'express';
import { activityController } from '../controllers/activityController.js';
import { roleMiddleware } from '../middleware/auth.js';
import { CAN_VIEW_ACTIVITY } from '../constants/roles.js';

const router = express.Router();

// Activity logs: Admin only
router.get('/log', roleMiddleware(CAN_VIEW_ACTIVITY), activityController.getActivityLog);

// Get activity summary/statistics
router.get('/summary', roleMiddleware(CAN_VIEW_ACTIVITY), activityController.getActivitySummary);

// Get available activity types
router.get('/types', roleMiddleware(CAN_VIEW_ACTIVITY), activityController.getActivityTypes);

// Get activities by specific user
router.get('/user/:userId', roleMiddleware(CAN_VIEW_ACTIVITY), activityController.getUserActivityLog);

// Get activities for a specific resource
router.get('/resource/:resourceId', roleMiddleware(CAN_VIEW_ACTIVITY), activityController.getResourceActivityLog);

export default router;
