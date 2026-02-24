import axios from "axios";
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Eye, Pencil, Trash2, Sparkles, Plus, User } from "lucide-react";
import { motion } from "framer-motion";

const ManageLabsPage = () => {
  const { courseId, classId } = useParams();
  const navigate = useNavigate();

  const [labs, setLabs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Ensure we get the current user's ID as a string
  const currentUserId = String(localStorage.getItem("userId") || "");

  const fetchLabs = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }
      const res = await axios.get(`http://localhost:5000/api/courses/${courseId}/all-labs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLabs(res.data || []);
    } catch (err) {
       console.error("Error fetching labs:", err.response?.data || err.message);
       setLabs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLabs();
  }, [courseId, classId]);

  const cloneLab = async (lab) => {
    try {
      if (!window.confirm(`Assign "${lab.title}" to your class?`)) return;

      const { _id, createdAt, updatedAt, __v, ...cleanLab } = lab;
      const clonedData = {
        ...cleanLab,
        isShared: false,
        submissions: [],
        createdBy: {
          id: currentUserId,
          name: localStorage.getItem("fullName") || "Teacher"
        }
      };
      const token = localStorage.getItem("token");
      await axios.post(`http://localhost:5000/api/courses/${courseId}/classes/${classId}/labs`, clonedData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("Lab successfully assigned to your class!");
      fetchLabs();
    } catch (err) {
      console.error("Clone Error:", err);
      alert("Failed to assign lab.");
    }
  };

  const deleteLab = async (labId, originClassId) => {
    if (!window.confirm("Are you sure you want to delete this lab?")) return;
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`http://localhost:5000/api/courses/${courseId}/classes/${originClassId || classId}/labs/${labId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchLabs();
    } catch (err) {
      console.error("Delete Error:", err);
    }
  };

  if (loading) return (
    <div className="flex justify-center items-center p-20 animate-pulse text-indigo-600 font-medium">
      Loading Labs...
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto p-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Manage Labs</h1>
        <p className="text-gray-500">Manage your class labs or assign exported labs from the course gallery.</p>
      </header>

      <div className="space-y-4">
        {labs.length === 0 ? (
          <div className="text-center py-10 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
            <p className="text-gray-500">No labs found in this course.</p>
          </div>
        ) : (
          labs.map((lab) => {
            const myId = String(currentUserId || "");
            const creatorId = lab.createdBy?.id ? String(lab.createdBy.id) : String(lab.createdBy || "");
            
            // 1. Identify relationship
            const isOwner = String(lab.createdBy?.id) === String(myId);
            const isSharedInCourse = lab.isShared === true;
            const isLocalToThisClass = String(lab.parentClassId) === String(classId);

            // 2. Visibility:
            // Show if it's physically in this class OR if it's a shared template from the gallery
            const shouldShow = isLocalToThisClass || isSharedInCourse;
            if (!shouldShow) return null;

            // 3. Permissions (The Fix):
            // You can Manage (Edit/Delete/View Submissions) if:
            // You are the owner AND this specific copy belongs to a class (not just a floating gallery template)
            const canManage = isOwner && isLocalToThisClass;

            // 4. Gallery Logic:
            // Show "Assign to Class" ONLY if you are NOT the owner of this class-instance 
            // and it's a shared template.
            const showAssignButton = isSharedInCourse && !isLocalToThisClass;

            // 5. Author Display Fix:
            const authorDisplayName = isOwner ? "Me" : (lab.createdBy?.name || "Unknown");

            return (
              <motion.div
                key={lab._id}
                whileHover={{ scale: 1.005 }}
                className={`bg-white rounded-xl shadow-sm p-5 flex justify-between items-center border ${
                  canManage ? "border-indigo-200 bg-indigo-50/10" : "border-gray-100"
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-lg font-bold text-gray-800">{lab.title}</h2>
                    {canManage && (
                      <span className="bg-indigo-600 text-white text-[10px] px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                        <User size={10} /> ACTIVE CLASS LAB
                      </span>
                    )}
                    {isSharedInCourse && !canManage && (
                      <span className="bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded-md font-bold flex items-center gap-1 border border-amber-200">
                        <Sparkles size={10} /> SHARED IN COURSE
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-1">{lab.description}</p>
                  
                  <div className="flex items-center gap-4 mt-3">
                    <span className="text-xs text-gray-500"><strong>Marks:</strong> {lab.marks}</span>
                    <span className="text-xs text-gray-500"><strong>Origin:</strong> {lab.originClass || "Local"}</span>
                    
                    {canManage && (
                       <div className="flex items-center gap-1 bg-white text-indigo-700 px-2 py-0.5 rounded text-[10px] font-bold border border-indigo-100">
                          SUBMISSIONS: {lab.submissions?.length || 0}
                       </div>
                    )}

                    <span className="text-xs text-indigo-600 font-semibold">
                        Author: {isOwner ? "Me" : (lab.createdBy?.name || "Unknown")}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  {/* If I own it in this class, show CRUD. If not and it's shared, show Assign */}
                  {canManage ? (
                    <>
                      <button
                        onClick={() => navigate(`/courses/${courseId}/class/${classId}/labs/${lab._id}/submissions`)}
                        className="flex items-center gap-1 text-sm px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                      >
                        <Eye size={14} /> View
                      </button>
                      <button
                        onClick={() => navigate(`/createlab/${lab._id}/${courseId}/${classId}`)}
                        className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition"
                      >
                        <Pencil size={18} />
                      </button>
                      <button
                        onClick={() => deleteLab(lab._id, classId)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                      >
                        <Trash2 size={18} />
                      </button>
                    </>
                  ) : (
                    isSharedInCourse && (
                      <button
                        onClick={() => cloneLab(lab)}
                        className="flex items-center gap-1 text-sm px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition shadow-md font-bold"
                      >
                        <Plus size={16} /> Assign to My Class
                      </button>
                    )
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ManageLabsPage;