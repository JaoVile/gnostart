import type { CSSProperties } from 'react';

export type PinPanelPoiType = 'atividade' | 'servico' | 'banheiro' | 'entrada';
export type PinPanelLiveTrackingState = 'idle' | 'requesting' | 'active' | 'blocked' | 'unsupported' | 'error';

export interface PinPanelPoi {
  id: string;
  x: number;
  y: number;
  nome: string;
  tipo: PinPanelPoiType;
  descricao?: string;
  imagemUrl?: string;
  contato?: string;
  corDestaque?: string;
  selo?: string;
  nodeId?: string;
}

export interface PinPanelProps {
  shouldShowPinsLocationPrompt: boolean;
  liveTrackingState: PinPanelLiveTrackingState;
  liveLocationStatusText: string;
  onRequestLocation: () => void;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  poiTypeLabels: Record<PinPanelPoiType, string>;
  poiTypeSingularLabels: Record<PinPanelPoiType, string>;
  enabledTypes: Record<PinPanelPoiType, boolean>;
  onToggleType: (type: PinPanelPoiType) => void;
  searchablePois: PinPanelPoi[];
  manualVisiblePoiIds: string[];
  onResetManualVisibility: () => void;
  arePinsHiddenByZoom: boolean;
  isPresentationMode: boolean;
  inputStyle: CSSProperties;
  actionButtonStyle: CSSProperties;
  getPoiAccentColor: (poi: PinPanelPoi) => string;
  getPoiAccentRingColor: (accentColor: string) => string;
  onToggleManualVisibility: (poiId: string) => void;
  onFocusPoi: (poi: PinPanelPoi) => void;
  onViewPoi: (poi: PinPanelPoi) => void;
  onNavigatePoi: (poi: PinPanelPoi) => void;
  selectedDestinationPoiName: string | null;
  routeMessage: string;
  routeDistanceMeters: number;
  routeEtaMinutes: number;
  activeRouteMetricLabel: string;
  activeRouteMetricValue: string;
  onClearRoute: () => void;
  formatDistanceLabel: (meters: number) => string;
  formatWalkingTimeLabel: (minutes: number) => string;
}

export const PinPanel = ({
  shouldShowPinsLocationPrompt,
  liveTrackingState,
  liveLocationStatusText,
  onRequestLocation,
  searchTerm,
  onSearchTermChange,
  poiTypeLabels,
  poiTypeSingularLabels,
  enabledTypes,
  onToggleType,
  searchablePois,
  manualVisiblePoiIds,
  onResetManualVisibility,
  arePinsHiddenByZoom,
  isPresentationMode,
  inputStyle,
  actionButtonStyle,
  getPoiAccentColor,
  getPoiAccentRingColor,
  onToggleManualVisibility,
  onFocusPoi,
  onViewPoi,
  onNavigatePoi,
  selectedDestinationPoiName,
  routeMessage,
  routeDistanceMeters,
  routeEtaMinutes,
  activeRouteMetricLabel,
  activeRouteMetricValue,
  onClearRoute,
  formatDistanceLabel,
  formatWalkingTimeLabel,
}: PinPanelProps) => (
  <div className='map-sheet-panel map-sheet-panel-pins'>
    <div className='pin-panel-hero'>
      <div>
        <div className='map-sheet-eyebrow'>Descoberta inteligente</div>
        <div className='map-panel-title'>Explorar locais</div>
        <div className='pin-panel-subtitle'>Encontre atividades e serviços do evento com foco rápido no mapa.</div>
      </div>
    </div>

    {shouldShowPinsLocationPrompt && (
      <div className='pins-location-gate-card'>
        <div className='pins-location-gate-copy'>
          <span className='map-sheet-eyebrow'>Localizacao necessaria</span>
          <strong className='pins-location-gate-title'>
            {liveTrackingState === 'blocked' ? 'Libere sua localizacao para continuar' : 'Ative sua localizacao'}
          </strong>
          <span className='pins-location-gate-text'>{liveLocationStatusText}</span>
        </div>
        <button type='button' onClick={onRequestLocation} className='btn btn-primary pins-location-gate-action'>
          <span className='pins-location-gate-check' aria-hidden='true'>
            <svg viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'>
              <path d='M4.5 10.3L8.2 14L15.5 6.7' />
            </svg>
          </span>
          <span>{liveTrackingState === 'blocked' ? 'Tentar novamente' : 'Confirmar localizacao'}</span>
        </button>
      </div>
    )}

    <div className='pin-search-box'>
      <input
        value={searchTerm}
        onChange={(e) => onSearchTermChange(e.target.value)}
        placeholder='Buscar atividade, serviço, banheiro ou entrada...'
        className='map-input pin-search-input'
        style={{ ...inputStyle, marginBottom: 0 }}
      />
      <span className='pin-search-label'>Buscar</span>
    </div>

    <div className='pin-filter-row'>
      {(Object.keys(poiTypeLabels) as PinPanelPoiType[]).map((type) => (
        <button
          key={`filter_${type}`}
          onClick={() => onToggleType(type)}
          className={`map-chip pin-filter-chip pin-filter-chip-${type} ${enabledTypes[type] ? 'active' : ''}`}
        >
          <span className={`pin-filter-dot pin-filter-dot-${type}`} />
          {poiTypeLabels[type]}
        </button>
      ))}
    </div>

    <div className='pin-panel-meta'>
      <span>{`${searchablePois.length} locais prontos para explorar`}</span>
      {!isPresentationMode && (
        <button
          onClick={onResetManualVisibility}
          disabled={manualVisiblePoiIds.length === 0}
          className='map-inline-link'
          style={{ color: manualVisiblePoiIds.length > 0 ? 'var(--color-primary)' : 'var(--color-text-soft)' }}
        >
          Modo inteligente
        </button>
      )}
    </div>

    {arePinsHiddenByZoom && (
      <div className='map-sheet-inline-status'>
        Aproxime o mapa para revelar os pontos na tela. A lista continua disponível logo abaixo.
      </div>
    )}

    <div className='map-list-shell pin-results-shell'>
      {searchablePois.map((poi) => {
        const checked = manualVisiblePoiIds.includes(poi.id);
        const accentColor = getPoiAccentColor(poi);
        return (
          <div
            key={`catalog_${poi.id}`}
            className={`map-list-item pin-result-row ${checked ? 'active' : ''}`}
            style={{
              gridTemplateColumns: isPresentationMode ? '1fr auto' : '22px 1fr auto',
              borderLeft: `3px solid ${accentColor}`,
            }}
          >
            {!isPresentationMode && (
              <input
                className='pin-select-check'
                type='checkbox'
                checked={checked}
                onChange={() => onToggleManualVisibility(poi.id)}
                title='Controlar visibilidade manual deste ponto'
              />
            )}
            <button onClick={() => onFocusPoi(poi)} className='pin-result-main'>
              <span
                className={`pin-result-type-mark pin-result-type-mark-${poi.tipo}`}
                style={{
                  background: accentColor,
                  boxShadow: `0 0 0 3px ${getPoiAccentRingColor(accentColor)}`,
                }}
              />
              <span className='pin-result-text'>
                <span className='pin-result-title'>{poi.nome}</span>
                <span className='pin-result-subtitle'>{poiTypeSingularLabels[poi.tipo]}</span>
              </span>
            </button>
            <div className='pin-result-actions'>
              <button onClick={() => onViewPoi(poi)} className='pin-result-open'>
                Ver
              </button>
              <button onClick={() => onNavigatePoi(poi)} className='pin-result-open pin-result-go'>
                Ir
              </button>
            </div>
          </div>
        );
      })}

      {searchablePois.length === 0 && <div className='pin-empty-state'>Nenhum ponto encontrado para esse filtro.</div>}
    </div>

    {selectedDestinationPoiName && (
      <>
        <div className='route-feedback-card'>
          <div className='route-feedback-title'>{`Navegando para ${selectedDestinationPoiName}`}</div>
          <div className='route-feedback-text'>{routeMessage}</div>
        </div>

        {routeDistanceMeters > 0 && (
          <div className='route-metrics-card'>
            <div className='route-metric-item'>
              <span className='route-metric-label'>Distancia</span>
              <span className='route-metric-value'>{formatDistanceLabel(routeDistanceMeters)}</span>
            </div>
            <div className='route-metric-item'>
              <span className='route-metric-label'>Tempo medio</span>
              <span className='route-metric-value'>{formatWalkingTimeLabel(routeEtaMinutes)}</span>
            </div>
            {!isPresentationMode && (
              <div className='route-metric-item'>
                <span className='route-metric-label'>{activeRouteMetricLabel}</span>
                <span className='route-metric-value'>{activeRouteMetricValue}</span>
              </div>
            )}
          </div>
        )}

        <div className='route-action-row'>
          <button onClick={onClearRoute} style={actionButtonStyle} className='btn btn-neutral route-secondary-action'>
            Limpar rota
          </button>
        </div>
      </>
    )}
  </div>
);
