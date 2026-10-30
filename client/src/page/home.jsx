import React, { useState } from 'react';
import { BookOpen, Eye, Contact, MessageSquareQuote, CheckCircle2, ArrowRight } from 'lucide-react';

export default function Home() {
  const [formData, setFormData] = useState({
    fullName: '',
    studentId: '',
    program: '',
    faculty: '',
    campus: '', // เพิ่ม State สำหรับเก็บข้อมูลวิทยาเขต
    q1: '',
    q2: '',
    q3: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] font-sans text-gray-800 flex flex-col">
      {/* Top Navbar */}
      <header className="bg-white border-b px-8 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-[#1C5F4A] p-2 rounded-lg text-white">
            <BookOpen size={20} />
          </div>
          <div>
            <h1 className="font-bold text-gray-900 leading-tight">พื้นที่การเรียนรู้</h1>
            <p className="text-xs text-gray-500">งานพัฒนานักศึกษา</p>
          </div>
        </div>
        <button className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
          <Eye size={16} />
          แบบฟอร์มสำหรับนักศึกษา
        </button>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto w-full px-4 py-10 flex-1">
        {/* Page Header */}
        <div className="mb-8">
          <p className="text-sm text-gray-500 mb-2">ทบทวน • เรียนรู้ • เติบโต</p>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">บันทึกการเรียนรู้ของคุณ</h2>
          <p className="text-gray-600">กรอกข้อมูลนักศึกษา แล้วแบ่งปันประสบการณ์และมุมมองจากการเรียนรู้ของคุณ</p>
        </div>

        <form className="space-y-6">
          {/* Section 1: ข้อมูลนักศึกษา */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-6">
              <Contact className="text-gray-400" size={24} />
              <div>
                <h3 className="text-lg font-bold text-gray-900">ข้อมูลนักศึกษา</h3>
                <p className="text-sm text-gray-500">โปรดกรอกข้อมูลให้ครบถ้วน ข้อมูลที่มี * จำเป็นต้องกรอก</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">ชื่อ-นามสกุล *</label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  placeholder="กรอกชื่อและนามสกุล"
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1C5F4A]/20 focus:border-[#1C5F4A] transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">รหัสนักศึกษา *</label>
                <input
                  type="text"
                  name="studentId"
                  value={formData.studentId}
                  onChange={handleChange}
                  placeholder="กรอกรหัสนักศึกษา"
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1C5F4A]/20 focus:border-[#1C5F4A] transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">หลักสูตร *</label>
                <input
                  type="text"
                  name="program"
                  value={formData.program}
                  onChange={handleChange}
                  placeholder="เช่น วิทยาศาสตรบัณฑิต"
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1C5F4A]/20 focus:border-[#1C5F4A] transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">คณะ *</label>
                <input
                  type="text"
                  name="faculty"
                  value={formData.faculty}
                  onChange={handleChange}
                  placeholder="เช่น คณะวิทยาศาสตร์"
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1C5F4A]/20 focus:border-[#1C5F4A] transition-all"
                />
              </div>
              
              {/* ช่องเลือกวิทยาเขต (ขยายเต็ม 2 คอลัมน์) */}
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-gray-700">วิทยาเขต / ศูนย์การศึกษา *</label>
                <select
                  name="campus"
                  value={formData.campus}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1C5F4A]/20 focus:border-[#1C5F4A] transition-all bg-white ${formData.campus === '' ? 'text-gray-400' : 'text-gray-900'}`}
                >
                  <option value="" disabled>เลือกวิทยาเขต / ศูนย์การศึกษา</option>
                  <option value="ภายในมหาวิทยาลัย">ภายในมหาวิทยาลัย</option>
                  <option value="ศูนย์วิทยาศาสตร์">ศูนย์วิทยาศาสตร์</option>
                  <option value="วิทยาเขตสุพรรณบุรี">วิทยาเขตสุพรรณบุรี</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: คำถามสะท้อนการเรียนรู้ */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-6">
              <MessageSquareQuote className="text-gray-400" size={24} />
              <div>
                <h3 className="text-lg font-bold text-gray-900">คำถามสะท้อนการเรียนรู้</h3>
                <p className="text-sm text-gray-500">พิมพ์คำตอบของคุณในช่องข้อความให้ครบทั้ง ๓ ข้อ</p>
              </div>
            </div>
            
            <hr className="border-gray-100 mb-6" />

            <div className="space-y-8">
              {/* Question 1 */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-800 block">
                  ๑. สิ่งสำคัญที่สุดที่คุณได้เรียนรู้ในการศึกษานี้คืออะไร *
                  <span className="block font-normal text-gray-500 text-xs mt-1">เล่าถึงความรู้ ทักษะ หรือมุมมองใหม่ พร้อมยกตัวอย่างประกอบ จากประสบการณ์ของคุณ</span>
                </label>
                <div className="relative">
                  <textarea
                    name="q1"
                    value={formData.q1}
                    onChange={handleChange}
                    placeholder="สิ่งที่คุณได้เรียนรู้คือ..."
                    rows={4}
                    maxLength={1000}
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1C5F4A]/20 focus:border-[#1C5F4A] transition-all resize-none"
                  ></textarea>
                  <div className="absolute bottom-3 right-3 text-xs text-gray-400">
                    {formData.q1.length} / 1,000 ตัวอักษร
                  </div>
                </div>
              </div>

              {/* Question 2 */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-800 block">
                  ๒. คุณพบความท้าทายอะไร และรับมือกับสิ่งนั้นอย่างไร *
                  <span className="block font-normal text-gray-500 text-xs mt-1">อาจเป็นเรื่องการเรียน การทำงานร่วมกับผู้อื่น หรือการจัดการเวลา</span>
                </label>
                <div className="relative">
                  <textarea
                    name="q2"
                    value={formData.q2}
                    onChange={handleChange}
                    placeholder="ความท้าทายที่ค้นพบ และวิธีที่รับมือคือ..."
                    rows={4}
                    maxLength={1000}
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1C5F4A]/20 focus:border-[#1C5F4A] transition-all resize-none"
                  ></textarea>
                  <div className="absolute bottom-3 right-3 text-xs text-gray-400">
                    {formData.q2.length} / 1,000 ตัวอักษร
                  </div>
                </div>
              </div>

              {/* Question 3 */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-800 block">
                  ๓. คุณจะนำสิ่งที่ได้เรียนรู้ไปใช้อย่างไร *
                  <span className="block font-normal text-gray-500 text-xs mt-1">แบ่งปันเป้าหมายและสิ่งที่คุณจะพัฒนาตนเองในการเรียนหรือการทำงานในอนาคต</span>
                </label>
                <div className="relative">
                  <textarea
                    name="q3"
                    value={formData.q3}
                    onChange={handleChange}
                    placeholder="สิ่งที่จะนำไปใช้คือ..."
                    rows={4}
                    maxLength={1000}
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1C5F4A]/20 focus:border-[#1C5F4A] transition-all resize-none"
                  ></textarea>
                  <div className="absolute bottom-3 right-3 text-xs text-gray-400">
                    {formData.q3.length} / 1,000 ตัวอักษร
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-between items-center pt-2 pb-10">
            <div className="flex items-center gap-2 text-[#1C5F4A]">
              <CheckCircle2 size={20} />
              <div>
                <p className="text-sm font-bold">ตรวจสอบข้อมูลและคำตอบก่อนส่ง</p>
                <p className="text-xs text-gray-500 font-normal">โปรดตอบคำถามให้ครบทุกข้อ</p>
              </div>
            </div>
            <button
              type="button"
              className="bg-[#2B7A5F] hover:bg-[#1C5F4A] text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm"
            >
              ส่งคำตอบ
              <ArrowRight size={18} />
            </button>
          </div>
        </form>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white py-6 mt-auto">
        <div className="max-w-4xl mx-auto px-4 flex justify-between items-center text-xs text-gray-400">
          <p>งานพัฒนานักศึกษา</p>
          <p>สงวนลิขสิทธิ์ © ระบบบันทึกการเรียนรู้</p>
        </div>
      </footer>
    </div>
  );
}