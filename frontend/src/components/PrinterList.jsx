// frontend/src/components/PrinterList.jsx
import React, { useState, useEffect, useCallback } from "react";
import {
  Accordion, AccordionSummary, AccordionDetails,
  Typography, Chip, MenuItem, Select,
  Stack, Switch, Button, Box, LinearProgress, Paper
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import RefreshIcon    from "@mui/icons-material/Refresh";

import PrinterCard from "./PrinterCard";
import { fetchStatus, fetchPrintJob } from "../api/printerService";

/* ───────────────────────────────────────── */

export default function PrinterList() {

  const [data, setData]    = useState({});   // ip → {info, job}
  const [auto, setAuto]    = useState(false);
  const [interval, setInt] = useState(30);

  /* ---------- завантажити все ---------- */
  const loadAll = useCallback(async () => {
    try {
      const base = await fetchStatus();              // {ip: info|null}

      const jobsArr = await Promise.all(
        Object.keys(base).map(async ip => {
          try   { return [ip, await fetchPrintJob(ip)]; }
          catch { return [ip, null]; }
        })
      );
      const jobsObj = Object.fromEntries(jobsArr);

      const merged = {};
      for (const [ip, info] of Object.entries(base)) {
        merged[ip] = { info, job: jobsObj[ip] || null };
      }
      setData(merged);
    } catch (e) { console.error("fetch status error", e); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(loadAll, interval * 1000);
    return () => clearInterval(t);
  }, [auto, interval, loadAll]);

  /* ---------- чип статусу ---------- */
  const chipFor = ({ info, job }) => {
    if (!info)                         return <Chip label="офлайн"  color="default" size="small"/>;
    if (job?.state === "printing")     return <Chip label="друкує"  color="warning" size="small"/>;
    if (info.state === "error")        return <Chip label="помилка" color="error"   size="small"/>;
    return                                <Chip label="вільний" color="success" size="small"/>;
  };

  /* ---------- JSX ---------- */
  return (
    <Box>

      {/* панель керування оновленнями */}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <Switch checked={auto} onChange={e => setAuto(e.target.checked)} />
        <Typography>Автооновлення</Typography>

        <Select size="small" value={interval}
                onChange={e => setInt(e.target.value)} disabled={!auto}>
          {[10, 20, 30, 60].map(s => (
            <MenuItem key={s} value={s}>{s}&nbsp;сек</MenuItem>
          ))}
        </Select>

        <Button size="small" variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={loadAll} disabled={auto}>
          ОНОВИТИ ЗАРАЗ
        </Button>
      </Stack>

      {/* список принтерів */}
      {Object.entries(data).map(([ip, { info, job }]) => (

        info ? (
          /* ───── онлайн / відповідає ───── */
          <Accordion key={ip} sx={{ mb: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ alignItems: "center" }}>
              <Box sx={{ flexGrow: 1 }}>
                <Typography fontWeight={700}>{info.model || "—"}</Typography>
                <Typography variant="caption" color="text.secondary">{ip}</Typography>

                {/* прогрес видно і в згорнутому стані */}
                {job?.state === "printing" && (
                  <Box sx={{ mt: 0.5 }}>
                    <LinearProgress
                      variant="determinate"
                      value={job.progress}
                      sx={{ height: 6, borderRadius: 3 }}
                    />
                    <Typography variant="caption" sx={{ ml: 0.5 }}>
                      {job.filename} — {Math.round(job.progress)}%
                    </Typography>
                  </Box>
                )}
              </Box>

              {chipFor({ info, job })}
            </AccordionSummary>

            <AccordionDetails sx={{ pt: 1 }}>
              <PrinterCard ip={ip} info={info} job={job} onRefresh={loadAll} />
            </AccordionDetails>
          </Accordion>
        ) : (
          /* ───── офлайн ───── */
          <Paper key={ip} variant="outlined" sx={{ mb: 2, p: 1.5 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Box sx={{ flexGrow: 1 }}>
                <Typography fontWeight={700}>—</Typography>
                <Typography variant="caption" color="text.secondary">{ip}</Typography>
              </Box>
              {chipFor({ info, job: null })}
            </Stack>
          </Paper>
        )

      ))}
    </Box>
  );
}
