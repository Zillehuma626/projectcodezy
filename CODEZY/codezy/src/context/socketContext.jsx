// src/context/socketContext.jsx
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
} from "react";
import { io } from "socket.io-client";
import { toast } from "react-hot-toast";
import { fetchNotifications, markNotificationRead } from "../services/notificationApi.js";

const SocketContext = createContext();
const WELCOME_KEY = "welcomeShown";

export const SocketProvider = ({ children, user, onNotification }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const socketRef = useRef(null);
  const joinedRef = useRef(false);

  // Helper to decrement unread count safely
  const decrementUnreadCount = useCallback(() => {
    setUnreadCount(prev => Math.max(prev - 1, 0));
  }, []);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId) => {
    try {
      // Optimistic UI update
      setNotifications(prev =>
        prev.map(n =>
          (n.notificationId === notificationId || n._id === notificationId)
            ? { ...n, isRead: true }
            : n
        )
      );

      decrementUnreadCount();

      // API call
      await markNotificationRead(notificationId);
    } catch (err) {
      console.error("❌ Error marking notification as read:", err);
    }
  }, [decrementUnreadCount]);

  // Welcome toast on login
  useEffect(() => {
    if (!user) return;

    if (!sessionStorage.getItem(WELCOME_KEY)) {
      toast(`Hello ${user.fullName || user.name || "User"} 👋`, {
        icon: "🔔",
        duration: 5000,
      });
      sessionStorage.setItem(WELCOME_KEY, "true");
    }
  }, [user]);

  // Fetch persistent notifications on login/refresh
  useEffect(() => {
    if (!user?.token) return;

    const fetchPersistentNotifications = async () => {
      setLoading(true);
      try {
        const data = await fetchNotifications();

        // Merge with existing notifications (avoid duplicates)
        setNotifications(prev => {
          const existingIds = new Set(prev.map(n => n.notificationId || n._id));
          const merged = [
            ...data.filter(n => !existingIds.has(n.notificationId || n._id)),
            ...prev
          ];
          return merged.sort(
            (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
          );
        });

        // Update unread count
        const unread = data.filter(n => !n.isRead).length;
        setUnreadCount(unread);

      } catch (err) {
        console.error("❌ Failed to fetch persistent notifications:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPersistentNotifications();
  }, [user?.token]);

  // Socket.io real-time logic
  useEffect(() => {
    if (!user?.token) return;
    if (socketRef.current) return;

    console.log("🔧 Setting up socket connection for user:", user._id || user.id);

    const socket = io(import.meta.env.VITE_SOCKET_URL || "http://localhost:5000", {
      auth: { token: user.token },
      transports: ["websocket", "polling"], // Allow fallback to polling
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    // Helper function to join rooms
    const joinRooms = () => {
      console.log("🔄 Attempting to join rooms for user:", user._id || user.id);
      socket.emit(
        "joinRooms",
        {
          userId: String(user._id || user.id),
          tenantId: String(user.tenantId || ""),
          role: user.role,
          classIds: (user.classIds || []).map(String),
        },
        (ack) => {
          if (ack?.success) {
            console.log("✅ Successfully joined rooms:", ack.rooms);
            joinedRef.current = true;
          } else {
            console.warn("⚠️ joinRooms failed:", ack?.error);
          }
        }
      );
    };

    // Join relevant rooms for user, class, and tenant
    socket.on("connect", () => {
      console.log("✅ Socket connected! ID:", socket.id);
      // Always rejoin rooms on connect (handles reconnections)
      joinRooms();
    });

    console.log("🎧 Setting up notification listener...");

    // Handle incoming notifications
    socket.on("notification", (data) => {
      console.log("🔔 Received notification:", data);

      // Call legacy onNotification callback if provided
      if (onNotification) onNotification(data);

      if (!data.persistent) {
        // Ephemeral → toast only (like welcome message)
        toast(data.message || data.title, { icon: "🔔", duration: 5000 });
        return;
      }

      // Persistent → add to dropdown only (no toast)
      console.log("📥 Adding notification to state...");
      setNotifications(prev => {
        console.log("📥 Current notifications count:", prev.length);
        const existingIds = new Set(prev.map(n => n.notificationId || n._id));
        if (existingIds.has(data.notificationId || data._id)) {
          console.log("⚠️ Notification already exists, skipping");
          return prev;
        }
        const newList = [data, ...prev].sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );
        console.log("✅ New notifications count:", newList.length);
        return newList;
      });

      // Update unread count
      if (!data.isRead) {
        console.log("🔢 Incrementing unread count");
        setUnreadCount(prev => prev + 1);
      }
    });

    // Handle read updates from other tabs/devices
    socket.on("notification-read", ({ notificationId }) => {
      setNotifications(prev =>
        prev.map(n =>
          (n.notificationId === notificationId || n._id === notificationId)
            ? { ...n, isRead: true }
            : n
        )
      );
      decrementUnreadCount();
    });

    socket.on("disconnect", (reason) => {
      console.log("⚠️ Socket disconnected:", reason);
      joinedRef.current = false;
    });

    socket.on("connect_error", (err) => {
      console.error("❌ Socket connection error:", err);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      joinedRef.current = false;
    };
  }, [user?.token, decrementUnreadCount, onNotification]);

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        notifications,
        unreadCount,
        markAsRead,
        decrementUnreadCount,
        loading,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
