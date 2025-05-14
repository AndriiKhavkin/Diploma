import React, { useState, useEffect, useCallback } from "react";
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Chip,
  MenuItem,
  Select,
  Stack,
  Switch,
  Button,
  Box,
  LinearProgress,
  Paper
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import RefreshIcon    from "@mui/icons-material/Refresh";

import PrinterCard from "./PrinterCard";
import { fetchStatus, fetchPrintJob, pausePrint, stopPrint, resumePrint } from "../api/printerService";

export default function PrinterList() {
  const [data, setData] = useState({});
  const [auto, setAuto] = useState(false);
  const [interval, setInt] = useState(30);
  const [loadingPauseIp, setLoadingPauseIp] = useState(null);
  const [loadingStopIp,  setLoadingStopIp]  = useState(null);
  const [loadingResumeIp, setLoadingResumeIp] = useState(null);

  const loadAll = useCallback(async () => {
    try {
      const base = await fetchStatus();

      const jobsArr = await Promise.all(
        Object.keys(base).map(async ip => {
          try { return [ip, await fetchPrintJob(ip)]; }
          catch { return [ip, null]; }
        })
      );
      const jobsObj = Object.fromEntries(jobsArr);

      const merged = {};
      for (const [ip, info] of Object.entries(base)) {
        merged[ip] = { info, job: jobsObj[ip] || null };
      }
      setData(merged);
    } catch (e) {
      console.error("fetch status error", e);
    }
  }, []);

  const handlePause = async (ip) => {
    setLoadingPauseIp(ip);
    try {
      await pausePrint(ip);
      await loadAll();
    } catch (e) {
      console.error("Pause error", e);
    } finally {
      setLoadingPauseIp(null);
    }
  };

  const handleStop = async (ip) => {
    setLoadingStopIp(ip);
    try {
      await stopPrint(ip);
      await loadAll();
    } catch (e) {
      console.error("Stop error", e);
    } finally {
      setLoadingStopIp(null);
    }
  };

  const handleResume = async (ip) => {
    setLoadingResumeIp(ip);
    try {
      await resumePrint(ip);
      await loadAll();
    } catch (e) {
      console.error("Resume error", e);
    } finally {
      setLoadingResumeIp(null);
    }
  };

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(loadAll, interval * 1000);
    return () => clearInterval(t);
  }, [auto, interval, loadAll]);

  const chipFor = ({ info, job }) => {
    if (!info)                        return <Chip label="офлайн"  color="default" size="small" />;
    if (job?.state === "printing")  return <Chip label="друкує"  color="warning" size="small" />;
    if (info.state === "error")     return <Chip label="помилка" color="error"   size="small" />;
    return                             <Chip label="вільний" color="success" size="small" />;
  };

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <Switch checked={auto} onChange={e => setAuto(e.target.checked)} />
        <Typography>Автооновлення</Typography>
        <Select
          size="small"
          value={interval}
          onChange={e => setInt(e.target.value)}
          disabled={!auto}
        >
          {[10, 20, 30, 60].map(s => (
            <MenuItem key={s} value={s}>{s}&nbsp;сек</MenuItem>
          ))}
        </Select>
        <Button
          size="small"
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={loadAll}
          disabled={auto}
        >
          ОНОВИТИ ЗАРАЗ
        </Button>
      </Stack>

      {Object.entries(data).map(([ip, { info, job }]) => (
        info ? (
          <Accordion key={ip} sx={{ mb: 2 }}>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{ alignItems: "center" }}
            >
              <Box sx={{ flexGrow: 1 }}>
                <Typography fontWeight={700}>{info.model || "—"}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {ip}
                </Typography>

                {(job?.state === "printing" || job?.state === "paused") && (
                  <Box sx={{ mt: 0.5 }}>
                    <LinearProgress
                      variant="determinate"
                      value={job.progress}
                      sx={{ height: 6, borderRadius: 3 }}
                    />
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
                      <Typography variant="caption">
                        {job.filename} — {Math.round(job.progress)}%
                      </Typography>

                      {job.state === "printing" ? (
                        // кнопка паузи під час друку
                        <Button
                          component="span"
                          size="small"
                          variant="outlined"
                          disabled={loadingPauseIp === ip}
                          onClick={e => {
                            e.stopPropagation(); e.preventDefault();
                            handlePause(ip);
                          }}
                        >
                          {loadingPauseIp === ip ? "Pausing…" : "Pause"}
                        </Button>
                      ) : (
                        // кнопка Resume під час паузи
                        <Button
                          component="span"
                          size="small"
                          variant="outlined"
                          color="success"
                          disabled={loadingResumeIp === ip}
                          onClick={e => {
                            e.stopPropagation(); e.preventDefault();
                            handleResume(ip);
                          }}
                        >
                          {loadingResumeIp === ip ? "Resuming…" : "Resume"}
                        </Button>
                      )}

                      {/* Кнопка Stop лишається завжди */}
                      <Button
                        component="span"
                        size="small"
                        variant="outlined"
                        color="error"
                        disabled={loadingStopIp === ip}
                        onClick={e => {
                          e.stopPropagation(); e.preventDefault();
                          handleStop(ip);
                        }}
                      >
                        {loadingStopIp === ip ? "Stopping…" : "Stop"}
                      </Button>
                    </Box>
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
          <Paper key={ip} variant="outlined" sx={{ mb: 2, p: 1.5 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Box sx={{ flexGrow: 1 }}>
                <Typography fontWeight={700}>—</Typography>
                <Typography variant="caption" color="text.secondary">
                  {ip}
                </Typography>
              </Box>
              {chipFor({ info, job: null })}
            </Stack>
          </Paper>
        )
      ))}
    </Box>
  );
}
