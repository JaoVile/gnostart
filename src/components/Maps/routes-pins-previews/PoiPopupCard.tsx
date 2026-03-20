import type { CSSProperties } from 'react';
import { Popup } from 'react-leaflet';

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
  popupSizePreset: {
    width: number;
    minWidth: number;
    maxWidth: number;
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
  popupSizePreset,
}: PoiPopupCardProps) => (
  <Popup autoPan={false} minWidth={popupSizePreset.minWidth} maxWidth={popupSizePreset.maxWidth}>
    <div
      style={
        {
          '--popup-accent': popupAccentColor,
          '--popup-fixed-width': `${popupSizePreset.width}px`,
        } as CSSProperties
      }
      className={`store-popup-card ${isExpanded ? 'expanded' : ''}`}
    >
      <div className='store-popup-header'>
        <img src={popupImage} alt={poi.nome} loading='lazy' decoding='async' className='store-popup-thumb' />
        <div className='store-popup-heading'>
          <div className='store-popup-title'>{poi.nome}</div>
          <div className='store-popup-subtitle'>
            {relatedSessions.length > 0 ? `${eventLabel} - ${relatedSessions.length} no cronograma` : eventLabel}
          </div>
        </div>
      </div>

      {popupHeroImage && (
        <div className='store-popup-hero-shell'>
          <img src={popupHeroImage} alt={poi.nome} loading='lazy' decoding='async' className='store-popup-hero' />
        </div>
      )}

      <div className='store-popup-guide-card'>
        <img src={popupImage} alt={poi.nome} loading='lazy' decoding='async' className='store-popup-guide-thumb' />
        <div className='store-popup-guide-copy'>
          <div className='store-popup-guide-title'>Procure este pin no mapa</div>
          <div className='store-popup-guide-subtitle'>Use este icone para localizar o ponto com mais rapidez no celular.</div>
        </div>
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

      <div className='store-popup-actions'>
        <button type='button' onClick={onNavigate} className='popup-action-btn popup-action-primary'>
          Tracar rota ate aqui
        </button>
      </div>
    </div>
  </Popup>
);
