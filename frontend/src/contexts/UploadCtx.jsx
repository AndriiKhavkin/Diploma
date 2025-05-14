import React, { createContext, useState, useContext } from "react";
import { Snackbar, Paper, Typography, LinearProgress } from "@mui/material";

/* ---------- контекст ---------- */
const UploadCtx = createContext(null);
export const useUpload = () => useContext(UploadCtx);

/* ---------- провайдер ---------- */
export function UploadProvider({ children }) {
  const [state, setState] = useState(null); // {name, pct} | null

  return (
    <UploadCtx.Provider value={setState}>
      {children}

      {/* toast у правому нижньому кутку */}
      {!!state && (
        <Snackbar
          open
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        >
          <Paper sx={{ p: 1, minWidth: 220 }}>
            <Typography variant="body2" noWrap>
              {state.name}
            </Typography>
            <LinearProgress variant="determinate" value={state.pct} />
          </Paper>
        </Snackbar>
      )}
    </UploadCtx.Provider>
  );
}
