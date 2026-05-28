import { useState } from 'react';
import {
  Lightbulb,
  Power,
  Fan,
  DoorOpen,
  DoorClosed,
  Blinds,
  Activity,
  Thermometer,
  CircleDot,
  Loader2
} from 'lucide-react';
import { useToggleDevice } from '../hooks/useDevices';

const iconMap = {
  light: Lightbulb,
  switch: Power,
  fan: Fan,
  door: DoorOpen,
  blind: Blinds,
  sensor: Activity,
  thermostat: Thermometer,
  other: CircleDot
};

const colorMap = {
  light: { on: 'text-yellow-400', off: 'text-dark-500', bg: 'bg-yellow-400/10' },
  switch: { on: 'text-primary-400', off: 'text-dark-500', bg: 'bg-primary-400/10' },
  fan: { on: 'text-cyan-400', off: 'text-dark-500', bg: 'bg-cyan-400/10' },
  door: { on: 'text-green-400', off: 'text-red-400', bg: 'bg-green-400/10' },
  blind: { on: 'text-orange-400', off: 'text-dark-500', bg: 'bg-orange-400/10' },
  sensor: { on: 'text-purple-400', off: 'text-dark-500', bg: 'bg-purple-400/10' },
  thermostat: { on: 'text-red-400', off: 'text-dark-500', bg: 'bg-red-400/10' },
  other: { on: 'text-dark-300', off: 'text-dark-500', bg: 'bg-dark-400/10' }
};

function DeviceCard({ device, compact = false }) {
  const [isToggling, setIsToggling] = useState(false);
  const toggleDevice = useToggleDevice();

  const isOn = device.current_value === 'true' || device.current_value === '1';
  const deviceType = device.device_type || 'switch';
  const Icon = iconMap[deviceType] || CircleDot;
  const colors = colorMap[deviceType] || colorMap.other;

  // For doors, show different icon based on state
  const DoorIcon = deviceType === 'door' ? (isOn ? DoorOpen : DoorClosed) : Icon;
  const ActualIcon = deviceType === 'door' ? DoorIcon : Icon;

  const handleToggle = async () => {
    if (!device.is_controllable || isToggling) return;

    setIsToggling(true);
    try {
      await toggleDevice.mutateAsync(device.address);
    } catch (error) {
      console.error('Toggle failed:', error);
    } finally {
      setIsToggling(false);
    }
  };

  if (compact) {
    return (
      <button
        onClick={handleToggle}
        disabled={!device.is_controllable || isToggling}
        className={`
          device-card card p-4 w-full text-left transition-all
          ${isOn ? 'on' : ''}
          ${device.is_controllable ? 'cursor-pointer hover:border-dark-600' : 'cursor-default opacity-75'}
        `}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isOn ? colors.bg : 'bg-dark-700'}`}>
            {isToggling ? (
              <Loader2 className="w-5 h-5 text-dark-400 animate-spin" />
            ) : (
              <ActualIcon className={`w-5 h-5 ${isOn ? colors.on : colors.off}`} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-white truncate">
              {device.name || device.address}
            </p>
            <p className="text-xs text-dark-400">{device.address}</p>
          </div>
          <div className={`w-2 h-2 rounded-full ${isOn ? 'bg-green-500' : 'bg-dark-600'}`} />
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={handleToggle}
      disabled={!device.is_controllable || isToggling}
      className={`
        device-card card p-6 w-full text-left transition-all
        ${isOn ? 'on' : ''}
        ${device.is_controllable ? 'cursor-pointer hover:border-dark-600' : 'cursor-default opacity-75'}
      `}
    >
      <div className="flex flex-col items-center text-center">
        {/* Icon */}
        <div className={`p-4 rounded-2xl mb-4 ${isOn ? colors.bg : 'bg-dark-700'}`}>
          {isToggling ? (
            <Loader2 className="w-8 h-8 text-dark-400 animate-spin" />
          ) : (
            <ActualIcon className={`w-8 h-8 ${isOn ? colors.on : colors.off}`} />
          )}
        </div>

        {/* Name */}
        <h3 className="font-semibold text-white mb-1 truncate w-full">
          {device.name || 'Unnamed Device'}
        </h3>

        {/* Address */}
        <p className="text-xs text-dark-400 mb-3">{device.address}</p>

        {/* Status */}
        <div className={`
          px-3 py-1 rounded-full text-xs font-medium
          ${isOn
            ? 'bg-green-500/20 text-green-400'
            : 'bg-dark-700 text-dark-400'
          }
        `}>
          {deviceType === 'door'
            ? (isOn ? 'Open' : 'Closed')
            : deviceType === 'sensor'
              ? (isOn ? 'Active' : 'Inactive')
              : (isOn ? 'ON' : 'OFF')
          }
        </div>
      </div>
    </button>
  );
}

export default DeviceCard;
