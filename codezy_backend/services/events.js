import { createNotification } from "./notificationService.js";

/**
 * Handle different notification events
 * Supports NEW_LAB, UPDATE_LAB, and GENERAL_ANNOUNCEMENT
 */
export const notifyEvent = async (eventType, payload, io) => {
  if (!io) return;

  const emitToRoom = (room, notification) => {
    io.to(room).emit("notification", notification);
  };

  switch (eventType) {

    // =========================
    // NEW LAB
    // =========================
    case "NEW_LAB":
      try {
        const recipientIds = Array.isArray(payload.studentIds)
          ? payload.studentIds.map(id => id.toString())
          : [];

        const teacherName = payload.teacherName || "Your Teacher";

        const notif = await createNotification({
          title: "New Lab Uploaded",
          message: `Lab "${payload.labTitle}" has been uploaded by ${teacherName}.`,
          type: "LAB_CREATED",
          createdBy: payload.teacherId,
          recipientIds,
          tenantId: payload.tenantId,
          data: {
            labId: payload.labId?.toString() || "",
            courseId: payload.courseId?.toString() || "",
            classId: payload.classId?.toString() || "",
            teacherName
          },
          io
        });

        if (!notif) return;

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
            createdAt: notif.createdAt.toISOString()
          });
        }

      } catch (err) {
        console.error("Error in NEW_LAB:", err);
      }
      break;

    // =========================
    // UPDATE LAB
    // =========================
    case "UPDATE_LAB":
      try {
        const recipientIds = Array.isArray(payload.studentIds)
          ? payload.studentIds.map(id => id.toString())
          : [];

        const teacherName = payload.teacherName || "Your Teacher";

        const notif = await createNotification({
          title: "Lab Updated",
          message: `Lab "${payload.labTitle}" has been updated by ${teacherName}.`,
          type: "LAB_UPDATED",
          createdBy: payload.teacherId,
          recipientIds,
          tenantId: payload.tenantId,
          data: {
            labId: payload.labId?.toString() || "",
            courseId: payload.courseId?.toString() || "",
            classId: payload.classId?.toString() || "",
            teacherName
          },
          io
        });

        if (!notif) return;

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
            createdAt: notif.createdAt.toISOString()
          });
        }

      } catch (err) {
        console.error("Error in UPDATE_LAB:", err);
      }
      break;

    // =========================
    // GENERAL ANNOUNCEMENT
    // =========================
    case "GENERAL_ANNOUNCEMENT":
      try {
        const roles = ["student", "teacher"];
        for (const role of roles) {
          const notif = await createNotification({
            title: payload.title,
            message: payload.message,
            type: "ANNOUNCEMENT",
            role,           // Will fetch users by role inside createNotification
            tenantId: payload.tenantId,
            data: {},
            io
          });

          // Optional: emit real-time per role if needed
          if (notif) {
            // Emit to all users of this role in the tenant (frontend can subscribe per role room)
            io.to(`${role}-tenant-${payload.tenantId}`).emit("notification", {
              persistent: true,
              notificationId: notif.notificationId,
              title: notif.title,
              message: notif.message,
              type: notif.type,
              data: notif.data,
              isRead: false,
              createdAt: notif.createdAt.toISOString()
            });
          }
        }
      } catch (err) {
        console.error("Error in GENERAL_ANNOUNCEMENT:", err);
      }
      break;

    default:
      console.warn("Unknown event type:", eventType);
  }
};

export default notifyEvent;
