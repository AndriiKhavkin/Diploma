// src/theme.js
import { createTheme } from '@mui/material/styles';

// базові кольори, шрифти, радіуси …
const base = {
  shape: { borderRadius: 6 },
  typography: { fontFamily: '"Roboto", sans-serif' },
};

export const lightTheme = createTheme({
  ...base,
  palette: {
    mode: 'light',
    primary:  { main: '#424242' },
    secondary:{ main: '#616161' },
    background:{ paper:'#fafafa', default:'#f5f5f5' },
    text:      { primary:'#212121', secondary:'#424242' },
  },
});

export const darkTheme  = createTheme({
  ...base,
  palette: {
    mode: 'dark',
    primary:  { main: '#90caf9' },
    secondary:{ main: '#f48fb1' },
    background:{ paper:'#303030', default:'#212121' },
    text:      { primary:'#e0e0e0', secondary:'#bdbdbd' },
  },
  components:{
    /* щоб у темному режимі текст “text/outlined”‑кнопок був видимий */
    MuiButton:{
      styleOverrides:{
        root:{ color:'#e0e0e0' },
        outlined:{ borderColor:'#555' },
      },
    },
  },
});

/** швидкий хелпер */
export const getTheme = (mode)=> mode==='dark' ? darkTheme : lightTheme;
