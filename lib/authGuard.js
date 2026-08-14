/**
 * Check if a user has access to a specific page module key.
 *
 * @param {object} user - The auth user or firestore user object
 * @param {string} role - The role string (e.g. "superAdmin", "admin", "user")
 * @param {object} permissions - The user's permissions map from Firestore
 * @param {string} pageKey - The unique key of the page module
 */
export function hasPageAccess(user, role = "", permissions = {}, pageKey = "") {
  if (!user) return false;

  const normalizedRole = (role || user.role || "").toLowerCase();

  // SuperAdmins always have unrestricted access
  if (normalizedRole === "superAdmin" || normalizedRole === "superAdmin") {
    return true;
  }

  // Check the permissions map from Firestore document
  const userPerms = permissions && Object.keys(permissions).length > 0
    ? permissions 
    : (user.permissions || {});

  return !!userPerms[pageKey];
}