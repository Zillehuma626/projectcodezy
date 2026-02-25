import React, { useState } from "react";
import { Bell, Check } from "lucide-react";
import { useNotifications } from "../hooks/useNotifications";
import { useNavigate } from "react-router-dom";

const NotificationDropdown = () => {
  const { notifications, unreadCount, markAsRead, loading } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  // Mark all notifications as read
  const markAllAsRead = async () => {
    for (const n of notifications) {
      if (!n.isRead && (n.notificationId || n._id)) {
        await markAsRead(n.notificationId || n._id);
      }
    }
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.isRead && (notification.notificationId || notification._id)) {
      await markAsRead(notification.notificationId || notification._id);
    }

    if (["LAB_CREATED", "LAB_UPDATED"].includes(notification.type)) {
      const labId = notification.data?.labId;
      const courseId = notification.data?.courseId;

      if (!labId || !courseId) {
        console.error("Lab or Course ID missing", notification);
        return;
      }

      navigate(`/student/courses/${courseId}/labs?highlightLabId=${labId}`, {
        state: { fromCourseId: courseId }
      });
      setIsOpen(false);
    }
  };

  const getIcon = (type) => {
    if (type === "LAB_CREATED") return "🧪";
    if (type === "LAB_UPDATED") return "✏️";
    return "🔔";
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-500 hover:text-purple-600 transition-colors focus:outline-none"
      >
        <Bell size={22} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-pink-500 text-[10px] font-bold text-white border-2 border-white animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-3 w-[380px] bg-white rounded-3xl shadow-2xl border border-gray-100 z-50 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-5 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
                Notifications
                {unreadCount > 0 && (
                  <span className="bg-purple-100 text-purple-700 text-[10px] px-2 py-0.5 rounded-full">
                    {unreadCount} New
                  </span>
                )}
              </h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-[11px] font-bold text-purple-600 hover:text-purple-800 uppercase tracking-wider"
                >
                  Mark all as read
                </button>
              )}
            </div>

            <div className="max-h-[450px] overflow-y-auto custom-scrollbar">
              {loading ? (
                <div className="p-16 text-center text-gray-400">Loading...</div>
              ) : notifications.length > 0 ? (
                notifications.map((n) => (
                  <div
                    key={n.notificationId || n._id}
                    className={`p-4 flex gap-4 border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer ${!n.isRead ? "bg-purple-50/30" : ""}`}
                    onClick={() => handleNotificationClick(n)}
                  >
                    <div className="w-11 h-11 shrink-0 rounded-2xl flex items-center justify-center text-lg text-purple-600 bg-purple-50">
                      {getIcon(n.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold truncate ${!n.isRead ? "text-gray-900" : "text-gray-500"}`}>
                        {n.title}
                      </p>
                      <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed mb-1.5">
                        {n.message}
                        {n.data?.teacherName && (
                          <span className="text-purple-600 font-semibold"> ({n.data.teacherName})</span>
                        )}
                      </p>
                      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-tighter">
                        {new Date(n.createdAt).toLocaleString()}
                      </span>
                    </div>

                    {!n.isRead && (n.notificationId || n._id) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(n.notificationId || n._id);
                        }}
                        className="p-1.5 self-start bg-white border border-gray-100 rounded-lg text-purple-600 hover:bg-purple-600 hover:text-white shadow-sm transition-all active:scale-95"
                        title="Mark as read"
                      >
                        <Check size={14} />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-16 text-center text-gray-400">
                  <Bell size={40} className="mx-auto mb-3 opacity-10" />
                  <p className="text-xs font-medium uppercase tracking-widest">No notifications</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f9fafb; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #ddd6fe; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #7c3aed; }
      `}} />
    </div>
  );
};

export default NotificationDropdown;
