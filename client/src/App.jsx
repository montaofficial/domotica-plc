import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from './api';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Devices from './pages/Devices';
import Rooms from './pages/Rooms';
import Discovery from './pages/Discovery';
import Topology from './pages/Topology';
import useWebSocket from './hooks/useWebSocket';
import { Loader2 } from 'lucide-react';

const MAX_DETECTIONS_CACHED = 200;
// On a busy KNX bus (3-4 telegrams/sec) every WS message used to trigger an
// immediate query invalidation -> a GET refetch per message, flooding the
// network. We coalesce invalidations into a single flush per window so a
// burst of messages causes at most one refetch per query key.
const INVALIDATE_WINDOW_MS = 1500;

function App() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [recentTelegrams, setRecentTelegrams] = useState([]);
  const [learnState, setLearnState] = useState(null);
  const [learnCalibration, setLearnCalibration] = useState(null);
  const [learnDetections, setLearnDetections] = useState([]);

  // Coalesced query invalidation: collect dirty query keys and flush them
  // once per INVALIDATE_WINDOW_MS instead of on every WebSocket message.
  const dirtyKeysRef = useRef(new Set());
  const flushTimerRef = useRef(null);

  const scheduleInvalidate = useCallback((key) => {
    dirtyKeysRef.current.add(JSON.stringify(key));
    if (flushTimerRef.current) return; // a flush is already pending
    flushTimerRef.current = setTimeout(() => {
      const keys = [...dirtyKeysRef.current].map((k) => JSON.parse(k));
      dirtyKeysRef.current.clear();
      flushTimerRef.current = null;
      for (const queryKey of keys) {
        queryClient.invalidateQueries({ queryKey });
      }
    }, INVALIDATE_WINDOW_MS);
  }, [queryClient]);

  useEffect(() => () => {
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
  }, []);

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
        scheduleInvalidate(['groupAddresses']);
        break;

      case 'device_discovered':
      case 'group_address_discovered':
        scheduleInvalidate(['groupAddresses', 'discovered']);
        scheduleInvalidate(['groupAddresses']);
        break;

      case 'learn_state': {
        const data = message.data;
        // The live view reads the pushed state directly from React state, so
        // no refetch is needed here. We only nudge the (rarely-mounted)
        // profile/state queries on a coalesced schedule.
        setLearnState(data);
        if (data?.state !== 'calibrating') setLearnCalibration(null);
        // When a session ends or a new one starts, drop the cached detections
        // - on idle: nothing to show; on learning: start fresh.
        if (data?.state !== 'learning') setLearnDetections([]);
        scheduleInvalidate(['learn']);
        break;
      }

      case 'learn_calibrating':
        setLearnCalibration(message.data);
        break;

      case 'learn_detection':
        setLearnDetections(prev => {
          const next = [message.data, ...prev];
          if (next.length > MAX_DETECTIONS_CACHED) next.length = MAX_DETECTIONS_CACHED;
          return next;
        });
        break;

      default:
        break;
    }
  }, [scheduleInvalidate]);

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
            element={
              <Discovery
                recentTelegrams={recentTelegrams}
                learnState={learnState}
                learnCalibration={learnCalibration}
                learnDetections={learnDetections}
              />
            }
          />
          <Route path="/topology" element={<Topology />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
