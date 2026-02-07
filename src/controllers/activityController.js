import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const activityController = {
  // Get all activity logs with pagination and filtering
  async getActivityLog(req, res, next) {
    try {
      const {
        page = 1,
        limit = 50,
        action,
        resourceType,
        userId,
        startDate,
        endDate,
        search,
      } = req.query;

      const where = {};

      // Filter by action
      if (action) {
        where.action = action;
      }

      // Filter by resource type
      if (resourceType) {
        where.resourceType = resourceType;
      }

      // Filter by user
      if (userId) {
        where.userId = userId;
      }

      // Filter by date range
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) {
          const end = new Date(endDate);
          end.setDate(end.getDate() + 1);
          where.createdAt.lte = end;
        }
      }

      // Search in description
      if (search) {
        where.description = { contains: search, mode: 'insensitive' };
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [activities, total] = await Promise.all([
        prisma.activityLog.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: parseInt(limit),
        }),
        prisma.activityLog.count({ where }),
      ]);

      res.json({
        activities,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit)),
        },
      });
    } catch (error) {
      next(error);
    }
  },

  // Get activity summary/stats
  async getActivitySummary(req, res, next) {
    try {
      const { startDate, endDate } = req.query;

      const where = {};

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) {
          const end = new Date(endDate);
          end.setDate(end.getDate() + 1);
          where.createdAt.lte = end;
        }
      }

      // Get activity breakdown by action
      const byAction = await prisma.activityLog.groupBy({
        by: ['action'],
        where,
        _count: {
          id: true,
        },
      });

      // Get activity breakdown by resource type
      const byResourceType = await prisma.activityLog.groupBy({
        by: ['resourceType'],
        where,
        _count: {
          id: true,
        },
      });

      // Get top users by activity count
      const byUser = await prisma.activityLog.groupBy({
        by: ['userId'],
        where,
        _count: {
          id: true,
        },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      });

      // Get user details for top users
      const userIds = byUser.map(u => u.userId);
      const userDetails = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
        },
      });

      const topUsers = byUser.map(activity => {
        const user = userDetails.find(u => u.id === activity.userId);
        return {
          user,
          count: activity._count.id,
        };
      });

      // Total activities
      const totalActivities = await prisma.activityLog.count({ where });

      res.json({
        summary: {
          totalActivities,
          startDate: startDate || 'All time',
          endDate: endDate || 'All time',
        },
        byAction: byAction.map(item => ({
          action: item.action,
          count: item._count.id,
        })),
        byResourceType: byResourceType.map(item => ({
          resourceType: item.resourceType,
          count: item._count.id,
        })),
        topUsers,
      });
    } catch (error) {
      next(error);
    }
  },

  // Get activities by specific user
  async getUserActivityLog(req, res, next) {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 50 } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [activities, total] = await Promise.all([
        prisma.activityLog.findMany({
          where: { userId },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: parseInt(limit),
        }),
        prisma.activityLog.count({ where: { userId } }),
      ]);

      res.json({
        activities,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit)),
        },
      });
    } catch (error) {
      next(error);
    }
  },

  // Get activities for a specific resource
  async getResourceActivityLog(req, res, next) {
    try {
      const { resourceId } = req.params;
      const { page = 1, limit = 50 } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [activities, total] = await Promise.all([
        prisma.activityLog.findMany({
          where: { resourceId },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: parseInt(limit),
        }),
        prisma.activityLog.count({ where: { resourceId } }),
      ]);

      res.json({
        activities,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit)),
        },
      });
    } catch (error) {
      next(error);
    }
  },

  // Get list of available actions and resource types
  async getActivityTypes(req, res, next) {
    try {
      const actions = await prisma.activityLog.findMany({
        distinct: ['action'],
        select: { action: true },
      });

      const resourceTypes = await prisma.activityLog.findMany({
        distinct: ['resourceType'],
        select: { resourceType: true },
      });

      res.json({
        actions: actions.map(a => a.action),
        resourceTypes: resourceTypes.map(r => r.resourceType),
      });
    } catch (error) {
      next(error);
    }
  },
};
