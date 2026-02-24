import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, Play, CheckCircle2, XCircle, Info, 
  AlertTriangle, Terminal, Clock, Target, ShieldCheck,
  Send, Layers
} from 'lucide-react';

const LabSession = () => {
  const { labId } = useParams();
  const navigate = useNavigate();
  const location = useLocation(); // For back navigation
  const [labData, setLabData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // State for multi-task handling
  const [activeTaskIndex, setActiveTaskIndex] = useState(0);
  const [taskCodes, setTaskCodes] = useState({}); // Stores code per task ID
  const [activeTab, setActiveTab] = useState('problem'); // 'problem' or 'testcases'

  useEffect(() => {
    // Fetches lab details including tasks, constraints, and test cases
    fetch(`http://localhost:5000/api/students/lab-details/${labId}`)
      .then(res => res.json())
      .then(data => {
        setLabData(data);
        // Initialize taskCodes with empty strings or starter code if available
        const initialCodes = {};
        data.tasks.forEach(task => {
          initialCodes[task.id] = ""; 
        });
        setTaskCodes(initialCodes);
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Error fetching lab details:", err);
        setIsLoading(false);
      });
  }, [labId]);

  const handleCodeChange = (newCode) => {
    const currentTaskId = labData.tasks[activeTaskIndex].id;
    setTaskCodes(prev => ({
      ...prev,
      [currentTaskId]: newCode
    }));
  };

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0F172A]">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-indigo-500"></div>
    </div>
  );

  const currentTask = labData?.tasks[activeTaskIndex];

  return (
    <div className="h-screen bg-[#0F172A] text-slate-300 flex flex-col font-sans overflow-hidden">
      {/* Header */}
      <header className="h-14 border-b border-slate-800 bg-[#1E293B] px-6 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-4">
          {/* Always visible back button */}
          <button
            onClick={() => {
              const courseId = location.state?.fromCourseId || labData?.courseId;
              if (courseId) {
                navigate(`/student/courses/${courseId}/labs`);
              } else {
                // fallback if courseId is missing
                navigate('/student/courses');
              }
            }}
            className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ChevronLeft size={20} className="text-white" />
          </button>

          <div className="flex flex-col border-l border-slate-700 pl-4">
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
              {labData?.courseCode || 'COURSE'}
            </span>
            <h1 className="text-sm font-black text-white leading-none uppercase">
              {labData?.title || 'Lab Session'}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-full border border-slate-800 text-xs font-bold">
            <Target size={14} className="text-emerald-500" />
            <span>{labData?.marks || 0} Total Marks</span>
          </div>
          <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-indigo-900/20">
            <Send size={14} /> Submit Solution
          </button>
        </div>
      </header>

      {/* Task Switcher Bar for Multiple Tasks */}
      <div className="h-10 bg-[#1E293B]/50 border-b border-slate-800 flex items-center px-4 gap-2">
        <div className="flex items-center gap-2 px-3 border-r border-slate-700 mr-2">
          <Layers size={14} className="text-slate-500" />
          <span className="text-[10px] font-black text-slate-500 uppercase">Tasks</span>
        </div>
        {labData?.tasks.map((task, idx) => (
          <button
            key={task.id ? `task-${task.id}` : `task-${idx}`}
            onClick={() => setActiveTaskIndex(idx)}
            className={`px-4 h-full text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
              activeTaskIndex === idx 
              ? 'text-indigo-400 border-b-2 border-indigo-400 bg-indigo-400/5' 
              : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {idx + 1}. {task.title}
          </button>
        ))}
      </div>

      <main className="flex-1 flex overflow-hidden">
        {/* Left Panel: Problem, Constraints & Test Cases */}
        <aside className="w-[480px] border-r border-slate-800 flex flex-col bg-[#0F172A] shrink-0">
          <div className="flex border-b border-slate-800 bg-[#1E293B]/30">
            <button onClick={() => setActiveTab('problem')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'problem' ? 'text-indigo-400 border-b-2 border-indigo-400 bg-indigo-400/5' : 'text-slate-500'}`}>
              Description
            </button>
            <button onClick={() => setActiveTab('testcases')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'testcases' ? 'text-indigo-400 border-b-2 border-indigo-400 bg-indigo-400/5' : 'text-slate-500'}`}>
              Test Cases
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
            <AnimatePresence mode="wait">
              {activeTab === 'problem' ? (
                <motion.div 
                  key={`prob-${activeTaskIndex}`}
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                  className="space-y-8"
                >
                  <section>
                    <div className="flex justify-between items-center mb-3">
                      <h2 className="text-white font-bold text-lg">{currentTask?.title}</h2>
                      <span className="text-[10px] font-bold bg-indigo-500/10 px-2 py-1 rounded text-indigo-400">{currentTask?.marks} pts</span>
                    </div>
                    <p className="text-sm leading-relaxed text-slate-400 bg-slate-900/50 p-5 rounded-2xl border border-slate-800">
                      {currentTask?.description || "No description provided."}
                    </p>
                  </section>

                  {currentTask?.codeConstraints?.length > 0 && (
                    <section className="space-y-4">
                      <h3 className="text-[10px] font-black uppercase text-amber-500 tracking-widest flex items-center gap-2">
                        <ShieldCheck size={14} /> Structural Constraints
                      </h3>
                      <div className="grid grid-cols-1 gap-2">
                        {currentTask.codeConstraints.map((con, cIdx) => (
                          <div key={con.id ? `con-${con.id}` : `con-${cIdx}`} className={`text-xs p-3 rounded-xl border ${con.type === 'Forbidden' ? 'bg-rose-500/5 border-rose-500/20 text-rose-400' : 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400'}`}>
                            <span className="font-bold">{con.type}:</span> {con.construct} 
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </motion.div>
              ) : (
                <motion.div 
                  key={`test-${activeTaskIndex}`}
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                  className="space-y-6"
                >
                  <h2 className="text-white font-bold text-sm mb-4">Verification Suites</h2>
                  {currentTask?.testCases?.map((tc, i) => (
                    <div key={tc.id ? `tc-${tc.id}` : `tc-${i}`} className={`bg-slate-900 rounded-xl border ${tc.isHidden ? 'border-dashed border-slate-800' : 'border-slate-800'} overflow-hidden`}>
                      <div className="bg-slate-800/50 px-4 py-2 text-[9px] font-bold uppercase tracking-wider flex justify-between">
                        <span>Case {i + 1}</span>
                        <span className={tc.isHidden ? "text-amber-500" : "text-indigo-400"}>
                          {tc.isHidden ? "Hidden Case" : "Public Case"}
                        </span>
                      </div>
                      {!tc.isHidden ? (
                        <div className="p-4 space-y-4">
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Input</label>
                            <pre className="mt-1 bg-black/30 p-3 rounded-lg text-xs font-mono text-emerald-400 overflow-x-auto border border-slate-800">{tc.input || "No Input"}</pre>
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Expected Output</label>
                            <pre className="mt-1 bg-black/30 p-3 rounded-lg text-xs font-mono text-blue-400 overflow-x-auto border border-slate-800">{tc.expectedOutput}</pre>
                          </div>
                        </div>
                      ) : (
                        <div className="p-6 flex flex-col items-center justify-center gap-3 italic text-xs text-slate-500">
                          <AlertTriangle size={24} className="text-slate-700" />
                          <span>Input/Output hidden for evaluation</span>
                        </div>
                      )}
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </aside>

        {/* Right Panel: Editor & Execution Console */}
        <section className="flex-1 flex flex-col bg-[#111827]">
          <div className="flex-1 p-4 relative">
             <div className="absolute top-8 right-10 z-10 flex items-center gap-3">
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">C++ 17</span>
                <div className="h-4 w-px bg-slate-800"></div>
                <Info size={14} className="text-slate-600" />
             </div>
            <textarea
              value={taskCodes[currentTask?.id] || ""}
              onChange={(e) => handleCodeChange(e.target.value)}
              className="w-full h-full bg-[#1E293B] rounded-3xl p-8 font-mono text-sm outline-none border border-slate-800 focus:border-indigo-500/50 transition-all text-emerald-400 resize-none shadow-2xl"
              placeholder={`// Write solution for Task ${activeTaskIndex + 1}...`}
            />
          </div>

          <div className="h-[280px] bg-[#020617] border-t border-slate-800 flex flex-col">
            <div className="flex justify-between items-center px-6 py-3 border-b border-slate-800 bg-slate-900/30">
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <Terminal size={14} /> Results Console
              </div>
              <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-1.5 rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-900/20 active:scale-95">
                <Play size={12} fill="currentColor" /> Run Current Task
              </button>
            </div>
            <div className="flex-1 p-6 font-mono text-xs overflow-y-auto space-y-4">
               <div className="flex items-center gap-3 text-slate-600">
                  <span className="animate-pulse">●</span>
                  <span className="uppercase text-[10px] font-bold tracking-widest">Waiting for execution...</span>
               </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default LabSession;
