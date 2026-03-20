import type { CSSProperties, ReactNode } from 'react';

export type RouteSuggestionPoiType = 'atividade' | 'servico' | 'banheiro' | 'entrada';

export interface RouteSuggestionPoi {
  id: string;
  x: number;
  y: number;
  nome: string;
  tipo: RouteSuggestionPoiType;
  nodeId?: string;
}

export interface RoutePanelProps {
  liveLocationCard: ReactNode;
  activeRouteOriginSummaryName: string;
  activeRouteOriginSummaryHelp: string;
  originQuery: string;
  onOriginQueryChange: (value: string) => void;
  onOriginFocus: () => void;
  onOriginBlur: () => void;
  onOriginSuggestionSelect: (poi: RouteSuggestionPoi) => void;
  originSuggestions: RouteSuggestionPoi[];
  showOriginSuggestions: boolean;
  destinationQuery: string;
  onDestinationQueryChange: (value: string) => void;
  onDestinationFocus: () => void;
  onDestinationBlur: () => void;
  onDestinationSuggestionSelect: (poi: RouteSuggestionPoi) => void;
  destinationSuggestions: RouteSuggestionPoi[];
  showDestinationSuggestions: boolean;
  onClearRoute: () => void;
  onClearManualRouteOrigin: () => void;
  onRepositionManualOrigin: () => void;
  hasManualRouteOrigin: boolean;
  hasManualMapRouteOrigin: boolean;
  routeMessage: string;
  routeDistanceMeters: number;
  routeEtaMinutes: number;
  activeRouteMetricLabel: string;
  activeRouteMetricValue: string;
  isPresentationMode: boolean;
  isMobile: boolean;
  inputStyle: CSSProperties;
  buttonStyle: CSSProperties;
  formatDistanceLabel: (meters: number) => string;
  formatWalkingTimeLabel: (minutes: number) => string;
}

export const RoutePanel = ({
  liveLocationCard,
  activeRouteOriginSummaryName,
  activeRouteOriginSummaryHelp,
  originQuery,
  onOriginQueryChange,
  onOriginFocus,
  onOriginBlur,
  onOriginSuggestionSelect,
  originSuggestions,
  showOriginSuggestions,
  destinationQuery,
  onDestinationQueryChange,
  onDestinationFocus,
  onDestinationBlur,
  onDestinationSuggestionSelect,
  destinationSuggestions,
  showDestinationSuggestions,
  onClearRoute,
  onClearManualRouteOrigin,
  onRepositionManualOrigin,
  hasManualRouteOrigin,
  hasManualMapRouteOrigin,
  routeMessage,
  routeDistanceMeters,
  routeEtaMinutes,
  activeRouteMetricLabel,
  activeRouteMetricValue,
  isPresentationMode,
  isMobile,
  inputStyle,
  buttonStyle,
  formatDistanceLabel,
  formatWalkingTimeLabel,
}: RoutePanelProps) => (
  <div className='map-sheet-panel map-sheet-panel-route'>
    <div className='route-panel-hero'>
      <div>
        <div className='map-sheet-eyebrow'>Navegacao guiada</div>
        <div className='map-panel-title'>Painel de rota</div>
        <div className='route-panel-subtitle'>
          Escolha o destino e, se o GPS demorar, selecione sua origem no mapa ou pelos pontos principais.
        </div>
      </div>
    </div>

    {liveLocationCard}

    <div className='route-field-grid'>
      <div className='route-auto-origin-card'>
        <span className='route-auto-origin-label'>{hasManualRouteOrigin ? 'Origem manual' : 'Origem automatica'}</span>
        <strong className='route-auto-origin-name'>{activeRouteOriginSummaryName}</strong>
        <span className='route-auto-origin-help'>{activeRouteOriginSummaryHelp}</span>
      </div>

      <div className='route-field-card'>
        <label className='map-input-label route-field-label'>Origem manual / pontos principais</label>
        <div className='route-field-input-wrap'>
          <input
            value={originQuery}
            onChange={(e) => onOriginQueryChange(e.target.value)}
            onFocus={onOriginFocus}
            onBlur={onOriginBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && originSuggestions.length > 0) {
                e.preventDefault();
                onOriginSuggestionSelect(originSuggestions[0]);
              }
            }}
            className='map-input route-field-input'
            style={{ ...inputStyle, margin: 0 }}
            placeholder='Ex.: Entrada Principal, Credenciamento...'
          />
          <span className='route-field-hint'>
            Se o GPS demorar, use este campo para se localizar pelos pontos principais e gerar a rota.
          </span>
          {showOriginSuggestions && (
            <div className='route-suggestions'>
              {originSuggestions.map((poi) => (
                <button
                  key={`origin_suggestion_${poi.id}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onOriginSuggestionSelect(poi)}
                  className='route-suggestion-item'
                >
                  <span className='route-suggestion-name'>{poi.nome}</span>
                  <span className='route-suggestion-type'>{poi.tipo.toUpperCase()}</span>
                </button>
              ))}
              {originSuggestions.length === 0 && <div className='route-suggestion-empty'>Nenhuma sugestao para origem.</div>}
            </div>
          )}
        </div>
      </div>

      <div className='route-field-card'>
        <label className='map-input-label route-field-label'>Destino</label>
        <div className='route-field-input-wrap'>
          <input
            value={destinationQuery}
            onChange={(e) => onDestinationQueryChange(e.target.value)}
            onFocus={onDestinationFocus}
            onBlur={onDestinationBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && destinationSuggestions.length > 0) {
                e.preventDefault();
                onDestinationSuggestionSelect(destinationSuggestions[0]);
              }
            }}
            autoFocus={isMobile}
            className='map-input route-field-input'
            style={{ ...inputStyle, margin: 0 }}
            placeholder='Ex.: Palco Principal, banheiro...'
          />
          <span className='route-field-hint'>Selecione um destino ou marque sua origem apenas perto de corredor ou pin.</span>
          {showDestinationSuggestions && (
            <div className='route-suggestions'>
              {destinationSuggestions.map((poi) => (
                <button
                  key={`destination_suggestion_${poi.id}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onDestinationSuggestionSelect(poi)}
                  className='route-suggestion-item'
                >
                  <span className='route-suggestion-name'>{poi.nome}</span>
                  <span className='route-suggestion-type'>{poi.tipo.toUpperCase()}</span>
                </button>
              ))}
              {destinationSuggestions.length === 0 && <div className='route-suggestion-empty'>Nenhuma sugestao para destino.</div>}
            </div>
          )}
        </div>
      </div>
    </div>

    <div className='route-action-row'>
      <button onClick={onClearRoute} style={buttonStyle} className='btn btn-neutral route-secondary-action'>
        Limpar
      </button>
      {hasManualRouteOrigin && (
        <button onClick={onClearManualRouteOrigin} style={buttonStyle} className='btn btn-neutral route-secondary-action'>
          Limpar origem
        </button>
      )}
      {hasManualMapRouteOrigin && (
        <button
          onClick={onRepositionManualOrigin}
          style={buttonStyle}
          className='btn btn-neutral route-secondary-action route-inline-action'
        >
          Mudar posicao
        </button>
      )}
    </div>

    <div className='route-feedback-card'>
      <div className='route-feedback-title'>Resumo da navegacao</div>
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
  </div>
);
