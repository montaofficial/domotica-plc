import { NavLink } from 'react-router-dom';
import {
  Home,
  LayoutGrid,
  Layers,
  Radio,
  Network,
  Wifi,
  WifiOff,
  Activity,
  LogOut,
  User,
  Zap
} from 'lucide-react';

const navItems = [
  { to: '/', icon: Home, label: 'Dashboard' },
  { to: '/devices', icon: LayoutGrid, label: 'Dispositivi' },
  { to: '/rooms', icon: Layers, label: 'Stanze' },
  { to: '/discovery', icon: Radio, label: 'Discovery' },
  { to: '/topology', icon: Network, label: 'Topologia' }
];

function StatusDot({ ok, pulse = false }) {
  return (
    <span className="relative inline-flex w-2.5 h-2.5">
      {ok && pulse && (
        <span className="absolute inline-flex w-full h-full rounded-full bg-green-400 opacity-40 animate-ping" />
      )}
      <span className={`relative inline-flex w-2.5 h-2.5 rounded-full ${ok ? 'bg-green-400' : 'bg-red-500'}`} />
    </span>
  );
}

function BrandMark({ size = 'md' }) {
  const box = size === 'md' ? 'w-10 h-10 rounded-xl' : 'w-8 h-8 rounded-lg';
  const icon = size === 'md' ? 'w-5 h-5' : 'w-4 h-4';
  return (
    <div className={`${box} shrink-0 bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-glow-cyan`}>
      <Zap className={`${icon} text-dark-950`} strokeWidth={2.5} />
    </div>
  );
}

function Layout({ children, connected, knxStatus, user, onLogout }) {
  return (
    <div className="flex h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 bg-dark-950/60 backdrop-blur-xl border-r border-dark-700/60 flex-col">
        <div className="p-6 border-b border-dark-700/60">
          <div className="flex items-center gap-3">
            <BrandMark />
            <div className="min-w-0">
              <h1 className="font-display text-lg font-bold text-white tracking-tight leading-none">Fortitude</h1>
              <p className="text-[11px] uppercase tracking-[0.18em] text-dark-400 mt-1">Domotica KNX</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4">
          <ul className="space-y-1">
            {navItems.map(({ to, icon: Icon, label }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    `relative flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-primary-500/10 text-primary-300'
                        : 'text-dark-300 hover:bg-dark-800/80 hover:text-white'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-primary-400 shadow-glow-cyan" />
                      )}
                      <Icon className="w-5 h-5" />
                      <span className="font-medium">{label}</span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* System health */}
        <div className="p-4 border-t border-dark-700/60">
          <div className="rounded-xl bg-dark-900/60 border border-dark-700/60 p-3 space-y-2.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-dark-400 flex items-center gap-2">
                {connected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                WebSocket
              </span>
              <span className="flex items-center gap-2">
                <StatusDot ok={connected} />
                <span className={connected ? 'text-green-400 text-xs' : 'text-red-400 text-xs'}>
                  {connected ? 'Connesso' : 'Disconnesso'}
                </span>
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-dark-400 flex items-center gap-2">
                <Activity className="w-3.5 h-3.5" />
                Bus KNX
              </span>
              <span className="flex items-center gap-2">
                <StatusDot ok={!!knxStatus?.connected} pulse />
                <span className={knxStatus?.connected ? 'text-green-400 text-xs' : 'text-red-400 text-xs'}>
                  {knxStatus?.connected ? 'Online' : 'Offline'}
                </span>
              </span>
            </div>
            {knxStatus?.gateway && (
              <div className="pt-1.5 border-t border-dark-700/60">
                <p className="font-mono text-[10px] text-dark-500 text-center tracking-tight" title="Gateway KNX/IP">
                  {knxStatus.gateway}:{knxStatus.port}
                </p>
              </div>
            )}
          </div>
        </div>

        {user && (
          <div className="px-4 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-dark-400" />
                <span className="text-dark-300">{user.username}</span>
              </div>
              <button
                onClick={onLogout}
                className="p-2 text-dark-400 hover:text-red-400 hover:bg-dark-800 rounded-lg transition-colors"
                title="Esci"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Content column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center justify-between px-4 h-14 bg-dark-950/70 backdrop-blur-xl border-b border-dark-700/60 shrink-0 sticky top-0 z-40">
          <div className="flex items-center gap-2.5">
            <BrandMark size="sm" />
            <div className="leading-none">
              <span className="font-display font-bold text-white block leading-none">Fortitude</span>
              <span className="text-[9px] uppercase tracking-[0.18em] text-dark-400">Domotica KNX</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center" title={knxStatus?.connected ? 'Bus KNX online' : 'Bus KNX offline'}>
              <StatusDot ok={!!knxStatus?.connected} pulse />
            </span>
            <span title={connected ? 'WebSocket connesso' : 'WebSocket disconnesso'}>
              {connected ? <Wifi className="w-4 h-4 text-green-400" /> : <WifiOff className="w-4 h-4 text-red-500" />}
            </span>
            {user && (
              <button onClick={onLogout} className="p-1.5 text-dark-400 hover:text-red-400" title="Esci">
                <LogOut className="w-5 h-5" />
              </button>
            )}
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-auto scrollbar-thin">
          <div className="p-4 lg:p-8 pb-24 lg:pb-8">
            {children}
          </div>
        </main>

        {/* Mobile bottom navigation */}
        <nav
          className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-dark-950/80 backdrop-blur-xl border-t border-dark-700/60 flex"
          style={{
            // Keep the row clear of the home indicator AND of the screen's
            // rounded corners, which otherwise clip the first/last tap targets.
            paddingBottom: 'env(safe-area-inset-bottom)',
            paddingLeft: 'env(safe-area-inset-left)',
            paddingRight: 'env(safe-area-inset-right)'
          }}
        >
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                // min-h gives a comfortable ~56px tap target (Apple HIG ≥44px);
                // the old py-2 made the bar too thin to hit reliably.
                `relative flex-1 flex flex-col items-center justify-center gap-1 py-2.5 min-h-[56px] transition-colors ${
                  isActive ? 'text-primary-300' : 'text-dark-400'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute top-0 w-8 h-0.5 rounded-full bg-primary-400" />
                  )}
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium leading-none">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}

export default Layout;
