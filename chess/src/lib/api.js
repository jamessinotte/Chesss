// src/lib/api.js
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// If VITE_WS_URL not provided, reuse API host (handy for Socket.IO)
const DEFAULT_WS = API_URL.replace(/^http/, "ws");
export const WS_URL = import.meta.env.VITE_WS_URL || DEFAULT_WS || "ws://localhost:5000";

// Single axios instance; automatically attaches token if present
export const api = axios.create({
  baseURL: `${API_URL}/api`,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
