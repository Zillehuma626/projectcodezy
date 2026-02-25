import express from "express";
import {
  getMyNotifications,
  getUnreadCount,
  markAsRead
} from "../controllers/notificationController.js";
import auth from "../middleware/auth.js";

const router = express.Router();

// Apply auth to all routes
router.use(auth);

// Static routes first
router.get("/unread-count", getUnreadCount);
router.get("/", getMyNotifications);

// Dynamic parameter routes last
router.patch("/:id/read", markAsRead);

export default router;
