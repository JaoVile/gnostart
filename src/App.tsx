import { Suspense, lazy, useEffect } from 'react';
import './App.css';

const ModaCenterMap = lazy(() => import('./components/Maps/Gnomon'));

function App() {
  useEffect(() => {
    const mapPreload = new Image();
    mapPreload.src = '/maps/mapa-visual.png';
  }, []);

  return (
    <div className="App">
      <Suspense fallback={<div className="app-loading">Preparando sua experiencia no mapa...</div>}>
        <ModaCenterMap />
      </Suspense>
    </div>
  );
}

export default App;

