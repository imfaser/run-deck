import { SWRConfig } from 'swr';

export const swrConfig = {
  dedupingInterval: 2000,
  errorRetryCount: 3,
  errorRetryInterval: 5000,
  revalidateOnFocus: false,
};

export { SWRConfig };
