import { NavLink } from 'react-router-dom';
import {
  Home,
  LayoutGrid,
  Layers,
  Radio,
  Wifi,
  WifiOff,
  Activity,
  LogOut,
  User
} from 'lucide-react';

const navItems = [
  { to: '/', icon: Home, label: 'Dashboard' },
  { to: '/devices', icon: LayoutGrid, label: 'Devices' },
  { to: '/rooms', icon: Layers, label: 'Rooms' },
  { to: '/discovery', icon: Radio, label: 'Discovery' }
];

function Layout({ children, connected, knxStatus, user, onLogout }) {
  return (
    <div className="flex h-screen bg-dark-900">
      {/* Sidebar */}
      <aside className="w-64 bg-dark-800 border-r border-dark-700 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-dark-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
              <Home className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">KNX Controller</h1>
              <p className="text-xs text-dark-400">Home Automation</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
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

        {/* Connection Status */}
        <div className="p-4 border-t border-dark-700">
          <div className="space-y-3">
            {/* WebSocket Status */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-dark-400">WebSocket</span>
              <div className="flex items-center gap-2">
                {connected ? (
                  <>
                    <Wifi className="w-4 h-4 text-green-500" />
                    <span className="text-green-500">Connected</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-4 h-4 text-red-500" />
                    <span className="text-red-500">Disconnected</span>
                  </>
                )}
              </div>
            </div>

            {/* KNX Gateway Status */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-dark-400">KNX Gateway</span>
              <div className="flex items-center gap-2">
                {knxStatus?.connected ? (
                  <>
                    <Activity className="w-4 h-4 text-green-500 status-pulse" />
                    <span className="text-green-500">Online</span>
                  </>
                ) : (
                  <>
                    <Activity className="w-4 h-4 text-red-500" />
                    <span className="text-red-500">Offline</span>
                  </>
                )}
              </div>
            </div>

            {/* Gateway IP */}
            {knxStatus?.gateway && (
              <div className="text-xs text-dark-500 text-center">
                {knxStatus.gateway}:{knxStatus.port}
              </div>
            )}
          </div>
        </div>

        {/* User / Logout */}
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
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto scrollbar-thin">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

export default Layout;
