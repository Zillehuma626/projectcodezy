import mongoose from "mongoose";

const testCaseSchema = new mongoose.Schema({
    input: { type: String, default: '' },
    expectedOutput: { type: String, default: '' },
    comparisonMode: { 
        type: String, 
        enum: ['Exact', 'IgnoreWhitespace', 'Regex'], 
        default: 'Exact' 
    },
    notes: { type: String, default: '' },
    isHidden: { type: Boolean, default: false } 
}, { _id: false }); // Prevents Mongoose from creating its own _id

// --- Sub-Schema: Structured Code Constraint ---
const specificConstraintSchema = new mongoose.Schema({
    type: { 
        type: String, 
        enum: ['Required', 'Forbidden'], 
        required: true 
    },
    construct: { 
        type: String, 
        required: true 
    }, // e.g., 'for loop', 'Recursion'
    specifics: {
        minDepth: { type: Number, default: 0 },
        maxDepth: { type: Number, default: 0 },
    },
}, { _id: false });

// --- Sub-Schema: Task ---
const taskSchema = new mongoose.Schema({
    title: { type: String, required: true },
    marks: { type: Number, required: true },
    description: { type: String },
    // Functional Constraints (Array of sub-documents)
    testCases: [testCaseSchema], 
    // Structural Constraints (Array of sub-documents)
    codeConstraints: {
        type: [specificConstraintSchema],
        default: [] 
    }
}, { _id: false });

// -----------------------------------------------
// 2. EXPANDED LAB SCHEMA
// -----------------------------------------------

const labSchema = new mongoose.Schema({
    title: { type: String, required: true },
    marks: { type: Number, required: true }, 
    description: { type: String },
    instructions: { type: String },
    isShared: { type: Boolean, default: false },
    createdBy: {
            id: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher" },
            name: { type: String }
        },
    status: {
        type: String,
        enum: ["Draft","Active", "Closed"],
        default: "Draft"
    },
    difficulty: { 
        type: String, 
        enum: ["Easy", "Medium", "Hard"], 
        default: "Medium" 
    },
     progressStatus: {
        type: String,
        enum: ["Pending", "Completed"],
        default: "Pending"
    },
    startDate: { type: Date, required: true },     
    startTime: { type: String, required: true },
    dueDate: { type: Date, required: true },
    dueTime: { type: String, required: true }, 
    submissions: [
    {
        studentId: {
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Student',
        required: true
        },
        submittedAt: {
        type: Date,
        default: Date.now
        },
        xp: {
        type: Number,
        default: 0
        },
        status: {
        type: String,
        enum: ["Submitted", "Not Submitted"],
        default: "Submitted"
        },
        code: { // Submitted code as a string
                type: String,
                required: true 
        },
        isLate: {
                type: Boolean,
                default: false
        },
        results: [ // Detailed test case results (optional but helpful)
                {
                    taskId: String,
                    passed: Boolean,
                    score: Number
                }
        ]
    }
    ],
    tasks: { 
        type: [taskSchema], 
        validate: {
            validator: function(v) {
                // Ensure at least one task is present
                return v && v.length > 0;
            },
            message: 'A lab must contain at least one task.'
        }
    } 
});

// Class schema (contains labs)
const classSchema = new mongoose.Schema({
    name: { type: String, required: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true },
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
    labs: [labSchema], 
});

// Course schema (main document)
const courseSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Tenant",
        required: true,
        index: true
    },
    title: { type: String, required: true },
    courseCode: { type: String, required: true},
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
    classes: [classSchema], 
}, { timestamps: true });
courseSchema.index(
  { tenantId: 1, courseCode: 1 },
  { unique: true }
);
export default mongoose.model("Course", courseSchema);