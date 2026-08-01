import { RouterProvider } from '@tanstack/react-router';
import { SWRConfig } from 'swr';
import { router } from '@/router';
import { swrConfig } from '@/services/query-client';
import type { Config } from '@/schemas/config';

function App({ config }: { config: Config }) {
  return (
    <SWRConfig value={{ ...swrConfig, fallback: { config } }}>
      <RouterProvider router={router} />
    </SWRConfig>
  );
}

export default App;
