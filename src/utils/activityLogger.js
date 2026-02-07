import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Log an activity in the system
 * @param {Object} params - Activity logging parameters
 * @param {string} params.userId - ID of user performing the action
 * @param {string} params.action - Type of action (CREATE, UPDATE, DELETE, LOGIN, etc.)
 * @param {string} params.resourceType - Type of resource affected (PRODUCT, SALE, RETURN, etc.)
 * @param {string} params.resourceId - ID of the affected resource
 * @param {string} params.description - Human-readable description of the action
 * @param {Object} params.changes - Optional object with { before, after } for edit operations
 * @param {string} params.ipAddress - Optional client IP address
 * @returns {Promise<Object>} The created activity log record
 */
async function logActivity({
  userId,
  action,
  resourceType,
  resourceId,
  description,
  changes = null,
  ipAddress = null,
}) {
  try {
    // Validate required fields
    if (!userId || !action || !resourceType || !description) {
      console.warn('Activity logging: Missing required fields', {
        userId,
        action,
        resourceType,
        description,
      });
      return null;
    }

    const activityLog = await prisma.activityLog.create({
      data: {
        userId,
        action,
        resourceType,
        resourceId: resourceId || null,
        description,
        changes: changes ? JSON.stringify(changes) : null,
        ipAddress: ipAddress || null,
      },
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
    });

    return activityLog;
  } catch (error) {
    console.error('Error logging activity:', error);
    // Don't throw error - activity logging should not break the main operation
    return null;
  }
}

/**
 * Helper function to get client IP from request
 * @param {Object} req - Express request object
 * @returns {string} Client IP address
 */
function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

export { logActivity, getClientIp };
