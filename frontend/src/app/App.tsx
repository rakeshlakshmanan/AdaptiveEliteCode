import { RouterProvider } from 'react-router';
import { router } from './routes';
import { useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';

export default function App() {
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    }
  }, []);

  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
