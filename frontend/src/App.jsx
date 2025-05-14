// src/App.jsx
import React, { useState } from 'react';
import { ThemeProvider, CssBaseline, IconButton, Box, Stack } from '@mui/material';
import LightModeIcon  from '@mui/icons-material/LightMode';
import DarkModeIcon   from '@mui/icons-material/DarkMode';
import PrinterList    from './components/PrinterList';
import { getTheme }   from './theme'

export default function App() {
  const [mode, setMode] = useState('light');

  return (
    <ThemeProvider theme={getTheme(mode)}>
      <CssBaseline />
      <Box sx={{p:2}}>
        {/* ───── Header ───── */}
        <Stack direction="row" alignItems="center" spacing={2} sx={{mb:2}}>
          <Box component="h1" sx={{flexGrow:1, m:0, fontSize:20}}>
            Моніторинг 3D принтерів
          </Box>

          <IconButton
            onClick={()=>setMode(prev=>prev==='light'?'dark':'light')}
            title={mode==='light'?'Увімкнути темну':'Увімкнути світлу'}
          >
            {mode==='light'? <DarkModeIcon/> : <LightModeIcon/>}
          </IconButton>
        </Stack>

        {/* ───── Список принтерів ───── */}
        <PrinterList />
      </Box>
    </ThemeProvider>
  );
}
