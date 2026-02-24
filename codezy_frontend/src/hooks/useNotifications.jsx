import { useCallback } from "react";
import { useSocket } from "../context/socketContext";

export const useNotifications = () => {
  const {
    notifications,
    unreadCount,
    markAsRead,
    loading,
  } = useSocket();

  // -------------------------------
  // Reload all persistent notifications (optional)
  // -------------------------------
  const reload = useCallback(() => {
    // If you want to reload, just refetch from backend
    // Or you can call fetchNotifications here if needed
  }, []);

  return {
    notifications,
    unreadCount,
    markAsRead,
    reload,
    loading,
  };
};
