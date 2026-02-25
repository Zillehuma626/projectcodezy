import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "react-hot-toast";
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ChevronLeft,
  TrendingUp,
  PlayCircle,
  Lock,
  XCircle
} from "lucide-react";
import Navbar from '../StudentDashboard/Navbar'; // Shared Navbar Component

// Helper function to check lab time status
const getLabTimeStatus = (lab) => {
  const now = new Date();
  
  // Combine date and time for start
  const startDateTime = new Date(lab.startDate);
  if (lab.startTime) {
    const [startHours, startMinutes] = lab.startTime.split(':');
    startDateTime.setHours(parseInt(startHours, 10), parseInt(startMinutes, 10), 0, 0);
  }
  
  // Combine date and time for due
  const dueDateTime = new Date(lab.dueDate);
  if (lab.dueTime) {
    const [dueHours, dueMinutes] = lab.dueTime.split(':');
    dueDateTime.setHours(parseInt(dueHours, 10), parseInt(dueMinutes, 10), 0, 0);
  }
  
  if (now < startDateTime) {
    return { 
      canAttempt: false, 
      reason: 'not_started', 
      message: `Lab opens on ${startDateTime.toLocaleDateString()} at ${lab.startTime || '00:00'}`,
      startDateTime
    };
  }
  
  if (now > dueDateTime) {
    return { 
      canAttempt: false, 
      reason: 'expired', 
      message: `Lab expired on ${dueDateTime.toLocaleDateString()} at ${lab.dueTime || '23:59'}`,
      dueDateTime
    };
  }
  
  return { canAttempt: true, reason: 'active', message: 'Lab is available' };
};

const CourseLabs = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const studentId = localStorage.getItem("userId");
  const studentName = localStorage.getItem('fullName') || 'Student';

  const [activeLabs, setActiveLabs] = useState([]);
  const [historyLabs, setHistoryLabs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`http://localhost:5000/api/students/${studentId}/courses/${courseId}/labs`)
      .then((res) => res.json())
      .then((data) => {
        setActiveLabs(data.active || []);
        setHistoryLabs(data.history || []);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching labs:", err);
        setIsLoading(false);
      });
  }, [courseId, studentId]);

  const allLabs = [...activeLabs, ...historyLabs];

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FD]">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FD] font-sans pb-12">
      {/* ✅ Shared Navbar */}
      <Navbar studentName={studentName} />

      <div className="max-w-7xl mx-auto px-8 py-10">
        <header className="mb-10 flex flex-col gap-4">
          <button 
            onClick={() => navigate('/student/courses')} 
            className="flex items-center gap-2 text-indigo-600 font-bold text-sm"
          >
            <ChevronLeft size={18} /> Back to Courses
          </button>
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Course Assignments</h1>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {allLabs.map((lab) => {
            const isDone = lab.status === 'Completed' || lab.status === 'Submitted';
            const isLate = lab.status === 'Late Submitted';
            const timeStatus = getLabTimeStatus(lab);

            // Handler for attempting lab with time validation
            const handleAttemptLab = () => {
              if (!timeStatus.canAttempt) {
                if (timeStatus.reason === 'not_started') {
                  toast.error(`⏰ Lab hasn't started yet!\n${timeStatus.message}`, { duration: 4000 });
                } else if (timeStatus.reason === 'expired') {
                  toast.error(`⌛ Lab has expired!\n${timeStatus.message}`, { duration: 4000 });
                }
                return;
              }
              navigate(`/lab-session/${lab._id}`);
            };

            return (
              <motion.div
                key={lab._id}
                whileHover={{ y: -5 }}
                className={`bg-white rounded-3xl p-7 shadow-sm border transition-all ${
                  isDone ? 'border-blue-100' : isLate ? 'border-red-100' : 
                  !timeStatus.canAttempt ? 'border-gray-200' : 'border-amber-100'
                }`}
              >
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg leading-tight">{lab.title}</h3>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">{lab.courseCode || 'Assignment'}</p>
                  </div>
                  <div className="mt-1">
                    {isDone ? <CheckCircle2 className="text-blue-500" size={24} /> : 
                     isLate ? <AlertCircle className="text-red-500" size={24} /> : 
                     timeStatus.reason === 'expired' ? <XCircle className="text-gray-400" size={24} /> :
                     timeStatus.reason === 'not_started' ? <Lock className="text-gray-400" size={24} /> :
                     <Clock className="text-amber-500" size={24} />}
                  </div>
                </div>

                <div className="space-y-4 text-sm border-b border-gray-50 pb-6 mb-6">
                  <div className="flex justify-between items-center text-gray-500">
                    <span className="font-bold uppercase text-[11px] tracking-wider">Total Tasks</span>
                    <span className="font-black text-gray-800">{lab.tasks?.length || 0}</span>
                  </div>
                  {(isDone || isLate) && (
                    <div className="flex justify-between items-center text-gray-500">
                      <span className="font-bold uppercase text-[11px] tracking-wider">Your Score</span>
                      <span className="font-black text-gray-900">{lab.score || '0'}/{lab.marks || '100'}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-4">
                  <div className={`flex items-center gap-2 text-[11px] font-black uppercase tracking-widest ${
                    isDone ? 'text-blue-600' : isLate ? 'text-red-600' : 
                    timeStatus.reason === 'expired' ? 'text-gray-500' :
                    timeStatus.reason === 'not_started' ? 'text-purple-600' :
                    'text-amber-600'
                  }`}>
                    {isDone ? (
                      <><CheckCircle2 size={14} /> Submitted: {new Date(lab.submittedAt || Date.now()).toLocaleDateString()}</>
                    ) : isLate ? (
                      <><AlertCircle size={14} /> Submitted Late: {new Date(lab.submittedAt || Date.now()).toLocaleDateString()}</>
                    ) : timeStatus.reason === 'expired' ? (
                      <><XCircle size={14} /> Expired: {new Date(lab.dueDate).toLocaleDateString()}</>
                    ) : timeStatus.reason === 'not_started' ? (
                      <><Lock size={14} /> Opens: {new Date(lab.startDate).toLocaleDateString()} at {lab.startTime || '00:00'}</>
                    ) : (
                      <><Clock size={14} /> Due: {new Date(lab.dueDate).toLocaleDateString()} at {lab.dueTime || '23:59'}</>
                    )}
                  </div>

                  {(!isDone && !isLate) ? (
                    timeStatus.reason === 'not_started' ? (
                      <button 
                        onClick={handleAttemptLab}
                        className="w-full py-3 bg-gray-300 text-gray-600 rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-not-allowed"
                      >
                        <Lock size={18} /> Not Available Yet
                      </button>
                    ) : timeStatus.reason === 'expired' ? (
                      <button 
                        onClick={handleAttemptLab}
                        className="w-full py-3 bg-gray-200 text-gray-500 rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-not-allowed"
                      >
                        <XCircle size={18} /> Lab Expired
                      </button>
                    ) : (
                      <button 
                        onClick={handleAttemptLab}
                        className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
                      >
                        <PlayCircle size={18} /> Attempt Lab
                      </button>
                    )
                  ) : (
                    <div className={`flex items-center gap-2 font-black text-[11px] uppercase tracking-widest w-fit px-3 py-1.5 rounded-xl ${
                        isDone ? 'text-blue-600 bg-blue-50' : 'text-red-600 bg-red-50'
                    }`}>
                      <TrendingUp size={14} /> Performance: {lab.performance || '100'}%
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CourseLabs;
