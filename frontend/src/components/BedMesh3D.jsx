// frontend/src/components/BedMesh3D.jsx
import React from 'react';
import Plot from 'react-plotly.js';

export default function BedMesh3D({ matrix }) {
  const flat = matrix.flat();
  const minVal = Math.min(...flat);
  const maxVal = Math.max(...flat);
  const mid = (0 - minVal) / ((maxVal - minVal) || 1);

  // дивергентний colorscale: край – червоний, середина (0) – зелений
  const colorscale = [
    [0, 'red'],
    [mid, 'green'],
    [1, 'red'],
  ];

  return (
    <Plot
      data={[
        {
          z: matrix,
          type: 'surface',
          colorscale,
          cmin: minVal,
          cmax: maxVal,
          showscale: true,       // вмикаємо колонку шкали
        }
      ]}
      layout={{
        autosize: true,
        title: '',
        scene: {
          dragmode: 'turntable', // режим обертання
          xaxis: { title: 'X' },
          yaxis: { title: 'Y' },
          zaxis: { title: 'Z (height)' },
        },
        margin: { l: 40, r: 40, b: 40, t: 10 },
      }}
      config={{
        displayModeBar: false // прибираємо всі кнопки plotly
      }}
      style={{ width: '100%', height: '400px' }}
    />
  );
}
