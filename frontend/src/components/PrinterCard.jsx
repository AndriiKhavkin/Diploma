import React, { useState } from "react";
import {
  Typography,
  TextField,
  Button,
  Box,
  ToggleButton,
  ToggleButtonGroup,
  Table,
  TableBody,
  TableRow,
  TableCell,
  Alert,
} from "@mui/material";

import {
  preheatBed,
  preheatNozzle,
  calibrateMesh,
  fetchBedMesh,
} from "../api/printerService";

import BedMesh3D from "./BedMesh3D";
import FilesDialog from "./FilesDialog";

/* допоміжний колір для комірки Z‑матриці */
const zColour = (z) =>
  `hsl(${(1 - (Math.max(-1, Math.min(1, z)) + 1) / 2) * 120},100%,50%)`;

export default function PrinterCard({ ip, info, onRefresh }) {
  const [nozT, setNozT] = useState(info?.ext?.target ?? 0);
  const [bedT, setBedT] = useState(info?.bed?.target ?? 0);
  const [mesh, setMesh] = useState(null);
  const [view, setView] = useState("table");
  const [dlgOpen, setDlg] = useState(false);

  /* --- збираємо «правильну» 2D-матрицю --- */
  const matrix = (() => {
    if (!mesh) return [];

    // 1) Використовуємо інтерпольовану mesh_matrix, якщо вона непорожня
    if (
      Array.isArray(mesh.mesh_matrix) &&
      mesh.mesh_matrix.length > 0 &&
      mesh.mesh_matrix[0].length > 0
    ) {
      return mesh.mesh_matrix;
    }

    // 2) В іншому випадку — probed_matrix
    if (
      Array.isArray(mesh.probed_matrix) &&
      mesh.probed_matrix.length > 0 &&
      mesh.probed_matrix[0].length > 0
    ) {
      return mesh.probed_matrix;
    }

    // 3) Фолбек на профільні точки — просто повертаємо їх як матрицю z-значень
    const prof = mesh.profiles?.default?.points;
    if (Array.isArray(prof) && prof.length > 0) {
      return prof;
    }

    return [];
  })();

  const setTemp = async (fn, val) => {
    try {
      await fn(ip, val);
      onRefresh?.();
    } catch (_) {}
  };

  const toggleMesh = async () => {
    if (mesh) return setMesh(null);
    try {
      setMesh(await fetchBedMesh(ip));
    } catch (_) {}
  };

  return (
    <Box sx={{ pl: 1 }}>
      {info?.error && (
        <Alert severity="error" sx={{ mb: 1 }}>
          {info.error}
        </Alert>
      )}

      <Box sx={{ display: "flex", gap: 4, mb: 1 }}>
        {[
          { lbl: "Nozzle °C", val: nozT, set: setNozT, fn: preheatNozzle },
          { lbl: "Bed °C", val: bedT, set: setBedT, fn: preheatBed },
        ].map(({ lbl, val, set, fn }) => (
          <Box key={lbl}>
            <Typography variant="body2">{lbl}</Typography>
            <Box sx={{ display: "flex", gap: 1 }}>
              <TextField
                size="small"
                type="number"
                value={val}
                onChange={(e) => set(parseInt(e.target.value, 10))}
                sx={{ width: 80 }}
              />
              <Button
                variant="outlined"
                size="small"
                onClick={() => setTemp(fn, val)}
              >
                Set
              </Button>
            </Box>
          </Box>
        ))}
      </Box>

      <Box sx={{ display: "flex", gap: 1, mb: 1, alignItems: "center" }}>
        <Button variant="outlined" size="small" onClick={toggleMesh}>
          {mesh ? "Hide Mesh" : "Show Mesh"}
        </Button>

        {mesh && (
          <ToggleButtonGroup
            size="small"
            value={view}
            exclusive
            onChange={(_, v) => v && setView(v)}
          >
            <ToggleButton value="table">2D</ToggleButton>
            <ToggleButton value="3d">3D</ToggleButton>
          </ToggleButtonGroup>
        )}

        <Button
          variant="outlined"
          size="small"
          onClick={() => calibrateMesh(ip).then(onRefresh).catch(() => {})}
        >
          Calibrate
        </Button>
      </Box>

      {mesh && view === "table" && (
        <Table size="small" sx={{ mb: 1, width: "auto" }}>
          <TableBody>
            {matrix.map((row, i) => (
              <TableRow key={i}>
                {row.map((z, j) => (
                  <TableCell
                    key={j}
                    sx={{
                      width: 48,
                      height: 48,
                      p: 0,
                      textAlign: "center",
                      fontSize: "0.75rem",
                      background: zColour(z),
                      color: Math.abs(z) > 0.5 ? "#fff" : "#000",
                    }}
                  >
                    {z.toFixed(2)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {mesh && view === "3d" && <BedMesh3D data={mesh} sx={{ mb: 1 }} />}

      <Box sx={{ mb: 1 }}>
        <Button variant="outlined" size="small" onClick={() => setDlg(true)}>
          Files
        </Button>
      </Box>

      <FilesDialog
        open={dlgOpen}
        onClose={(needRefresh) => {
          setDlg(false);
          if (needRefresh) onRefresh?.();
        }}
        ip={ip}
        model={info?.model ?? ""}
      />
    </Box>
  );
}
