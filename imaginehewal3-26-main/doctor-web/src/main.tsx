import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '@fontsource/source-serif-4/400.css';
import '@fontsource/source-serif-4/600.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import './styles.css';
import { applyTheme, savedTheme } from './theme';

applyTheme(savedTheme());

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
