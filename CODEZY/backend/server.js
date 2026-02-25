import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";
import jwt from "jsonwebtoken";
import authRoutes from "./routes/authRoutes.js";
import paymentRoutes from "./routes/payment.js";
import subscriptionRoutes from "./routes/subscription.js";
import teacherRoutes from "./routes/teacherRoutes.js";
import courseRoutes from "./routes/courseRoutes.js";
import studentRoutes from './routes/studentRoutes.js';
import learnerRoutes from './routes/learnerRoutes.js';
import notificationRoutes from "./routes/notificationRoutes.js";
import codeExecutionRoutes from "./routes/codeExecutionRoutes.js";
import learnerCoursesRoute from "./routes/learnerCourses.js";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { getPendingNotifications } from "./services/notificationService.js";

dotenv.config();

const app = express();
const server = createServer(app);

// Stripe webhook raw parser (must be before express.json())
app.use("/api/payments/webhook", express.raw({ type: "application/json" }));

// JSON parser
app.use(express.json());

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
}));

// Socket.IO
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

// Make io accessible in routes/controllers
app.set("io", io);

// Socket Authentication Middleware
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

// Socket Connection Handler
io.on("connection", (socket) => {
  const { user } = socket;
  console.log("✅ New client connected:", socket.id, "User:", user?.userId);

  socket.joinedRooms = false;

  socket.on("joinRooms", async ({ userId, role, classIds = [], tenantId, fullName }, callback) => {
    try {
      console.log("🔍 DEBUG - joinRooms called with userId:", userId, "role:", role, "socketId:", socket.id);
      
      // Allow rejoining if socket reconnects (remove the early return)
      const rooms = [];

      // Personal room
      socket.join(`user-${userId}`);
      rooms.push(`user-${userId}`);

      // Verify the room was joined
      const checkRoom = io.sockets.adapter.rooms.get(`user-${userId}`);
      console.log(`🔍 Room user-${userId} now has ${checkRoom?.size || 0} sockets`);

      // Tenant rooms
      if (tenantId) {
        const tenantRoom = `tenant-${tenantId}-${role === "student" ? "students" : "teachers"}`;
        socket.join(tenantRoom);
        rooms.push(tenantRoom);
      }

      // Class rooms
      if (classIds?.length) {
        classIds.forEach(id => {
          const classRoom = `${role === "student" ? "students" : "teachers"}-${id}`;
          socket.join(classRoom);
          rooms.push(classRoom);
        });
      }

      // Role-based rooms
      if (role === "individual_learner") {
        socket.join("solo-learners");
        rooms.push("solo-learners");
      }
      if (role === "admin") {
        socket.join("admins");
        rooms.push("admins");
      }
      if (role === "super_admin") {
        socket.join("super-admins");
        rooms.push("super-admins");
      }

      socket.joinedRooms = true;
      console.log(`✅ User ${userId} (${role}) joined rooms:`, rooms);
      callback?.({ success: true, rooms });

      // Send pending persistent notifications
      try {
        const pending = await getPendingNotifications(userId);
        pending.forEach(n => socket.emit("notification", { ...n, persistent: true }));
      } catch (err) {
        console.error("Error fetching pending notifications:", err);
      }

    } catch (err) {
      console.error("❌ joinRooms error:", err);
      callback?.({ success: false, error: err.message });
    }
  });

  socket.on("disconnect", (reason) => {
    console.log("❌ Client disconnected:", socket.id, "Reason:", reason);
  });
});

// Debug endpoint to check socket rooms
app.get("/api/debug/socket-rooms", (req, res) => {
  const rooms = {};
  io.sockets.adapter.rooms.forEach((sockets, roomName) => {
    // Filter out socket-id rooms (every socket is in a room with its own ID)
    if (!roomName.startsWith("user-") && !roomName.startsWith("tenant-") && !roomName.startsWith("students-") && !roomName.startsWith("teachers-")) {
      return;
    }
    rooms[roomName] = Array.from(sockets);
  });
  res.json({ 
    totalConnections: io.sockets.sockets.size,
    rooms 
  });
});

// Test notification endpoint
app.post("/api/debug/test-notification", (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ message: "userId required" });
  
  const room = `user-${userId}`;
  const socketsInRoom = io.sockets.adapter.rooms.get(room);
  
  console.log(`🧪 Test notification to room: ${room}, sockets: ${socketsInRoom?.size || 0}`);
  
  if (socketsInRoom && socketsInRoom.size > 0) {
    io.to(room).emit("notification", {
      persistent: true,
      notificationId: "test-" + Date.now(),
      title: "Test Notification",
      message: "This is a test notification sent at " + new Date().toISOString(),
      type: "TEST",
      data: {},
      isRead: false,
      createdAt: new Date().toISOString()
    });
    res.json({ success: true, message: `Sent to ${socketsInRoom.size} socket(s) in room ${room}` });
  } else {
    res.json({ success: false, message: `No sockets in room ${room}` });
  }
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/teachers", teacherRoutes);
app.use("/api/courses", courseRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/learners', learnerRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/code-execution", codeExecutionRoutes);
app.use("/api/learner-courses", learnerCoursesRoute);

// Database
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ DB Connection Error:", err));

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
