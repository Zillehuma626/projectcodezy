import express from "express";
import Course from "../models/Course.js";
import mongoose from "mongoose";
import Teacher from "../models/Teacher.js";
import Student from "../models/Students.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createNotification } from "../services/notificationService.js";
import { syncInstitutionCoursesToLearners } from "../services/syncCourses.js";

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
    await syncInstitutionCoursesToLearners(tenantId);
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
    await syncInstitutionCoursesToLearners(tenantId);
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
    await syncInstitutionCoursesToLearners(tenantId);
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
          _id: String(lab._id),              // 🔥 FORCE STRING
          parentClassId: String(cls._id),    // 🔥 FORCE STRING
          originClass: cls.name,
          createdBy: {
            id: String(lab.createdBy?.id || lab.createdBy || ""),
            name: lab.createdBy?.name || "Other Teacher"
          },
          isShared: Boolean(lab.isShared)    // 🔥 FORCE BOOLEAN
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

    const courses = await Course.find({
      tenantId,
      "classes.teacher": req.params.teacherId
    }).lean();

    res.json(courses);
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
          status: sub?.status || "Not Submitted"
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
    const { tenantId, userId } = getAuthContext(req);
    const { courseId, classId } = req.params;

    // 🔥 Get teacher name properly
    const teacher = await Teacher.findOne({
      _id: userId,
      tenantId
    }).select("name");

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    // Create new lab data with a unique _id
    const newLabData = {
      ...req.body,
      _id: new mongoose.Types.ObjectId(), 
      submissions: [],
      isShared: Boolean(req.body.isShared),
      createdBy: {
        id: String(userId),
        name: teacher.name
      }
    };

    // Push lab into course
    const course = await Course.findOneAndUpdate(
      { _id: courseId, tenantId, "classes._id": classId },
      { $push: { "classes.$.labs": newLabData } },
      { new: true }
    );

    if (!course) {
      return res.status(404).json({ message: "Course or Class not found" });
    }

    // Get the class to fetch student IDs for notification
    const cls = course.classes.id(classId);
    const studentIds = (cls.students || []).map(s => s.toString());

    // 🔔 Create notification after lab is saved
    await createNotification({
      title: "New Lab Uploaded",
      message: `Lab "${newLabData.title}" has been uploaded by ${teacher.name}.`,
      type: "LAB_CREATED",
      createdBy: userId,
      recipientIds: studentIds,
      data: {
        labId: newLabData._id.toString(),
        courseId,
        classId,
        teacherName: teacher.name // ✅ include teacher name in payload
      },
      tenantId,
      io: req.app.get("io")
    });
    await syncInstitutionCoursesToLearners(tenantId);
    res.status(201).json({ message: "Lab added successfully", lab: newLabData });

  } catch (err) {
    console.error("CREATE LAB ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// UPDATE LAB
router.put("/:courseId/classes/:classId/labs/:labId", async (req, res) => {
  try {
    const { tenantId, userId } = getAuthContext(req);
    const { courseId, classId, labId } = req.params;

    const course = await Course.findOne({ _id: courseId, tenantId });
    if (!course) return res.status(404).json({ message: "Course not found" });

    const cls = course.classes.id(classId);
    if (!cls) return res.status(404).json({ message: "Class not found" });

    const lab = cls.labs.id(labId);
    if (!lab) return res.status(404).json({ message: "Lab not found" });

    // Fallback for older labs missing the createdBy object
    if (!lab.createdBy || !lab.createdBy.id) {
      const teacher = await Teacher.findById(userId).select("name");
      lab.createdBy = { id: String(userId), name: teacher?.name || "Teacher" };
    }

    // Merge updates while protecting the original creator and submissions
    Object.assign(lab, {
      ...req.body,
      createdBy: lab.createdBy,
      submissions: lab.submissions // Protect existing student work
    });

    await course.save();

    // 🔔 Send notification to students about updated lab
    const io = req.app.get("io");
    const studentIds = (cls.students || []).map(s => s.toString());

    await createNotification({
      title: "Lab Updated",
      message: `Lab "${lab.title}" has been updated by ${lab.createdBy.name}.`,
      type: "LAB_UPDATED",
      createdBy: userId,
      recipientIds: studentIds,
      data: {
        labId: lab._id.toString(),
        courseId,
        classId,
        teacherName: lab.createdBy.name // ✅ include teacher name in payload
      },
      tenantId,
      io
    });
    await syncInstitutionCoursesToLearners(tenantId);
    res.json({ message: "Lab updated successfully", lab });
  } catch (err) {
    console.error("UPDATE LAB ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// DELETE LAB
router.delete("/:courseId/classes/:classId/labs/:labId", async (req, res) => {
  try {
    const { tenantId, userId } = getAuthContext(req);
    const { courseId, classId, labId } = req.params;

    const course = await Course.findOne({ _id: courseId, tenantId });
    if (!course) return res.status(404).json({ message: "Course not found" });

    const cls = course.classes.id(classId);
    if (!cls) return res.status(404).json({ message: "Class not found" });

    const lab = cls.labs.id(labId);
    if (!lab) return res.status(404).json({ message: "Lab not found" });

    // Security: Only creator or the assigned class teacher can delete
    const isOwner = String(lab.createdBy?.id) === String(userId);
    const isClassTeacher = String(cls.teacher) === String(userId);

    if (!isOwner && !isClassTeacher) {
      return res.status(403).json({ message: "Unauthorized deletion" });
    }

    // FIX: Use the positional operator '$' to pull from the specific class matched
    await Course.updateOne(
      { _id: courseId, tenantId, "classes._id": classId },
      { $pull: { "classes.$.labs": { _id: labId } } }
    );
    
    await syncInstitutionCoursesToLearners(tenantId);
    res.json({ message: "Lab deleted successfully" });
  } catch (err) {
    console.error("DELETE Lab Error:", err);
    res.status(500).json({ message: err.message });
  }
});

export default router;
