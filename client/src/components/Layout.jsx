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
  User
} from 'lucide-react';

const navItems = [
  { to: '/', icon: Home, label: 'Dashboard' },
  { to: '/devices', icon: LayoutGrid, label: 'Dispositivi' },
  { to: '/rooms', icon: Layers, label: 'Stanze' },
  { to: '/discovery', icon: Radio, label: 'Discovery' },
  { to: '/topology', icon: Network, label: 'Topologia' }
];

function Layout({ children, connected, knxStatus, user, onLogout }) {
  return (
    <div className="flex h-screen bg-dark-900">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 bg-dark-800 border-r border-dark-700 flex-col">
        <div className="p-6 border-b border-dark-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
              <Home className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">KNX Controller</h1>
              <p className="text-xs text-dark-400">Domotica</p>
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
                    `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-primary-600 text-white'
                        : 'text-dark-300 hover:bg-dark-700 hover:text-white'
                    }`
                  }
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-4 border-t border-dark-700">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-dark-400">WebSocket</span>
              <div className="flex items-center gap-2">
                {connected ? (
                  <><Wifi className="w-4 h-4 text-green-500" /><span className="text-green-500">Connesso</span></>
                ) : (
                  <><WifiOff className="w-4 h-4 text-red-500" /><span className="text-red-500">Disconnesso</span></>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-dark-400">Gateway KNX</span>
              <div className="flex items-center gap-2">
                {knxStatus?.connected ? (
                  <><Activity className="w-4 h-4 text-green-500 status-pulse" /><span className="text-green-500">Online</span></>
                ) : (
                  <><Activity className="w-4 h-4 text-red-500" /><span className="text-red-500">Offline</span></>
                )}
              </div>
            </div>
            {knxStatus?.gateway && (
              <div className="text-xs text-dark-500 text-center">
                {knxStatus.gateway}:{knxStatus.port}
              </div>
            )}
          </div>
        </div>

        {user && (
          <div className="p-4 border-t border-dark-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-dark-400" />
                <span className="text-dark-300">{user.username}</span>
              </div>
              <button
                onClick={onLogout}
                className="p-2 text-dark-400 hover:text-red-400 hover:bg-dark-700 rounded-lg transition-colors"
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
        <header className="lg:hidden flex items-center justify-between px-4 h-14 bg-dark-800 border-b border-dark-700 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <Home className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-white">KNX Controller</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5" title={knxStatus?.connected ? 'KNX online' : 'KNX offline'}>
              <Activity className={`w-4 h-4 ${knxStatus?.connected ? 'text-green-500 status-pulse' : 'text-red-500'}`} />
            </span>
            <span title={connected ? 'WebSocket connesso' : 'WebSocket disconnesso'}>
              {connected ? <Wifi className="w-4 h-4 text-green-500" /> : <WifiOff className="w-4 h-4 text-red-500" />}
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
          className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-dark-800 border-t border-dark-700 flex"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center gap-0.5 py-2 transition-colors ${
                  isActive ? 'text-primary-400' : 'text-dark-400'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium leading-none">{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}

export default Layout;
