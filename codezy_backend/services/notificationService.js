import mongoose from "mongoose";
import Notification from "../models/Notification.js";
import NotificationRecipient from "../models/NotificationRecipient.js";
import Student from "../models/Students.js";
import Teacher from "../models/Teacher.js";

export const createNotification = async ({
  title,
  message,
  type,
  createdBy = null,
  recipientIds = [],
  role = null,
  tenantId,
  data = {},
  io = null
}) => {
  if (!tenantId) throw new Error("tenantId is required");

  const tenantObjectId = new mongoose.Types.ObjectId(String(tenantId));

  // 1️⃣ Fetch users by role
  let roleUsers = [];
  if (role === "student") {
    roleUsers = await Student.find({ tenantId: tenantObjectId }).select("_id").lean();
  }
  if (role === "teacher") {
    roleUsers = await Teacher.find({ tenantId: tenantObjectId }).select("_id").lean();
  }

  // 2️⃣ Normalize + deduplicate recipients
  const normalizedRecipients = [
    ...roleUsers.map(u => String(u._id)),
    ...recipientIds.map(id => String(id))
  ];
  const uniqueRecipients = [...new Set(normalizedRecipients)];
  if (uniqueRecipients.length === 0) return null;

  // 3️⃣ Convert all data to strings
  const safeData = {};
  if (data && typeof data === "object") {
    for (const key in data) {
      if (data[key] !== undefined && data[key] !== null) {
        safeData[key] = data[key].toString();
      }
    }
  }

  // 4️⃣ Start transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Create the notification
    const [newNotification] = await Notification.create(
      [
        {
          title,
          message,
          type,
          createdBy: createdBy ? new mongoose.Types.ObjectId(String(createdBy)) : null,
          tenantId: tenantObjectId,
          data: safeData
        }
      ],
      { session }
    );

    // 5️⃣ Upsert recipient document for each user
    const bulkOps = uniqueRecipients.map(uid => ({
      updateOne: {
        filter: { user: uid },
        update: {
          $setOnInsert: { tenantId: tenantObjectId },
          $push: { notifications: { notification: newNotification._id, isRead: false } }
        },
        upsert: true
      }
    }));

    await NotificationRecipient.bulkWrite(bulkOps, { session });

    await session.commitTransaction();
    session.endSession();

    // 6️⃣ Emit real-time notifications
    if (io) {
      uniqueRecipients.forEach(uid => {
        io.to(`user-${uid}`).emit("notification", {
          persistent: true,
          notificationId: newNotification._id.toString(),
          title: newNotification.title,
          message: newNotification.message,
          type: newNotification.type,
          data: newNotification.data || {},
          isRead: false,
          createdAt: newNotification.createdAt.toISOString()
        });
      });
    }

    return {
      notificationId: newNotification._id.toString(),
      title: newNotification.title,
      message: newNotification.message,
      type: newNotification.type,
      data: newNotification.data || {},
      createdAt: newNotification.createdAt,
      recipientCount: uniqueRecipients.length,
      recipientIds: uniqueRecipients
    };

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
};

export const getPendingNotifications = async (userId) => {
  if (!userId) return [];

  const recipient = await NotificationRecipient.findOne({ user: userId })
    .populate({
      path: "notifications.notification",
      select: "title message type createdAt data"
    })
    .lean();

  if (!recipient) return [];

  return (recipient.notifications || [])
    .filter(n => !n.isRead && n.notification)
    .map(n => ({
      notificationId: n.notification._id.toString(),
      title: n.notification.title,
      message: n.notification.message,
      type: n.notification.type,
      data: n.notification.data || {},
      createdAt: n.notification.createdAt,
      isRead: n.isRead
    }));
};
