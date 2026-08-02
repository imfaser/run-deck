import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import { preloadAppData } from '@/services/preload';
import { logMessage } from '@/services/cmds';
import App from './App';
import './index.css';

function setupGlobalErrorLogging() {
  window.addEventListener('error', (e) => {
    logMessage('error', `[global] uncaught error: ${e.message}`).catch(() => {});
  });
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason instanceof Error ? e.reason.message : String(e.reason);
    logMessage('error', `[global] unhandled rejection: ${reason}`).catch(() => {});
  });
}

async function bootstrap() {
  setupGlobalErrorLogging();
  await preloadAppData();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
      <Toaster position="top-center" offset={44} richColors />
    </StrictMode>
  );
}

bootstrap();
