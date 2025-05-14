import axios from 'axios';
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// задаємо базову адресу для всіх запитів
axios.defaults.baseURL = API;

export async function fetchStatus() {
  const { data } = await axios.get(`${API}/status`);
  return data;
}

export async function fetchBedMesh(name) {
  const { data } = await axios.get(`${API}/printer/${name}/mesh`);
  return data;
}

export async function preheatBed(name, temp) {
  const { data } = await axios.post(
    `${API}/control/${name}/preheat_bed`,
    { temp }
  );
  return data;
}

export async function preheatNozzle(name, temp) {
  const { data } = await axios.post(
    `${API}/control/${name}/preheat_nozzle`,
    { temp }
  );
  return data;
}

// Новий метод для калібрування
export async function calibrateMesh(name) {
  const { data } = await axios.post(`${API}/control/${name}/calibrate_mesh`);
  return data;
}

export async function fetchPrintJob(ip) {
  const { data } = await axios.get(`${API}/printer/${ip}/job`);
  return data;
}

export async function fetchFiles(ip) {
  const { data } = await axios.get(`${API}/printer/${ip}/files`);
  return data.result;           // null | []
}

export async function startPrint(ip, filename) {
  await axios.post(`${API}/printer/${ip}/print`, { filename });
}

export async function getEnclosureFan(ip) {
  const res = await axios.get(`${API}/control/${ip}/enclosure_fan`)
  return res.data;  // { power: number }
}

export async function setEnclosureFan(ip, power) {
  const res = await axios.post(`/control/${ip}/enclosure_fan`, { speed: power });
  return res.data;  // { status: 'ok', power: number }
}

export async function uploadFile(ip, file, onProgress){
  const fd = new FormData();
  fd.append("file", file);
   const { data } = await axios.post(
    `${API}/printer/${ip}/upload`,
    fd,
       { onUploadProgress: e => onProgress?.(Math.round(e.loaded*100/e.total)) }
   );
  return data.ok;
}