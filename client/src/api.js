const API_BASE = import.meta.env.VITE_API_URL || "/api";

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json", ...options.headers },
      ...options,
    });
  } catch {
    throw new Error("เชื่อมต่อ API ไม่ได้ กรุณาเปิดเซิร์ฟเวอร์ที่พอร์ต 8000");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `คำขอล้มเหลว (${response.status})`);
  }
  return response.status === 204 ? null : response.json();
}

export const questionApi = {
  list: () => request("/question-sets"),
  create: (data) => request("/question-sets", { method: "POST", body: JSON.stringify(data) }),
  update: (id, data) => request(`/question-sets/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  saveQuestions: (id, questions) => request(`/question-sets/${id}/questions`, {
    method: "PUT", body: JSON.stringify({ questions }),
  }),
  remove: (id) => request(`/question-sets/${id}`, { method: "DELETE" }),
};

export const dashboardApi = {
  getData: (questionSetId = "") => {
    const query = questionSetId ? `?question_set_id=${encodeURIComponent(questionSetId)}` : "";
    return request(`/dashboard${query}`);
  },
  submit: (data) => request("/submissions", { method: "POST", body: JSON.stringify(data) }),
  pinStudent: (studentCode, pinned) => request(`/students/${encodeURIComponent(studentCode)}/pin`, {
    method: "PUT", body: JSON.stringify({ pinned }),
  }),
};
