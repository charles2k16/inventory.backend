import express from 'express';
import { PrismaClient } from '@prisma/client';
import { roleMiddleware } from '../middleware/auth.js';
import { CAN_VIEW_ACTIVITY } from '../constants/roles.js';

const router = express.Router();
const prisma = new PrismaClient();

// List all users (admin only)
router.get('/', roleMiddleware(CAN_VIEW_ACTIVITY), async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
    res.json(users);
  } catch (error) {
    next(error);
  }
});

export default router;
