import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, ArrowLeft, X } from 'lucide-react';

export default function CodezyLogin({ setUserState }) {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({ email: '', password: '', rememberMe: false });
  const [showMfaInput, setShowMfaInput] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [tempUserId, setTempUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");

  // --- Role-based dashboard mapping
  const roleToDashboard = (role) => {
    switch (role) {
      case 'teacher': return '/teacher';
      case 'student': return '/student';
      case 'individual_learner': return '/learner-dashboard';
      case 'institution_admin': return '/admin';
      default: return '/';
    }
  };

  // --- Complete login sequence
  const completeLogin = (data) => {
    if (!data || !data.token || !data.userId) {
      return alert("Login failed: invalid response from server");
    }

    // 1. Construct the user object carefully
    const user = {
      _id: data.userId,
      tenantId: data.tenantId || "",
      role: data.role || "student",
      classIds: data.classIds || [],
      email: data.email || "",
      fullName: data.fullName || "",
      token: data.token,
    };

    // 2. Persistent storage sync
    try {
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("token", data.token);
      localStorage.setItem("role", user.role);
      localStorage.setItem("userId", user._id);
      localStorage.setItem("fullName", user.fullName);
    } catch (err) {
      console.error("LocalStorage Error:", err);
    }

    // 3. Update global React state (triggers SocketProvider connection)
    setUserState(user);

    // 4. Execution of navigation with a slight delay
    // This ensures the App.jsx state has reconciled before the URL changes
    setTimeout(() => {
      const targetPath = roleToDashboard(user.role);
      console.log(`Successfully authenticated. Navigating to: ${targetPath}`);
      navigate(targetPath, { replace: true });
    }, 150);
  };

  // --- Initial credential submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    const { email, password } = formData;
    if (!email || !password) return alert("Please fill both email and password");

    setLoading(true);
    try {
      const response = await fetch("http://localhost:5000/api/auth/login", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (!response.ok) return alert(data.message || "Login failed");

      if (data.mfaRequired) {
        setTempUserId(data.userId);
        setShowMfaInput(true);
      } else {
        completeLogin(data);
      }
    } catch (err) {
      console.error("Network Error:", err);
      alert("Login failed. Please ensure the server is running.");
    } finally {
      setLoading(false);
    }
  };

  // --- MFA Verification submission
  const handleVerifyMFA = async (e) => {
    e.preventDefault();
    if (mfaCode.length !== 6) return alert("Enter 6-digit code");

    setLoading(true);
    try {
      const response = await fetch("http://localhost:5000/api/auth/verify-2fa", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: tempUserId, token: mfaCode }),
      });
      const data = await response.json();
      if (!response.ok) return alert(data.message || "Invalid 2FA code");

      completeLogin(data);
    } catch (err) {
      alert("Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!resetEmail) return alert("Please enter your email");
    setLoading(true);
    try {
      const response = await fetch("http://localhost:5000/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail }),
      });
      const data = await response.json();
      if (!response.ok) return alert(data.message || "Failed to send reset email");
      alert("Password reset link has been sent to your email");
      setShowForgotPassword(false);
      setResetEmail("");
    } catch (err) {
      alert("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center p-4 relative overflow-hidden">
      {/* --- FORGOT PASSWORD MODAL --- */}
      {showForgotPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Reset Password</h2>
              <button onClick={() => setShowForgotPassword(false)} className="text-gray-400 hover:text-gray-600"><X size={24}/></button>
            </div>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <input type="email" required value={resetEmail} onChange={e => setResetEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                placeholder="name@example.com" />
              <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold">{loading ? "Sending..." : "Send Reset Link"}</button>
            </form>
          </div>
        </div>
      )}

      {/* --- LOGIN / 2FA CARD --- */}
      <div className="relative z-10 w-full max-w-5xl">
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-white/20">
          <div className="flex flex-col md:flex-row">

            {/* Left Column: Visuals */}
            <div className="md:w-1/2 bg-gradient-to-br from-indigo-600 via-purple-600 to-purple-700 p-12 flex items-center justify-center relative overflow-hidden">
              <img src="/src/assets/login.gif" alt="Welcome" className="w-full max-w-md mx-auto rounded-2xl shadow-2xl"/>
            </div>

            {/* Right Column: Form Logic */}
            <div className="md:w-1/2 p-12 relative">
              <div className="max-w-md mx-auto">
                {!showMfaInput ? (
                  <>
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">Welcome Back</h1>
                    <p className="text-gray-600 mb-8">Please enter your credentials</p>
                    <form className="space-y-6" onSubmit={handleSubmit}>
                      <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="Enter your email" required className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"/>
                      <input type="password" name="password" value={formData.password} onChange={handleChange} placeholder="Enter your password" required className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"/>
                      <div className="flex items-center justify-between">
                        <label className="flex items-center cursor-pointer">
                          <input type="checkbox" name="rememberMe" checked={formData.rememberMe} onChange={handleChange} className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"/>
                          <span className="ml-2 text-sm text-gray-600">Remember me</span>
                        </label>
                        <button type="button" onClick={() => setShowForgotPassword(true)} className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">Forgot password?</button>
                      </div>
                      <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-indigo-700 transition-all">
                        {loading ? "Logging in..." : "Login"}
                      </button>
                    </form>
                  </>
                ) : (
                  <div className="animate-in fade-in slide-in-from-right duration-500">
                    <button onClick={() => setShowMfaInput(false)} className="flex items-center text-sm text-indigo-600 hover:text-indigo-700 mb-6 font-medium">
                      <ArrowLeft size={16} className="mr-1"/> Back to Password
                    </button>
                    <div className="bg-indigo-50 w-16 h-16 rounded-2xl flex items-center justify-center mb-6">
                      <Shield className="text-indigo-600" size={32}/>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">Verify Account</h1>
                    <p className="text-gray-600 mb-8">Enter the 6-digit code from your authenticator app</p>
                    <form className="space-y-6" onSubmit={handleVerifyMFA}>
                      <input type="text" maxLength="6" placeholder="000000" value={mfaCode} onChange={e => setMfaCode(e.target.value.replace(/\D/g,''))} 
                        className="w-full text-center text-3xl tracking-[0.5em] font-mono py-4 border-2 border-gray-200 rounded-xl focus:border-indigo-500 outline-none"/>
                      <button type="submit" disabled={loading || mfaCode.length < 6} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl font-bold disabled:opacity-50 transition-all">
                        {loading ? "Verifying..." : "Verify & Login"}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}