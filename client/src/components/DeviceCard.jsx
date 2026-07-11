import { useEffect, useRef, useState } from 'react';
import {
  Lightbulb,
  Power,
  Zap,
  Fan,
  DoorOpen,
  DoorClosed,
  Blinds,
  Activity,
  Thermometer,
  CircleDot,
  Loader2,
  Pencil
} from 'lucide-react';
import { useToggleDevice, usePulseDevice } from '../hooks/useDevices';
import { useToast } from './Toast';

const iconMap = {
  light: Lightbulb,
  switch: Power,
  pulse: Zap,
  fan: Fan,
  door: DoorOpen,
  blind: Blinds,
  sensor: Activity,
  thermostat: Thermometer,
  other: CircleDot
};

// Amber = physical light burning; cyan = digital/system action; the rest are
// quieter identities. "on" is the icon color, "bg" the icon backplate.
const colorMap = {
  light: { on: 'text-amber-300', off: 'text-dark-500', bg: 'bg-amber-400/15' },
  switch: { on: 'text-primary-300', off: 'text-dark-500', bg: 'bg-primary-400/10' },
  pulse: { on: 'text-primary-300', off: 'text-primary-300/80', bg: 'bg-primary-400/10' },
  fan: { on: 'text-cyan-300', off: 'text-dark-500', bg: 'bg-cyan-400/10' },
  door: { on: 'text-green-400', off: 'text-red-400', bg: 'bg-green-400/10' },
  blind: { on: 'text-orange-300', off: 'text-dark-500', bg: 'bg-orange-400/10' },
  sensor: { on: 'text-purple-300', off: 'text-dark-500', bg: 'bg-purple-400/10' },
  thermostat: { on: 'text-red-400', off: 'text-dark-500', bg: 'bg-red-400/10' },
  other: { on: 'text-dark-300', off: 'text-dark-500', bg: 'bg-dark-400/10' }
};

// How long a pulse button stays locked after firing, so a double tap can't
// send two impulses to the actuator.
const PULSE_LOCKOUT_MS = 1500;

function DeviceCard({ device, compact = false, editMode = false, onEdit }) {
  const [isToggling, setIsToggling] = useState(false);
  const [pulseLocked, setPulseLocked] = useState(false);
  const [justFired, setJustFired] = useState(false);
  const [wsFlash, setWsFlash] = useState(false);
  const toggleDevice = useToggleDevice();
  const pulseDevice = usePulseDevice();
  const toast = useToast();

  const isPulse = (device.device_type || 'switch') === 'pulse';
  const isOn = !isPulse && (device.current_value === 'true' || device.current_value === '1');
  const deviceType = device.device_type || 'switch';
  const Icon = iconMap[deviceType] || CircleDot;
  const colors = colorMap[deviceType] || colorMap.other;

  // For doors, show different icon based on state
  const ActualIcon = deviceType === 'door' ? (isOn ? DoorOpen : DoorClosed) : Icon;

  // Flash the card when a bus telegram changes its state (pushed via WebSocket).
  const prevValue = useRef(device.current_value);
  useEffect(() => {
    if (prevValue.current !== device.current_value) {
      prevValue.current = device.current_value;
      setWsFlash(true);
      const t = setTimeout(() => setWsFlash(false), 950);
      return () => clearTimeout(t);
    }
  }, [device.current_value]);

  const firePulse = async () => {
    if (pulseLocked) return;
    setPulseLocked(true);
    setJustFired(true);
    setTimeout(() => setJustFired(false), 650);
    setTimeout(() => setPulseLocked(false), PULSE_LOCKOUT_MS);
    try {
      await pulseDevice.mutateAsync(device.address);
      toast(`Impulso inviato a ${device.name || device.address}`, 'success');
    } catch (error) {
      // The global mutation cache already toasts the error.
      console.error('Pulse failed:', error);
    }
  };

  const handleClick = async () => {
    // In edit mode the card is an editing affordance, not a switch — clicking
    // opens the config modal instead of actuating the device.
    if (editMode) {
      onEdit?.(device);
      return;
    }
    if (!device.is_controllable) return;

    if (isPulse) {
      firePulse();
      return;
    }

    if (isToggling) return;
    setIsToggling(true);
    try {
      await toggleDevice.mutateAsync(device.address);
    } catch (error) {
      console.error('Toggle failed:', error);
    } finally {
      setIsToggling(false);
    }
  };

  const disabled = !editMode && (!device.is_controllable || (isPulse ? pulseLocked : isToggling));

  if (compact) {
    return (
      <button
        onClick={handleClick}
        disabled={disabled}
        className={`
          device-card card p-4 w-full text-left relative
          ${isOn && !editMode ? 'on' : ''}
          ${wsFlash ? 'ws-flash' : ''}
          ${editMode ? 'cursor-pointer hover:border-primary-500 ring-1 ring-primary-500/30' : (device.is_controllable ? 'cursor-pointer hover:border-dark-500' : 'cursor-default opacity-75')}
        `}
      >
        {editMode && (
          <span className="absolute top-2 right-2 text-primary-400"><Pencil className="w-3.5 h-3.5" /></span>
        )}
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg shrink-0 ${isOn || isPulse ? colors.bg : 'bg-dark-700'} ${justFired ? 'animate-pulse-fire' : ''}`}>
            {isToggling ? (
              <Loader2 className="w-5 h-5 text-dark-400 animate-spin" />
            ) : (
              <ActualIcon className={`w-5 h-5 ${isOn ? colors.on : colors.off}`} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-white break-words" title={device.name || device.address}>
              {device.name || device.address}
            </p>
            <p className="font-mono text-[11px] tracking-tight text-dark-400">{device.address}</p>
          </div>
          {isPulse ? (
            <Zap className="w-3.5 h-3.5 text-primary-400/70 shrink-0" />
          ) : (
            <div className={`w-2 h-2 rounded-full shrink-0 ${isOn ? 'bg-amber-400 shadow-lamp-sm' : 'bg-dark-600'}`} />
          )}
        </div>
      </button>
    );
  }

  // Full-size pulse card: a momentary industrial push button. No on/off state,
  // no status chip — pressing it fires one impulse on the bus.
  if (isPulse && !editMode) {
    return (
      <button
        onClick={handleClick}
        disabled={disabled}
        className={`
          device-card card p-6 w-full text-left relative
          ${wsFlash ? 'ws-flash' : ''}
          ${device.is_controllable ? 'cursor-pointer hover:border-primary-500/50' : 'cursor-default opacity-75'}
        `}
      >
        <div className="flex flex-col items-center text-center">
          {/* Bezel ring + button face */}
          <div className={`
            mb-4 rounded-full p-1.5 border transition-colors
            ${pulseLocked ? 'border-dark-600' : 'border-primary-500/40'}
          `}>
            <div className={`
              w-14 h-14 rounded-full flex items-center justify-center transition-all
              bg-gradient-to-b from-dark-700 to-dark-800
              ${justFired ? 'animate-pulse-fire scale-95' : ''}
              ${pulseLocked ? 'opacity-60' : ''}
            `}>
              <Zap className={`w-7 h-7 transition-colors ${justFired ? 'text-primary-300' : 'text-primary-400/90'}`} />
            </div>
          </div>

          <h3 className="font-semibold text-white mb-1 w-full break-words leading-tight" title={device.name || ''}>
            {device.name || 'Dispositivo senza nome'}
          </h3>

          <p className="ga-chip mb-3">{device.address}</p>

          <div className="px-3 py-1 rounded-full text-xs font-medium bg-primary-500/10 text-primary-300 border border-primary-500/20">
            {pulseLocked ? 'Inviato ✓' : 'Invia impulso'}
          </div>
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={`
        device-card card p-6 w-full text-left relative
        ${isOn && !editMode ? 'on' : ''}
        ${wsFlash ? 'ws-flash' : ''}
        ${editMode ? 'cursor-pointer hover:border-primary-500 ring-1 ring-primary-500/30' : (device.is_controllable ? 'cursor-pointer hover:border-dark-500' : 'cursor-default opacity-75')}
      `}
    >
      {editMode && (
        <span className="absolute top-2 right-2 text-primary-400"><Pencil className="w-4 h-4" /></span>
      )}
      <div className="flex flex-col items-center text-center">
        {/* Icon */}
        <div className={`p-4 rounded-2xl mb-4 transition-colors ${isOn ? colors.bg : 'bg-dark-700'}`}>
          {isToggling ? (
            <Loader2 className="w-8 h-8 text-dark-400 animate-spin" />
          ) : (
            <ActualIcon className={`w-8 h-8 transition-colors ${isOn ? colors.on : colors.off}`} />
          )}
        </div>

        {/* Name (wraps fully so long names stay readable on every screen) */}
        <h3 className="font-semibold text-white mb-1 w-full break-words leading-tight" title={device.name || ''}>
          {device.name || 'Dispositivo senza nome'}
        </h3>

        {/* Address — bus data reads as bus data: monospace tag */}
        <p className="ga-chip mb-3">{device.address}</p>

        {/* Status */}
        <div className={`
          px-3 py-1 rounded-full text-xs font-medium transition-colors
          ${isOn
            ? 'bg-amber-400/15 text-amber-300 border border-amber-400/25'
            : 'bg-dark-700 text-dark-400 border border-transparent'
          }
        `}>
          {deviceType === 'pulse'
            ? 'Impulso'
            : deviceType === 'door'
              ? (isOn ? 'Aperta' : 'Chiusa')
              : deviceType === 'sensor'
                ? (isOn ? 'Attivo' : 'Inattivo')
                : (isOn ? 'Accesa' : 'Spenta')
          }
        </div>
      </div>
    </button>
  );
}

export default DeviceCard;
