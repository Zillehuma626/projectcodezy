import React from "react";
import { useNotifications } from "../hooks/useNotifications";

export default function Notifications() {
  const { notifications, loading, markAsRead } = useNotifications();

  if (loading) return <p>Loading notifications...</p>;

  return (
    <div className="max-w-xl mx-auto p-4">
      <h2 className="text-xl font-bold mb-4">Notifications</h2>

      {notifications.length === 0 && <p>No notifications yet</p>}

      {notifications.map((n) => (
        <div
          key={n.notificationId} // ✅ use notificationId
          className="flex items-start gap-4 p-4 mb-3 rounded-lg"
          style={{ background: n.isRead ? "#eee" : "#f0ebff" }}
        >
          <span className="text-2xl">
            {n.type === "LAB_CREATED" ? "🧪" : "🔔"}
          </span>
          <div className="flex-1">
            <h4 className="font-semibold text-gray-800 mb-1">{n.title}</h4>
            <p className="text-gray-700 text-sm mb-1">{n.message}</p>
            <small className="text-gray-500 text-xs">
              {new Date(n.createdAt).toLocaleString()}
            </small>
          </div>

          {!n.isRead && (
            <button
              onClick={() => markAsRead(n.notificationId)} // ✅ use notificationId
              className="text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1 rounded-md text-xs font-bold"
            >
              Mark as read
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
