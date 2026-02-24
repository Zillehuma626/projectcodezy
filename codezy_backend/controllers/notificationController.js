import mongoose from "mongoose";
import NotificationRecipient from "../models/NotificationRecipient.js";

// -----------------------------
// GET all notifications for the logged-in user
// -----------------------------
export const getMyNotifications = async (req, res) => {
  try {
    const userId = req.user.userId;
    const tenantId = req.user.tenantId;

    // Fetch the user's recipient document
    const recipientDoc = await NotificationRecipient.findOne({
      user: new mongoose.Types.ObjectId(userId),
      tenantId: new mongoose.Types.ObjectId(tenantId)
    })
      .populate({
        path: "notifications.notification",
        select: "title message type createdAt data" // include 'data'
      })
      .lean();

    if (!recipientDoc || !recipientDoc.notifications) {
      return res.json([]);
    }

    // Flatten notifications array
    const notifications = recipientDoc.notifications
      .filter(n => n.notification) // filter out orphans
      .map(n => ({
        notificationId: n.notification._id.toString(),
        title: n.notification.title,
        message: n.notification.message,
        type: n.notification.type,
        createdAt: n.notification.createdAt,
        isRead: n.isRead,
        data: {
          labId: n.notification.data?.labId?._id
            ? n.notification.data.labId._id.toString()
            : n.notification.data?.labId?.toString(),
          courseId: n.notification.data?.courseId?._id
            ? n.notification.data.courseId._id.toString()
            : n.notification.data?.courseId?.toString(),
          classId: n.notification.data?.classId?._id
            ? n.notification.data.classId._id.toString()
            : n.notification.data?.classId?.toString(),
          ...n.notification.data
        }
      }))
      // sort newest first
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(notifications);
  } catch (err) {
    console.error("FETCH NOTIFICATIONS ERROR:", err);
    res.status(500).json({ message: "Server error fetching notifications" });
  }
};

// -----------------------------
// MARK a notification as read
// -----------------------------
export const markAsRead = async (req, res) => {
  try {
    const userId = req.user.userId;
    const tenantId = req.user.tenantId;
    const notificationId = req.params.id;
    const io = req.app.get("io");

    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({ message: "Invalid notification ID format" });
    }

    // Update the specific notification in the array
    const recipientDoc = await NotificationRecipient.findOneAndUpdate(
      {
        user: new mongoose.Types.ObjectId(userId),
        tenantId: new mongoose.Types.ObjectId(tenantId),
        "notifications.notification": new mongoose.Types.ObjectId(notificationId)
      },
      {
        $set: { "notifications.$.isRead": true, "notifications.$.readAt": new Date() }
      },
      { new: true }
    );

    if (!recipientDoc) {
      return res.status(404).json({ message: "Notification not found" });
    }

    if (io) {
      io.to(`user-${userId}`).emit("notification-read", { notificationId });
    }

    res.json({ message: "Notification marked as read", notificationId });
  } catch (err) {
    console.error("MARK AS READ ERROR:", err);
    res.status(500).json({ message: "Server error marking notification as read" });
  }
};

// -----------------------------
// GET unread notification count
// -----------------------------
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.userId;
    const tenantId = req.user.tenantId;

    const recipientDoc = await NotificationRecipient.findOne({
      user: new mongoose.Types.ObjectId(userId),
      tenantId: new mongoose.Types.ObjectId(tenantId)
    }).lean();

    const unreadCount = recipientDoc?.notifications?.filter(n => !n.isRead).length || 0;

    res.json({ unreadCount });
  } catch (err) {
    console.error("UNREAD COUNT ERROR:", err);
    res.status(500).json({ message: "Server error fetching unread count" });
  }
};
