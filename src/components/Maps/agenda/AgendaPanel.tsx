import type { CSSProperties, KeyboardEvent } from 'react';

export interface AgendaPanelDay {
  id: string;
  weekday: string;
  dateLabel: string;
}

export interface AgendaPanelStats {
  sessionCount: number;
  speakerCount: number;
  connectedCount: number;
  windowLabel: string;
}

export interface AgendaPanelSpeaker {
  name: string;
  role: string;
}

export interface AgendaPanelSession {
  id: string;
  weekday: string;
  dateLabel: string;
  category: string;
  title: string;
  summary: string;
  venue: string;
  audience: string;
  startTime: string;
  endTime: string;
  accent: string;
  durationLabel: string;
  isFavorite: boolean;
  hasLinkedPoi: boolean;
  linkedPoiImage: string | null;
  linkedPoiName: string | null;
  speakers: AgendaPanelSpeaker[];
}

export interface AgendaPanelProps {
  days: AgendaPanelDay[];
  selectedDayId: string;
  onSelectDay: (dayId: string) => void;
  selectedDayMeta: AgendaPanelDay;
  stats: AgendaPanelStats;
  sessions: AgendaPanelSession[];
  onToggleFavorite: (sessionId: string) => void;
  onOpenOnMap: (sessionId: string) => void;
}

const handleInteractiveKeyDown = (event: KeyboardEvent<HTMLElement>, callback: () => void) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    callback();
  }
};

export const AgendaPanel = ({
  days,
  selectedDayId,
  onSelectDay,
  selectedDayMeta,
  stats,
  sessions,
  onToggleFavorite,
  onOpenOnMap,
}: AgendaPanelProps) => {
  const featuredSessions = sessions.slice(0, 3);
  const hasSingleDay = days.length === 1;

  return (
    <div className='agenda-panel-shell map-sheet-panel map-sheet-panel-agenda'>
      <div className='agenda-panel-hero'>
        <div className='agenda-panel-hero-copy'>
          <div className='map-sheet-eyebrow'>Programacao oficial</div>
          <div className='map-panel-title'>Cronograma do evento</div>
          <div className='agenda-panel-subtitle'>
            Linha do tempo do dia 21 com horarios, espacos e acesso rapido para os locais que ja estao ligados ao mapa.
          </div>
        </div>
      </div>

      <section className='agenda-day-hero-card'>
        <div className='agenda-day-hero-main'>
          <div className='agenda-day-hero-badge'>{`${selectedDayMeta.weekday} ${selectedDayMeta.dateLabel}`}</div>
          <div className='agenda-day-hero-title'>Sabado 21</div>
          <div className='agenda-day-hero-copy'>
            Um unico dia, com conteudo principal, experiencias paralelas, oficinas e hotseats organizados por horario.
          </div>
        </div>
        <div className='agenda-day-hero-window'>
          <span className='agenda-day-hero-window-label'>Janela do dia</span>
          <strong className='agenda-day-hero-window-value'>{stats.windowLabel}</strong>
        </div>
      </section>

      <div className='agenda-panel-highlights'>
        <article className='agenda-highlight-card'>
          <span className='agenda-highlight-label'>Sessoes</span>
          <strong className='agenda-highlight-value'>{stats.sessionCount}</strong>
        </article>
        <article className='agenda-highlight-card'>
          <span className='agenda-highlight-label'>Palestrantes</span>
          <strong className='agenda-highlight-value'>{stats.speakerCount}</strong>
        </article>
        <article className='agenda-highlight-card'>
          <span className='agenda-highlight-label'>No mapa</span>
          <strong className='agenda-highlight-value'>{`${stats.connectedCount}/${stats.sessionCount}`}</strong>
        </article>
      </div>

      {hasSingleDay ? (
        <div className='agenda-single-day-pill'>{`${selectedDayMeta.weekday} ${selectedDayMeta.dateLabel} | Startup Day 2026`}</div>
      ) : (
        <div className='agenda-day-strip' role='tablist' aria-label='Dia do cronograma'>
          {days.map((day) => (
            <button
              key={`agenda_day_${day.id}`}
              onClick={() => onSelectDay(day.id)}
              className={`agenda-day-chip ${selectedDayId === day.id ? 'active' : ''}`}
              role='tab'
              aria-selected={selectedDayId === day.id}
            >
              <span className='agenda-day-weekday'>{day.weekday}</span>
              <span className='agenda-day-number'>{day.dateLabel}</span>
            </button>
          ))}
        </div>
      )}

      {featuredSessions.length > 0 && (
        <section className='agenda-featured-strip' aria-label='Destaques do dia'>
          {featuredSessions.map((session) => (
            <article
              key={`featured_${session.id}`}
              className='agenda-featured-card'
              style={{ '--agenda-accent': session.accent } as CSSProperties}
            >
              {session.linkedPoiImage && (
                <div className='agenda-featured-pin'>
                  <img src={session.linkedPoiImage} alt={session.linkedPoiName ?? session.title} className='agenda-featured-pin-thumb' />
                  <span className='agenda-featured-pin-label'>{session.linkedPoiName ?? 'Pin no mapa'}</span>
                </div>
              )}
              <div className='agenda-featured-time'>{`${session.startTime} - ${session.endTime}`}</div>
              <div className='agenda-featured-title'>{session.title}</div>
              <div className='agenda-featured-meta'>{session.venue}</div>
            </article>
          ))}
        </section>
      )}

      <div className='agenda-timeline-list'>
        {sessions.map((session) => (
          <article
            key={session.id}
            className={`agenda-timeline-card ${session.hasLinkedPoi ? 'interactive' : ''}`}
            style={{ '--agenda-accent': session.accent } as CSSProperties}
            onClick={session.hasLinkedPoi ? () => onOpenOnMap(session.id) : undefined}
            onKeyDown={session.hasLinkedPoi ? (event) => handleInteractiveKeyDown(event, () => onOpenOnMap(session.id)) : undefined}
            role={session.hasLinkedPoi ? 'button' : undefined}
            tabIndex={session.hasLinkedPoi ? 0 : undefined}
          >
            <div className='agenda-timeline-rail'>
              <div className='agenda-timeline-start'>{session.startTime}</div>
              <div className='agenda-timeline-divider' />
              <div className='agenda-timeline-end'>{session.endTime}</div>
            </div>

            <div className='agenda-timeline-main'>
              <div className='agenda-timeline-topline'>
                <div className='agenda-timeline-tags'>
                  <span className='agenda-session-tag'>{session.category}</span>
                  <span className='agenda-timeline-duration'>{session.durationLabel}</span>
                </div>
                <button
                  type='button'
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleFavorite(session.id);
                  }}
                  className={`agenda-favorite-btn ${session.isFavorite ? 'active' : ''}`}
                  aria-pressed={session.isFavorite}
                  title={session.isFavorite ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
                >
                  <svg viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'>
                    <path d='M12 20.2L10.6 18.9C5.6 14.3 2.4 11.4 2.4 7.8C2.4 5.2 4.4 3.2 7 3.2C8.5 3.2 9.9 3.9 10.8 5.1L12 6.6L13.2 5.1C14.1 3.9 15.5 3.2 17 3.2C19.6 3.2 21.6 5.2 21.6 7.8C21.6 11.4 18.4 14.3 13.4 18.9L12 20.2Z' />
                  </svg>
                </button>
              </div>

              <div className='agenda-session-title'>{session.title}</div>
              <div className='agenda-session-summary'>{session.summary}</div>

              {session.linkedPoiImage && (
                <div className='agenda-session-linked-poi'>
                  <img
                    src={session.linkedPoiImage}
                    alt={session.linkedPoiName ?? session.title}
                    loading='lazy'
                    decoding='async'
                    className='agenda-session-linked-poi-thumb'
                  />
                  <div className='agenda-session-linked-poi-copy'>
                    <span className='agenda-session-linked-poi-label'>Pin vinculado</span>
                    <strong className='agenda-session-linked-poi-name'>{session.linkedPoiName ?? 'Local no mapa'}</strong>
                  </div>
                </div>
              )}

              <div className='agenda-session-meta'>
                <span className='agenda-session-meta-item'>{session.venue}</span>
                <span className='agenda-session-meta-separator' />
                <span className='agenda-session-meta-item'>{session.audience}</span>
              </div>

              <div className='agenda-speaker-row'>
                <div className='agenda-speaker-stack'>
                  {session.speakers.map((speaker) => (
                    <span key={`${session.id}_${speaker.name}`} className='agenda-speaker-avatar' title={speaker.name}>
                      {speaker.name
                        .split(' ')
                        .slice(0, 2)
                        .map((part) => part.charAt(0))
                        .join('')}
                    </span>
                  ))}
                </div>
                <div className='agenda-speaker-copy'>
                  <span className='agenda-speaker-roleline'>{session.speakers.map((speaker) => speaker.role).join(' / ')}</span>
                  {session.speakers.map((speaker) => speaker.name).join(' | ')}
                </div>
              </div>

              <div className='agenda-session-footer'>
                <span className='agenda-session-status'>{session.isFavorite ? 'Salvo para voce' : 'Disponivel no dia 21'}</span>
                <button
                  type='button'
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenOnMap(session.id);
                  }}
                  className='agenda-session-map-link'
                  disabled={!session.hasLinkedPoi}
                >
                  <span>{session.hasLinkedPoi ? 'Ver no mapa' : 'Sem local vinculado'}</span>
                  {session.hasLinkedPoi && (
                    <svg viewBox='0 0 20 20' aria-hidden='true'>
                      <path d='M6 10H14' />
                      <path d='M10.5 6.5L14 10L10.5 13.5' />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};
