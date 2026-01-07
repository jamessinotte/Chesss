
import axios from "axios";

const DEFAULT_API_URL =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://localhost:5000"
    : window.location.origin;
const API_URL = import.meta.env.VITE_API_URL || DEFAULT_API_URL;


export const WS_URL = import.meta.env.VITE_WS_URL || API_URL;


export const api = axios.create({
  baseURL: `${API_URL}/api`,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
