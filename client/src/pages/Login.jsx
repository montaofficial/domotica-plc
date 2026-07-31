import { useState, useEffect, useCallback } from 'react';
import { Lock, User, Loader2, AlertCircle, Zap, ScanFace } from 'lucide-react';
import { authApi } from '../api';
import { biometricAvailable, biometricEnabled, enableBiometric, loginWithBiometric } from '../lib/biometric';

function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Face ID state: whether the device supports it, whether the user already
  // enabled it, and whether they want to enable it on this manual login.
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [rememberBio, setRememberBio] = useState(false);

  const doBiometricLogin = useCallback(async () => {
    setError('');
    const creds = await loginWithBiometric();
    if (!creds) return; // cancelled/failed — stay on the password form
    setLoading(true);
    try {
      const result = await authApi.login(creds.username, creds.password);
      onLogin(result.user);
    } catch {
      // Stored password no longer valid (e.g. it was changed): fall back.
      setError('Accesso con Face ID non riuscito. Inserisci la password.');
    } finally {
      setLoading(false);
    }
  }, [onLogin]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [avail, enabled] = await Promise.all([biometricAvailable(), biometricEnabled()]);
      if (cancelled) return;
      setBioAvailable(avail);
      setBioEnabled(avail && enabled);
      // Auto-offer Face ID on launch when it's already set up.
      if (avail && enabled) doBiometricLogin();
    })();
    return () => { cancelled = true; };
  }, [doBiometricLogin]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await authApi.login(username, password);
      // Opted in to Face ID on this login: stash the credentials in the Keychain.
      if (rememberBio && bioAvailable) {
        try { await enableBiometric(username, password); } catch { /* non-fatal */ }
      }
      onLogin(result.user);
    } catch (err) {
      setError(err.message === 'Invalid credentials'
        ? 'Nome utente o password non validi'
        : 'Accesso non riuscito. Riprova.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-up">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center mx-auto mb-5 shadow-glow-cyan">
            <Zap className="w-8 h-8 text-dark-950" strokeWidth={2.5} />
          </div>
          <h1 className="font-display text-3xl font-bold text-white tracking-tight">Fortitude</h1>
          <p className="text-[11px] uppercase tracking-[0.22em] text-dark-400 mt-2">Domotica KNX</p>
        </div>

        {/* Login Card */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-white mb-6 text-center">
            Accedi per continuare
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {bioEnabled && (
            <button
              type="button"
              onClick={doBiometricLogin}
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 mb-4 disabled:opacity-60"
            >
              <ScanFace className="w-5 h-5" />
              Accedi con Face ID
            </button>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Nome utente</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="input pl-10"
                  placeholder="Inserisci il nome utente"
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input pl-10"
                  placeholder="Inserisci la password"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            {bioAvailable && !bioEnabled && (
              <label className="flex items-center gap-2 text-sm text-dark-300 select-none cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberBio}
                  onChange={e => setRememberBio(e.target.checked)}
                  className="w-4 h-4 accent-primary-500"
                />
                <ScanFace className="w-4 h-4 text-dark-400" />
                Abilita l'accesso con Face ID
              </label>
            )}

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60 disabled:hover:shadow-none"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Accesso…
                </>
              ) : (
                'Accedi'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-dark-500 text-sm mt-6 font-mono text-xs">
          KNX Controller · v1.0
        </p>
      </div>
    </div>
  );
}

export default Login;
