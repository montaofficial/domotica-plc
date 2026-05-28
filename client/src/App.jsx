import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from './api';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Devices from './pages/Devices';
import Rooms from './pages/Rooms';
import Discovery from './pages/Discovery';
import useWebSocket from './hooks/useWebSocket';
import { Loader2 } from 'lucide-react';

function App() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [recentTelegrams, setRecentTelegrams] = useState([]);

  // Check auth status on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const status = await authApi.status();
        if (status.authenticated) {
          setUser(status.user);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setAuthChecked(true);
      }
    };
    checkAuth();
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
    setUser(null);
    queryClient.clear();
  };

  const handleWebSocketMessage = useCallback((message) => {
    switch (message.type) {
      case 'telegram':
        setRecentTelegrams(prev => [message.data, ...prev.slice(0, 99)]);
        break;

      case 'state_change':
        queryClient.invalidateQueries({ queryKey: ['groupAddresses'] });
        break;

      case 'device_discovered':
      case 'group_address_discovered':
        queryClient.invalidateQueries({ queryKey: ['groupAddresses', 'discovered'] });
        queryClient.invalidateQueries({ queryKey: ['groupAddresses'] });
        break;

      default:
        break;
    }
  }, [queryClient]);

  // Only connect WebSocket when authenticated
  const { connected, knxStatus } = useWebSocket(
    user ? handleWebSocketMessage : null
  );

  // Show loading while checking auth
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  // Show login if not authenticated
  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <BrowserRouter>
      <Layout
        connected={connected}
        knxStatus={knxStatus}
        user={user}
        onLogout={handleLogout}
      >
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/devices" element={<Devices />} />
          <Route path="/rooms" element={<Rooms />} />
          <Route
            path="/discovery"
            element={<Discovery recentTelegrams={recentTelegrams} />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
