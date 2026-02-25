import express from "express";
import Course from "../models/Course.js";
import mongoose from "mongoose";
import Teacher from "../models/Teacher.js";
import Student from "../models/Students.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router = express.Router();

/* ========================
   AUTH CONTEXT
======================== */
const getAuthContext = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    const err = new Error("Unauthorized");
    err.status = 401;
    throw err;
  }

  const token = authHeader.split(" ")[1];
  return jwt.verify(token, process.env.JWT_SECRET);
};


/* ========================
   TEACHER STATS (TENANT SAFE)
======================== */
const syncTeacherStats = async (teacherId, tenantId) => {
  if (!teacherId || !mongoose.Types.ObjectId.isValid(teacherId)) return;

  const stats = await Course.aggregate([
    { $match: { tenantId } },
    { $unwind: "$classes" },
    { $match: { "classes.teacher": new mongoose.Types.ObjectId(teacherId) } },
    {
      $group: {
        _id: "$classes.teacher",
        uniqueCourses: { $addToSet: "$_id" },
        classNames: { $addToSet: "$classes.name" },
        totalStudents: {
          $sum: { $size: { $ifNull: ["$classes.students", []] } }
        }
      }
    }
  ]);

  const payload = stats[0] || {
    uniqueCourses: [],
    classNames: [],
    totalStudents: 0
  };

  await Teacher.findByIdAndUpdate(teacherId, {
    courses: payload.uniqueCourses,
    classes: payload.classNames,
    courseLoad: payload.uniqueCourses.length,
    classesLoad: payload.classNames.length,
    students: payload.totalStudents
  });
};

/* ========================
   COURSES
======================== */

// CREATE COURSE
router.post("/", async (req, res) => {
  try {
    const { tenantId } = getAuthContext(req);
    const { title, courseCode, classes } = req.body;

    const course = await Course.create({
      title,
      courseCode,
      classes: classes || [],
      tenantId
    });

    const teacherIds = [...new Set((classes || []).map(c => c.teacher).filter(Boolean))];
    for (const t of teacherIds) {
      await syncTeacherStats(t, tenantId);
    }

    res.status(201).json(course);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// UPDATE COURSE
router.put("/:id", async (req, res) => {
  try {
    const { tenantId } = getAuthContext(req);
    const courseId = req.params.id;

    const oldCourse = await Course.findOne({ _id: courseId, tenantId });
    if (!oldCourse) return res.status(404).json({ message: "Course not found" });

    const teachersBefore = [...new Set(oldCourse.classes.map(c => c.teacher?.toString()).filter(Boolean))];

    const updatedCourse = await Course.findOneAndUpdate(
      { _id: courseId, tenantId },
      req.body,
      { new: true }
    );

    const teachersAfter = [...new Set(updatedCourse.classes.map(c => c.teacher?.toString()).filter(Boolean))];
    const affected = [...new Set([...teachersBefore, ...teachersAfter])];

    for (const t of affected) {
      await syncTeacherStats(t, tenantId);
    }

    res.json(updatedCourse);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE COURSE
router.delete("/:id", async (req, res) => {
  try {
    const { tenantId } = getAuthContext(req);

    const course = await Course.findOne({ _id: req.params.id, tenantId });
    if (!course) return res.status(404).json({ message: "Course not found" });

    for (const cls of course.classes) {
      if (cls.teacher) {
        await syncTeacherStats(cls.teacher, tenantId);
      }
    }

    await Course.findOneAndDelete({ _id: req.params.id, tenantId });
    res.json({ message: "Course deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET ALL COURSES
router.get("/", async (req, res) => {
  try {
    const { tenantId } = getAuthContext(req);
    console.log("Tenant ID:", tenantId);
    const courses = await Course.find({ tenantId }).lean();
    res.json(courses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ========================
   STUDENTS
======================== */

// ADD STUDENTS
router.post("/:courseId/classes/:classId/students", async (req, res) => {
  try {
    const { tenantId } = getAuthContext(req);
    const { courseId, classId } = req.params;
    const { students } = req.body;

    const ids = [];

    for (const s of students) {
      const hashed = await bcrypt.hash(s.password || "123456", 10);

      const doc = await Student.findOneAndUpdate(
        { email: s.email, tenantId },
        {
          ...s,
          password: hashed,
          tenantId,
          course: courseId,
          classId
        },
        { upsert: true, new: true }
      );

      ids.push(doc._id);
    }
      console.log("Adding students to class:", {
        courseId,
        classId,
        tenantId,
        studentIds: ids
    });

    const updatedCourse = await Course.findOneAndUpdate(
      { _id: courseId, tenantId, "classes._id": classId },
      { $addToSet: { "classes.$.students": { $each: ids } } },
      { new: true }
    );
    
    console.log("Updated Course Result:", updatedCourse);
    res.json({ message: "Students added" });
  } catch (err) {
    console.error("Error in /students POST:", err);
    res.status(500).json({ message: err.message });
  }
});
// GET ALL LABS IN A COURSE (ACROSS ALL CLASSES)
router.get("/:courseId/all-labs", async (req, res) => {
  try {
    const { tenantId } = getAuthContext(req);
    const { courseId } = req.params;

    const course = await Course.findOne({ _id: courseId, tenantId }).lean();
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    const labs = [];

    for (const cls of course.classes || []) {
      for (const lab of cls.labs || []) {
        labs.push({
          ...lab,
          parentClassId: cls._id,
          originClass: cls.name
        });
      }
    }

    res.json(labs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET CLASS STUDENTS
router.get("/:courseId/classes/:classId/students", async (req, res) => {
  try {
    const { tenantId } = getAuthContext(req);

    const course = await Course.findOne({
      _id: req.params.courseId,
      tenantId
    }).populate("classes.students");

    if (!course) return res.status(404).json({ message: "Course not found" });

    const cls = course.classes.id(req.params.classId);
    res.json(cls?.students || []);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// UPDATE SINGLE STUDENT
router.put("/:courseId/classes/:classId/students/:studentId", async (req, res) => {
  try {
    const { tenantId } = getAuthContext(req);
    const { courseId, classId, studentId } = req.params;
    const updateData = req.body;

    // Ensure the student belongs to the tenant
    const student = await Student.findOne({ _id: studentId, tenantId });
    if (!student) return res.status(404).json({ message: "Student not found" });

    // If password is being updated, hash it
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }

    Object.assign(student, updateData);
    await student.save();

    res.json({ message: "Student updated", student });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
// DELETE SINGLE STUDENT
router.delete("/:courseId/classes/:classId/students/:studentId", async (req, res) => {
  try {
    const { tenantId } = getAuthContext(req);
    const { courseId, classId, studentId } = req.params;

    // 1️⃣ Remove student from the Students collection (tenant-safe)
    const student = await Student.findOneAndDelete({ _id: studentId, tenantId });
    if (!student) return res.status(404).json({ message: "Student not found" });

    // 2️⃣ Remove student reference from the class in the course
    await Course.updateOne(
      { _id: courseId, tenantId, "classes._id": classId },
      { $pull: { "classes.$.students": studentId } }
    );

    res.json({ message: "Student deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ========================
   TEACHER COURSES
======================== */
router.get("/teacher/:teacherId", async (req, res) => {
  try {
    const { tenantId } = getAuthContext(req);
    const teacherId = req.params.teacherId;

    // Find all courses where this teacher is assigned to at least one class
    const courses = await Course.find({
      tenantId,
      "classes.teacher": teacherId
    }).lean();

    // Filter classes to only include those assigned to this teacher
    const filteredCourses = courses.map(course => ({
      ...course,
      classes: course.classes.filter(cls => 
        cls.teacher && cls.teacher.toString() === teacherId
      )
    })).filter(course => course.classes.length > 0); // Remove courses with no classes after filtering

    res.json(filteredCourses);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Internal Server Error" });
  }
});

/* ========================
   LABS & SUBMISSIONS
======================== */
// GET SINGLE LAB
router.get("/:courseId/classes/:classId/labs/:labId", async (req, res) => {
  try {
    const { tenantId } = getAuthContext(req);
    const { courseId, classId, labId } = req.params;

    const course = await Course.findOne({ _id: courseId, tenantId });
    if (!course) return res.status(404).json({ message: "Course not found" });

    const cls = course.classes.id(classId);
    if (!cls) return res.status(404).json({ message: "Class not found" });

    const lab = cls.labs.id(labId);
    if (!lab) return res.status(404).json({ message: "Lab not found" });

    res.json(lab);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET SUBMISSIONS
router.get("/:courseId/classes/:classId/labs/:labId/submissions", async (req, res) => {
  try {
    const { tenantId } = getAuthContext(req);

    const course = await Course.findOne({
      _id: req.params.courseId,
      tenantId
    }).populate("classes.students", "name rollNumber");

    if (!course) return res.status(404).json({ message: "Course not found" });

    const cls = course.classes.id(req.params.classId);
    const lab = cls.labs.id(req.params.labId);

    res.json(
      cls.students.map(st => {
        const sub = lab.submissions.find(s => s.studentId.equals(st._id));
        return {
          studentId: st._id,
          name: st.name,
          rollNumber: st.rollNumber,
          submitted: !!sub,
          xp: sub?.xp || 0,
          averageScore: sub?.averageScore || 0,
          status: sub?.status || "Not Submitted",
          isLate: sub?.isLate || false,
          submittedAt: sub?.submittedAt || null,
          results: sub?.results || []
        };
      })
    );
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// CREATE LAB
router.post("/:courseId/classes/:classId/labs", async (req, res) => {
  try {
    const authContext = getAuthContext(req);
    const { tenantId, userId, name } = authContext;
    const { courseId, classId } = req.params;

    // First, find the course to get class students
    const courseBeforeUpdate = await Course.findOne({ 
      _id: courseId, 
      tenantId, 
      "classes._id": classId 
    }).populate("classes.students");

    if (!courseBeforeUpdate) {
      return res.status(404).json({ message: "Course or class not found" });
    }

    // Get the class to find students
    const classData = courseBeforeUpdate.classes.id(classId);
    if (!classData) {
      return res.status(404).json({ message: "Class not found" });
    }

    // Debug: Log the class data and students
    console.log("🔍 DEBUG - Class data students (raw):", classData.students);
    console.log("🔍 DEBUG - Class data students length:", classData.students?.length || 0);
    if (classData.students?.length > 0) {
      console.log("🔍 DEBUG - First student:", JSON.stringify(classData.students[0], null, 2));
    }

    // Create the lab
    const course = await Course.findOneAndUpdate(
      { _id: courseId, tenantId, "classes._id": classId },
      { 
        $push: { 
          "classes.$.labs": { 
            ...req.body, 
            submissions: [],
            createdBy: {
              id: userId,
              name: name || "Teacher"
            }
          } 
        } 
      },
      { new: true }
    );

    if (!course) return res.status(404).json({ message: "Not found" });

    // Get the created lab (last one in the array)
    const updatedClass = course.classes.id(classId);
    const createdLab = updatedClass.labs[updatedClass.labs.length - 1];

    // Get student IDs for notification
    const studentIds = classData.students
      .filter(s => s?._id)
      .map(s => s._id.toString());

    console.log("📢 Lab created, sending notification to students:", studentIds);

    // Send notifications if there are students
    if (studentIds.length > 0) {
      const io = req.app.get("io");
      
      // Debug: Show which user rooms are currently connected
      const connectedUserRooms = [];
      io.sockets.adapter.rooms.forEach((sockets, roomName) => {
        if (roomName.startsWith("user-")) {
          connectedUserRooms.push(roomName.replace("user-", ""));
        }
      });
      console.log("🔍 Currently connected user IDs:", connectedUserRooms);
      console.log("🔍 Looking for students:", studentIds);
      console.log("🔍 Matching users:", studentIds.filter(id => connectedUserRooms.includes(id)));
      
      const { notifyEvent } = await import("../services/events.js");
      
      await notifyEvent(
        "NEW_LAB",
        {
          labTitle: req.body.title || "New Lab",
          studentIds,
          teacherId: userId,
          teacherName: name || "Your Teacher",
          tenantId,
          classId: classId.toString(),
          data: {
            labId: createdLab._id.toString(),
            courseId: courseId.toString(),
            classId: classId.toString()
          }
        },
        io
      );
    }

    res.status(201).json({ message: "Lab added", lab: createdLab });
  } catch (err) {
    console.error("Create Lab Error:", err);
    res.status(500).json({ message: err.message });
  }
});

// UPDATE LAB
router.put("/:courseId/classes/:classId/labs/:labId", async (req, res) => {
  try {
    const { tenantId } = getAuthContext(req);
    const { courseId, classId, labId } = req.params;

    const course = await Course.findOne({ _id: courseId, tenantId });
    if (!course) return res.status(404).json({ message: "Course not found" });

    const cls = course.classes.id(classId);
    if (!cls) return res.status(404).json({ message: "Class not found" });

    const lab = cls.labs.id(labId);
    if (!lab) return res.status(404).json({ message: "Lab not found" });

    // Update only the fields sent in req.body
    Object.assign(lab, req.body);

    await course.save();

    res.json({ message: "Lab updated successfully", lab });
  } catch (err) {
    console.error("PUT Lab Error:", err);
    res.status(500).json({ message: err.message });
  }
});



// DELETE LAB
router.delete("/:courseId/classes/:classId/labs/:labId", async (req, res) => {
  try {
    const { tenantId } = getAuthContext(req);

    await Course.updateOne(
      { _id: req.params.courseId, tenantId, "classes._id": req.params.classId },
      { $pull: { "classes.$.labs": { _id: req.params.labId } } }
    );

    res.json({ message: "Lab deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
