import { Suspense, lazy, useState, type FormEvent } from 'react';
import './App.css';
import {
  ACCESS_GATE_PASSWORD,
  ACCESS_GATE_STORAGE_KEY,
  ACCESS_GATE_USERNAME,
  REQUIRE_ACCESS_GATE,
} from './config/accessGate';

const ModaCenterMap = lazy(() => import('./components/Maps/Gnomon'));

const readAccessGateState = () => {
  if (typeof window === 'undefined') return false;
  return window.sessionStorage.getItem(ACCESS_GATE_STORAGE_KEY) === '1';
};

function App() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(() => !REQUIRE_ACCESS_GATE || readAccessGateState());

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedUsername = username.trim();
    if (normalizedUsername === ACCESS_GATE_USERNAME && password === ACCESS_GATE_PASSWORD) {
      setIsAuthenticated(true);
      setLoginError('');
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(ACCESS_GATE_STORAGE_KEY, '1');
      }
      return;
    }

    setLoginError('Usuário ou senha inválidos.');
  };

  if (!isAuthenticated) {
    return (
      <div className="App auth-shell">
        <div className="auth-card">
          <div className="auth-eyebrow">Acesso interno</div>
          <h1 className="auth-title">Mapa operacional com acesso restrito</h1>
          <p className="auth-copy">Ambiente reservado para pessoas autorizadas durante a operação do evento.</p>

          <form className="auth-form" onSubmit={handleLogin}>
            <label className="auth-field">
              <span>Usuário</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="auth-input"
                autoComplete="username"
                placeholder="Digite o usuário"
              />
            </label>

            <label className="auth-field">
              <span>Senha</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="auth-input"
                autoComplete="current-password"
                placeholder="Digite a senha"
              />
            </label>

            {loginError && <div className="auth-error">{loginError}</div>}

            <button type="submit" className="auth-submit">
              Entrar
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <Suspense fallback={<div className="app-loading">Abrindo o mapa operacional...</div>}>
        <ModaCenterMap />
      </Suspense>
    </div>
  );
}

export default App;
