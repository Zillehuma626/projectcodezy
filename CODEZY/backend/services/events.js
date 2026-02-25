// src/services/events.js
import { createNotification } from "./notificationService.js";

/**
 * Handle different notification events
 * Supports LOGIN, NEW_LAB, UPDATE_LAB, and GENERAL_ANNOUNCEMENT
 */
export const notifyEvent = async (eventType, payload, io) => {
  if (!io) return;

  const emitToRoom = (room, notification) => {
    io.to(room).emit("notification", notification);
  };

  switch (eventType) {

    // ================= LOGIN (EPHEMERAL ONLY) =================
    // Note: Welcome toast is now handled by frontend with sessionStorage to prevent duplicates
    case "LOGIN": {
      // No-op: Frontend handles welcome toast
      break;
    }

    // ================= NEW LAB =================
    case "NEW_LAB": {
      try {
        console.log("📬 NEW_LAB event received with payload:", JSON.stringify(payload, null, 2));
        
        const recipientIds = Array.isArray(payload.studentIds)
          ? payload.studentIds.map(id => id.toString())
          : [];
        
        console.log("📬 Recipient IDs for notification:", recipientIds);

        const teacherName = payload.teacherName || "Your Teacher";
        const data = payload.data || {
          labId: payload.labId?.toString() || "",
          courseId: payload.courseId?.toString() || "",
          classId: payload.classId?.toString() || "",
          teacherName
        };

        const notif = await createNotification({
          title: "New Lab Uploaded",
          message: `Lab "${payload.labTitle}" has been uploaded by ${teacherName}.`,
          type: "LAB_CREATED",
          createdBy: payload.teacherId,
          recipientIds,
          tenantId: payload.tenantId,
          data,
          io
        });

        if (!notif) break;

        // Emit to class room if available
        if (payload.classId) {
          const classRoom = `students-${payload.classId}`;
          emitToRoom(classRoom, {
            persistent: true,
            notificationId: notif.notificationId,
            title: notif.title,
            message: notif.message,
            type: notif.type,
            data: notif.data,
            isRead: false,
            createdAt: notif.createdAt?.toISOString?.() || new Date().toISOString()
          });
        }

        // Teacher ephemeral confirmation
        io.to(`user-${payload.teacherId}`).emit("notification", {
          title: "Lab Created",
          message: `You created "${payload.labTitle}"`,
          persistent: false
        });

      } catch (err) {
        console.error("Error in NEW_LAB:", err);
      }
      break;
    }

    // ================= UPDATE LAB =================
    case "UPDATE_LAB": {
      try {
        const recipientIds = Array.isArray(payload.studentIds)
          ? payload.studentIds.map(id => id.toString())
          : [];

        const teacherName = payload.teacherName || "Your Teacher";
        const data = payload.data || {
          labId: payload.labId?.toString() || "",
          courseId: payload.courseId?.toString() || "",
          classId: payload.classId?.toString() || "",
          teacherName
        };

        const notif = await createNotification({
          title: "Lab Updated",
          message: `Lab "${payload.labTitle}" has been updated by ${teacherName}.`,
          type: "LAB_UPDATED",
          createdBy: payload.teacherId,
          recipientIds,
          tenantId: payload.tenantId,
          data,
          io
        });

        if (!notif) break;

        // Emit to class room if available
        if (payload.classId) {
          const classRoom = `students-${payload.classId}`;
          emitToRoom(classRoom, {
            persistent: true,
            notificationId: notif.notificationId,
            title: notif.title,
            message: notif.message,
            type: notif.type,
            data: notif.data,
            isRead: false,
            createdAt: notif.createdAt?.toISOString?.() || new Date().toISOString()
          });
        }

      } catch (err) {
        console.error("Error in UPDATE_LAB:", err);
      }
      break;
    }

    // ================= ANNOUNCEMENT =================
    case "GENERAL_ANNOUNCEMENT": {
      try {
        const roles = ["student", "teacher"];
        for (const role of roles) {
          const notif = await createNotification({
            title: payload.title,
            message: payload.message,
            type: "ANNOUNCEMENT",
            role,
            tenantId: payload.tenantId,
            data: {},
            io
          });

          if (notif) {
            // Emit to tenant room
            io.to(`tenant-${payload.tenantId}-${role}s`).emit("notification", {
              persistent: true,
              notificationId: notif.notificationId,
              title: notif.title,
              message: notif.message,
              type: notif.type,
              data: notif.data,
              isRead: false,
              createdAt: notif.createdAt?.toISOString?.() || new Date().toISOString()
            });
          }
        }
      } catch (err) {
        console.error("Error in GENERAL_ANNOUNCEMENT:", err);
      }
      break;
    }

    default:
      console.warn("Unknown event type:", eventType);
  }
};

export default notifyEvent;
