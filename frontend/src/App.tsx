import { Suspense, lazy, useEffect, useState } from 'react';
import './App.css';

const ModaCenterMap = lazy(() => import('./components/Maps/ModaCenterMap'));

function App() {
  const [isSplashVisible, setIsSplashVisible] = useState(true);

  useEffect(() => {
    const mapPreload = new Image();
    mapPreload.src = '/maps/mapa-visual.jpeg';

    const splashTimer = window.setTimeout(() => {
      setIsSplashVisible(false);
    }, 1800);

    return () => {
      window.clearTimeout(splashTimer);
    };
  }, []);

  return (
    <div className="App">
      {isSplashVisible ? (
        <section className="brand-splash" aria-label="Abertura da marca GNOCENTER">
          <div className="brand-splash__chip">Navegacao indoor</div>
          <h1 className="brand-splash__title">GNOCENTER</h1>
          <p className="brand-splash__subtitle">
            Encontre atividades, servicos e rotas seguras do evento.
          </p>
        </section>
      ) : (
        <Suspense fallback={<div className="app-loading">Preparando sua experiencia no mapa...</div>}>
          <ModaCenterMap />
        </Suspense>
      )}
    </div>
  );
}

export default App;


