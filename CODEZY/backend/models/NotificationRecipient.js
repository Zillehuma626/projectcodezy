import mongoose from "mongoose";

const notificationRecipientSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true
    },
    notification: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Notification",
      required: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    
    isRead: { type: Boolean, default: false },
    readAt: { type: Date }
  },
  { timestamps: true }
);

// Compound index: one recipient per notification per user (not unique user globally)
notificationRecipientSchema.index({ notification: 1, user: 1 }, { unique: true });

// Index for fast queries by user
notificationRecipientSchema.index({ user: 1, isRead: 1 });

export default mongoose.model(
  "NotificationRecipient",
  notificationRecipientSchema
);
