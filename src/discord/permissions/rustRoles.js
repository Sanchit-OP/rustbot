/**
 * Role-based permissions for Rust commands
 * This module can be extended to add role-based access control
 */

/**
 * Check if a user has permission to use Rust commands
 * Currently allows all users, but can be extended for role-based permissions
 */
function hasRustPermission(member) {
  // For now, allow all users
  // In the future, you can check for specific roles:
  // return member.roles.cache.some(role => role.name === 'Rust Admin');
  return true;
}

/**
 * Get required role names for Rust commands
 */
function getRequiredRoles() {
  return []; // Empty array means no specific roles required
}

module.exports = {
  hasRustPermission,
  getRequiredRoles,
};
