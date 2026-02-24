import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster, toast } from "react-hot-toast"; // Recommended for the toasts
import App from "./App";
import "./index.css"; 
import { SocketProvider } from "./context/socketContext.jsx";
import { getCurrentUser } from "./services/auth.js";

// We wrap the render in a small wrapper or just pass the user.
// To handle login/logout without refresh, App usually manages the user state.
const Root = () => {
  const [user, setUser] = React.useState(getCurrentUser());

  return (
    <BrowserRouter>
      {/* 1. Add a Toaster component here for the popups to show up */}
      <Toaster position="top-right" reverseOrder={false} />
      <SocketProvider user={user}>
        <App user={user} setUser={setUser} />
      </SocketProvider>
    </BrowserRouter>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);