import mongoose from "mongoose";
import NotificationRecipient from "../models/NotificationRecipient.js";

export const getMyNotifications = async (req, res) => {
  try {
    const userId = req.user.userId;  
    const tenantId = req.user.tenantId;

    console.log("📥 Fetching notifications for user:", userId, "tenant:", tenantId);

    if (!userId) return res.status(400).json({ message: "User not found" });

    // Build query - handle both ObjectId and string tenantId
    const query = {
      user: new mongoose.Types.ObjectId(userId)
    };
    
    if (tenantId) {
      if (mongoose.Types.ObjectId.isValid(tenantId)) {
        query.tenantId = new mongoose.Types.ObjectId(tenantId);
      } else {
        query.tenantId = tenantId; // For "GLOBAL" or other non-ObjectId values
      }
    }

    console.log("📥 Query:", JSON.stringify(query));

    const notifications = await NotificationRecipient.find(query)
      .populate("notification")
      .sort({ createdAt: -1 })
      .lean();

    console.log("📥 Found notification recipients:", notifications.length);

    // Flatten and format for frontend
    const formatted = notifications
      .filter(nr => nr.notification) // filter out orphans
      .map(nr => ({
        _id: nr._id.toString(),
        notificationId: nr.notification._id.toString(),
        title: nr.notification.title,
        message: nr.notification.message,
        type: nr.notification.type,
        createdAt: nr.notification.createdAt,
        isRead: nr.isRead,
        data: nr.notification.data || {}
      }));

    console.log("📥 Returning formatted notifications:", formatted.length);
    res.json(formatted);
  } catch (err) {
    console.error("FETCH NOTIFICATIONS ERROR:", err);
    res.status(500).json({ message: "Server error fetching notifications" });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const userId = req.user.userId;
    const notificationId = req.params.id;
    const io = req.app.get("io");

    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({ message: "Invalid notification ID format" });
    }

    // Try to find by _id first, then by notification field
    let recipient = await NotificationRecipient.findOneAndUpdate(
      { _id: notificationId, user: new mongoose.Types.ObjectId(userId) },
      { isRead: true, readAt: new Date() },
      { new: true }
    );

    // If not found by _id, try by notification field
    if (!recipient) {
      recipient = await NotificationRecipient.findOneAndUpdate(
        { notification: new mongoose.Types.ObjectId(notificationId), user: new mongoose.Types.ObjectId(userId) },
        { isRead: true, readAt: new Date() },
        { new: true }
      );
    }

    if (!recipient) {
      return res.status(404).json({ message: "Notification not found" });
    }

    // Emit socket event for real-time sync across tabs/devices
    if (io) {
      io.to(`user-${userId}`).emit("notification-read", { notificationId });
    }

    res.json({ message: "Notification marked as read", notificationId });
  } catch (err) {
    console.error("MARK AS READ ERROR:", err);
    res.status(500).json({ message: "Server error marking notification as read" });
  }
};

export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.userId;
    const tenantId = req.user.tenantId;

    const unreadCount = await NotificationRecipient.countDocuments({
      user: new mongoose.Types.ObjectId(userId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
      isRead: false
    });

    res.json({ unreadCount });
  } catch (err) {
    console.error("UNREAD COUNT ERROR:", err);
    res.status(500).json({ message: "Server error fetching unread count" });
  }
};
