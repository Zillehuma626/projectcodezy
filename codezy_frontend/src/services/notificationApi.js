import axios from "./axiosInstance";

/**
 * Fetch all notifications for the logged-in user
 * Returns an array of notifications
 */
export const fetchNotifications = async () => {
  try {
    const response = await axios.get("/notifications");
    // Ensure always returns an array
    if (Array.isArray(response.data)) return response.data;
    if (Array.isArray(response.data?.data)) return response.data.data;
    return [];
  } catch (error) {
    console.error(
      "❌ Failed to fetch notifications:",
      error.response?.data || error.message
    );
    return []; // return empty array to prevent frontend crash
  }
};

/**
 * Mark a specific notification as read by its notificationId
 */
export const markNotificationRead = async (notificationId) => {
  try {
    const response = await axios.patch(`/notifications/${notificationId}/read`);
    return response.data;
  } catch (error) {
    console.error(
      `❌ Failed to mark notification ${notificationId} as read:`,
      error.response?.data || error.message
    );
    throw error;
  }
};

/**
 * Mark all notifications as read for the logged-in user
 */
export const markAllNotificationsRead = async () => {
  try {
    const response = await axios.patch("/notifications/read-all");
    return response.data;
  } catch (error) {
    console.error(
      "❌ Failed to mark all notifications as read:",
      error.response?.data || error.message
    );
    throw error;
  }
};
