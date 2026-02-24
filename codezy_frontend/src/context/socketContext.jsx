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

export const SocketProvider = ({ children, user }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const socketRef = useRef(null);
  const joinedRef = useRef(false);

  // ------------------------------
  // Helper to decrement unread count safely
  // ------------------------------
  const decrementUnreadCount = useCallback(() => {
    setUnreadCount(prev => Math.max(prev - 1, 0));
  }, []);

  // ------------------------------
  // Mark notification as read
  // ------------------------------
  const markAsRead = useCallback(async (notificationId) => {
    try {
      // Optimistic UI update
      setNotifications(prev =>
        prev.map(n =>
          n.notificationId === notificationId ? { ...n, isRead: true } : n
        )
      );

      decrementUnreadCount();

      // API call
      await markNotificationRead(notificationId);
    } catch (err) {
      console.error("❌ Error marking notification as read:", err);
    }
  }, [decrementUnreadCount]);

  // ===============================
  // WELCOME TOAST (LOGIN GREETING)
  // ===============================
  useEffect(() => {
    if (!user) return;

    if (!sessionStorage.getItem(WELCOME_KEY)) {
      toast(`Hello ${user.fullName || "User"} 👋`, {
        icon: "🔔",
        duration: 5000,
      });
      sessionStorage.setItem(WELCOME_KEY, "true");
    }
  }, [user]);

  // ===============================
  // FETCH PERSISTENT NOTIFICATIONS ON LOGIN / REFRESH
  // ===============================
  useEffect(() => {
    if (!user?.token) return;

    const fetchPersistentNotifications = async () => {
      setLoading(true);
      try {
        const data = await fetchNotifications();

        // Merge with existing notifications (avoid duplicates)
        setNotifications(prev => {
          const existingIds = new Set(prev.map(n => n.notificationId));
          const merged = [
            ...data.filter(n => !existingIds.has(n.notificationId)),
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

  // ===============================
  // SOCKET.IO REAL-TIME LOGIC
  // ===============================
  useEffect(() => {
    if (!user?.token) return;
    if (socketRef.current) return;

    const socket = io(import.meta.env.VITE_SOCKET_URL || "http://localhost:5000", {
      auth: { token: user.token },
      transports: ["websocket"],
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    // Join relevant rooms for user, class, and tenant
    socket.on("connect", () => {
      if (!joinedRef.current) {
        socket.emit(
          "joinRooms",
          {
            userId: String(user._id),
            tenantId: String(user.tenantId || ""),
            role: user.role,
            classIds: (user.classIds || []).map(String),
          },
          (ack) => {
            if (!ack?.success)
              console.warn("⚠️ joinRooms failed:", ack?.error);
            joinedRef.current = true;
          }
        );
      }
    });

    // Handle incoming notifications
    socket.on("notification", (data) => {
      if (!data.persistent) {
        // Ephemeral → toast only
        toast(data.message || data.title, { icon: "🔔", duration: 5000 });
        return;
      }

      // Persistent → only add to dropdown
      setNotifications(prev => {
        const existingIds = new Set(prev.map(n => n.notificationId));
        if (existingIds.has(data.notificationId)) return prev;
        return [data, ...prev].sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );
      });

      // Update unread count
      if (!data.isRead) setUnreadCount(prev => prev + 1);
    });

    // Handle read updates from other tabs/devices
    socket.on("notification-read", ({ notificationId }) => {
      setNotifications(prev =>
        prev.map(n =>
          n.notificationId === notificationId ? { ...n, isRead: true } : n
        )
      );
      decrementUnreadCount();
    });

    socket.on("disconnect", () => {
      joinedRef.current = false;
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      joinedRef.current = false;
    };
  }, [user?.token, decrementUnreadCount]);

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
