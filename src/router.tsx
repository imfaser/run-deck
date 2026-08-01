import { createRouter, createHashHistory } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';
import { ErrorComponent } from './routes/-error';
import { NotFoundComponent } from './routes/-not-found';

export const router = createRouter({
  routeTree,
  history: createHashHistory(),
  defaultErrorComponent: ErrorComponent,
  defaultNotFoundComponent: NotFoundComponent,
  scrollRestoration: true,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
