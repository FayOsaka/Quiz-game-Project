import React from 'react';
import { BookOpen, LayoutGrid, Settings, HelpCircle, LogOut } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../auth';

export default function Sidebar({ isSidebarOpen }) {
  const location = useLocation(); // ดึง path ปัจจุบัน (เช่น '/dashboard' หรือ '/question')
  const navigate = useNavigate();
  const { user, logout } = useAdminAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // The local auth state is cleared even if the session already expired.
    } finally {
      navigate('/admin/login', { replace: true });
    }
  };

  return (
    <aside
      className={`fixed md:sticky top-0 left-0 z-30 h-screen w-64 bg-white border-r border-slate-200/80 flex flex-col justify-between p-4 transition-transform duration-200 ease-in-out ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}
    >
      <div>
        {/* Brand Header */}
        <div className="flex items-start space-x-3 mb-6 px-1">
          <div className="w-9 h-9 rounded-xl bg-emerald-800 flex items-center justify-center text-white shadow-sm mt-0.5">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-base leading-snug text-slate-900">พื้นที่การเรียนรู้</h1>
            <p className="text-xs text-slate-400">งานพัฒนานักศึกษา</p>
          </div>
        </div>

        {/* Admin Category Pill */}
        <div className="mb-6 px-1">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-emerald-800">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1.5"></span>
            สำหรับผู้ดูแลระบบ
          </span>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2">
            พื้นที่ทำงาน
          </p>
          
          {/* เปลี่ยนแท็ก <a> เป็น <Link> และเช็คสีแบบไดนามิก */}
          <Link
            to="/dashboard"
            className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-colors ${
              location.pathname === '/dashboard' 
                ? 'bg-[#eef5ed] text-emerald-900' // สีตอน Active
                : 'text-slate-600 hover:bg-slate-50' // สีตอนไม่ได้เลือก
            }`}
          >
            <LayoutGrid className={`w-4 h-4 ${location.pathname === '/dashboard' ? 'text-emerald-700' : 'text-slate-400'}`} />
            <span>ภาพรวมและตรวจคำตอบ</span>
          </Link>

          <Link
            to="/question"
            className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-colors ${
              location.pathname === '/question' 
                ? 'bg-[#eef5ed] text-emerald-900'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Settings className={`w-4 h-4 ${location.pathname === '/question' ? 'text-emerald-700' : 'text-slate-400'}`} />
            <span>ตั้งค่าคำถาม</span>
          </Link>
        </nav>
      </div>

      {/* Sidebar Footer */}
      <div className="pt-4 border-t border-slate-100 space-y-3">
        <div className="px-1 text-xs text-slate-500">เข้าสู่ระบบ: {user?.username}</div>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-slate-600 hover:bg-red-50 hover:text-red-700"
        >
          <LogOut className="h-4 w-4" />
          ออกจากระบบ
        </button>
        <Link
          to="/manual" // สมมติว่ามีหน้าคู่มือ
          className="flex items-center space-x-2 text-xs text-slate-500 hover:text-slate-800 px-1"
        >
          <HelpCircle className="w-4 h-4 text-slate-400" />
          <span>คู่มือสำหรับผู้ดูแล</span>
        </Link>

        <div className="px-1 text-[11px] text-slate-400">
          พื้นที่การเรียนรู้ • ปีการศึกษา 2569
        </div>
      </div>
    </aside>
  );
}
