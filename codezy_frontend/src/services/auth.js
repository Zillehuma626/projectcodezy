/**
 * Retrieves the current user and their auth token from localStorage.
 */
export const getCurrentUser = () => {
  const userString = localStorage.getItem("user");
  const token = localStorage.getItem("token"); // Often stored separately

  if (!userString) return null;

  try {
    const user = JSON.parse(userString);
    
    // If token is stored separately, merge it so SocketProvider can find it
    return {
      ...user,
      token: token || user.token 
    };
  } catch (err) {
    console.error("❌ Error parsing user from localStorage:", err);
    return null;
  }
};

/**
 * Helper to update user data without losing the session
 */
export const updateLocalUser = (newData) => {
  const current = getCurrentUser();
  if (current) {
    const updated = { ...current, ...newData };
    localStorage.setItem("user", JSON.stringify(updated));
    // Optional: window.dispatchEvent(new Event("storage")); 
    // This helps other tabs realize the user data changed
    return updated;
  }
  return null;
};