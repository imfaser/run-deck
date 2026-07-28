import { isRouteErrorResponse } from 'react-router';

export function getErrorMessage(error: unknown): string {
  if (isRouteErrorResponse(error)) {
    return error.status === 404 ? 'Page not found' : error.statusText;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Something went wrong';
}
