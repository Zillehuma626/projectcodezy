// routes/learner.js
import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Enrollment from "../models/Enrollment.js";
import LearnerCourse from "../models/LearnerCourse.js";
import speakeasy from "speakeasy";
import QRCode from "qrcode";

const router = express.Router();

const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&()[\]{}#^<>.,;:'"~`+=_-]).{8,}$/;


// PUT Update Profile
router.put("/profile/:userId", async (req, res) => {
  try {
    const { fullName, email, bio } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      req.params.userId,
      { $set: { fullName, email, bio } },
      { new: true, runValidators: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(updatedUser);
  } catch (err) {
    console.error("Update DB Error:", err);
    res.status(500).json({ message: "Error saving to database" });
  }
});

// GET Profile Data
router.get("/profile/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Error fetching profile" });
  }
});

/* ======================================================
   DASHBOARD DATA
====================================================== */
// GET Dashboard Data (Learner)
router.get("/dashboard-data/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;

    // Fetch learner info
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const tenantId = user.tenantId;

    // Optional: ensure LearnerCourse entries are up-to-date
    await syncInstitutionCoursesToLearners(tenantId);

    // 1️⃣ Fetch all courses the learner is enrolled in
    const enrolled = await Enrollment.find({ userId })
      .populate("courseId") // get actual Course document
      .lean();

    // 2️⃣ Fetch all learner courses for this tenant
    const learnerCourses = await LearnerCourse.find({ tenantId }).lean();

    // 3️⃣ Map learner-specific data
    const personalizedCourses = learnerCourses.map(lc => {
      // Match enrollment by comparing course IDs as strings
      const enrolledData = enrolled.find(
        e => String(e.courseId?._id) === String(lc.courseId)
      );

      return {
        _id: lc._id,
        courseId: lc.courseId,
        title: lc.title,
        instructor: lc.instructor,
        thumbnail: lc.thumbnail || "https://via.placeholder.com/300x200",
        category: lc.category || "Beginner",
        purchased: !!enrolledData,
        progress: enrolledData?.progress || 0,
        duration: enrolledData?.duration || lc.durationWeeks || 0,
        price: lc.price || 0
      };
    });

    // 4️⃣ Recommended courses: top 4 not purchased
    const recommended = personalizedCourses.filter(c => !c.purchased).slice(0, 4);

    // 5️⃣ Stats (replace with real stats if available)
    const stats = {
      totalXp: 3250,
      completedLabs: 42,
      learningStreak: 12,
      xpThisWeek: 280
    };

    // ✅ Return full dashboard data
    res.json({
      enrolled,
      personalizedCourses,
      recommended,
      stats
    });

  } catch (err) {
    console.error("Dashboard Data Error:", err);
    res.status(500).json({ message: "Error loading dashboard" });
  }
});

// CHANGE PASSWORD (WITH STRONG VALIDATION)
// PUT Change Password
router.put("/change-password/:userId", async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Strong password regex
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&()[\]{}#^<>.,;:'"~`+=_-]).{8,}$/;

    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        message:
          "Password must be at least 8 characters and include uppercase, lowercase, number, and special character"
      });
    }

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    const isSame = await bcrypt.compare(newPassword, user.password);
    if (isSame) {
      return res.status(400).json({ message: "New password must be different" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // ✅ IMPORTANT FIX (NO FULL VALIDATION)
    await User.updateOne(
      { _id: req.params.userId },
      { $set: { password: hashedPassword } }
    );

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("Password Update Error:", err);
    res.status(500).json({ message: "Server error during password update" });
  }
});


/* ======================================================
   MFA (TWO-FACTOR AUTHENTICATION)
====================================================== */

// Toggle MFA
router.put("/toggle-mfa/:userId", async (req, res) => {
  try {
    const { enabled } = req.body;

    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { mfaEnabled: enabled },
      { new: true }
    ).select("mfaEnabled");

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Error updating security settings" });
  }
});

// Setup MFA
router.post("/setup-mfa/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);

    const secret = speakeasy.generateSecret({
      name: `Codezy:${user.email}`
    });

    user.mfaSecret = secret.base32;
    await user.save();

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    res.json({ qrCodeUrl });
  } catch (err) {
    res.status(500).json({ message: "Error setting up MFA" });
  }
});

// Verify & Activate MFA
router.post("/verify-mfa/:userId", async (req, res) => {
  try {
    const { token } = req.body;
    const user = await User.findById(req.params.userId);

    const verified = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: "base32",
      token
    });

    if (!verified) {
      return res.status(400).json({ message: "Invalid 6-digit code" });
    }

    user.mfaEnabled = true;
    await user.save();

    res.json({ message: "MFA activated successfully", mfaEnabled: true });
  } catch (err) {
    res.status(500).json({ message: "Verification failed" });
  }
});

// Disable MFA
router.put("/disable-mfa/:userId", async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.userId, {
      mfaEnabled: false,
      mfaSecret: null
    });

    res.json({ mfaEnabled: false });
  } catch (err) {
    res.status(500).json({ message: "Error disabling MFA" });
  }
});

export default router;
