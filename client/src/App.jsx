import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import "./App.css";

// pages
import Home from "./page/home";
import Question from "./page/question";
import Dashboard from "./page/dashboard";
import AdminLoginPage from "./page/admin-login";
import { AdminAuthProvider, useAdminAuth } from "./auth";

function RequireAdmin({ children }) {
  const { user, loading } = useAdminAuth();
  const location = useLocation();
  if (loading) return <div className="min-h-screen grid place-items-center text-slate-500">กำลังตรวจสอบสิทธิ์…</div>;
  if (!user) return <Navigate to="/admin/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  return children;
}

function App() {
  return (
    <AdminAuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/question" element={<RequireAdmin><Question /></RequireAdmin>} />
          <Route path="/dashboard" element={<RequireAdmin><Dashboard /></RequireAdmin>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AdminAuthProvider>
  );
}

export default App;
