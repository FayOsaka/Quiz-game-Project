import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  LayoutGrid,
  ListChecks,
  Bell,
  User,
  Plus,
  Eye,
  Pencil,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Copy,
  Trash2,
  Key,
  Info,
  ChevronDown,
  MoreHorizontal,
  X,
  Calendar,
  Play,
  Square,
} from "lucide-react";

const QuestionSettingPage = () => {
  // 1. State สำหรับฟอร์มข้อคำถามด้านขวา
  const [questions, setQuestions] = useState([
    {
      id: 1,
      question: "รหัสผ่านที่ปลอดภัยควรมีลักษณะอย่างไร?",
      answer: "อย่างน้อย 12 ตัว ผสมอักขระหลายประเภท",
    },
    {
      id: 2,
      question: "หากได้รับลิงก์น่าสงสัย ควรทำสิ่งใดก่อน?",
      answer: "ไม่คลิกลิงก์ และตรวจสอบผู้ส่งก่อน",
    },
    {
      id: 3,
      question: "การยืนยันตัวตนสองขั้นตอนคืออะไร?",
      answer: "รหัสผ่านร่วมกับรหัสยืนยันอีกชั้น",
    },
  ]);

  // 2. State สำหรับเปิด/ปิด Dropdown เมนูจุด 3 จุด
  const [openDropdownId, setOpenDropdownId] = useState(null);

  // 3. State สำหรับเปิด/ปิด ป๊อปอัป เพิ่ม/แก้ไข ชุดคำถาม
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add"); // 'add' หรือ 'edit'
  const [editSetId, setEditSetId] = useState(null);
  const [newSetTitle, setNewSetTitle] = useState("");
  const [newSetDesc, setNewSetDesc] = useState("");

  // State สำหรับ ป๊อปอัปตั้งเวลา
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleTargetId, setScheduleTargetId] = useState(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // 4. State ข้อมูลชุดคำถามฝั่งซ้าย (เพิ่มฟิลด์ status, startDate, endDate)
  const [questionSets, setQuestionSets] = useState([
    {
      id: 1,
      title: "ความปลอดภัยดิจิทัล",
      desc: "ระบบจะเทียบคำตอบกับเฉลยจากฐานข้อมูลและแสดงผลทันทีหลังส่ง",
      isActive: true,
      questionCount: 3,
      respondents: "120 คนตอบ",
      status: "open",
      startDate: "",
      endDate: "",
    },
    {
      id: 2,
      title: "การใช้ห้องสมุด",
      desc: "ระบบจะเทียบคำตอบกับเฉลยจากฐานข้อมูลและแสดงผลทันทีหลังส่ง",
      isActive: false,
      questionCount: 5,
      respondents: "ยังไม่มีผู้ตอบ",
      status: "closed",
      startDate: "",
      endDate: "",
    },
    {
      id: 3,
      title: "จริยธรรมทางวิชาการ",
      desc: "ระบบจะเทียบคำตอบกับเฉลยจากฐานข้อมูลและแสดงผลทันทีหลังส่ง",
      isActive: false,
      questionCount: 4,
      respondents: "86 คนตอบ",
      status: "closed",
      startDate: "",
      endDate: "",
    },
  ]);

  // ระบบตรวจจับเวลาอัตโนมัติ (เช็คทุกๆ 1 วินาที)
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();

      setQuestionSets(prevSets => {
        let hasChanges = false;
        
        const updatedSets = prevSets.map(set => {
          let newStatus = set.status;

          // 1. ถ้าสถานะเป็น "ตั้งเวลา" และถึงเวลา startDate แล้ว -> เปลี่ยนเป็น "เปิด"
          if (set.status === 'scheduled' && set.startDate) {
            const startTime = new Date(set.startDate);
            if (now >= startTime) {
              newStatus = 'open';
              hasChanges = true;
            }
          }

          // 2. ถ้าสถานะ "เปิด" อยู่ และมีการตั้ง endDate ไว้ แล้วถึงเวลา -> เปลี่ยนเป็น "ปิด"
          if (newStatus === 'open' && set.endDate) {
            const endTime = new Date(set.endDate);
            if (now >= endTime) {
              newStatus = 'closed';
              hasChanges = true;
            }
          }

          if (newStatus !== set.status) {
            return { ...set, status: newStatus };
          }
          return set;
        });

        // คืนค่าใหม่เฉพาะเมื่อมีการเปลี่ยนแปลงสถานะ เพื่อไม่ให้ React Re-render พร่ำเพรื่อ
        return hasChanges ? updatedSets : prevSets;
      });
    }, 1000); // 1000 ms = 1 วินาที

    // ทำความสะอาดการตั้งเวลาเมื่อออกหน้านี้
    return () => clearInterval(timer);
  }, []);

  // ฟังก์ชันสำหรับบันทึกชุดคำถาม (รองรับทั้งเพิ่มใหม่และแก้ไข)
  const handleSaveSet = () => {
    if (!newSetTitle.trim()) return;

    if (modalMode === "add") {
      const newSet = {
        id: Date.now(),
        title: newSetTitle,
        desc:
          newSetDesc ||
          "ระบบจะเทียบคำตอบกับเฉลยจากฐานข้อมูลและแสดงผลทันทีหลังส่ง",
        isActive: false,
        questionCount: 0,
        respondents: "ยังไม่มีผู้ตอบ",
        status: "closed",
        startDate: "",
        endDate: "",
      };
      setQuestionSets([newSet, ...questionSets]); // เอาไว้บนสุด
    } else if (modalMode === "edit") {
      setQuestionSets(
        questionSets.map((set) =>
          set.id === editSetId
            ? { ...set, title: newSetTitle, desc: newSetDesc }
            : set,
        ),
      );
    }
    closeMainModal();
  };

  const openEditModal = (set) => {
    setModalMode("edit");
    setEditSetId(set.id);
    setNewSetTitle(set.title);
    setNewSetDesc(set.desc);
    setIsModalOpen(true);
    setOpenDropdownId(null);
  };

  const closeMainModal = () => {
    setIsModalOpen(false);
    setNewSetTitle("");
    setNewSetDesc("");
    setEditSetId(null);
    setModalMode("add");
  };

  // ฟังก์ชันเปลี่ยนสถานะเปิด/ปิดทันที
  const handleToggleStatus = (id, newStatus) => {
    setQuestionSets(
      questionSets.map((set) =>
        set.id === id
          ? { ...set, status: newStatus, startDate: "", endDate: "" }
          : set,
      ),
    );
    setOpenDropdownId(null);
  };

  // ฟังก์ชันบันทึกการตั้งเวลา
  const handleSaveSchedule = () => {
    setQuestionSets(
      questionSets.map((set) =>
        set.id === scheduleTargetId
          ? { ...set, status: "scheduled", startDate, endDate }
          : set,
      ),
    );
    setIsScheduleModalOpen(false);
    setScheduleTargetId(null);
    setStartDate("");
    setEndDate("");
  };

  return (
    <div
      className="min-h-screen bg-[#F8FAFC] flex font-sans text-gray-800"
      onClick={() => setOpenDropdownId(null)}
    >
      {/* ----------------- ป๊อปอัป เพิ่ม/แก้ไข ชุดคำถาม ----------------- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                {modalMode === "add" ? "เพิ่มชุดคำถามใหม่" : "แก้ไขชุดคำถาม"}
              </h2>
              <button
                onClick={closeMainModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ชื่อชุดคำถาม <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="เช่น การใช้งานอินเทอร์เน็ตเบื้องต้น"
                  value={newSetTitle}
                  onChange={(e) => setNewSetTitle(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  คำอธิบาย
                </label>
                <textarea
                  placeholder="พิมพ์คำอธิบายชุดคำถาม..."
                  value={newSetDesc}
                  onChange={(e) => setNewSetDesc(e.target.value)}
                  rows="3"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                ></textarea>
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50">
              <button
                onClick={closeMainModal}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSaveSet}
                disabled={!newSetTitle.trim()}
                className="px-4 py-2 bg-[#2E6B4F] disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-[#23533D] text-white rounded-lg text-sm font-medium transition-colors"
              >
                {modalMode === "add" ? "สร้างชุดคำถาม" : "บันทึกการแก้ไข"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- ป๊อปอัป ตั้งเวลาเปิด/ปิด ----------------- */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                ตั้งเวลาเปิด-ปิด
              </h2>
              <button
                onClick={() => setIsScheduleModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    เวลาเริ่มต้น
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      now.setMinutes(
                        now.getMinutes() - now.getTimezoneOffset(),
                      );
                      setStartDate(now.toISOString().slice(0, 16));
                    }}
                    className="text-xs text-emerald-600 hover:text-emerald-800 font-medium transition-colors"
                  >
                    + เปิดทันที (เวลาปัจจุบัน)
                  </button>
                </div>
                {/* เพิ่ม onClick={(e) => e.target.showPicker()} และ cursor-pointer */}
                <input
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  onClick={(e) => e.target.showPicker()}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  เวลาสิ้นสุด
                </label>
                {/* เพิ่ม onClick={(e) => e.target.showPicker()} และ cursor-pointer */}
                <input
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  onClick={(e) => e.target.showPicker()}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                />
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
              <button
                onClick={() => setIsScheduleModalOpen(false)}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSaveSchedule}
                className="px-4 py-2 bg-[#2E6B4F] text-white rounded-lg text-sm font-medium"
              >
                บันทึกเวลา
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col z-10">
        <div className="p-6">
          <div className="flex items-center gap-3 text-emerald-800 mb-1">
            <BookOpen size={24} className="text-emerald-700" />
            <span className="font-bold text-lg">พื้นที่การเรียนรู้</span>
          </div>
          <p className="text-xs text-gray-500 ml-9">งานพัฒนานักศึกษา</p>
        </div>

        <div className="px-6 pb-4">
          <span className="inline-flex items-center px-2 py-1 bg-emerald-50 text-emerald-700 text-xs rounded font-medium">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></div>
            สำหรับผู้ดูแลระบบ
          </span>
        </div>

        <div className="px-4 py-2">
          <p className="px-4 text-xs font-semibold text-gray-400 mb-2">
            พื้นที่ทำงาน
          </p>
          <nav className="space-y-1">
            <a
              href="#"
              className="flex items-center gap-3 px-4 py-2.5 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <LayoutGrid size={18} />
              <span className="text-sm">ภาพรวมและตรวจคำตอบ</span>
            </a>
            <a
              href="#"
              className="flex items-center gap-3 px-4 py-2.5 bg-emerald-50 text-emerald-700 rounded-lg transition-colors"
            >
              <ListChecks size={18} />
              <span className="text-sm font-medium">ตั้งค่าคำถาม</span>
            </a>
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>ผู้ดูแลระบบ</span>
            <span>{">"}</span>
            <span className="text-gray-900 font-medium">ตั้งค่าคำถาม</span>
          </div>
          <div className="flex items-center gap-4">
            <button className="text-gray-400 hover:text-gray-600 relative">
              <Bell size={20} />
              <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-bold text-sm">
                ส
              </div>
              <div className="text-sm">
                <p className="font-medium leading-none">สุภาวดี ใจดี</p>
                <p className="text-xs text-gray-500">ผู้ดูแลระบบ</p>
              </div>
              <ChevronDown size={16} className="text-gray-400 ml-1" />
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">ตั้งค่าคำถาม</h1>
            <p className="text-sm text-gray-500 mt-1">
              สร้างชุดคำถามและกำหนดเฉลยสำหรับระบบตรวจอัตโนมัติ
            </p>
          </div>

          <div className="flex gap-6 items-start">
            {/* Left Column: Question Sets */}
            <div className="w-1/3 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-gray-900 text-sm">
                  ชุดคำถามสำหรับตรวจอัตโนมัติ
                </h2>
                <span className="text-sm text-gray-500">
                  {questionSets.length} ชุด
                </span>
              </div>

              <button
                onClick={() => {
                  setModalMode("add");
                  setIsModalOpen(true);
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#2E6B4F] hover:bg-[#23533D] text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Plus size={18} />
                เพิ่มชุดคำถามใหม่
              </button>

              <div className="space-y-3">
                {questionSets.map((set) => (
                  <div
                    key={set.id}
                    onClick={() => {
                      setQuestionSets(
                        questionSets.map((q) => ({
                          ...q,
                          isActive: q.id === set.id,
                        })),
                      );
                    }}
                    className={`relative border rounded-lg p-4 cursor-pointer transition-colors ${
                      set.isActive
                        ? "bg-emerald-50 border-emerald-500"
                        : "bg-white border-gray-200 hover:border-emerald-300"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3
                          className={`font-bold pr-8 ${set.isActive ? "text-emerald-800" : "text-gray-800"}`}
                        >
                          {set.title}
                        </h3>
                        {/* ป้ายกำกับสถานะ */}
                        <span
                          className={`inline-block mt-1 px-2 py-0.5 text-[10px] rounded-full font-medium ${
                            set.status === "open"
                              ? "bg-emerald-100 text-emerald-700"
                              : set.status === "scheduled"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {set.status === "open"
                            ? "เปิดรับคำตอบ"
                            : set.status === "scheduled"
                              ? "ตั้งเวลาล่วงหน้า"
                              : "ปิดรับคำตอบ"}
                        </span>
                      </div>

                      {/* ปุ่มจุด 3 จุด */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenDropdownId(
                            openDropdownId === set.id ? null : set.id,
                          );
                        }}
                        className={`absolute top-3 right-3 p-1.5 rounded-md transition-colors ${
                          openDropdownId === set.id
                            ? "bg-gray-200 text-gray-800"
                            : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        }`}
                      >
                        <MoreHorizontal size={18} />
                      </button>

                      {/* เมนู Dropdown (แก้ไข / ลบ / ตั้งเวลา / เปิด-ปิด) */}
                      {openDropdownId === set.id && (
                        <div className="absolute top-10 right-4 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 overflow-hidden">
                          {/* เปิด-ปิด ทันที */}
                          {set.status !== "open" ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleStatus(set.id, "open");
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <Play size={14} className="text-emerald-600" />{" "}
                              เปิดทันที
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleStatus(set.id, "closed");
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <Square size={14} className="text-red-500" />{" "}
                              ปิดทันที
                            </button>
                          )}

                          {/* ตั้งเวลา */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setScheduleTargetId(set.id);
                              setStartDate(set.startDate);
                              setEndDate(set.endDate);
                              setIsScheduleModalOpen(true);
                              setOpenDropdownId(null);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <Calendar size={14} className="text-blue-500" />{" "}
                            ตั้งเวลา
                          </button>

                          <hr className="my-1 border-gray-100" />

                          <button
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(set);
                            }}
                          >
                            <Pencil size={14} /> แก้ไขข้อมูล
                          </button>
                          <button
                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              setQuestionSets(
                                questionSets.filter((q) => q.id !== set.id),
                              );
                              setOpenDropdownId(null);
                            }}
                          >
                            <Trash2 size={14} /> ลบชุดคำถาม
                          </button>
                        </div>
                      )}
                    </div>

                    <p className="text-xs text-gray-500 mb-4 line-clamp-2">
                      {set.desc}
                    </p>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{set.questionCount} ข้อ • ตรวจอัตโนมัติ</span>
                      <span>{set.respondents}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Info Box */}
              <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4 mt-2">
                <div className="flex items-center gap-2 text-emerald-700 mb-2">
                  <Info size={18} />
                  <span className="font-bold text-sm">
                    บันทึกเฉลยเพื่อใช้ตรวจอัตโนมัติ
                  </span>
                </div>
                <p className="text-xs text-emerald-800 mb-3">
                  ระบุคำตอบที่ยอมรับได้มากกว่า 1 รูปแบบต่อข้อ
                  เพื่อให้ระบบเทียบคำตอบนักศึกษาได้แม่นยำ
                </p>
                <p className="text-xs text-emerald-600">
                  เฉลยที่บันทึกไว้จะถูกใช้เทียบคำตอบนักศึกษาโดยอัตโนมัติ
                </p>
              </div>
            </div>

            {/* Right Column: Editor */}
            <div className="w-2/3 flex flex-col gap-4">
              {/* ดึงข้อมูลชุดคำถามที่กำลัง Active อยู่มาใช้งาน */}
              {(() => {
                const activeSet =
                  questionSets.find((set) => set.isActive) || questionSets[0];

                // หากไม่มีชุดคำถามเลย (ถูกลบหมด) ให้แสดงข้อความว่างๆ
                if (!activeSet) {
                  return (
                    <div className="bg-white border border-gray-200 rounded-xl p-10 flex flex-col items-center justify-center text-gray-400 h-full">
                      <ListChecks size={48} className="mb-4 text-gray-300" />
                      <p>กรุณาเลือกหรือสร้างชุดคำถามเพื่อดูรายละเอียด</p>
                    </div>
                  );
                }

                return (
                  <>
                    {/* Header Editor */}
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          {/* เปลี่ยนหัวข้อเป็นชื่อชุดคำถามที่ Active */}
                          <h2 className="text-xl font-bold text-gray-900">
                            {activeSet.title}
                          </h2>
                          {/* เปลี่ยนสีและข้อความของ Badge ตามสถานะที่ Active */}
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              activeSet.status === "open"
                                ? "bg-emerald-100 text-emerald-700"
                                : activeSet.status === "scheduled"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            <div
                              className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                                activeSet.status === "open"
                                  ? "bg-emerald-500"
                                  : activeSet.status === "scheduled"
                                    ? "bg-blue-500"
                                    : "bg-gray-400"
                              }`}
                            ></div>
                            {activeSet.status === "open"
                              ? "เปิดรับคำตอบ"
                              : activeSet.status === "scheduled"
                                ? "ตั้งเวลาล่วงหน้า"
                                : "ปิดรับคำตอบ"}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">
                          แก้ไขล่าสุดเมื่อสักครู่ โดย สุภาวดี ใจดี •
                          ใช้ตรวจอัตโนมัติ
                        </p>
                      </div>
                      <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                        <Eye size={18} />
                        ดูตัวอย่างแบบฟอร์ม
                      </button>
                    </div>

                    {/* Form Config */}
                    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                      <div className="flex gap-4 mb-4">
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            ชื่อชุดคำถาม
                          </label>
                          {/* แสดงเป็นกล่องข้อความอ่านอย่างเดียว (ไม่มีขอบตอนโฟกัส) */}
                          <div className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-700 cursor-default">
                            {activeSet.title}
                          </div>
                        </div>
                        <div className="w-48">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            สถานะชุดคำถาม
                          </label>
                          {/* เปลี่ยนจาก Select เป็นกล่องข้อความแสดงสถานะแทน */}
                          <div className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-700 cursor-default">
                            {activeSet.status === 'open' ? 'เปิดรับคำตอบ' : 
                             activeSet.status === 'scheduled' ? 'ตั้งเวลาล่วงหน้า' : 'ปิดรับคำตอบ'}
                          </div>
                        </div>
                      </div>
                      
                      {/* นำ cursor-pointer, onClick และไอคอนดินสอออกทั้งหมด */}
                      <div className="flex items-start justify-between border-t border-gray-100 pt-3">
                        <div className="flex gap-4 items-start w-full text-sm">
                          <span className="text-gray-500 whitespace-nowrap">
                            คำอธิบาย
                          </span>
                          <p className="text-gray-800">{activeSet.desc}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4 mb-2">
                      <div className="flex items-center gap-3">
                        <h3 className="font-bold text-gray-900">
                          คำถามและเฉลยสำหรับตรวจอัตโนมัติ
                        </h3>
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">
                          {questions.length} ข้อ
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        พิมพ์ข้อความ • ระบุเฉลยได้หลายรูปแบบต่อข้อ
                      </p>
                    </div>

                    {/* Questions List */}
                    <div className="space-y-4">
                      {questions.map((q, index) => (
                        <div
                          key={q.id}
                          className="bg-white border border-gray-200 rounded-xl p-0 flex shadow-sm"
                        >
                          {/* Drag Handle */}
                          <div className="w-10 flex flex-col items-center justify-center border-r border-gray-100 text-gray-400 cursor-grab bg-gray-50 rounded-l-xl">
                            <GripVertical size={20} />
                          </div>

                          <div className="flex-1 p-5">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <span className="flex items-center justify-center w-6 h-6 rounded bg-gray-100 text-sm font-bold text-gray-700">
                                  {index + 1}
                                </span>
                                <span className="font-bold text-gray-900">
                                  คำถามข้อที่ {index + 1}
                                </span>
                                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                  พิมพ์ข้อความ • ตรวจอัตโนมัติ
                                </span>
                              </div>
                              <div className="flex items-center gap-4 text-gray-500">
                                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                  จำเป็นต้องตอบ
                                  <div className="w-9 h-5 bg-emerald-600 rounded-full relative cursor-pointer">
                                    <div className="w-4 h-4 bg-white rounded-full absolute top-0.5 right-0.5"></div>
                                  </div>
                                </div>
                                <div className="h-4 w-px bg-gray-300"></div>
                                <button className="hover:text-gray-800">
                                  <ArrowUp size={16} />
                                </button>
                                <button className="hover:text-gray-800">
                                  <ArrowDown size={16} />
                                </button>
                                <button className="hover:text-gray-800">
                                  <Copy size={16} />
                                </button>
                                <button className="hover:text-red-600">
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>

                            <input
                              type="text"
                              defaultValue={q.question}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                            />

                            <div className="bg-emerald-50/50 rounded-lg p-4 border border-emerald-100">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 text-sm text-emerald-700 font-medium">
                                  <Key size={16} />
                                  เฉลยสำหรับระบบตรวจอัตโนมัติ
                                </div>
                                <span className="text-xs text-gray-500">
                                  บันทึกในฐานข้อมูลเพื่อเทียบคำตอบและแสดงผลทันทีหลังส่ง
                                  • แก้ไขได้
                                </span>
                              </div>
                              <div className="relative">
                                <input
                                  type="text"
                                  defaultValue={q.answer}
                                  className="w-full bg-emerald-50/80 border border-emerald-200 rounded-lg px-3 py-2 text-sm text-emerald-900 focus:outline-none focus:bg-white"
                                />
                                <button className="absolute right-3 top-1/2 transform -translate-y-1/2 text-emerald-600 hover:text-emerald-800">
                                  <Pencil size={16} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <button 
                      onClick={() => {
                        const newQuestion = {
                          id: Date.now(), // สร้าง ID ใหม่จากเวลาปัจจุบัน
                          question: '',   // สร้างช่องคำถามว่างๆ
                          answer: ''      // สร้างช่องเฉลยว่างๆ
                        };
                        // นำข้อคำถามใหม่ไปต่อท้ายข้อมูลเดิม
                        setQuestions([...questions, newQuestion]);
                      }}
                      className="w-full py-3 bg-emerald-50 hover:bg-emerald-100 border border-dashed border-emerald-300 rounded-xl text-emerald-700 font-medium text-sm flex items-center justify-center gap-2 transition-colors"
                    >
                      <Plus size={18} />
                      เพิ่มข้อคำถาม{" "}
                      <span className="text-emerald-600/70 font-normal">
                        เพิ่มได้ตามต้องการ
                      </span>
                    </button>
                  </>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <footer className="h-20 bg-white border-t border-gray-200 flex items-center justify-between px-6 shrink-0 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <Info size={20} className="text-gray-400" />
            <div>
              <p className="font-medium text-gray-700">
                นักศึกษาตอบด้วยการพิมพ์ข้อความเท่านั้น
              </p>
              <p className="text-xs">
                ระบบเทียบคำตอบกับเฉลยจากฐานข้อมูลและแสดงผลทันทีหลังส่ง
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="px-5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              ยกเลิก
            </button>
            <button className="flex items-center gap-2 px-5 py-2.5 bg-[#2E6B4F] hover:bg-[#23533D] text-white rounded-lg text-sm font-medium transition-colors">
              <ListChecks size={18} />
              บันทึกชุดคำถาม
            </button>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default QuestionSettingPage;
