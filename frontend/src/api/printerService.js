import axios from 'axios';

// Налаштування базового URL до API
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const http = axios.create({ baseURL: API });

// Отримати статус усіх принтерів
export async function fetchStatus() {
  const { data } = await http.get('/status');
  return data;
}

// Отримати інформацію про активний джоб
export async function fetchPrintJob(ip) {
  const { data } = await http.get(`/printer/${ip}/job`);
  return data;
}

// Отримати mesh-дані столу
export async function fetchBedMesh(ip) {
  const { data } = await http.get(`/printer/${ip}/mesh`);
  return data;
}

// Отримати список G-code файлів
export async function fetchFiles(ip) {
  const { data } = await http.get(`/printer/${ip}/files`);
  return data;
}

// Попередній розігрів екструдера (hotend)
export async function preheatNozzle(ip, temperature) {
  const { data } = await http.post(`/printer/${ip}/hotend`, { temperature });
  return data;
}

// Попередній розігрів столу (bed)
export async function preheatBed(ip, temperature) {
  const { data } = await http.post(`/printer/${ip}/bed`, { temperature });
  return data;
}

// Запустити автокалібрування столу
export async function calibrateMesh(ip) {
  const { data } = await http.post(`/printer/${ip}/calibrate`);
  return data;
}

// Старт друку заданого G-code файлу
export async function startPrint(ip, filename) {
  const { data } = await http.post(`/printer/${ip}/print`, { filename });
  return data;
}

// Пауза друку
export async function pausePrint(ip) {
  const { data } = await http.post(`/printer/${ip}/print/pause`);
  return data;
}

// Відновлення друку
export async function resumePrint(ip) {
  const { data } = await http.post(`/printer/${ip}/print/resume`);
  return data;
}

// Зупинка (скасування) друку
export async function stopPrint(ip) {
  const { data } = await http.post(`/printer/${ip}/print/stop`);
  return data;
}

// Завантаження G-code файлу на принтер
export async function uploadFile(ip, file, onProgress) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await http.post(
    `/printer/${ip}/upload`,
    form,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => onProgress?.(Math.round((e.loaded * 100) / e.total)),
    }
  );
  return data;
}
