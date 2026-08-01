import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import { preloadAppData } from '@/services/preload';
import App from './App';
import './index.css';

async function bootstrap() {
  const { config } = await preloadAppData();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App config={config} />
      <Toaster position="bottom-right" richColors />
    </StrictMode>
  );
}

bootstrap();
