import Lab from "../models/Lab.js";
import Class from "../models/Class.js";
import { notifyEvent } from "../services/events.js";
import mongoose from "mongoose";

export const createLab = async (req, res) => {
  try {
    const { title, courseId, classId } = req.body;

    if (!title || !courseId || !classId) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const lab = await Lab.create({
      title,
      course: mongoose.Types.ObjectId(courseId),
      class: mongoose.Types.ObjectId(classId),
      createdBy: {
        id: mongoose.Types.ObjectId(req.user.userId),
        name: req.user.name
      }
    });

    const classData = await Class.findById(classId).populate("students");
    if (!classData) {
      return res.status(404).json({ message: "Class not found" });
    }

    const studentIds = classData.students
      .filter(s => s?._id)
      .map(s => mongoose.Types.ObjectId(s._id));

    const tenantId = mongoose.Types.ObjectId(req.user.tenantId);
    const io = req.app.get("io");

    // ✅ Send a clear `data` object for notifications
    await notifyEvent(
      "NEW_LAB",
      {
        labTitle: title,
        studentIds,
        teacherId: mongoose.Types.ObjectId(req.user.userId),
        tenantId,
        data: {
          labId: lab._id.toString(),
          courseId: lab.course.toString(),
          classId: classId
        }
      },
      io
    );

    res.status(201).json(lab);

  } catch (error) {
    console.error("Error creating lab:", error);
    res.status(500).json({ message: "Server error creating lab" });
  }
};
