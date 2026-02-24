import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";
import jwt from "jsonwebtoken";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";

// Route Imports
import authRoutes from "./routes/authRoutes.js";
import teacherRoutes from "./routes/teacherRoutes.js";
import courseRoutes from "./routes/courseRoutes.js";
import studentRoutes from "./routes/studentRoutes.js";
import learnerRoutes from "./routes/learnerRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import learnerCoursesRoute from "./routes/learnerCourses.js";
import { getPendingNotifications } from "./services/notificationService.js";

dotenv.config();

const app = express();
const server = createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

app.set("io", io);

app.use(express.json());
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173", credentials: true }));

// ------------------- SOCKET AUTH -------------------
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("Authentication error: Token missing"));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    next();
  } catch {
    next(new Error("Authentication error: Invalid token"));
  }
});

// ------------------- SOCKET CONNECTION -------------------
io.on("connection", (socket) => {
  const { user } = socket;
  console.log("✅ New client connected:", socket.id, "User:", user?.userId);

  // Track if rooms joined and login notification sent
  socket.joinedRooms = false;
  socket.loginNotified = false;

  socket.on("joinRooms", async ({ userId, role, classIds = [], tenantId, fullName }, callback) => {
    try {
      if (socket.joinedRooms) return callback?.({ success: true });

      const rooms = [];

      // Personal room
      socket.join(`user-${userId}`);
      rooms.push(`user-${userId}`);

      // Tenant rooms
      if (tenantId) {
        const tenantRoom = `tenant-${tenantId}-${role === "student" ? "students" : "teachers"}`;
        socket.join(tenantRoom);
        rooms.push(tenantRoom);
      }

      // Class rooms
      classIds.forEach(id => {
        const classRoom = `${role === "student" ? "students" : "teachers"}-${id}`;
        socket.join(classRoom);
        rooms.push(classRoom);
      });

      socket.joinedRooms = true;
      console.log(`✅ User ${userId} joined rooms:`, rooms);
      callback?.({ success: true, rooms });

      // Send pending persistent notifications
      const pending = await getPendingNotifications(userId);
      pending.forEach(n => socket.emit("notification", {...n,persistent:true} ));

    } catch (err) {
      console.error("❌ joinRooms error:", err);
      callback?.({ success: false, error: err.message });
    }
  });

  socket.on("disconnect", reason => {
    console.log("❌ Client disconnected:", socket.id, "Reason:", reason);
  });
});

// ------------------- ROUTES -------------------
app.use("/api/auth", authRoutes);
app.use("/api/teachers", teacherRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/learners", learnerRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/learner-courses", learnerCoursesRoute);
// ------------------- DB & SERVER -------------------
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ DB Connection Error:", err));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
