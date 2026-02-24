import mongoose from "mongoose";

const notificationRecipientSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true // One document per user
    },
    notifications: [
      {
        notification: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Notification",
          required: true
        },
        isRead: { type: Boolean, default: false },
        readAt: { type: Date }
      }
    ]
  },
  { timestamps: true }
);

// Index for quick unread count retrieval
notificationRecipientSchema.index({ "notifications.isRead": 1 });

export default mongoose.model(
  "NotificationRecipient",
  notificationRecipientSchema
);
