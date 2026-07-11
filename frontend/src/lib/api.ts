import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type {
  AuthResponse, UploadResponse, MappingResponse,
  PreviewData, ImportResult, SessionSummary, Session, User,
} from '@/types';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err: AxiosError<{ error?: string }>) => {
    if (err.response?.status === 401) {
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export async function login(email: string, password: string): Promise<AuthResponse> {
  const { data } = await api.post('/auth/login', { email, password });
  return data.data;
}

export async function register(email: string, password: string, name?: string): Promise<AuthResponse> {
  const { data } = await api.post('/auth/register', { email, password, name });
  return data.data;
}

export async function getProfile(): Promise<User> {
  const { data } = await api.get('/auth/me');
  return data.data;
}

export async function uploadCsv(file: File, onProgress?: (pct: number) => void): Promise<UploadResponse> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post('/csv/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    },
  });
  return data.data;
}

export async function mapHeaders(sessionId: string): Promise<MappingResponse> {
  const { data } = await api.post(`/csv/sessions/${sessionId}/map`);
  return data.data;
}

export async function getPreview(sessionId: string): Promise<PreviewData> {
  const { data } = await api.get(`/csv/sessions/${sessionId}/preview`);
  return data.data;
}

export async function importLeads(sessionId: string): Promise<ImportResult> {
  const { data } = await api.post(`/csv/sessions/${sessionId}/import`);
  return data.data;
}

export async function getSummary(sessionId: string): Promise<SessionSummary> {
  const { data } = await api.get(`/csv/sessions/${sessionId}/summary`);
  return data.data;
}

export async function getSession(id: string): Promise<Session> {
  const { data } = await api.get(`/csv/sessions/${id}`);
  return data.data;
}

export async function listSessions(): Promise<Session[]> {
  const { data } = await api.get('/csv/sessions');
  return data.data;
}

export async function deleteSession(id: string): Promise<void> {
  await api.delete(`/csv/sessions/${id}`);
}

export async function getLeads(sessionId: string, params?: { status?: string; offset?: number; limit?: number }) {
  const { data } = await api.get(`/csv/sessions/${sessionId}/leads`, { params });
  return data.data;
}

export async function getAiSummary(sessionId: string) {
  const { data } = await api.post(`/csv/sessions/${sessionId}/ai-summary`);
  return data.data;
}

export default api;
