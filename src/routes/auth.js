import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { logActivity, getClientIp } from '../utils/activityLogger.js';
import { authMiddleware, roleMiddleware } from '../middleware/auth.js';
import { CAN_VIEW_ACTIVITY } from '../constants/roles.js';

const router = express.Router();
const prisma = new PrismaClient();

// Login
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      // Log failed login attempt
      await logActivity({
        userId: user.id,
        action: 'LOGIN_FAILED',
        resourceType: 'USER',
        resourceId: user.id,
        description: `Failed login attempt for user ${username}`,
        ipAddress: getClientIp(req),
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
    );

    // Log successful login
    await logActivity({
      userId: user.id,
      action: 'LOGIN',
      resourceType: 'USER',
      resourceId: user.id,
      description: `User ${username} logged in`,
      ipAddress: getClientIp(req),
    });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Register (admin only)
router.post('/register', authMiddleware, roleMiddleware(CAN_VIEW_ACTIVITY), async (req, res, next) => {
  try {
    const { username, email, password, firstName, lastName, role } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: role || 'SALES',
      },
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

    await logActivity({
      userId: req.user.id,
      action: 'CREATE',
      resourceType: 'USER',
      resourceId: user.id,
      description: `Admin created user ${user.username} (${user.role})`,
      ipAddress: getClientIp(req),
    });

    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
});

export default router;
