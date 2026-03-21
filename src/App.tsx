import { Suspense, lazy } from 'react';
import './App.css';

const ModaCenterMap = lazy(() => import('./components/Maps/Gnomon'));

function App() {
  return (
    <div className='App'>
      <Suspense fallback={<div className='app-loading'>Abrindo o mapa operacional...</div>}>
        <ModaCenterMap />
      </Suspense>
    </div>
  );
}

export default App;
