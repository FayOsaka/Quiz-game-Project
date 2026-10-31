import { useState, useMemo, useEffect } from 'react';
import Asides from '../components/asides';
import { dashboardApi } from '../api';
import {
  Bell,
  ChevronDown,
  Download,
  Users,
  CheckCircle2,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Pin,
  FileCheck,
  UserCheck,
  Building2,
  FlaskConical,
  GraduationCap
} from 'lucide-react';

export default function App() {
  const [studentsList, setStudentsList] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [questionSets, setQuestionSets] = useState([]);
  const [selectedSetId, setSelectedSetId] = useState('');
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCampus, setSelectedCampus] = useState('');
  const [responseSort, setResponseSort] = useState('all');
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [notification, setNotification] = useState('');
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  useEffect(() => {
    let ignore = false;
    dashboardApi.getData(selectedSetId)
      .then((data) => {
        if (ignore) return;
        setQuestionSets(data.questionSets);
        setStudentsList(data.submissions);
        setSelectedStudent((current) => data.submissions.find((item) => item.submissionId === current?.submissionId) || data.submissions[0] || null);
        setApiError('');
      })
      .catch((error) => { if (!ignore) setApiError(error.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [selectedSetId]);

  const uniqueStudents = useMemo(() => {
    const byCode = new Map();
    studentsList.forEach((submission) => {
      if (!byCode.has(submission.id)) byCode.set(submission.id, submission);
    });
    return [...byCode.values()];
  }, [studentsList]);

  // คำนวณจำนวนนักศึกษาแยกตามสถานที่จากข้อมูลจริง
  const campusCount = useMemo(() => {
    return uniqueStudents.filter((s) => s.campus === 'ในมหาวิทยาลัย').length;
  }, [uniqueStudents]);

  const scienceCount = useMemo(() => {
    return uniqueStudents.filter((s) => s.campus === 'ศูนย์วิทยาศาสตร์').length;
  }, [uniqueStudents]);

  const suphanCount = useMemo(() => {
    return uniqueStudents.filter((s) => s.campus === 'วิทยาเขตสุพรรณบุรี').length;
  }, [uniqueStudents]);

  // ช่องที่ 4: รวมจำนวนนักศึกษาจากทั้ง 3 ช่องอัตโนมัติ
  const totalStudentsCount = uniqueStudents.length;

  // คำนวณคำตอบทั้งหมด คำตอบที่ถูก และผิด จากคำตอบของนักศึกษาจริง
  const answerStats = useMemo(() => {
    let total = 0;
    let correct = 0;
    let wrong = 0;

    studentsList.forEach((student) => {
      student.answers.forEach((ans) => {
        total += 1;
        if (ans.isCorrect) correct += 1;
        else wrong += 1;
      });
    });

    const correctPercent = total > 0 ? ((correct / total) * 100).toFixed(1) : 0;
    const wrongPercent = total > 0 ? ((wrong / total) * 100).toFixed(1) : 0;

    return { total, correct, wrong, correctPercent, wrongPercent };
  }, [studentsList]);

  const notificationsList = studentsList.slice(0, 5).map((student, index) => ({
    id: student.submissionId,
    studentName: student.name,
    location: student.campus || 'ไม่ระบุวิทยาเขต',
    timeAgo: index === 0 ? 'ล่าสุด' : student.time,
    isRead: false,
  }));
  const unreadCount = notificationsList.length;

  // Filter students by search term
  const filteredStudents = useMemo(() => {
    const query = searchQuery.toLowerCase();
    const matches = studentsList.filter((student) => {
      const matchesCampus = !selectedCampus || student.campus === selectedCampus;
      const matchesSearch = student.name.toLowerCase().includes(query) || student.id.includes(searchQuery);
      return matchesCampus && matchesSearch && (!pinnedOnly || student.isPinned);
    });
    const compareSpeed = (a, b) => {
      if (a.durationSeconds != null && b.durationSeconds != null) return a.durationSeconds - b.durationSeconds;
      if (a.durationSeconds != null) return -1;
      if (b.durationSeconds != null) return 1;
      return String(a.submittedAt).localeCompare(String(b.submittedAt));
    };
    if (responseSort === 'time') matches.sort(compareSpeed);
    if (responseSort === 'correct') matches.sort((a, b) => b.score - a.score);
    if (responseSort === 'combined') matches.sort((a, b) => (b.score - a.score) || compareSpeed(a, b));
    return matches;
  }, [studentsList, searchQuery, selectedCampus, responseSort, pinnedOnly]);

  const filteredUniqueStudentCount = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return uniqueStudents.filter((student) => {
      const matchesCampus = !selectedCampus || student.campus === selectedCampus;
      const matchesSearch = student.name.toLowerCase().includes(query) || student.id.includes(searchQuery);
      return matchesCampus && matchesSearch && (!pinnedOnly || student.isPinned);
    }).length;
  }, [uniqueStudents, searchQuery, selectedCampus, pinnedOnly]);
  const pinnedStudentCount = uniqueStudents.filter((student) => student.isPinned).length;

  const displayedStudent = filteredStudents.find((student) => student.submissionId === selectedStudent?.submissionId)
    || filteredStudents[0]
    || null;

  const togglePin = async (student) => {
    const pinned = !student.isPinned;
    try {
      await dashboardApi.pinStudent(student.id, pinned);
      setStudentsList((items) => items.map((item) => item.id === student.id ? { ...item, isPinned: pinned } : item));
      setSelectedStudent((current) => current?.id === student.id ? { ...current, isPinned: pinned } : current);
      setNotification(pinned ? 'ปักหมุดนักศึกษาแล้ว' : 'ยกเลิกปักหมุดแล้ว');
      setTimeout(() => setNotification(''), 2500);
    } catch (error) {
      setNotification(error.message);
      setTimeout(() => setNotification(''), 3500);
    }
  };

  const handleExport = () => {
    if (!studentsList.length) return setNotification('ยังไม่มีข้อมูลสำหรับส่งออก');
    const escapeCsv = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const rows = [['รหัสนักศึกษา', 'ชื่อ-นามสกุล', 'หลักสูตร', 'คณะ', 'วิทยาเขต', 'วันที่ส่ง', 'คะแนน']];
    studentsList.forEach((student) => rows.push([
      student.id, student.name, student.degree, student.faculty, student.campus,
      student.submittedAt, `${student.score}/${student.totalQuestions}`,
    ]));
    const csv = `\uFEFF${rows.map((row) => row.map(escapeCsv).join(',')).join('\r\n')}`;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.download = 'quiz-dashboard.csv';
    link.click();
    URL.revokeObjectURL(link.href);
    setNotification('ส่งออกข้อมูลเป็น CSV แล้ว');
    setTimeout(() => setNotification(''), 3000);
  };

  return (
    <div className="min-h-screen bg-[#f7f8f6] text-slate-800 font-sans flex flex-col md:flex-row antialiased selection:bg-emerald-100 selection:text-emerald-800">
      
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-700 text-white px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 text-sm animate-bounce">
          <CheckCircle2 className="w-4 h-4" />
          {notification}
        </div>
      )}

      <Asides />

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        
        {/* TOP HEADER BAR */}
        <header className="bg-white border-b border-slate-200/80 px-6 py-3.5 flex items-center justify-between sticky top-0 z-20">
          {/* Breadcrumb */}
          <div className="flex items-center space-x-2 text-xs md:text-sm text-slate-500">
            <span>ผู้ดูแลระบบ</span>
            <span className="text-slate-300">&gt;</span>
            <span className="font-medium text-slate-800">ภาพรวมและตรวจคำตอบ</span>
          </div>

          {/* Right User Actions with Notification Popover */}
          <div className="flex items-center space-x-4 relative">
            <button
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              className="relative p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors focus:outline-none"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-600 rounded-full animate-pulse"></span>
              )}
            </button>

            {/* Notification Dropdown Popover */}
            {isNotifOpen && (
              <div className="absolute right-0 top-12 w-80 sm:w-96 bg-white rounded-xl shadow-lg border border-slate-200/80 z-50 overflow-hidden">
                <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold text-slate-800">การแจ้งเตือนล่าสุด</span>
                    {unreadCount > 0 && (
                      <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        ใหม่ {unreadCount}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400">เรียลไทม์</span>
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {notificationsList.length > 0 ? (
                    notificationsList.map((item) => (
                      <div
                        key={item.id}
                        className={`p-3.5 flex items-start space-x-3 transition-colors hover:bg-slate-50 ${
                          !item.isRead ? 'bg-emerald-50/30' : ''
                        }`}
                      >
                        <div className="p-2 rounded-lg bg-emerald-100/70 text-emerald-600 shrink-0 mt-0.5">
                          <UserCheck className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-slate-800 truncate">
                              {item.studentName}
                            </p>
                            <div className="flex items-center text-[10px] text-slate-400 space-x-1 shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              <span>{item.timeAgo}</span>
                            </div>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            ส่งคำตอบสำเร็จ • <span className="font-medium text-slate-600">{item.location}</span>
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-6 text-center text-slate-400 text-xs">
                      ยังไม่มีข้อมูลการส่งคำตอบใหม่
                    </div>
                  )}
                </div>

                <div className="p-2 bg-slate-50 text-center border-t border-slate-100">
                  <button
                    onClick={() => setIsNotifOpen(false)}
                    className="text-[11px] font-medium text-slate-500 hover:text-slate-700"
                  >
                    ปิดหน้าต่าง
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* DASHBOARD CONTAINER */}
        <main className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
          {apiError && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{apiError}</div>}
          {loading && <div className="text-sm text-slate-500">กำลังโหลดข้อมูลจากฐานข้อมูล…</div>}
          
          {/* SECTION HEADER & CONTROL BAR */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                ภาพรวมและตรวจคำตอบ
              </h1>
              <p className="text-xs md:text-sm text-slate-500 mt-1">
                ติดตามการตอบและผลตรวจอัตโนมัติจากฐานข้อมูลได้ในพื้นที่เดียว
              </p>
            </div>

            <div className="flex items-center space-x-3">
              {/* Dropdown Selector */}
              <div className="relative">
                <select
                  value={selectedSetId}
                  onChange={(e) => { setLoading(true); setSelectedSetId(e.target.value); }}
                  className="appearance-none bg-white border border-slate-200 text-slate-700 text-xs md:text-sm rounded-lg pl-3 pr-8 py-2 font-medium hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-sm cursor-pointer"
                >
                  <option value="">ทุกชุดคำถาม</option>
                  {questionSets.map((set) => <option key={set.id} value={String(set.id)}>{set.title}</option>)}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Export Button */}
              <button
                onClick={handleExport}
                className="inline-flex items-center space-x-1.5 bg-white border border-slate-200 text-emerald-800 hover:bg-emerald-50/50 text-xs md:text-sm font-medium px-3.5 py-2 rounded-lg transition-colors shadow-sm"
              >
                <Download className="w-4 h-4 text-emerald-700" />
                <span>ส่งออกข้อมูล</span>
              </button>
            </div>
          </div>

          {/* STATS CARDS ROW (4 CARDS) - ปรับไอคอนและหัวข้อตรงตามความหมาย */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: ในมหาวิทยาลัย */}
            <button type="button" aria-pressed={selectedCampus === 'ในมหาวิทยาลัย'} onClick={() => setSelectedCampus((value) => value === 'ในมหาวิทยาลัย' ? '' : 'ในมหาวิทยาลัย')} className={`text-left bg-white rounded-xl p-5 border shadow-sm flex flex-col justify-between transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-500 ${selectedCampus === 'ในมหาวิทยาลัย' ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200/80'}`}>
              <div className="flex justify-between items-start">
                <span className="text-xs font-medium text-slate-500">ในมหาวิทยาลัย</span>
                <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <Building2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-extrabold text-slate-900">
                  {campusCount} <span className="text-xs font-normal text-slate-500 ml-0.5">คน</span>
                </div>
              </div>
            </button>

            {/* Card 2: ศูนย์วิทยาศาสตร์ */}
            <button type="button" aria-pressed={selectedCampus === 'ศูนย์วิทยาศาสตร์'} onClick={() => setSelectedCampus((value) => value === 'ศูนย์วิทยาศาสตร์' ? '' : 'ศูนย์วิทยาศาสตร์')} className={`text-left bg-white rounded-xl p-5 border shadow-sm flex flex-col justify-between transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-500 ${selectedCampus === 'ศูนย์วิทยาศาสตร์' ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200/80'}`}>
              <div className="flex justify-between items-start">
                <span className="text-xs font-medium text-slate-500">ศูนย์วิทยาศาสตร์</span>
                <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <FlaskConical className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-extrabold text-slate-900">
                  {scienceCount} <span className="text-xs font-normal text-slate-500 ml-0.5">คน</span>
                </div>
              </div>
            </button>

            {/* Card 3: วิทยาเขตสุพรรณบุรี */}
            <button type="button" aria-pressed={selectedCampus === 'วิทยาเขตสุพรรณบุรี'} onClick={() => setSelectedCampus((value) => value === 'วิทยาเขตสุพรรณบุรี' ? '' : 'วิทยาเขตสุพรรณบุรี')} className={`text-left bg-white rounded-xl p-5 border shadow-sm flex flex-col justify-between transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-500 ${selectedCampus === 'วิทยาเขตสุพรรณบุรี' ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200/80'}`}>
              <div className="flex justify-between items-start">
                <span className="text-xs font-medium text-slate-500">วิทยาเขตสุพรรณบุรี</span>
                <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                  <GraduationCap className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-extrabold text-slate-900">
                  {suphanCount} <span className="text-xs font-normal text-slate-500 ml-0.5">คน</span>
                </div>
              </div>
            </button>

            {/* Card 4: จำนวนนักศึกษาทั้งหมด (ผลรวมจาก 3 ช่องแรก) */}
            <button type="button" aria-pressed={!selectedCampus} onClick={() => setSelectedCampus('')} className={`text-left bg-white rounded-xl p-5 border shadow-sm flex flex-col justify-between transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-500 ${!selectedCampus ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200/80'}`}>
              <div className="flex justify-between items-start">
                <span className="text-xs font-medium text-slate-500">จำนวนนักศึกษาทั้งหมด</span>
                <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-extrabold text-slate-900">
                  {totalStudentsCount} <span className="text-xs font-normal text-slate-500 ml-0.5">นักศึกษา</span>
                </div>
              </div>
            </button>
          </div>

          {/* MIDDLE ANALYTICS WIDGET: STATUS BAR (คำนวณตามจำนวนที่นักศึกษาตอบจริง) */}
          <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-sm">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xs font-semibold text-slate-700">สถานะคำตอบอัตโนมัติ</h3>
              <span className="text-xs text-slate-400">{answerStats.total} คำตอบ</span>
            </div>

            <div className="flex items-baseline space-x-2 my-2">
              <span className="text-2xl font-extrabold text-slate-900">{answerStats.total ? `${answerStats.correctPercent}%` : '0%'}</span>
              <span className="text-xs text-slate-500">ตอบถูกจากคำตอบทั้งหมด</span>
            </div>

            {/* Stacked Progress Bar คำนวณแบบ Dynamic */}
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex my-3">
              <div
                className="bg-emerald-800 h-full transition-all duration-300"
                style={{ width: `${answerStats.correctPercent}%` }}
                title={`ตรวจถูก ${answerStats.correct} (${answerStats.correctPercent}%)`}
              ></div>
              <div
                className="bg-rose-500 h-full transition-all duration-300"
                style={{ width: `${answerStats.wrongPercent}%` }}
                title={`ตรวจผิด ${answerStats.wrong} (${answerStats.wrongPercent}%)`}
              ></div>
            </div>

            {/* Progress Bar Footnotes */}
            <div className="flex items-center space-x-6 text-xs text-slate-600 mt-2">
              <div className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-800"></span>
                <span>ระบบตรวจถูก</span>
                <span className="font-bold text-slate-800">
                  {answerStats.correct} ({answerStats.correctPercent}%)
                </span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                <span>ระบบตรวจผิด</span>
                <span className="font-bold text-slate-800">
                  {answerStats.wrong} ({answerStats.wrongPercent}%)
                </span>
              </div>
            </div>
          </div>

          {/* BOTTOM MAIN SPLIT VIEW */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* LEFT PANEL: STUDENT LIST */}
            <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col justify-between">
              <div>
                <div className="p-4 border-b border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <h2 className="font-bold text-slate-800 text-sm md:text-base">รายการผู้ตอบ{selectedCampus ? ` • ${selectedCampus}` : ' • ทุกวิทยาเขต'}</h2>
                      <span className="bg-emerald-50 text-emerald-800 text-xs px-2 py-0.5 rounded-full font-medium">
                        {filteredUniqueStudentCount} คน
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {studentsList[0] ? `ล่าสุด ${studentsList[0].date} • ${studentsList[0].time}` : 'ยังไม่มีการส่งคำตอบ'}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="ค้นหาชื่อหรือรหัสนักศึกษา"
                        className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white transition-all"
                      />
                    </div>
                    <div className="relative">
                      <Filter className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <select aria-label="ตัวกรองรายการผู้ตอบ" value={responseSort} onChange={(event) => setResponseSort(event.target.value)} className="appearance-none w-36 rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs font-medium text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500">
                        <option value="all">ทุกสถานะ</option>
                        <option value="time">เวลา • ตอบเร็วสุด</option>
                        <option value="correct">ถูกต้อง • คะแนนสูงสุด</option>
                        <option value="combined">เวลาและถูกต้อง</option>
                      </select>
                    </div>
                    <button type="button" aria-pressed={pinnedOnly} onClick={() => setPinnedOnly((value) => !value)} className={`inline-flex items-center space-x-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${pinnedOnly ? 'border-amber-300 bg-amber-100 text-amber-800' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
                      <Pin className="h-3.5 w-3.5" />
                      <span>ปักหมุด {pinnedStudentCount}</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/70 border-b border-slate-100 text-[11px] text-slate-400 font-medium">
                        <th className="py-2.5 px-4">ชื่อ-นามสกุล / รหัสนักศึกษา</th>
                        <th className="py-2.5 px-4">หลักสูตร / คณะ</th>
                        <th className="py-2.5 px-4">เวลาที่ตอบ</th>
                        <th className="py-2.5 px-4 text-center">การตรวจ</th>
                        <th className="py-2.5 px-3 text-center">ปักหมุด</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredStudents.length > 0 ? (
                        filteredStudents.map((student) => {
                          const isSelected = displayedStudent?.submissionId === student.submissionId;
                          return (
                            <tr
                              key={student.id}
                              onClick={() => setSelectedStudent(student)}
                              className={`cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-emerald-50/60 font-medium'
                                  : 'hover:bg-slate-50/80'
                              }`}
                            >
                              <td className="py-3 px-4">
                                <div className="text-slate-900 font-semibold">{student.name}</div>
                                <div className="flex items-center gap-2 text-[11px] text-slate-400 font-normal">
                                  <span>{student.id}</span>
                                  {student.isPinned && <Pin className="h-3 w-3 fill-amber-500 text-amber-600" aria-label="ปักหมุดแล้ว" />}
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <div className="text-slate-700">{student.degree}</div>
                                <div className="text-[11px] text-slate-400">{student.faculty}</div>
                              </td>
                              <td className="py-3 px-4 text-slate-600">
                                <div>{student.time}</div>
                                <div className="text-[10px] text-slate-400">{student.date}</div>
                                {student.durationSeconds != null && <div className="text-[10px] font-medium text-indigo-600">ใช้เวลา {student.durationSeconds < 60 ? `${student.durationSeconds} วินาที` : `${Math.floor(student.durationSeconds / 60)} นาที ${student.durationSeconds % 60} วินาที`}</div>}
                              </td>
                              <td className="py-3 px-3 text-center">
                                <button type="button" title={student.isPinned ? 'ยกเลิกปักหมุด' : 'ปักหมุดนักศึกษา'} aria-label={student.isPinned ? `ยกเลิกปักหมุด ${student.name}` : `ปักหมุด ${student.name}`} onClick={(event) => { event.stopPropagation(); togglePin(student); }} className={`rounded-md p-1.5 transition-colors ${student.isPinned ? 'text-amber-600 hover:bg-amber-50' : 'text-slate-300 hover:bg-amber-50 hover:text-amber-600'}`}>
                                  <Pin className={`h-4 w-4 ${student.isPinned ? 'fill-amber-400' : ''}`} />
                                </button>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-100/70 text-emerald-800">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                                  <span>{student.status}</span>
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan="5" className="text-center py-8 text-slate-400 text-xs">
                            ไม่พบข้อมูลนักศึกษาที่ค้นหา
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Table Pagination */}
              <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>แสดง 1-{filteredStudents.length} จาก {studentsList.length} คน</span>
                <div className="flex items-center space-x-1">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button className="w-6 h-6 rounded bg-emerald-50 text-emerald-800 font-semibold text-center flex items-center justify-center">
                    1
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => p + 1)}
                    className="p-1 rounded hover:bg-slate-100"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* RIGHT PANEL: AUTO-GRADING INSPECTION */}
            <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h2 className="font-bold text-slate-800 text-sm md:text-base">ผลตรวจอัตโนมัติ</h2>
                <span className="bg-emerald-50 text-emerald-800 text-[11px] px-2.5 py-0.5 rounded-full font-medium inline-flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                  <span>{displayedStudent ? `ตรวจแล้ว ${displayedStudent.answers.length} ข้อ` : 'ยังไม่มีผลตรวจ'}</span>
                </span>
              </div>

              {displayedStudent ? <>
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-base flex-shrink-0">
                  {displayedStudent.name.charAt(0)}
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                    <span>{displayedStudent.name}</span>
                    <span className="text-xs text-slate-400 font-normal">{displayedStudent.id}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {displayedStudent.degree} • {displayedStudent.faculty}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span>ส่งเมื่อ {displayedStudent.date} เวลา {displayedStudent.time} ({displayedStudent.questionSetTitle})</span>
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                {displayedStudent.answers.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 space-y-2 transition-all hover:border-slate-200"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-semibold text-xs text-slate-800 leading-snug">
                        {item.question}
                      </h4>
                      {item.isCorrect ? (
                        <span className="inline-flex items-center space-x-1 bg-emerald-100/80 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0">
                          <Check className="w-3 h-3" />
                          <span>ถูก</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 bg-rose-100/80 text-rose-700 text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0">
                          <X className="w-3 h-3" />
                          <span>ผิด</span>
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-700 font-medium bg-white p-2.5 rounded-lg border border-slate-100 shadow-2xs">
                      {item.userAnswer}
                    </div>

                    <p className="text-[10px] text-slate-400">
                      {item.refAnswer}
                    </p>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-800">คะแนน {displayedStudent.score}/{displayedStudent.totalQuestions} ข้อ</div>
                  <div className="text-[10px] text-slate-400">ผลตรวจอัปเดตสมบูรณ์</div>
                </div>

                <button className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors">
                  <FileCheck className="w-3.5 h-3.5 text-slate-500" />
                  <span>ดูแลตรวจอัตโนมัติ</span>
                </button>
              </div>
              </> : <div className="py-12 text-center text-sm text-slate-400">ยังไม่มีข้อมูลคำตอบสำหรับชุดคำถามนี้</div>}

            </div>

          </div>

        </main>
      </div>

    </div>
  );
}
