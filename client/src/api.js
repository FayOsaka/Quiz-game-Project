const API_BASE = import.meta.env.VITE_API_URL || "/api";
let csrfToken = "";

async function request(path, options = {}) {
  let response;
  const { skipCsrf, ...fetchOptions } = options;
  const method = (fetchOptions.method || "GET").toUpperCase();
  const headers = { "Content-Type": "application/json", ...fetchOptions.headers };
  if (!["GET", "HEAD", "OPTIONS"].includes(method) && csrfToken && !skipCsrf) {
    headers["X-CSRF-Token"] = csrfToken;
  }
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...fetchOptions,
      credentials: "include",
      headers,
    });
  } catch {
    throw new Error("เชื่อมต่อ API ไม่ได้ กรุณาเปิดเซิร์ฟเวอร์ที่พอร์ต 8000");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    if (response.status === 401 && !path.startsWith("/auth/login") && !path.startsWith("/auth/session")) {
      window.dispatchEvent(new Event("admin-session-expired"));
    }
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

export const publicQuestionApi = {
  listOpen: () => request("/public/question-sets"),
};

export const dashboardApi = {
  getData: (questionSetId = "") => {
    const query = questionSetId ? `?question_set_id=${encodeURIComponent(questionSetId)}` : "";
    return request(`/dashboard${query}`);
  },
  submit: (data) => request("/submissions", { method: "POST", body: JSON.stringify(data), skipCsrf: true }),
  pinStudent: (studentCode, pinned) => request(`/students/${encodeURIComponent(studentCode)}/pin`, {
    method: "PUT", body: JSON.stringify({ pinned }),
  }),
};

export const adminAuthApi = {
  session: async () => {
    const result = await request("/auth/session");
    csrfToken = result.csrfToken;
    return result;
  },
  login: async (username, password) => {
    const result = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
      skipCsrf: true,
    });
    csrfToken = result.csrfToken;
    return result;
  },
  logout: async () => {
    try {
      return await request("/auth/logout", { method: "POST", body: "{}" });
    } finally {
      csrfToken = "";
    }
  },
};
