# backend/main.py
from fastapi import FastAPI, HTTPException, Body, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
from typing import List

from printers import (
    discover_printers,
    Printer,
    get_print_job,
    list_files,          # ← модульна функція
    send_gcode,
    get_model_name_by_mac,
)
from model_templates import model_command_template

app = FastAPI(title="3D Printer Dashboard")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from printers import send_gcode

class PreheatParams(BaseModel):
    temp: int


# ─────────────────────────  health / status  ────────────────────────────
@app.get("/", tags=["root"])
async def root():
    return {"message": "API is up. See /docs for documentation."}


@app.get("/status")
async def all_status():
    printers = await discover_printers()
    status_map = {}
    for p in printers:
        try:
            status_map[p.host] = await p.query_status()
        except Exception as e:
            status_map[p.host] = None
            print(f"[WARN] status {p.host}: {e}")
    return status_map


# ─────────────────────────────  mesh  ───────────────────────────────────
@app.get("/printer/{printer_name}/mesh", tags=["mesh"])
async def get_mesh(printer_name: str):
    printers = await discover_printers()
    pr = next((p for p in printers if p.name == printer_name), None)
    if not pr:
        raise HTTPException(status_code=404, detail="Printer not found")
    try:
        mesh = await pr.query_bed_mesh()
        return mesh
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────―  temperatures  ─────────────────────────────
@app.post("/control/{printer_name}/preheat_bed", tags=["control"])
async def preheat_bed(printer_name: str, params: PreheatParams):
    printers = await discover_printers()
    pr = next((p for p in printers if p.name == printer_name), None)
    if not pr:
        raise HTTPException(status_code=404, detail="Printer not found")
    detail = await pr.send_gcode([f"M140 S{params.temp}"])
    return {"status": "ok", "detail": detail}


@app.post("/control/{printer_name}/preheat_nozzle", tags=["control"])
async def preheat_nozzle(printer_name: str, params: PreheatParams):
    printers = await discover_printers()
    pr = next((p for p in printers if p.name == printer_name), None)
    if not pr:
        raise HTTPException(status_code=404, detail="Printer not found")
    detail = await pr.send_gcode([f"M104 S{params.temp}"])
    return {"status": "ok", "detail": detail}


# ─────────────────────────  mesh‑calibration  ───────────────────────────
@app.post("/control/{printer_name}/calibrate_mesh", tags=["control"])
async def calibrate_mesh(printer_name: str):
    printers = await discover_printers()
    pr = next((p for p in printers if p.name == printer_name), None)
    if not pr:
        raise HTTPException(status_code=404, detail="Printer not found")

    model = get_model_name_by_mac(pr.mac)
    commands = model_command_template.get(model, ["G29"])
    print(f"[INFO] Calibrating {pr.name} as {model} with {commands}")

    detail = await pr.send_gcode(commands)
    return {"status": "ok", "detail": detail}


# ─────────────────────────  print‑job / files  ──────────────────────────
@app.get("/printer/{ip}/job")
async def job(ip: str):
    job = await get_print_job(ip)
    return job  # None → 200 з null


@app.get("/printer/{ip}/files")
async def printer_files(ip: str):
    """
    Повертає вміст папки G‑codes на принтері.
    Формат відповіді:
        { "result": [ { "path": ..., "size": ..., ... }, ... ] }

    Якщо принтер офлайн → "result": null
    """
    try:
        files = await list_files(ip)   # ← ВИКЛИКАЄМО МОДУЛЬНУ ФУНКЦІЮ
        return {"result": files}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/printer/{ip}/print")
async def print_(ip: str, payload: dict):
    filename = payload["filename"]
    url = f"http://{ip}:7125/printer/print/start"
    async with httpx.AsyncClient(timeout=5) as client:
        # передаємо filename як параметр запиту
        r = await client.post(url, params={"filename": filename})
        r.raise_for_status()
    return {"status": "ok"}


# ───────────────────────  enclosure fan (K1 Max)  ───────────────────────
@app.get("/control/{printer_name}/enclosure_fan", tags=["control"])
async def get_enclosure_fan(printer_name: str):
    printers = await discover_printers()
    pr = next((p for p in printers if p.name == printer_name), None)
    if not pr:
        raise HTTPException(status_code=404, detail="Printer not found")
    if pr.model != "K1 Max":
        raise HTTPException(status_code=404, detail="Enclosure fan not supported")

    power = await pr.get_enclosure_fan()
    return {"power": power}


@app.post("/control/{printer_name}/enclosure_fan", tags=["control"])
async def set_enclosure_fan(printer_name: str, speed: int = Body(..., embed=True)):
    printers = await discover_printers()
    pr = next((p for p in printers if p.name == printer_name), None)
    if not pr:
        raise HTTPException(status_code=404, detail="Printer not found")
    if pr.model != "K1 Max":
        raise HTTPException(status_code=404, detail="Enclosure fan not supported")

    await pr.set_enclosure_fan(speed)
    return {"status": "ok", "power": speed}


@app.post("/printer/{ip}/upload")
async def upload_file(ip: str, file: UploadFile = File(...)):
    """
    Проксі для завантаження G-code на принтер через Moonraker.
    Отримує файл у multipart/form-data під ключем "file"
    та штовхає його на /server/files/upload?root=gcodes
    """
    # Зчитуємо вміст файлу
    content = await file.read()
    # Формуємо URL для Moonraker
    url = f"http://{ip}:7125/server/files/upload"
    params = {"root": "gcodes"}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            # Передаємо файл у форматі multipart/form-data
            files = {"file": (file.filename, content, file.content_type)}
            r = await client.post(url, params=params, files=files)
            r.raise_for_status()
    except httpx.HTTPStatusError as e:
        # Якщо Moonraker повернув 4xx/5xx
        raise HTTPException(status_code=e.response.status_code, detail=e.response.text)
    except Exception as e:
        # Інші помилки (timeout, connection)
        raise HTTPException(status_code=500, detail=str(e))

    return {"ok": True}



async def _proxy_print_control(ip: str, action: str):
    """
    Проксі-протокол для Moonraker:
      action = "pause" → /printer/print/pause
      action = "cancel" → /printer/print/stop
    """
    url = f"http://{ip}:7125/printer/print/{action}"
    # встановимо окремі таймаути: 10с на конект, 30с на рід
    timeout = httpx.Timeout(
        connect=10.0,
        read=30.0,
        write=30.0,
        pool=30.0
    )
    async with httpx.AsyncClient(timeout=timeout) as client:
        r = await client.post(url)
        try:
            r.raise_for_status()
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=e.response.text)


@app.post("/printer/{ip}/print/pause")
async def pause_print(ip: str):
    """
    Pause the current print by sending the PAUSE G-code.
    """
    try:
        # Klipper macro: PAUSE
        await send_gcode(ip, ["PAUSE"])
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pause failed: {e}")

@app.post("/printer/{ip}/print/stop")
async def stop_print(ip: str):
    """
    Fully stop/cancel the print by sending the CANCEL_PRINT G-code.
    """
    try:
        await send_gcode(ip, ["CANCEL_PRINT"])
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Stop failed: {e}")

@app.post("/printer/{ip}/print/resume")
async def resume_print(ip: str):
    """
    Resume a paused print by sending the RESUME G-code.
    """
    try:
        # Klipper macro: RESUME
        await send_gcode(ip, ["RESUME"])
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Resume failed: {e}")