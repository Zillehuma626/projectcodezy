import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    tenantId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Tenant", 
      required: true 
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: [
        "LAB_CREATED",
        "LAB_UPDATED",
        "EXAM_CREATED",
        "ANNOUNCEMENT",
        "SYSTEM",
      ],
      required: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  { timestamps: true,
    minimize: false // Allow flexible data field without strict schema
   }
);

const Notification = mongoose.models.Notification || mongoose.model("Notification", notificationSchema);

export default Notification;
