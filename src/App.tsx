import { RouterProvider } from '@tanstack/react-router';
import { SWRConfig } from 'swr';
import { ThemeProvider } from '@/components/theme-provider';
import { router } from '@/router';
import { swrConfig } from '@/services/query-client';
import type { Config } from '@/schemas/config';

function App({ config }: { config: Config }) {
  return (
    <ThemeProvider defaultTheme={config.frontend.mode}>
      <SWRConfig value={{ ...swrConfig, fallback: { config } }}>
        <RouterProvider router={router} />
      </SWRConfig>
    </ThemeProvider>
  );
}

export default App;
