// frontend/src/components/FilesDialog.jsx
import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Dialog, DialogTitle, IconButton, DialogContent,
  List, ListItemButton, ListItemText,
  LinearProgress, Alert, Button, Box, Typography,
} from "@mui/material";
import CloseIcon       from "@mui/icons-material/Close";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";

import {
  fetchFiles,          // ← один-єдиний імпорт
  startPrint,
  uploadFile,
} from "../api/printerService";

import { useUpload }   from "../contexts/UploadCtx";

/**
 * Діалог із переліком G‑кодів для вибраного принтера
 * + Upload → Print
 */
export default function FilesDialog({ open, ip, model, onClose }) {
  const [files,    setFiles]    = useState(null);   // null – loading
  const [selected, setSelected] = useState(null);
  const [error,    setError]    = useState("");

  const setUpload = useUpload();      // глобальний snackbar
  const fileRef   = useRef();         // прихований <input type=file>

  /* --- завантажити список --- */
  const load = useCallback(() => {
    setFiles(null);
    setSelected(null);
    setError("");

    fetchFiles(ip)
      .then(setFiles)
      .catch(() => setError("Не вдалося отримати список файлів"));
  }, [ip]);

  useEffect(() => { if (open) load(); }, [open, load]);

  /* --- друк --- */
  const handlePrint = async () => {
    if (!selected) return;
    try {
      await startPrint(ip, selected.path);
      onClose(true);          // refresh parent
    } catch {
      setError("Не вдалося запустити друк");
    }
  };

  /* --- upload --- */
  const handleChoose = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const name = file.name;
    uploadFile(ip, file, pct => setUpload({ name, pct }))
      .then(() => { setUpload(null); load(); })
      .catch(() => { setUpload(null); setError("Upload failed"); });
  };

  return (
    <Dialog open={open} onClose={() => onClose(false)} maxWidth="sm" fullWidth>
      <DialogTitle>
        {`Файли ${model} (${ip})`}
        <IconButton
          aria-label="close"
          sx={{ position: "absolute", right: 8, top: 8 }}
          onClick={() => onClose(false)}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {files === null && <LinearProgress />}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {files && files.length === 0 && (
          <Typography align="center">Файлів не знайдено</Typography>
        )}

        {files && files.length > 0 && (
          <>
            <List dense disablePadding>
              {files.map(f => (
                <ListItemButton
                  key={f.path}
                  selected={selected?.path === f.path}
                  onClick={() => setSelected(f)}
                  divider
                >
                  <ListItemText
                    primary={f.path}
                    secondary={`${(f.size / 1024).toFixed(1)} KB`}
                  />
                </ListItemButton>
              ))}
            </List>

            <Box sx={{ textAlign: "right", mt: 2 }}>
              <Button
                variant="contained"
                disabled={!selected}
                onClick={handlePrint}
              >
                Друкувати
              </Button>
            </Box>
          </>
        )}

        {/* ───── Upload button ───── */}
        <Box sx={{ mt: 2, textAlign: "right" }}>
          <input
            hidden
            ref={fileRef}
            type="file"
            accept=".gcode"
            onChange={handleChoose}
          />
          <Button
            variant="outlined"
            size="small"
            startIcon={<CloudUploadIcon />}
            onClick={() => fileRef.current?.click()}
          >
            Upload
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
