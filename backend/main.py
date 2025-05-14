# backend/main.py
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
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
    # payload = {"filename":"cube_20mm.gcode"}
    filename = payload["filename"]
    cmd = f"PRINT_START filename={filename}"
    await send_gcode(ip, [cmd])
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
