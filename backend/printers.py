# backend/printers.py
"""
Єдиний модуль «принтери»:
 • пошук Creality‑пристроїв у кількох підмережах (10.51.0.0/24, 10.50.0.0/24 …)
 • асинхронні запити Moonraker (стани, bed‑mesh, G‑code, список файлів, job‑progress)
"""

from __future__ import annotations

import asyncio, ipaddress, platform, subprocess, re, yaml
from concurrent.futures import ThreadPoolExecutor
from typing import List, Dict, Any

import httpx
from httpx import ConnectError, ReadTimeout, HTTPStatusError
from pydantic import BaseModel

# ────────────────────────────────  MAC helpers  ─────────────────────────────
CREALITY_MAC_PREFIXES = ("d4:3a:eb", "84:0d:8e", "dc:01:02", "fc:ee:11", "fc:ee:28")


def _norm(mac: str) -> str:
    return mac.lower().replace("-", ":").strip()


def _is_creality(mac: str) -> bool:
    return any(_norm(mac).startswith(p) for p in CREALITY_MAC_PREFIXES)


def normalize_mac(mac: str) -> str:
    return mac.lower().replace("-", ":").strip()


def is_creality_mac(mac: str) -> bool:
    mac = normalize_mac(mac)
    return any(mac.startswith(pref) for pref in CREALITY_MAC_PREFIXES)


def get_model_name_by_mac(mac: str) -> str:
    mac = normalize_mac(mac)
    if mac.startswith("fc:ee:28"):
        return "K1 Max"
    elif mac.startswith("fc:ee:11"):
        return "Ender 3 KE"
    return "Unknown"


# ───────────────────────────  subnet list from config  ──────────────────────
def _load_subnets() -> List[ipaddress.IPv4Network]:
    """
    Читає /subnets з config.yaml.
    Якщо файла немає – підмережа власного інтерфейсу (/24).
    """
    try:
        with open("config.yaml", encoding="utf-8") as f:
            nets = yaml.safe_load(f).get("subnets", [])
            return [ipaddress.ip_network(n) for n in nets]
    except FileNotFoundError:
        raw = subprocess.check_output("ipconfig", shell=True).decode(
            "cp866", errors="ignore"
        )
        ipm = re.search(r"IPv4.*?:\s*([\d\.]+)", raw)
        subnet = f"{ipm.group(1).rsplit('.',1)[0]}.0/24" if ipm else "192.168.0.0/24"
        return [ipaddress.ip_network(subnet)]


# ─────────────────────────  low‑level ping + ARP table  ─────────────────────
def _ping(ip: str) -> None:
    """
    Одноразовий ping: на Windows ховає консоль,
    а також **не** закриває дескриптори ‑ так ми обходимо WinError 6.
    """
    if platform.system().lower() == "windows":
        si = subprocess.STARTUPINFO()
        si.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        try:
            subprocess.run(
                ["ping", "-n", "1", ip],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                startupinfo=si,
                close_fds=False,
                timeout=5,
            )
        except Exception as e:
            print(f"[WARN] ping {ip} failed: {e}")
    else:  # Linux / macOS
        try:
            subprocess.run(
                ["ping", "-c", "1", ip],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                close_fds=True,
                timeout=5,
            )
        except Exception as e:
            print(f"[WARN] ping {ip} failed: {e}")


def _arp_table() -> Dict[str, str]:
    txt = subprocess.check_output("arp -a", shell=True).decode("cp866", errors="ignore")
    return {
        ip: _norm(mac) for ip, mac in re.findall(r"(\d+\.\d+\.\d+\.\d+)\s+([-:\w]{17})", txt)
    }


async def _scan_subnet(net: ipaddress.IPv4Network) -> List[Dict[str, str]]:
    ips = [str(h) for h in net.hosts()]
    loop = asyncio.get_running_loop()
    with ThreadPoolExecutor(max_workers=256) as pool:
        await asyncio.gather(*(loop.run_in_executor(pool, _ping, ip) for ip in ips))

    table = _arp_table()
    return [
        {"ip": ip, "mac": mac} for ip, mac in table.items() if ip in ips and _is_creality(mac)
    ]


async def _discover_async() -> List[Dict[str, str]]:
    devices: List[Dict[str, str]] = []
    for net in _load_subnets():
        devices += await _scan_subnet(net)
    return devices


# ────────────────────────────────  Printer  ────────────────────────────────
class Printer(BaseModel):
    name: str
    host: str
    mac: str
    port: int = 7125

    # -----------------------  довідкова інформація  ------------------------
    @property
    def model(self) -> str:
        return get_model_name_by_mac(self.mac)

    # ----------------------------  STATUS  ----------------------------------
    async def query_status(self) -> Dict[str, Any]:
        payload = {
            "objects": {
                "extruder": ["temperature", "target"],
                "heater_bed": ["temperature", "target"],
                "gcode_move": ["position"],
                "klippy": ["state", "message"],
            }
        }
        async with httpx.AsyncClient(timeout=5) as c:
            r = await c.post(
                f"http://{self.host}:{self.port}/printer/objects/query", json=payload
            )
        r.raise_for_status()
        st = r.json()["result"]["status"]
        return {
            "manufacturer": "Creality" if is_creality_mac(self.mac) else "Unknown",
            "model": get_model_name_by_mac(self.mac),
            "ext": {"actual": st["extruder"]["temperature"], "target": st["extruder"]["target"]},
            "bed": {"actual": st["heater_bed"]["temperature"], "target": st["heater_bed"]["target"]},
            "pos": {
                "x": st["gcode_move"]["position"][0],
                "y": st["gcode_move"]["position"][1],
                "z": st["gcode_move"]["position"][2],
            },
            "state": st["klippy"]["state"],  # ready / printing / error …
            "error": st["klippy"].get("message") or "",
        }

    # ---------------------  enclosure‑fan helpers  --------------------------
    async def get_enclosure_fan(self) -> int:
        params = {"fans": ""}
        async with httpx.AsyncClient(timeout=5) as c:
            r = await c.get(
                f"http://{self.host}:{self.port}/printer/objects/query", params=params
            )
        r.raise_for_status()
        status = r.json()["result"]["status"]
        for f in status.get("fans", []):
            if f.get("index") == 2:
                return f.get("speed", 0)
        return 0

    async def set_enclosure_fan(self, speed: int):
        s = max(0, min(255, speed * 255 // 100))
        await self.send_gcode([f"M106 P2 S{s}"])

    # -----------------------------  bed‑mesh  -------------------------------
    async def query_bed_mesh(self):
        url = f"http://{self.host}:{self.port}/printer/objects/query?bed_mesh"
        async with httpx.AsyncClient(timeout=5) as c:
            r = await c.get(url, timeout=5)
        r.raise_for_status()
        data = r.json()["result"]["status"]
        return data.get("bed_mesh") or data

    # ---------------------------  send G‑code  ------------------------------
    async def send_gcode(self, commands: list[str]) -> Dict[str, Any]:
        async with httpx.AsyncClient(timeout=5) as c:
            for cmd in commands:
                try:
                    await c.post(
                        f"http://{self.host}:{self.port}/printer/gcode/script",
                        json={"script": cmd},
                        timeout=3,
                    )
                except ReadTimeout:
                    continue
                except httpx.HTTPError as e:
                    print(f"[WARN] send_gcode {cmd} → {e}")
        return {"sent": commands}


# ────────────────────────  Public helpers для main.py  ──────────────────────
async def discover_printers() -> list[Printer]:
    try:
        found = await _discover_async()
    except Exception as e:
        print(f"[ERROR] discover_printers failed: {e}")
        found = []
    return [Printer(name=d["ip"], host=d["ip"], mac=d["mac"]) for d in found]


async def send_gcode(ip: str, lines: list[str]):
    async with httpx.AsyncClient(timeout=5) as c:
        await c.post(
            f"http://{ip}:7125/printer/gcode/script", json={"script": "\n".join(lines)}
        )


async def get_print_job(ip: str):
    url = f"http://{ip}:7125/printer/objects/query"
    params = {"print_stats": "", "display_status": ""}
    try:
        async with httpx.AsyncClient(timeout=5) as c:
            r = await c.get(url, params=params)
        r.raise_for_status()
    except (ConnectError, ReadTimeout):
        return None

    st = r.json()["result"]["status"]
    ps, ds = st["print_stats"], st["display_status"]

    if ps["state"] not in ("printing", "paused"):
        return None

    prog = ds.get("progress") or ps.get("progress") or 0
    prog = prog * 100 if prog <= 1 else prog
    return {
        "filename": ps["filename"],
        "progress": round(prog, 1),
        "eta": ds.get("eta") or "",
        "state": ps["state"],
    }


async def list_files(ip: str):
    """
    Повертає список G‑кодів у root=gcodes або:
     • []  — якщо на принтері немає файлів чи стався HTTP 404
     • None — якщо немає зв’язку з принтером
    УСІ помилки перехоплюються, щоб енд‑поінт завжди віддавав 200 OK.
    """
    try:
        async with httpx.AsyncClient(timeout=5) as c:
            r = await c.get(
                f"http://{ip}:7125/server/files/list", params={"root": "gcodes"}
            )
        if r.status_code == 404:
            # Moonraker відповідає 404, коли root не знайдено
            return []
        r.raise_for_status()
        return r.json().get("result", {}).get("files", [])
    except (ConnectError, ReadTimeout):
        return None          # офлайн
    except HTTPStatusError as e:
        print(f"[WARN] list_files {ip}: {e}")
        return []
    except Exception as e:
        print(f"[ERROR] list_files {ip}: {e}")
        return []
