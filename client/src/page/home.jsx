import { useEffect, useState } from 'react';
import { dashboardApi, publicQuestionApi } from '../api';
import { BookOpen, Eye, Contact, MessageSquareQuote, CheckCircle2, ArrowRight, Sparkles, X } from 'lucide-react';

export default function Home() {
  const [activeSet, setActiveSet] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [savingSubmission, setSavingSubmission] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [showDuplicatePopup, setShowDuplicatePopup] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [formData, setFormData] = useState({
    fullName: '',
    studentId: '',
    program: '',
    faculty: '',
    campus: '',
    q1: '',
    q2: '',
    q3: ''
  });

  useEffect(() => {
    publicQuestionApi.listOpen()
      .then((sets) => {
        const openSet = sets[0] || null;
        setActiveSet(openSet);
        setElapsedSeconds(0);
        if (openSet) setFormData((current) => ({
          ...current,
          ...Object.fromEntries(openSet.questions.map((_, index) => [`q${index + 1}`, current[`q${index + 1}`] ?? ''])),
        }));
      })
      .catch((error) => setSubmitError(error.message))
      .finally(() => setLoadingQuestions(false));
  }, []);

  useEffect(() => {
    if (!activeSet || alreadySubmitted) return undefined;
    const startedAt = Date.now();
    const timer = setInterval(() => setElapsedSeconds(Math.round((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [activeSet, alreadySubmitted]);

  const questions = activeSet?.questions?.length
    ? activeSet.questions.map((question, index) => ({ id: `q${index + 1}`, questionId: question.id, isRequired: Boolean(question.is_required), title: question.text, desc: '', placeholder: 'พิมพ์คำตอบของคุณ...' }))
    : [
        { id: 'q1', title: '๑. สิ่งสำคัญที่สุดที่คุณได้เรียนรู้ในการศึกษานี้คืออะไร', desc: 'เล่าถึงความรู้ ทักษะ หรือมุมมองใหม่ พร้อมยกตัวอย่างประกอบ จากประสบการณ์ของคุณ', placeholder: 'สิ่งที่คุณได้เรียนรู้คือ...' },
        { id: 'q2', title: '๒. คุณพบความท้าทายอะไร และรับมือกับสิ่งนั้นอย่างไร', desc: 'อาจเป็นเรื่องการเรียน การทำงานร่วมกับผู้อื่น หรือการจัดการเวลา', placeholder: 'ความท้าทายที่ค้นพบ และวิธีที่รับมือคือ...' },
        { id: 'q3', title: '๓. คุณจะนำสิ่งที่ได้เรียนรู้ไปใช้อย่างไร', desc: 'แบ่งปันเป้าหมายและสิ่งที่คุณจะพัฒนาตนเองในการเรียนหรือการทำงานในอนาคต', placeholder: 'สิ่งที่จะนำไปใช้คือ...' },
      ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError('');
    if (alreadySubmitted || savingSubmission) return;
    if (!activeSet) {
      setSubmitError('ขณะนี้ยังไม่มีชุดคำถามที่เปิดรับคำตอบ');
      return;
    }
    try {
      setSavingSubmission(true);
      await dashboardApi.submit({
        question_set_id: activeSet.id,
        duration_seconds: elapsedSeconds,
        student: {
          student_code: formData.studentId,
          full_name: formData.fullName,
          program_name: formData.program,
          faculty_name: formData.faculty,
          campus_name: formData.campus,
        },
        answers: questions.map((question) => ({ question_id: question.questionId, answer_text: formData[question.id] || '' })),
      });
      setAlreadySubmitted(true);
      setShowSuccessPopup(true);
      setFormData({ fullName: '', studentId: '', program: '', faculty: '', campus: '', ...Object.fromEntries(questions.map((question) => [question.id, ''])) });
    } catch (error) {
      if (error.message === 'ท่านได้ส่งคำตอบแล้ว') {
        setAlreadySubmitted(true);
        setShowDuplicatePopup(true);
      }
      setSubmitError(error.message);
    } finally {
      setSavingSubmission(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col relative overflow-hidden">
      
      {/* 3D Background Glow Effects */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-emerald-300/30 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-5%] w-[40rem] h-[40rem] bg-teal-300/20 rounded-full blur-3xl pointer-events-none"></div>

      {/* Top Navbar (Glassmorphism) */}
      <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-white/50 px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="bg-gradient-to-br from-emerald-400 to-teal-700 p-2.5 rounded-xl text-white shadow-lg shadow-emerald-500/30 transform hover:scale-105 transition-transform">
            <BookOpen size={22} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="font-extrabold text-slate-900 text-lg leading-tight tracking-tight">พื้นที่การเรียนรู้</h1>
            <p className="text-[11px] font-medium text-emerald-600 uppercase tracking-wider">งานพัฒนานักศึกษา</p>
          </div>
        </div>
        <button className="hidden md:flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 bg-white border border-slate-200 px-4 py-2 rounded-full shadow-sm hover:shadow-md transition-all">
          <Eye size={16} />
          แบบฟอร์มสำหรับนักศึกษา
        </button>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto w-full px-4 py-12 flex-1 relative z-10">
        
        {/* Page Header */}
        <div className="text-center mb-12">
          <span className="inline-flex items-center gap-1.5 py-1.5 px-4 rounded-full bg-emerald-100/80 text-emerald-700 text-xs font-bold tracking-widest mb-4 border border-emerald-200 shadow-sm backdrop-blur-sm">
            <Sparkles size={14} /> ทบทวน • เรียนรู้ • เติบโต
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-800 to-teal-600 mb-3 drop-shadow-sm">
            บันทึกการเรียนรู้ของคุณ
          </h2>
          <p className="text-slate-500 font-medium">กรอกข้อมูลนักศึกษา แล้วแบ่งปันประสบการณ์และมุมมองจากการเรียนรู้ของคุณ</p>
        </div>

        {submitError && !alreadySubmitted && <div role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 text-rose-700">{submitError}</div>}
        {loadingQuestions && <div className="rounded-xl border border-slate-200 bg-white px-5 py-8 text-center text-slate-500">กำลังโหลดชุดคำถาม…</div>}
        {!loadingQuestions && !activeSet && !submitError && <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-8 text-center text-amber-800">ขณะนี้ยังไม่มีชุดคำถามที่เปิดรับคำตอบ</div>}
        {activeSet && <form className="space-y-8" onSubmit={handleSubmit}>
          {activeSet && <div className="rounded-xl border border-blue-100 bg-blue-50 px-5 py-3 text-sm text-blue-800">ชุดคำถาม: <strong>{activeSet.title}</strong></div>}
          
          {/* Section 1: ข้อมูลนักศึกษา */}
          <div className="bg-white/80 backdrop-blur-xl p-8 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white relative overflow-hidden group hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-shadow duration-500">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-400 to-teal-500"></div>
            
            <div className="flex items-center gap-4 mb-8">
              <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600 shadow-inner">
                <Contact size={26} strokeWidth={2} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800">ข้อมูลนักศึกษา</h3>
                <p className="text-sm text-slate-500 mt-1">โปรดกรอกข้อมูลให้ครบถ้วน ข้อมูลที่มี <span className="text-rose-500 font-bold">*</span> จำเป็นต้องกรอก</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { label: 'ชื่อ-นามสกุล', name: 'fullName', placeholder: 'เช่น สมชาย ใจดี' },
                { label: 'รหัสนักศึกษา', name: 'studentId', placeholder: 'เช่น 6401234567' },
                { label: 'หลักสูตร', name: 'program', placeholder: 'เช่น วิทยาศาสตรบัณฑิต' },
                { label: 'คณะ', name: 'faculty', placeholder: 'เช่น คณะวิทยาศาสตร์' },
              ].map((field) => (
                <div key={field.name} className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 ml-1">{field.label} <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    name={field.name}
                    required
                    value={formData[field.name]}
                    onChange={handleChange}
                    placeholder={field.placeholder}
                    className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/15 focus:border-emerald-500 transition-all duration-300 shadow-sm text-slate-700 placeholder:text-slate-400"
                  />
                </div>
              ))}
              
              {/* ช่องเลือกวิทยาเขต */}
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-semibold text-slate-700 ml-1">วิทยาเขต / ศูนย์การศึกษา <span className="text-rose-500">*</span></label>
                <div className="relative">
                  <select
                    name="campus"
                    required
                    value={formData.campus}
                    onChange={handleChange}
                    className={`w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/15 focus:border-emerald-500 transition-all duration-300 shadow-sm appearance-none cursor-pointer ${formData.campus === '' ? 'text-slate-400' : 'text-slate-700'}`}
                  >
                    <option value="" disabled>เลือกวิทยาเขต / ศูนย์การศึกษา</option>
                    <option value="ภายในมหาวิทยาลัย">ภายในมหาวิทยาลัย</option>
                    <option value="ศูนย์วิทยาศาสตร์">ศูนย์วิทยาศาสตร์</option>
                    <option value="วิทยาเขตสุพรรณบุรี">วิทยาเขตสุพรรณบุรี</option>
                  </select>
                  {/* Custom Arrow for Select */}
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: คำถามสะท้อนการเรียนรู้ */}
          <div className="bg-white/80 backdrop-blur-xl p-8 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white relative overflow-hidden group hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-shadow duration-500">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-teal-500 to-emerald-400"></div>
            
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-teal-50 rounded-2xl text-teal-600 shadow-inner">
                <MessageSquareQuote size={26} strokeWidth={2} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800">คำถามสะท้อนการเรียนรู้</h3>
                <p className="text-sm text-slate-500 mt-1">พิมพ์คำตอบของคุณในช่องข้อความให้ครบทั้ง ๓ ข้อ</p>
              </div>
            </div>
            
            <hr className="border-slate-100 mb-8" />

            <div className="space-y-10">
              {questions.map((q) => (
                <div key={q.id} className="space-y-3">
                  <label className="block">
                    <span className="text-base font-bold text-slate-800">
                      {q.title} {q.isRequired !== false && <span className="text-rose-500">*</span>}
                    </span>
                    <span className="block font-medium text-slate-500 text-xs mt-1.5">{q.desc}</span>
                  </label>
                  <div className="relative group/textarea">
                    <textarea
                      name={q.id}
                      required={q.isRequired ?? true}
                      value={formData[q.id]}
                      onChange={handleChange}
                      placeholder={q.placeholder}
                      rows={4}
                      maxLength={1000}
                      className="w-full px-5 py-4 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white focus:outline-none focus:ring-4 focus:ring-teal-500/15 focus:border-teal-500 transition-all duration-300 resize-none shadow-sm text-slate-700 placeholder:text-slate-400"
                    ></textarea>
                    
                    {/* Character Counter */}
                    <div className="absolute bottom-3 right-4 text-xs font-medium bg-white/80 backdrop-blur px-2 py-1 rounded-md text-slate-400 border border-slate-100 shadow-sm transition-opacity opacity-70 group-hover/textarea:opacity-100">
                      <span className={formData[q.id].length > 900 ? 'text-amber-500' : ''}>
                        {formData[q.id].length}
                      </span> / 1,000
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Form Actions (3D Button Effect) */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-6 pt-4 pb-8">
            <div className="flex items-center gap-3 text-emerald-700 bg-emerald-50 px-5 py-3 rounded-2xl border border-emerald-100 shadow-sm">
              <CheckCircle2 size={24} className="text-emerald-500 drop-shadow-sm" />
              <div>
                <p className="text-sm font-bold">ตรวจสอบข้อมูลให้ถูกต้อง</p>
                <p className="text-xs text-emerald-600/80 font-medium">กรุณาตอบคำถามที่มีเครื่องหมายจำเป็นก่อนกดยืนยัน</p>
              </div>
            </div>
            
            <button
              type="submit"
              disabled={!activeSet || activeSet.questions.length === 0 || savingSubmission || alreadySubmitted}
              className="w-full sm:w-auto relative group overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 px-8 py-4 font-bold text-white shadow-[0_8px_20px_rgba(16,185,129,0.3)] transition-all duration-300 hover:shadow-[0_10px_25px_rgba(16,185,129,0.4)] hover:-translate-y-1 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <div className="relative z-10 flex items-center justify-center gap-2">
                <span className="tracking-wide">{savingSubmission ? 'กำลังบันทึก…' : 'ส่งคำตอบ'}</span>
                <ArrowRight size={18} className="group-hover:translate-x-1.5 transition-transform duration-300" />
              </div>
              {/* Shine effect on hover */}
              <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
            </button>
          </div>
        </form>}
      </main>

      {/* Footer */}
      <footer className="bg-white/80 backdrop-blur-md border-t border-slate-200 py-6 mt-auto relative z-10">
        <div className="max-w-4xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-2 text-xs font-medium text-slate-400">
          <p className="flex items-center gap-2">
            <BookOpen size={14} /> งานพัฒนานักศึกษา
          </p>
          <p>สงวนลิขสิทธิ์ © ระบบบันทึกการเรียนรู้</p>
        </div>
      </footer>

      {showSuccessPopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="submission-success-title"
            className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl"
          >
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 size={38} />
            </div>
            <h2 id="submission-success-title" className="text-xl font-bold text-slate-900">
              ส่งคำตอบและบันทึกข้อมูลเรียบร้อยแล้ว
            </h2>
            <p className="mt-3 text-sm text-slate-500">กรุณารีเฟรชเว็บไซต์หากต้องการปิดหน้าต่างนี้</p>
          </div>
        </div>
      )}
      {showDuplicatePopup && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="duplicate-submission-title"
            className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl"
          >
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 text-rose-600">
              <X size={36} />
            </div>
            <h2 id="duplicate-submission-title" className="text-xl font-bold text-slate-900">
              ท่านได้ส่งคำตอบแล้ว
            </h2>
            <p className="mt-3 text-sm text-slate-500">ไม่สามารถส่งคำตอบซ้ำในชุดคำถามนี้ได้</p>
            <button
              autoFocus
              onClick={() => setShowDuplicatePopup(false)}
              className="mt-6 w-full rounded-xl bg-rose-600 px-5 py-3 font-semibold text-white transition-colors hover:bg-rose-700"
            >
              รับทราบ
            </button>
          </div>
        </div>
      )}

      {/* Styles for the button shimmer effect */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}} />
    </div>
  );
}
