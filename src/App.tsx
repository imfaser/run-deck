import { RouterProvider, createBrowserRouter, Navigate } from 'react-router';
import RootLayout from '@/routes/root';
import ErrorPage from '@/routes/error';
import Overview from '@/pages/Overview';
import Config from '@/pages/Config';
import NotFound from '@/pages/NotFound';

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <Navigate to="/overview" replace /> },
      { path: 'overview', element: <Overview /> },
      { path: 'config', element: <Config /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
