import mongoose from "mongoose";
import Notification from "../models/Notification.js";
import NotificationRecipient from "../models/NotificationRecipient.js";
import Student from "../models/Students.js";
import Teacher from "../models/Teacher.js";

/**
 * Create notification for individual users and/or entire roles
 */
export const createNotification = async ({
  title,
  message,
  type,
  createdBy,
  recipientIds = [],
  role = null,
  tenantId,
  data = {},
  io = null
}) => {
  if (!tenantId) tenantId = "GLOBAL";

  const tenantObjectId = mongoose.Types.ObjectId.isValid(tenantId)
    ? new mongoose.Types.ObjectId(String(tenantId))
    : tenantId;

  // Fetch users by role
  let roleUsers = [];
  if (role === "student") {
    roleUsers = await Student.find({ tenantId: tenantObjectId }).select("_id").lean();
  } else if (role === "teacher") {
    roleUsers = await Teacher.find({ tenantId: tenantObjectId }).select("_id").lean();
  }

  const allRecipients = [
    ...roleUsers.map(u => u._id.toString()),
    ...recipientIds.map(id => String(id))
  ];

  const uniqueRecipients = [...new Set(allRecipients)];

  if (uniqueRecipients.length === 0) {
    console.warn("No recipients for notification:", title);
    return null;
  }

  // Convert data values to strings for safety
  const safeData = {};
  if (data && typeof data === "object") {
    for (const key in data) {
      if (data[key] !== undefined && data[key] !== null) {
        safeData[key] = data[key].toString();
      }
    }
  }

  const notification = await Notification.create({
    title,
    message,
    type,
    createdBy,
    tenantId: tenantObjectId,
    data: safeData
  });

  const recipientDocs = uniqueRecipients.map(userId => ({
    notification: notification._id,
    user: new mongoose.Types.ObjectId(userId),
    tenantId: tenantObjectId
  }));

  await NotificationRecipient.insertMany(recipientDocs);

  // Emit real-time notifications via Socket.io
  if (io) {
    console.log("📤 Emitting notifications to users:", uniqueRecipients);
    
    // Debug: Check which sockets are in each room
    uniqueRecipients.forEach(uid => {
      const room = `user-${uid}`;
      const socketsInRoom = io.sockets.adapter.rooms.get(room);
      console.log(`   → Room ${room} has ${socketsInRoom?.size || 0} connected sockets`);
      
      if (socketsInRoom && socketsInRoom.size > 0) {
        io.to(room).emit("notification", {
          persistent: true,
          notificationId: notification._id.toString(),
          title: notification.title,
          message: notification.message,
          type: notification.type,
          data: notification.data || {},
          isRead: false,
          createdAt: notification.createdAt.toISOString()
        });
        console.log(`   ✅ Emitted to room: ${room}`);
      } else {
        console.log(`   ⚠️ No sockets in room: ${room} - notification saved but not delivered in real-time`);
      }
    });
  } else {
    console.log("⚠️ No io instance provided, skipping real-time emit");
  }

  return {
    notificationId: notification._id.toString(),
    title: notification.title,
    message: notification.message,
    type: notification.type,
    data: notification.data || {},
    createdAt: notification.createdAt,
    recipientCount: uniqueRecipients.length,
    recipientIds: uniqueRecipients
  };
};

/**
 * Get pending (unread) notifications for a user
 */
export const getPendingNotifications = async (userId) => {
  if (!userId) return [];

  const recipients = await NotificationRecipient.find({
    user: new mongoose.Types.ObjectId(String(userId)),
    isRead: false
  })
    .populate("notification")
    .sort({ createdAt: -1 })
    .lean();

  return recipients
    .filter(r => r.notification)
    .map(r => ({
      notificationId: r.notification._id.toString(),
      title: r.notification.title,
      message: r.notification.message,
      type: r.notification.type,
      data: r.notification.data || {},
      createdAt: r.notification.createdAt,
      isRead: r.isRead
    }));
};
