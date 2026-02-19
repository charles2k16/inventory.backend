/**
 * User roles and permissions
 * ADMIN - Full access
 * MANAGER - Add products, stock updates, weekly reports
 * SALES - POS, sales, add lenders/customers only
 */
export const ROLES = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  SALES: 'SALES',
};

/** Roles that can add/edit products and manage stock */
export const CAN_MANAGE_PRODUCTS = [ROLES.ADMIN, ROLES.MANAGER];

/** Roles that can update stock / additional stock / inventory */
export const CAN_MANAGE_STOCK = [ROLES.ADMIN, ROLES.MANAGER];

/** Roles that can manage weekly stock reports */
export const CAN_MANAGE_REPORTS = [ROLES.ADMIN, ROLES.MANAGER];

/** Roles that can process returns */
export const CAN_MANAGE_RETURNS = [ROLES.ADMIN, ROLES.MANAGER];

/** Roles that can view activity logs (sensitive) */
export const CAN_VIEW_ACTIVITY = [ROLES.ADMIN];

/** All roles that can use POS, sales, and lenders */
export const CAN_SALES_AND_LENDERS = [ROLES.ADMIN, ROLES.MANAGER, ROLES.SALES];

/** Normalize legacy STAFF role to SALES for permission checks */
export function normalizeRole(role) {
  return role === 'STAFF' ? 'SALES' : role;
}
