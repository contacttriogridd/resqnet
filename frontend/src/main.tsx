import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { bootstrap } from './bootstrap';
import { initPwa } from './offline/pwa';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Start offline machinery after first paint; the UI already works from local data.
void bootstrap();
void initPwa();
