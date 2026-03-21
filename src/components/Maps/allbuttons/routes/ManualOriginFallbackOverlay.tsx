import { useEffect, useState } from 'react';
import './routes.css';

export interface ManualOriginNearbyPoiOption {
  id: string;
  nome: string;
  tipoLabel: string;
}

export interface ManualOriginFallbackOverlayProps {
  isOpen: boolean;
  mode?: 'fallback' | 'reposition' | null;
  destinationName: string | null;
  statusMessage?: string | null;
  nearbyPois: readonly ManualOriginNearbyPoiOption[];
  onSelectNearbyPoi: (poiId: string) => void;
}

export const ManualOriginFallbackOverlay = ({
  isOpen,
  mode,
  destinationName,
  statusMessage,
  nearbyPois,
  onSelectNearbyPoi,
}: ManualOriginFallbackOverlayProps) => {
  const [isNearbyPickerOpen, setIsNearbyPickerOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsNearbyPickerOpen(false);
    }
  }, [isOpen]);

  useEffect(() => {
    setIsNearbyPickerOpen(false);
  }, [destinationName, mode]);

  if (!isOpen) return null;

  const isRepositionMode = mode === 'reposition';
  const title = isRepositionMode ? 'Reposicione sua origem' : 'Onde voce esta?';
  const copy = isRepositionMode
    ? 'Toque no mapa. Se cair no preto, ajustamos para o corredor branco mais proximo.'
    : destinationName
      ? `Toque no mapa para ir ate ${destinationName}. Se cair no preto, ajustamos para o corredor branco mais proximo.`
      : 'Toque no mapa. Se cair no preto, ajustamos para o corredor branco mais proximo.';

  return (
    <div className='manual-origin-overlay' aria-live='polite'>
      <div className='manual-origin-overlay-card' role='status'>
        <span className='manual-origin-overlay-badge'>Origem</span>
        <strong className='manual-origin-overlay-title'>{title}</strong>
        <span className='manual-origin-overlay-copy'>{copy}</span>
        <div className='manual-origin-overlay-status-row'>
          <span className='manual-origin-overlay-status'>Toque no mapa ou use um pin</span>
          <div className='manual-origin-overlay-actions'>
            <button
              type='button'
              onClick={() => setIsNearbyPickerOpen(false)}
              className='manual-origin-overlay-action'
            >
              Toque no mapa
            </button>
            <button
              type='button'
              onClick={() => setIsNearbyPickerOpen((current) => !current)}
              className='manual-origin-overlay-action manual-origin-overlay-action-secondary'
            >
              {isNearbyPickerOpen ? 'Ocultar pins' : 'Pins proximos'}
            </button>
          </div>
        </div>
        {isNearbyPickerOpen && (
          <div className='manual-origin-overlay-nearby-shell'>
            <span className='manual-origin-overlay-nearby-label'>Escolha um pin para usar como origem</span>
            {nearbyPois.length > 0 ? (
              <div className='manual-origin-overlay-nearby-list'>
                {nearbyPois.map((poi) => (
                  <button
                    key={poi.id}
                    type='button'
                    onClick={() => onSelectNearbyPoi(poi.id)}
                    className='manual-origin-overlay-nearby-item'
                  >
                    <span className='manual-origin-overlay-nearby-name'>{poi.nome}</span>
                    <span className='manual-origin-overlay-nearby-type'>{poi.tipoLabel}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className='manual-origin-overlay-empty'>Nenhum pin sugerido agora. Toque no mapa.</div>
            )}
          </div>
        )}
        {statusMessage && <div className='manual-origin-overlay-note'>{statusMessage}</div>}
      </div>
    </div>
  );
};
