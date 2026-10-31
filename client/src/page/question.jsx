import { useState, useEffect } from 'react';
import Asides from '../components/asides';
import { questionApi } from '../api';
import {
  ListChecks,
  Bell,
  Plus,
  Pencil,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Copy,
  Trash2,
  Key,
  Info,
  MoreHorizontal,
  X,
  Calendar,
  Play,
  Square,
  CheckCircle2,
} from "lucide-react";

const mapSet = (set, isActive = false) => ({
  ...set,
  desc: set.description,
  isActive,
  questionCount: set.questions?.length ?? 0,
  respondents: `${set.respondent_count ?? 0} คนตอบ`,
  startDate: set.start_at ? set.start_at.replace(" ", "T").slice(0, 16) : "",
  endDate: set.end_at ? set.end_at.replace(" ", "T").slice(0, 16) : "",
});

const QuestionSettingPage = () => {
  // 1. State สำหรับฟอร์มข้อคำถามด้านขวา
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");
  const [showSavedPopup, setShowSavedPopup] = useState(false);

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
  const [questionSets, setQuestionSets] = useState([]);

  useEffect(() => {
    questionApi.list()
      .then((rows) => {
        setQuestionSets(rows.map((row, index) => mapSet(row, index === 0)));
        if (rows[0]) setQuestions(rows[0].questions.map((q) => ({
          id: q.id, question: q.text, answer: q.accepted_answers[0] || "",
          is_required: Boolean(q.is_required),
        })));
      })
      .catch((error) => setApiError(error.message))
      .finally(() => setLoading(false));
  }, []);

  // ระบบตรวจจับเวลาอัตโนมัติ (เช็คทุกๆ 1 วินาที)
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      questionSets.forEach((set) => {
          let newStatus = set.status;

          // 1. ถ้าสถานะเป็น "ตั้งเวลา" และถึงเวลา startDate แล้ว -> เปลี่ยนเป็น "เปิด"
          if (set.status === 'scheduled' && set.startDate) {
            const startTime = new Date(set.startDate);
            if (now >= startTime) {
              newStatus = 'open';
            }
          }

          // 2. ถ้าสถานะ "เปิด" อยู่ และมีการตั้ง endDate ไว้ แล้วถึงเวลา -> เปลี่ยนเป็น "ปิด"
          if (newStatus === 'open' && set.endDate) {
            const endTime = new Date(set.endDate);
            if (now >= endTime) {
              newStatus = 'closed';
            }
          }

          if (newStatus !== set.status) {
            questionApi.update(set.id, { status: newStatus }).then((saved) => {
              setQuestionSets((sets) => sets.map((item) => item.id === set.id ? mapSet(saved, item.isActive) : item));
            }).catch((error) => setApiError(error.message));
          }
      });
    }, 1000);

    // ทำความสะอาดการตั้งเวลาเมื่อออกหน้านี้
    return () => clearInterval(timer);
  }, [questionSets]);

  // ฟังก์ชันสำหรับบันทึกชุดคำถาม (รองรับทั้งเพิ่มใหม่และแก้ไข)
  const handleSaveSet = async () => {
    if (!newSetTitle.trim()) return;
    setSaving(true);
    setApiError("");
    try {
      const data = { title: newSetTitle.trim(), description: newSetDesc.trim() };
      const saved = modalMode === "add"
        ? await questionApi.create(data)
        : await questionApi.update(editSetId, data);
      if (modalMode === "add") {
        setQuestionSets((sets) => [mapSet(saved, true), ...sets.map((set) => ({ ...set, isActive: false }))]);
        setQuestions([]);
      } else {
        setQuestionSets((sets) => sets.map((set) => set.id === editSetId ? mapSet(saved, set.isActive) : set));
      }
      closeMainModal();
    } catch (error) {
      setApiError(error.message);
    } finally {
      setSaving(false);
    }
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
  const handleToggleStatus = async (id, newStatus) => {
    try {
      const saved = await questionApi.update(id, { status: newStatus, start_at: null, end_at: null });
      setQuestionSets((sets) => sets.map((set) => set.id === id ? mapSet(saved, set.isActive) : set));
    } catch (error) { setApiError(error.message); }
    setOpenDropdownId(null);
  };

  // ฟังก์ชันบันทึกการตั้งเวลา
  const handleSaveSchedule = async () => {
    try {
      const saved = await questionApi.update(scheduleTargetId, {
        status: "scheduled", start_at: startDate || null, end_at: endDate || null,
      });
      setQuestionSets((sets) => sets.map((set) => set.id === scheduleTargetId ? mapSet(saved, set.isActive) : set));
    } catch (error) { setApiError(error.message); }
    setIsScheduleModalOpen(false);
    setScheduleTargetId(null);
    setStartDate("");
    setEndDate("");
  };

  const handleToggleRequired = (questionId) => {
    setQuestions((items) => items.map((item) => item.id === questionId
      ? { ...item, is_required: !item.is_required }
      : item));
  };

  const handleMoveQuestion = (index, direction) => {
    setQuestions((items) => {
      const destination = index + direction;
      if (destination < 0 || destination >= items.length) return items;
      const reordered = [...items];
      [reordered[index], reordered[destination]] = [reordered[destination], reordered[index]];
      return reordered;
    });
  };

  const handleCopyQuestion = (index) => {
    setQuestions((items) => {
      const original = items[index];
      const copy = {
        ...original,
        id: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      };
      return [...items.slice(0, index + 1), copy, ...items.slice(index + 1)];
    });
  };

  const handleDeleteQuestion = (questionId) => {
    setQuestions((items) => items.filter((item) => item.id !== questionId));
  };

  const handleSaveQuestions = async () => {
    const activeSet = questionSets.find((set) => set.isActive);
    if (!activeSet) return;
    setSaving(true);
    setApiError("");
    try {
      const saved = await questionApi.saveQuestions(activeSet.id, questions.map((q) => ({
        text: q.question, accepted_answers: q.answer ? [q.answer] : [], is_required: q.is_required ?? true,
      })));
      setQuestions(saved.questions.map((q) => ({ id: q.id, question: q.text, answer: q.accepted_answers[0] || "", is_required: Boolean(q.is_required) })));
      setQuestionSets((sets) => sets.map((set) => set.id === saved.id ? mapSet(saved, set.isActive) : set));
      setShowSavedPopup(true);
    } catch (error) { setApiError(error.message); }
    finally { setSaving(false); }
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
      <Asides />

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
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-6">
          {apiError && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{apiError}</div>}
          {loading && <p className="mb-4 text-sm text-gray-500">กำลังโหลดข้อมูลจากฐานข้อมูล…</p>}
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
                      setQuestions((set.questions || []).map((q) => ({
                        id: q.id, question: q.text, answer: q.accepted_answers?.[0] || "",
                        is_required: Boolean(q.is_required),
                      })));
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
                              questionApi.remove(set.id).then(() => {
                                setQuestionSets((sets) => {
                                  const remaining = sets.filter((q) => q.id !== set.id);
                                  if (set.isActive && remaining[0]) {
                                    remaining[0].isActive = true;
                                    setQuestions((remaining[0].questions || []).map((q) => ({ id: q.id, question: q.text, answer: q.accepted_answers?.[0] || "", is_required: Boolean(q.is_required) })));
                                  } else if (!remaining.length) setQuestions([]);
                                  return remaining;
                                });
                                setOpenDropdownId(null);
                              }).catch((error) => setApiError(error.message));
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
                  ใส่คีย์เวิร์ดที่ต้องพบในคำตอบ คั่นแต่ละคำด้วยเครื่องหมายจุลภาค (,)
                  ระบบจะถือว่าถูกเมื่อพบคีย์เวิร์ดครบทุกคำ
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
                        <p className="text-xs text-gray-500">ใช้ตรวจอัตโนมัติ</p>
                      </div>
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
                                  <div className="flex items-center gap-2.5 text-sm font-medium text-gray-700">
                                    <span>จำเป็นต้องตอบ</span>
                                    <span className={`min-w-[4.5rem] rounded-full px-2 py-1 text-center text-[10px] font-bold transition-colors ${(q.is_required ?? true) ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                      {(q.is_required ?? true) ? 'ต้องตอบ' : 'ไม่บังคับ'}
                                    </span>
                                  <button
                                    type="button"
                                    role="switch"
                                    aria-checked={q.is_required ?? true}
                                    aria-label={`จำเป็นต้องตอบ: ${q.question || `คำถามข้อที่ ${index + 1}`}`}
                                    onClick={() => handleToggleRequired(q.id)}
                                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-transparent shadow-inner transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${(q.is_required ?? true) ? 'bg-gradient-to-r from-emerald-500 to-teal-600' : 'bg-slate-300'}`}
                                  >
                                    <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md ring-1 ring-black/5 transition-transform duration-200 ${(q.is_required ?? true) ? 'translate-x-[1.375rem]' : 'translate-x-0.5'}`} />
                                  </button>
                                </div>
                                <div className="h-4 w-px bg-gray-300"></div>
                                <button type="button" title="เลื่อนคำถามขึ้น" aria-label={`เลื่อนคำถามข้อที่ ${index + 1} ขึ้น`} disabled={index === 0} onClick={() => handleMoveQuestion(index, -1)} className="hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-30">
                                  <ArrowUp size={16} />
                                </button>
                                <button type="button" title="เลื่อนคำถามลง" aria-label={`เลื่อนคำถามข้อที่ ${index + 1} ลง`} disabled={index === questions.length - 1} onClick={() => handleMoveQuestion(index, 1)} className="hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-30">
                                  <ArrowDown size={16} />
                                </button>
                                <button type="button" title="คัดลอกคำถาม" aria-label={`คัดลอกคำถามข้อที่ ${index + 1}`} onClick={() => handleCopyQuestion(index)} className="hover:text-gray-800">
                                  <Copy size={16} />
                                </button>
                                <button type="button" title="ลบคำถาม" aria-label={`ลบคำถามข้อที่ ${index + 1}`} onClick={() => handleDeleteQuestion(q.id)} className="hover:text-red-600">
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>

                            <input
                              type="text"
                              value={q.question}
                              onChange={(e) => setQuestions((items) => items.map((item) => item.id === q.id ? { ...item, question: e.target.value } : item))}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                            />

                            <div className="bg-emerald-50/50 rounded-lg p-4 border border-emerald-100">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 text-sm text-emerald-700 font-medium">
                                  <Key size={16} />
                                  คีย์เวิร์ดที่ต้องพบในคำตอบ
                                </div>
                                <span className="text-xs text-gray-500">
                                  บันทึกในฐานข้อมูลเพื่อเทียบคำตอบและแสดงผลทันทีหลังส่ง
                                  • แก้ไขได้
                                </span>
                              </div>
                              <div className="relative">
                                <input
                                  type="text"
                                  placeholder="เช่น แดง หรือ แดง, สีของสายรุ้ง"
                                  value={q.answer}
                                  onChange={(e) => setQuestions((items) => items.map((item) => item.id === q.id ? { ...item, answer: e.target.value } : item))}
                                  className="w-full bg-emerald-50/80 border border-emerald-200 rounded-lg px-3 py-2 text-sm text-emerald-900 focus:outline-none focus:bg-white"
                                />
                                <button className="absolute right-3 top-1/2 transform -translate-y-1/2 text-emerald-600 hover:text-emerald-800">
                                  <Pencil size={16} />
                                </button>
                              </div>
                              <p className="mt-2 text-xs text-emerald-700">
                                คั่นด้วย , เมื่อต้องการให้คำตอบมีหลายคำสำคัญ และผู้ตอบต้องมีครบทุกคำ
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <button 
                      onClick={() => {
                        const newQuestion = {
                          id: `new-${Date.now()}`,
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
              <button onClick={() => {
                const activeSet = questionSets.find((set) => set.isActive);
                setQuestions((activeSet?.questions || []).map((q) => ({ id: q.id, question: q.text, answer: q.accepted_answers?.[0] || "", is_required: Boolean(q.is_required) })));
              }} className="px-5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              ยกเลิก
            </button>
            <button onClick={handleSaveQuestions} disabled={saving || loading || !questionSets.length} className="flex items-center gap-2 px-5 py-2.5 bg-[#2E6B4F] hover:bg-[#23533D] disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
              <ListChecks size={18} />
              {saving ? "กำลังบันทึก…" : "บันทึกชุดคำถาม"}
            </button>
          </div>
        </footer>
      </main>
      {showSavedPopup && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"
          onClick={() => setShowSavedPopup(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="saved-popup-title"
            className="w-full max-w-sm rounded-2xl bg-white p-7 text-center shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 size={38} />
            </div>
            <h2 id="saved-popup-title" className="text-xl font-bold text-slate-900">
              บันทึกคำถามเรียบร้อยแล้ว
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              ชุดคำถามและเฉลยถูกบันทึกลงฐานข้อมูลแล้ว
            </p>
            <button
              autoFocus
              onClick={() => setShowSavedPopup(false)}
              className="mt-6 w-full rounded-xl bg-[#2E6B4F] px-5 py-3 font-semibold text-white transition-colors hover:bg-[#23533D]"
            >
              ตกลง
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionSettingPage;
