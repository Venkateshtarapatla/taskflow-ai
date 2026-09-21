const API_URL = "http://127.0.0.1:8000";

export interface AuthRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
}

export interface UserResponse {
  id: number;
  email: string;
}

export type Status = "pending" | "in_progress" | "completed";
export type Priority = "low" | "medium" | "high";

export interface Task {
  id: number;
  title: string;
  description: string | null;
  status: Status;
  priority: Priority;
  created_at: string;
  updated_at: string;
}

// ============================================================
// TOKEN MANAGEMENT
// ============================================================

function getToken(): string | null {
  return localStorage.getItem("taskflow_token");
}

export function setToken(token: string): void {
  localStorage.setItem("taskflow_token", token);
}

export function clearToken(): void {
  localStorage.removeItem("taskflow_token");
}

export function hasValidToken(): boolean {
  return getToken() !== null;
}

// ============================================================
// RESPONSE HANDLING
// ============================================================

export async function parseResponse<T>(
  response: Response,
): Promise<T> {
  const contentType =
    response.headers.get("content-type") || "";

  let data: unknown;

  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    if (
      typeof data === "object" &&
      data !== null &&
      "detail" in data
    ) {
      const detail = (data as { detail: unknown }).detail;

      if (typeof detail === "string") {
        throw new Error(detail);
      }
    }

    throw new Error(
      `Request failed with status ${response.status}`,
    );
  }

  return data as T;
}

// ============================================================
// AUTHENTICATED REQUESTS
// ============================================================

async function authenticatedFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = getToken();
  const headers = new Headers(options.headers);

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearToken();
    window.dispatchEvent(new Event("taskflow:unauthorized"));
  }

  return response;
}

// ============================================================
// AUTHENTICATION
// ============================================================

export async function register(
  credentials: AuthRequest,
): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(credentials),
  });

  const data = await parseResponse<AuthResponse>(response);

  // Store the JWT immediately after successful registration.
  setToken(data.access_token);

  return data;
}

export async function login(
  credentials: AuthRequest,
): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(credentials),
  });

  const data = await parseResponse<AuthResponse>(response);

  // Store the JWT immediately after successful login.
  setToken(data.access_token);

  return data;
}

export async function getCurrentUser(): Promise<UserResponse> {
  const response = await authenticatedFetch("/auth/me", {
    method: "GET",
  });

  return parseResponse<UserResponse>(response);
}

// ============================================================
// TASKS
// ============================================================

export async function getTasks(): Promise<Task[]> {
  const response = await authenticatedFetch("/tasks", {
    method: "GET",
  });

  return parseResponse<Task[]>(response);
}

export async function createTask<T = Task>(task: {
  title: string;
  description?: string | null;
  priority?: string;
}): Promise<T> {
  const response = await authenticatedFetch("/tasks", {
    method: "POST",
    body: JSON.stringify(task),
  });

  return parseResponse<T>(response);
}

export async function updateTask<T = Task>(
  taskId: number,
  task: {
    title: string;
    description?: string | null;
    status?: string;
    priority?: string;
  },
): Promise<T> {
  const response = await authenticatedFetch(
    `/tasks/${taskId}`,
    {
      method: "PUT",
      body: JSON.stringify(task),
    },
  );

  return parseResponse<T>(response);
}

export async function deleteTask<
  T = { message: string; task_id: number }
>(taskId: number): Promise<T> {
  const response = await authenticatedFetch(
    `/tasks/${taskId}`,
    {
      method: "DELETE",
    },
  );

  return parseResponse<T>(response);
}

// ============================================================
// AI — CREATE TASK
// ============================================================

export async function aiCreateTask<T>(
  text: string,
): Promise<T> {
  const response = await authenticatedFetch(
    "/ai/create-task",
    {
      method: "POST",
      body: JSON.stringify({ text }),
    },
  );

  return parseResponse<T>(response);
}

// ============================================================
// AI — BREAKDOWN TASK
// ============================================================

export async function aiBreakdownTask<T>(
  text: string,
): Promise<T> {
  const response = await authenticatedFetch(
    "/ai/breakdown-task",
    {
      method: "POST",
      body: JSON.stringify({ text }),
    },
  );

  return parseResponse<T>(response);
}

// ============================================================
// AI — PRIORITY
// ============================================================

export async function aiSuggestPriority<T>(
  title: string,
  description: string,
): Promise<T> {
  const response = await authenticatedFetch(
    "/ai/suggest-priority",
    {
      method: "POST",
      body: JSON.stringify({ title, description }),
    },
  );

  return parseResponse<T>(response);
}

// ============================================================
// AI — PRODUCTIVITY INSIGHTS
// ============================================================

export async function aiProductivityInsights<T>(
  tasks: unknown[],
): Promise<T> {
  const response = await authenticatedFetch(
    "/ai/productivity-insights",
    {
      method: "POST",
      body: JSON.stringify({ tasks }),
    },
  );

  return parseResponse<T>(response);
}
