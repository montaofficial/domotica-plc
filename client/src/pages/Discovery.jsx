import { useState, useMemo } from 'react';
import { useDiscoveredAddresses } from '../hooks/useDevices';
import DeviceConfigModal from '../components/DeviceConfigModal';
import {
  Radio,
  Loader2,
  AlertCircle,
  Settings,
  Clock,
  ArrowRight,
  RefreshCw
} from 'lucide-react';

function Discovery({ recentTelegrams = [] }) {
  const { data: discovered = [], isLoading, error, refetch } = useDiscoveredAddresses();
  const [configuringDevice, setConfiguringDevice] = useState(null);
  const [showTelegrams, setShowTelegrams] = useState(true);

  // Get unique addresses from recent telegrams
  const recentAddresses = useMemo(() => {
    const addressMap = new Map();
    recentTelegrams.forEach(t => {
      if (!addressMap.has(t.dst)) {
        addressMap.set(t.dst, t);
      }
    });
    return Array.from(addressMap.values()).slice(0, 20);
  }, [recentTelegrams]);

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Discovery</h1>
          <p className="text-dark-400">View and configure discovered KNX devices</p>
        </div>
        <button
          onClick={() => refetch()}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Live Telegrams */}
      {showTelegrams && (
        <div className="card">
          <div className="flex items-center justify-between p-4 border-b border-dark-700">
            <div className="flex items-center gap-2">
              <Radio className="w-5 h-5 text-green-500 animate-pulse" />
              <h2 className="font-semibold text-white">Live Telegrams</h2>
              <span className="text-xs text-dark-400">
                ({recentTelegrams.length} received)
              </span>
            </div>
            <button
              onClick={() => setShowTelegrams(false)}
              className="text-xs text-dark-400 hover:text-dark-300"
            >
              Hide
            </button>
          </div>

          <div className="max-h-48 overflow-y-auto scrollbar-thin">
            {recentTelegrams.length === 0 ? (
              <div className="p-8 text-center text-dark-400">
                <Radio className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Waiting for KNX telegrams...</p>
                <p className="text-xs mt-1">
                  Trigger a device (switch, motion sensor, etc.) to see activity
                </p>
              </div>
            ) : (
              <table className="w-full">
                <tbody className="divide-y divide-dark-700/50">
                  {recentTelegrams.slice(0, 10).map((telegram, index) => (
                    <tr key={index} className="text-sm hover:bg-dark-700/30">
                      <td className="px-4 py-2 text-dark-400 whitespace-nowrap">
                        <Clock className="w-3 h-3 inline mr-1" />
                        {formatTime(telegram.timestamp)}
                      </td>
                      <td className="px-4 py-2">
                        <code className="text-dark-300">{telegram.src}</code>
                      </td>
                      <td className="px-4 py-2 text-dark-500">
                        <ArrowRight className="w-3 h-3" />
                      </td>
                      <td className="px-4 py-2">
                        <code className="text-primary-400">{telegram.dst}</code>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`
                          px-2 py-0.5 rounded text-xs
                          ${telegram.decodedValue ? 'bg-green-500/20 text-green-400' : 'bg-dark-700 text-dark-400'}
                        `}>
                          {telegram.decodedValue !== null
                            ? (telegram.decodedValue ? 'ON' : 'OFF')
                            : telegram.rawHex || '-'
                          }
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-dark-500">
                        {telegram.type}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {!showTelegrams && (
        <button
          onClick={() => setShowTelegrams(true)}
          className="text-sm text-primary-400 hover:text-primary-300"
        >
          Show live telegrams
        </button>
      )}

      {/* Discovered Addresses */}
      <div className="card">
        <div className="p-4 border-b border-dark-700">
          <h2 className="font-semibold text-white">Unconfigured Addresses</h2>
          <p className="text-sm text-dark-400">
            These addresses have been seen on the bus but not configured yet
          </p>
        </div>

        {discovered.length === 0 ? (
          <div className="p-12 text-center text-dark-400">
            <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">All discovered addresses are configured!</p>
            <p className="text-sm mt-2">
              New addresses will appear here when detected on the KNX bus
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-dark-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-dark-400 uppercase">
                    Address
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-dark-400 uppercase">
                    Last Value
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-dark-400 uppercase">
                    Last Activity
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-dark-400 uppercase">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {discovered.map(device => {
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
                        <span className={`
                          inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium
                          ${isOn
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-dark-700 text-dark-400'
                          }
                        `}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isOn ? 'bg-green-400' : 'bg-dark-500'}`} />
                          {device.current_value !== null
                            ? (isOn ? 'ON' : 'OFF')
                            : 'Unknown'
                          }
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-dark-400">
                        {lastActivity}
                      </td>
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

      {/* Recent Activity Summary */}
      {recentAddresses.length > 0 && (
        <div className="card p-4">
          <h3 className="font-medium text-white mb-3">Recent Active Addresses</h3>
          <div className="flex flex-wrap gap-2">
            {recentAddresses.map(t => (
              <button
                key={t.dst}
                onClick={() => {
                  const device = discovered.find(d => d.address === t.dst);
                  if (device) setConfiguringDevice(device);
                }}
                className="px-3 py-1.5 bg-dark-700 hover:bg-dark-600 rounded-lg text-sm transition-colors"
              >
                <code className="text-primary-400">{t.dst}</code>
                <span className="ml-2 text-dark-400">
                  {t.decodedValue !== null ? (t.decodedValue ? 'ON' : 'OFF') : '-'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Configure Modal */}
      <DeviceConfigModal
        device={configuringDevice}
        isOpen={!!configuringDevice}
        onClose={() => setConfiguringDevice(null)}
      />
    </div>
  );
}

export default Discovery;
