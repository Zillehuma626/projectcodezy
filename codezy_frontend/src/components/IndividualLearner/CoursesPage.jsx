import React, { useEffect, useState } from "react";
import ChatWidget from "../ai/ChatWidget";
import axios from "axios";
import { Search, BookOpen, LogOut } from "lucide-react";
import LearnerNavbar from "./Navbar.jsx";

const CoursesPage = () => {
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All Levels");

  const userId = localStorage.getItem("userId");
  const fullName = localStorage.getItem("fullName") || "User";

  // --- FETCH ENROLLED COURSES ---
  useEffect(() => {
    if (!userId) return;

    axios
      .get(`http://localhost:5000/api/learners/dashboard-data/${userId}`)
      .then((res) => {
        // res.data.enrolled contains array of enrollments with courseId populated
        setEnrolledCourses(res.data.enrolled || []);
      })
      .catch((err) => console.error("Error fetching courses:", err));
  }, [userId]);

  // --- FILTER & SEARCH ---
  const filtered = enrolledCourses.filter((item) => {
    const course = item.courseId || {};
    const title = course.title || "";
    const instructor = course.instructor || "";
    const category = course.category || "";

    const matchesSearch =
      title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      instructor.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      activeCategory === "All Levels" || category === activeCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-white font-sans relative">
      <LearnerNavbar />

      <main className="max-w-7xl mx-auto p-10">
        <header className="mb-10">
          <h1 className="text-2xl font-bold text-gray-800">My Courses</h1>
          <p className="text-gray-500 text-sm mt-1">
            View and continue learning your enrolled courses
          </p>
        </header>

        {/* SEARCH + FILTER */}
        <div className="flex flex-col md:flex-row gap-4 mb-10 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search your courses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-100 outline-none text-sm"
            />
          </div>

          <div className="flex gap-2">
            {["All Levels", "Beginner", "Intermediate", "Advanced"].map((level) => (
              <button
                key={level}
                onClick={() => setActiveCategory(level)}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold border ${
                  activeCategory === level
                    ? "bg-purple-700 text-white border-purple-700"
                    : "bg-white text-gray-500 border-gray-200"
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        {/* COURSE GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filtered.length ? (
            filtered.map((item) => {
              const course = item.courseId || {};
              return (
                <div
                  key={item._id}
                  className="bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all"
                >
                  <img
                    src={course.thumbnail || "/placeholder.jpg"}
                    className="h-48 w-full object-cover rounded-t-3xl"
                    alt={course.title || "Course"}
                  />

                  <div className="p-6">
                    <h3 className="font-bold text-gray-800">{course.title}</h3>
                    <p className="text-xs text-gray-400 mt-1">
                      by {course.instructor || "Unknown"}
                    </p>

                    <div className="mt-4">
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="bg-purple-600 h-full"
                          style={{ width: `${item.progress || 0}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {item.progress || 0}% completed
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full py-24 text-center">
              <BookOpen className="mx-auto text-gray-300 mb-4" size={48} />
              <p className="text-gray-400">No courses found.</p>
            </div>
          )}
        </div>
      </main>

      {/* --- AI COACH CHAT --- */}
      <ChatWidget />
    </div>
  );
};

export default CoursesPage;