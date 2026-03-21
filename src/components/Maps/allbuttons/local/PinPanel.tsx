import type { CSSProperties } from 'react';
import './local.css';

export type PinPanelPoiType = 'atividade' | 'servico' | 'banheiro' | 'entrada';

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
  getPoiAccentColor: (poi: PinPanelPoi) => string;
  getPoiAccentRingColor: (accentColor: string) => string;
  onToggleManualVisibility: (poiId: string) => void;
  onFocusPoi: (poi: PinPanelPoi) => void;
  onViewPoi: (poi: PinPanelPoi) => void;
  onNavigatePoi: (poi: PinPanelPoi) => void;
}

export const PinPanel = ({
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
  getPoiAccentColor,
  getPoiAccentRingColor,
  onToggleManualVisibility,
  onFocusPoi: _onFocusPoi,
  onViewPoi,
  onNavigatePoi,
}: PinPanelProps) => {
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Se o usuário apertar Enter ou "Buscar", abrimos o primeiro resultado direto no mapa
    if (searchablePois.length > 0) {
      onViewPoi(searchablePois[0]);
    }
  };

  return (
    <div className='map-sheet-panel map-sheet-panel-pins'>
      <div className='pin-panel-hero'>
        <div>
          <div className='map-sheet-eyebrow'>Descoberta inteligente</div>
          <div className='map-panel-title'>Explorar locais</div>
          <div className='pin-panel-subtitle'>Encontre atividades e serviços do evento com foco rápido no mapa.</div>
        </div>
      </div>

      <form className='pin-search-box' onSubmit={handleSearchSubmit}>
        <input
          value={searchTerm}
          onChange={(e) => onSearchTermChange(e.target.value)}
          placeholder='Buscar local, serviço, banheiro...'
          className='map-input pin-search-input'
          style={{ ...inputStyle, marginBottom: 0 }}
        />
        <button type='submit' className='pin-search-button'>Buscar</button>
      </form>

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
            Restaurar mapa
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
              <button onClick={() => onViewPoi(poi)} className='pin-result-main' title='Ver detalhes no mapa'>
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
                  Mostrar
                </button>
                <button onClick={() => onNavigatePoi(poi)} className='pin-result-open pin-result-go'>
                  Ir
                </button>
              </div>
            </div>
          );
        })}

        {searchablePois.length === 0 && <div className='pin-empty-state'>Nenhum ponto encontrado para "{searchTerm}".</div>}
      </div>
    </div>
  );
};
