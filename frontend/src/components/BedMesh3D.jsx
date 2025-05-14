// src/components/BedMesh3D.jsx
import React from "react";
import Plot from "react-plotly.js";
import { Box, Typography } from "@mui/material"; // 1) імпорт Box & Typography

/**
 * @param {{ data: object, sx?: object }} props
 *   data: обʼєкт bed_mesh з бекенду
 *   sx: додаткові стилі MUI
 */
export default function BedMesh3D({ data, sx }) {
  // --- 1. Витягуємо “реальну” матрицю z-значень ---
  let matrix = [];
  // (A) спроба mesh_matrix
  if (
    Array.isArray(data.mesh_matrix) &&
    data.mesh_matrix.some(r => Array.isArray(r) && r.length > 0)
  ) {
    matrix = data.mesh_matrix;
  }
  // (B) або probed_matrix
  else if (
    Array.isArray(data.probed_matrix) &&
    data.probed_matrix.some(r => Array.isArray(r) && r.length > 0)
  ) {
    matrix = data.probed_matrix;
  }
  // (C) fallback на профільні точки (беремо тільки z)
  else {
    const prof = data.profiles?.default?.points;
    if (Array.isArray(prof) && prof.length > 0) {
      matrix = prof.map(row =>
        Array.isArray(row)
          ? row.slice(2)     // забираємо лише значення Z
          : []
      );
    }
  }

  // --- 2. Якщо нічого рендерити, показуємо плейсхолдер ---
  const hasData =
    Array.isArray(matrix) &&
    matrix.length > 0 &&
    matrix.some(r => Array.isArray(r) && r.length > 0);

  if (!hasData) {
    return (
      <Box
        sx={{
          height: 200,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          ...sx,
        }}
      >
        <Typography variant="caption" color="text.secondary">
          Немає даних для mesh
        </Typography>
      </Box>
    );
  }

  // --- 3. Обчислюємо кольорову шкалу та межі ---
  const flat = matrix.flat();
  const minVal = Math.min(...flat);
  const maxVal = Math.max(...flat);
  const mid = (0 - minVal) / ((maxVal - minVal) || 1);

  const colorscale = [
    [0, "red"],
    [mid, "green"],
    [1, "red"],
  ];

  // Розміри матриці
  const nRows = matrix.length;
  const nCols = matrix[0].length;
  // координати осей: 0,1,… до числа стовпців/рядів
  const x = Array.from({ length: nCols }, (_, i) => i);
  const y = Array.from({ length: nRows }, (_, i) => i);

  // --- 4. Рендеримо поверхню ---
  return (
    <Plot
      data={[
        {
          z: matrix,
          x,      // додаємо координати стовпців
          y,      // додаємо координати рядків
          type: "surface",
          colorscale,
          cmin: minVal,
          cmax: maxVal,
          showscale: true,
        },
      ]}
      layout={{
        autosize: true,
        margin: { l: 40, r: 40, b: 40, t: 10 },
        scene: {
          dragmode: "turntable",
           xaxis: {
           title: "X",
           range: [0, nCols - 1],
         },
         yaxis: {
           title: "Y",
           range: [0, nRows - 1],
         },
          zaxis: { title: "Z (height)" },
        },
      }}
      config={{ displayModeBar: false }}
      style={{ width: "100%", height: 400 }}
    />
  );
}
