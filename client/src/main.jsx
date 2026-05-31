import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider, MutationCache } from '@tanstack/react-query';
import App from './App';
import { ToastProvider, toast } from './components/Toast';
import { AuthError } from './api';
import './index.css';

const queryClient = new QueryClient({
  // Any failed mutation surfaces an error toast, so a save/toggle/delete that
  // fails is no longer a silent console.error. Auth errors are handled by the
  // global redirect-to-login flow, so we don't toast those.
  mutationCache: new MutationCache({
    onError: (error) => {
      if (error instanceof AuthError) return;
      toast(error?.message || 'Operazione non riuscita', 'error');
    }
  }),
  defaultOptions: {
    queries: {
      staleTime: 5000,
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <App />
      </ToastProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
