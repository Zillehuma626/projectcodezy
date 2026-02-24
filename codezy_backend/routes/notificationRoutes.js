import express from "express";
import {
  getMyNotifications,
  getUnreadCount,
  markAsRead
} from "../controllers/notificationController.js";
import auth from "../middleware/auth.js";

const router = express.Router();

// Apply auth to all routes in this router to avoid repetition
router.use(auth);

// 1. Static routes first
router.get("/unread-count", getUnreadCount);
router.get("/", getMyNotifications);

// 2. Dynamic parameter routes last
router.patch("/:id/read", markAsRead);

export default router;