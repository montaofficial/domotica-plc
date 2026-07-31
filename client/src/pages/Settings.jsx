import { useState, useEffect } from 'react';
import { Lock, User, Loader2, AlertCircle, CheckCircle2, KeyRound, UserCog, ScanFace } from 'lucide-react';
import { authApi } from '../api';
import { biometricAvailable, biometricEnabled, enableBiometric, disableBiometric } from '../lib/biometric';

// Small reusable field with a leading icon, matching the Login styling.
function Field({ icon: Icon, type, value, onChange, placeholder, autoComplete }) {
  return (
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input pl-10"
        placeholder={placeholder}
        autoComplete={autoComplete}
      />
    </div>
  );
}

function Banner({ kind, text }) {
  if (!text) return null;
  const ok = kind === 'ok';
  return (
    <div
      className={`mb-4 p-3 rounded-lg flex items-center gap-2 text-sm border ${
        ok
          ? 'bg-green-500/10 border-green-500/30 text-green-400'
          : 'bg-red-500/10 border-red-500/30 text-red-400'
      }`}
    >
      {ok ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
      <span>{text}</span>
    </div>
  );
}

function ChangePasswordCard() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState({ kind: '', text: '' });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setMsg({ kind: '', text: '' });
    if (next.length < 8) return setMsg({ kind: 'err', text: 'La nuova password deve avere almeno 8 caratteri.' });
    if (next !== confirm) return setMsg({ kind: 'err', text: 'Le due password non coincidono.' });
    setLoading(true);
    try {
      await authApi.changePassword(current, next);
      setMsg({ kind: 'ok', text: 'Password aggiornata.' });
      setCurrent(''); setNext(''); setConfirm('');
    } catch (err) {
      setMsg({
        kind: 'err',
        text: err.message === 'Current password is incorrect'
          ? 'La password attuale non è corretta.'
          : (err.message || 'Impossibile cambiare la password.')
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-6">
      <div className="flex items-center gap-2 mb-5">
        <KeyRound className="w-5 h-5 text-primary-400" />
        <h2 className="text-lg font-semibold text-white">Cambia password</h2>
      </div>
      <Banner kind={msg.kind === 'ok' ? 'ok' : 'err'} text={msg.text} />
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Password attuale</label>
          <Field icon={Lock} type="password" value={current} onChange={setCurrent} placeholder="Password attuale" autoComplete="current-password" />
        </div>
        <div>
          <label className="label">Nuova password</label>
          <Field icon={Lock} type="password" value={next} onChange={setNext} placeholder="Almeno 8 caratteri" autoComplete="new-password" />
        </div>
        <div>
          <label className="label">Conferma nuova password</label>
          <Field icon={Lock} type="password" value={confirm} onChange={setConfirm} placeholder="Ripeti la nuova password" autoComplete="new-password" />
        </div>
        <button
          type="submit"
          disabled={loading || !current || !next || !confirm}
          className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {loading ? <><Loader2 className="w-5 h-5 animate-spin" />Salvataggio…</> : 'Aggiorna password'}
        </button>
      </form>
    </div>
  );
}

function ChangeUsernameCard() {
  const [newUsername, setNewUsername] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState({ kind: '', text: '' });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setMsg({ kind: '', text: '' });
    if (!newUsername.trim()) return setMsg({ kind: 'err', text: 'Inserisci il nuovo nome utente.' });
    setLoading(true);
    try {
      await authApi.changeUsername(password, newUsername.trim());
      setMsg({ kind: 'ok', text: `Nome utente aggiornato in "${newUsername.trim()}".` });
      setNewUsername(''); setPassword('');
    } catch (err) {
      setMsg({
        kind: 'err',
        text: err.message === 'Current password is incorrect'
          ? 'La password non è corretta.'
          : (err.message || 'Impossibile cambiare il nome utente.')
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-6">
      <div className="flex items-center gap-2 mb-5">
        <UserCog className="w-5 h-5 text-primary-400" />
        <h2 className="text-lg font-semibold text-white">Cambia nome utente</h2>
      </div>
      <Banner kind={msg.kind === 'ok' ? 'ok' : 'err'} text={msg.text} />
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Nuovo nome utente</label>
          <Field icon={User} type="text" value={newUsername} onChange={setNewUsername} placeholder="Nuovo nome utente" autoComplete="username" />
        </div>
        <div>
          <label className="label">Password (per conferma)</label>
          <Field icon={Lock} type="password" value={password} onChange={setPassword} placeholder="La tua password" autoComplete="current-password" />
        </div>
        <button
          type="submit"
          disabled={loading || !newUsername || !password}
          className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {loading ? <><Loader2 className="w-5 h-5 animate-spin" />Salvataggio…</> : 'Aggiorna nome utente'}
        </button>
      </form>
    </div>
  );
}

function FaceIdCard() {
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState({ kind: '', text: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [a, e] = await Promise.all([biometricAvailable(), biometricEnabled()]);
      if (!cancelled) { setAvailable(a); setEnabled(a && e); }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!available) return null; // web, or no Face ID / Touch ID on the device

  const enable = async (e) => {
    e.preventDefault();
    setMsg({ kind: '', text: '' });
    setLoading(true);
    try {
      // Verify the credentials against the server before storing them, so we
      // never save a wrong password into the Keychain.
      await authApi.login(username, password);
      await enableBiometric(username, password);
      setEnabled(true);
      setUsername(''); setPassword('');
      setMsg({ kind: 'ok', text: 'Face ID attivato.' });
    } catch (err) {
      setMsg({
        kind: 'err',
        text: err.message === 'Invalid credentials'
          ? 'Credenziali non valide.'
          : (err.message || 'Impossibile attivare Face ID.')
      });
    } finally {
      setLoading(false);
    }
  };

  const disable = async () => {
    setLoading(true);
    await disableBiometric();
    setEnabled(false);
    setMsg({ kind: 'ok', text: 'Face ID disattivato.' });
    setLoading(false);
  };

  return (
    <div className="card p-6">
      <div className="flex items-center gap-2 mb-5">
        <ScanFace className="w-5 h-5 text-primary-400" />
        <h2 className="text-lg font-semibold text-white">Accesso con Face ID</h2>
      </div>
      <Banner kind={msg.kind === 'ok' ? 'ok' : 'err'} text={msg.text} />
      {enabled ? (
        <div className="space-y-4">
          <p className="text-sm text-dark-300 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-400" /> Face ID è attivo su questo dispositivo.
          </p>
          <button onClick={disable} disabled={loading} className="btn-secondary w-full flex items-center justify-center gap-2 disabled:opacity-60">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Disattiva Face ID'}
          </button>
        </div>
      ) : (
        <form onSubmit={enable} className="space-y-4">
          <p className="text-sm text-dark-400">Conferma le credenziali per attivare l'accesso con Face ID.</p>
          <div>
            <label className="label">Nome utente</label>
            <Field icon={User} type="text" value={username} onChange={setUsername} placeholder="Nome utente" autoComplete="username" />
          </div>
          <div>
            <label className="label">Password</label>
            <Field icon={Lock} type="password" value={password} onChange={setPassword} placeholder="Password" autoComplete="current-password" />
          </div>
          <button type="submit" disabled={loading || !username || !password} className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60">
            {loading ? <><Loader2 className="w-5 h-5 animate-spin" />Attivazione…</> : 'Attiva Face ID'}
          </button>
        </form>
      )}
    </div>
  );
}

function Settings() {
  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Impostazioni</h1>
        <p className="text-sm text-dark-400 mt-1">Gestisci le credenziali di accesso.</p>
      </div>
      <FaceIdCard />
      <ChangePasswordCard />
      <ChangeUsernameCard />
    </div>
  );
}

export default Settings;
