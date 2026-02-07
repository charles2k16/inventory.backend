import express from 'express';
import { activityController } from '../controllers/activityController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Get activity log with filtering and pagination
router.get('/log', activityController.getActivityLog);

// Get activity summary/statistics
router.get('/summary', activityController.getActivitySummary);

// Get available activity types
router.get('/types', activityController.getActivityTypes);

// Get activities by specific user
router.get('/user/:userId', activityController.getUserActivityLog);

// Get activities for a specific resource
router.get('/resource/:resourceId', activityController.getResourceActivityLog);

export default router;
