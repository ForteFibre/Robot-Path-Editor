import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { exposeBenchmarkApi } from './bench/benchmarkExpose';
import { initializeThemePreference } from './features/theme/themePreference';

initializeThemePreference();
exposeBenchmarkApi();

const rootElement = document.getElementById('root');

if (rootElement === null) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
