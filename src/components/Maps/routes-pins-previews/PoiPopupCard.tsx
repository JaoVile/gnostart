import type { Popup as LeafletPopup } from 'leaflet';
import { useCallback, useEffect, useRef, type CSSProperties } from 'react';
import { Popup, useMap } from 'react-leaflet';

export interface PoiPopupAgendaSession {
  id: string;
  weekday: string;
  dateLabel: string;
  startTime: string;
  endTime: string;
  title: string;
  venue: string;
}

export interface PoiPopupPoi {
  id: string;
  nome: string;
}

export interface PoiPopupCardProps {
  poi: PoiPopupPoi;
  eventLabel: string;
  relatedSessions: readonly PoiPopupAgendaSession[];
  popupImage: string;
  popupHeroImage?: string | null;
  popupAccentColor: string;
  popupDetailsId: string;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onNavigate: () => void;
  onSetAsOrigin: () => void;
  popupSizePreset: {
    width: number;
    minWidth: number;
    maxWidth: number;
    maxHeight: number;
    tier: 'medium' | 'medium-large' | 'large';
    isMobile: boolean;
  };
}

export const PoiPopupCard = ({
  poi,
  eventLabel,
  relatedSessions,
  popupImage,
  popupHeroImage,
  popupAccentColor,
  popupDetailsId,
  isExpanded,
  onToggleExpanded,
  onNavigate,
  onSetAsOrigin,
  popupSizePreset,
}: PoiPopupCardProps) => {
  const map = useMap();
  const popupRef = useRef<LeafletPopup | null>(null);
  const closePreview = () => {
    map.closePopup();
  };
  const syncPopupLayout = useCallback(() => {
    const popup = popupRef.current;
    if (!popup || !popup.isOpen()) return;
    popup.update();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const animationFrameId = window.requestAnimationFrame(syncPopupLayout);
    const timeoutId = window.setTimeout(syncPopupLayout, isExpanded ? 280 : 80);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.clearTimeout(timeoutId);
    };
  }, [
    isExpanded,
    popupHeroImage,
    popupSizePreset.maxHeight,
    popupSizePreset.maxWidth,
    popupSizePreset.minWidth,
    popupSizePreset.width,
    relatedSessions.length,
    syncPopupLayout,
  ]);

  const popupPaddingTopLeft: [number, number] = popupSizePreset.isMobile ? [14, 84] : [18, 104];
  const popupPaddingBottomRight: [number, number] = popupSizePreset.isMobile ? [14, 170] : [18, 34];

  return (
    <Popup
      ref={popupRef}
      autoPan
      keepInView
      minWidth={popupSizePreset.minWidth}
      maxWidth={popupSizePreset.maxWidth}
      maxHeight={popupSizePreset.maxHeight}
      autoPanPadding={[16, 16]}
      autoPanPaddingTopLeft={popupPaddingTopLeft}
      autoPanPaddingBottomRight={popupPaddingBottomRight}
      className='store-poi-popup'
    >
      <div
        style={
          {
            '--popup-accent': popupAccentColor,
            '--popup-fixed-width': `${popupSizePreset.width}px`,
            '--popup-max-width': `${popupSizePreset.maxWidth}px`,
            '--popup-max-height': `${popupSizePreset.maxHeight}px`,
          } as CSSProperties
        }
        className={`store-popup-card popup-tier-${popupSizePreset.tier} ${isExpanded ? 'expanded' : ''}`}
      >
        <div className='store-popup-header'>
          <img
            src={popupImage}
            alt={poi.nome}
            loading='lazy'
            decoding='async'
            className='store-popup-thumb'
            onLoad={syncPopupLayout}
          />
          <div className='store-popup-heading'>
            <div className='store-popup-title'>{poi.nome}</div>
            <div className='store-popup-subtitle'>
              {relatedSessions.length > 0 ? `${eventLabel} - ${relatedSessions.length} no cronograma` : eventLabel}
            </div>
          </div>
        </div>

        {popupHeroImage && (
          <div className='store-popup-hero-shell'>
            <img
              src={popupHeroImage}
              alt={poi.nome}
              loading='lazy'
              decoding='async'
              className='store-popup-hero'
              onLoad={syncPopupLayout}
            />
          </div>
        )}

        <button
          type='button'
          onClick={() => {
            closePreview();
            onNavigate();
          }}
          className='popup-action-btn popup-action-primary store-popup-primary-action'
        >
          Ir ate o destino
        </button>

        <div className='store-popup-actions'>
          <button
            type='button'
            onClick={() => {
              closePreview();
              onSetAsOrigin();
            }}
            className='popup-action-btn popup-action-soft store-popup-secondary-action'
          >
            Estou aqui
          </button>
        </div>

        <button
          type='button'
          onClick={onToggleExpanded}
          aria-expanded={isExpanded}
          aria-controls={popupDetailsId}
          className={`store-popup-disclosure ${isExpanded ? 'expanded' : ''}`}
        >
          <span>{isExpanded ? 'Ocultar detalhes' : 'Mais detalhes e cronograma'}</span>
          <svg viewBox='0 0 20 20' aria-hidden='true'>
            <path d='M5 7.5L10 12.5L15 7.5' />
          </svg>
        </button>

        <div id={popupDetailsId} className={`store-popup-expand-panel ${isExpanded ? 'expanded' : ''}`}>
          <div className='store-popup-expand-panel-inner'>
            <div className='store-popup-agenda-block'>
              <div className='store-popup-section-title'>Cronograma relacionado</div>

              {relatedSessions.length > 0 ? (
                <div className='store-popup-agenda-list'>
                  {relatedSessions.map((session) => (
                    <article key={session.id} className='store-popup-agenda-item'>
                      <div className='store-popup-agenda-time'>
                        {session.weekday} {session.dateLabel} - {session.startTime} - {session.endTime}
                      </div>
                      <div className='store-popup-agenda-name'>{session.title}</div>
                      <div className='store-popup-agenda-venue'>{session.venue}</div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className='store-popup-empty-state'>Este espaco ainda nao tem horarios vinculados no cronograma.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Popup>
  );
};
