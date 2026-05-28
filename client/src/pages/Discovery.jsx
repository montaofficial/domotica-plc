import { useState, useMemo } from 'react';
import { useDiscoveredAddresses } from '../hooks/useDevices';
import { useLearnState } from '../hooks/useLearn';
import { groupAddressesApi } from '../api';
import DeviceConfigModal from '../components/DeviceConfigModal';
import LearnPanel from '../components/learn/LearnPanel';
import {
  Radio,
  Loader2,
  AlertCircle,
  Settings,
  Clock,
  ArrowRight
} from 'lucide-react';

function Discovery({
  recentTelegrams = [],
  learnState: learnStateProp,
  learnCalibration,
  learnDetections = []
}) {
  const { data: discovered = [], isLoading, error } = useDiscoveredAddresses();
  // Fallback for the very first render: WebSocket hasn't pushed learn_state yet.
  const { data: initialLearnState } = useLearnState();
  const learnState = learnStateProp ?? initialLearnState ?? null;

  const [configuringDevice, setConfiguringDevice] = useState(null);
  const [showLiveBus, setShowLiveBus] = useState(false);

  const recentAddresses = useMemo(() => {
    const addressMap = new Map();
    recentTelegrams.forEach((t) => {
      if (!addressMap.has(t.dst)) addressMap.set(t.dst, t);
    });
    return Array.from(addressMap.values()).slice(0, 20);
  }, [recentTelegrams]);

  const handleConfigureDetection = async (detection) => {
    // The KNX service auto-upserts a GA on every GroupWrite/Response, so by
    // the time a detection lands the GA exists in the DB. The polled
    // `discovered` list can be a few seconds stale though — fall back to a
    // direct lookup by address if we miss it locally.
    const local = discovered.find((d) => d.address === detection.dst);
    if (local) {
      setConfiguringDevice(local);
      return;
    }
    try {
      const ga = await groupAddressesApi.getByAddress(detection.dst);
      setConfiguringDevice(ga);
    } catch (e) {
      console.warn('[Discovery] GA not yet in DB for', detection.dst, e);
    }
  };

  const formatTime = (ts) => new Date(ts).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-400">Failed to load discovered addresses</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Discovery</h1>
        <p className="text-dark-400">
          Trova un dispositivo nuovo filtrando il rumore del bus. Una volta
          imparato il rumore di fondo, qui sotto vedi solo gli eventi inediti.
        </p>
      </div>

      {/* Adaptive Learn flow (the main story) */}
      <LearnPanel
        learnState={learnState}
        calibration={learnCalibration}
        detections={learnDetections}
        onConfigureDetection={handleConfigureDetection}
      />

      {/* Live bus (collapsible — disabled by default so it doesn't compete with Learn) */}
      <div className="card">
        <button
          onClick={() => setShowLiveBus((v) => !v)}
          className="w-full p-3 flex items-center justify-between text-left hover:bg-dark-700/30"
        >
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-green-500" />
            <span className="font-medium text-white text-sm">Bus live (non filtrato)</span>
            <span className="text-xs text-dark-400">({recentTelegrams.length} in cache)</span>
          </div>
          <span className="text-xs text-dark-400">{showLiveBus ? 'Nascondi' : 'Mostra'}</span>
        </button>
        {showLiveBus && (
          <div className="border-t border-dark-700 max-h-56 overflow-y-auto scrollbar-thin">
            {recentTelegrams.length === 0 ? (
              <div className="p-6 text-center text-dark-400 text-sm">In attesa…</div>
            ) : (
              <table className="w-full">
                <tbody className="divide-y divide-dark-700/50">
                  {recentTelegrams.slice(0, 20).map((t, i) => (
                    <tr key={i} className="text-sm hover:bg-dark-700/30">
                      <td className="px-3 py-1.5 text-dark-400 whitespace-nowrap">
                        <Clock className="w-3 h-3 inline mr-1" />
                        {formatTime(t.timestamp)}
                      </td>
                      <td className="px-3 py-1.5"><code className="text-dark-300">{t.src}</code></td>
                      <td className="px-3 py-1.5 text-dark-500"><ArrowRight className="w-3 h-3" /></td>
                      <td className="px-3 py-1.5"><code className="text-primary-400">{t.dst}</code></td>
                      <td className="px-3 py-1.5 text-xs text-dark-500">{t.type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Discovered, unconfigured addresses (background discovery — keeps working as before) */}
      <div className="card">
        <div className="p-4 border-b border-dark-700">
          <h2 className="font-semibold text-white">Unconfigured Addresses</h2>
          <p className="text-sm text-dark-400">
            Indirizzi visti sul bus ma non ancora configurati come dispositivi.
          </p>
        </div>

        {discovered.length === 0 ? (
          <div className="p-10 text-center text-dark-400">
            <Settings className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="font-medium">Tutto configurato.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-dark-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-dark-400 uppercase">Address</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-dark-400 uppercase">Last Value</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-dark-400 uppercase">Last Activity</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-dark-400 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {discovered.map((device) => {
                  const isOn = device.current_value === 'true' || device.current_value === '1';
                  const lastActivity = device.last_activity
                    ? new Date(device.last_activity).toLocaleString()
                    : 'Unknown';
                  return (
                    <tr key={device.id} className="hover:bg-dark-700/50">
                      <td className="px-4 py-3">
                        <code className="text-sm text-primary-400 bg-dark-700 px-2 py-1 rounded">
                          {device.address}
                        </code>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${isOn ? 'bg-green-500/20 text-green-400' : 'bg-dark-700 text-dark-400'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isOn ? 'bg-green-400' : 'bg-dark-500'}`} />
                          {device.current_value !== null ? (isOn ? 'ON' : 'OFF') : 'Unknown'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-dark-400">{lastActivity}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setConfiguringDevice(device)}
                          className="btn-primary text-sm py-1.5"
                        >
                          <Settings className="w-4 h-4 mr-1 inline" />
                          Configure
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {recentAddresses.length > 0 && (
        <div className="card p-4">
          <h3 className="font-medium text-white mb-3">Indirizzi recenti</h3>
          <div className="flex flex-wrap gap-2">
            {recentAddresses.map((t) => (
              <button
                key={t.dst}
                onClick={() => {
                  const device = discovered.find((d) => d.address === t.dst);
                  if (device) setConfiguringDevice(device);
                }}
                className="px-3 py-1.5 bg-dark-700 hover:bg-dark-600 rounded-lg text-sm transition-colors"
              >
                <code className="text-primary-400">{t.dst}</code>
                <span className="ml-2 text-dark-400">
                  {t.decodedValue !== null ? (t.decodedValue ? 'ON' : 'OFF') : '—'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <DeviceConfigModal
        device={configuringDevice}
        isOpen={!!configuringDevice}
        onClose={() => setConfiguringDevice(null)}
      />
    </div>
  );
}

export default Discovery;
