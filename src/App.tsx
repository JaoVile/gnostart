import { Suspense, lazy, useEffect, useState, type FormEvent } from 'react';
import './App.css';

const ModaCenterMap = lazy(() => import('./components/Maps/Gnomon'));
const TEMP_LOGIN_STORAGE_KEY = 'gnostart.tempLoginEnabled';
const TEMP_LOGIN_USERNAME = 'admin';
const TEMP_LOGIN_PASSWORD = '654321';
const REQUIRE_TEMP_LOGIN = (import.meta.env.VITE_REQUIRE_TEMP_LOGIN || 'true').trim().toLowerCase() !== 'false';

const readTempLoginState = () => {
  if (typeof window === 'undefined') return false;
  return window.sessionStorage.getItem(TEMP_LOGIN_STORAGE_KEY) === '1';
};

function App() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(() => !REQUIRE_TEMP_LOGIN || readTempLoginState());

  useEffect(() => {
    const mapPreload = new Image();
    mapPreload.src = '/maps/mapa-background.jpeg';
  }, []);

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedUsername = username.trim();
    if (normalizedUsername === TEMP_LOGIN_USERNAME && password === TEMP_LOGIN_PASSWORD) {
      setIsAuthenticated(true);
      setLoginError('');
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(TEMP_LOGIN_STORAGE_KEY, '1');
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
          <h1 className="auth-title">Acesso interno ao mapa operacional</h1>
          <p className="auth-copy">
            Este login é temporário e deve ser removido antes do uso oficial.
          </p>

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

