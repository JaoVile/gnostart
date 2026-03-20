import pinMapaSvgUrl from '../../../assets/pin_mapa.svg';

export type TutorialVisual = 'intro' | 'pins' | 'location';
export type LiveTrackingState = 'idle' | 'requesting' | 'active' | 'blocked' | 'unsupported' | 'error';

export interface TutorialStageProps {
  visual: TutorialVisual;
  liveTrackingState?: LiveTrackingState;
  liveLocationStatusText?: string;
  onRequestLocation?: () => void;
}

export const TutorialStage = ({
  visual,
  liveTrackingState = 'idle',
  liveLocationStatusText,
  onRequestLocation,
}: TutorialStageProps) => {
  if (visual === 'intro') {
    return (
      <div className='tutorial-stage tutorial-stage--intro'>
        <div className='tutorial-stage-chip'>21 mar 2026</div>
        <div className='tutorial-stage-chip-group'>
          <span className='tutorial-stage-badge'>Sebrae Startups</span>
          <span className='tutorial-stage-badge'>Porto Digital Caruaru</span>
        </div>
        <div className='tutorial-stage-stats'>
          <div className='tutorial-stage-stat'>
            <strong>Startup Day</strong>
            <span>Conteudo, conexoes e oportunidades para o ecossistema.</span>
          </div>
          <div className='tutorial-stage-stat'>
            <strong>Gnomon</strong>
            <span>Seu ponto de apoio para mapa, agenda e navegacao no evento.</span>
          </div>
        </div>
      </div>
    );
  }

  if (visual === 'pins') {
    return (
      <div className='tutorial-stage tutorial-stage--pins'>
        <div className='tutorial-stage-map'>
          <div className='tutorial-stage-map-grid' />
          <div className='tutorial-stage-map-surface' />
          <div className='tutorial-stage-pin tutorial-stage-pin--a'>
            <img src={pinMapaSvgUrl} alt='' aria-hidden='true' className='tutorial-stage-pin-image tutorial-stage-pin-image--primary' />
          </div>
          <div className='tutorial-stage-pin tutorial-stage-pin--b'>
            <img src={pinMapaSvgUrl} alt='' aria-hidden='true' className='tutorial-stage-pin-image tutorial-stage-pin-image--secondary' />
          </div>
          <div className='tutorial-stage-pin tutorial-stage-pin--c'>
            <img src={pinMapaSvgUrl} alt='' aria-hidden='true' className='tutorial-stage-pin-image tutorial-stage-pin-image--tertiary' />
          </div>
          <div className='tutorial-stage-tap' />
          <div className='tutorial-stage-preview'>
            <div className='tutorial-stage-preview-handle' />
            <div className='tutorial-stage-preview-top'>
              <span className='tutorial-stage-preview-label'>Preview</span>
              <span className='tutorial-stage-preview-chip'>Ponto</span>
            </div>
            <strong>Palco Principal</strong>
            <span>Toque no pin para abrir o local, ver o resumo e decidir se quer focar ou traçar a rota.</span>
            <div className='tutorial-stage-preview-actions'>
              <span>Ver detalhes</span>
              <span>Traçar rota</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const tutorialLocationStatusLabel =
    liveTrackingState === 'active'
      ? 'GPS ativo'
      : liveTrackingState === 'requesting'
        ? 'Solicitando GPS'
        : liveTrackingState === 'blocked'
          ? 'Permissão bloqueada'
          : liveTrackingState === 'error'
            ? 'Falha ao localizar'
            : liveTrackingState === 'unsupported'
              ? 'GPS indisponível'
              : 'GPS necessário';
  const tutorialLocationStatusTone =
    liveTrackingState === 'active'
      ? 'is-active'
      : liveTrackingState === 'requesting'
        ? 'is-requesting'
        : liveTrackingState === 'blocked' || liveTrackingState === 'error'
          ? 'is-alert'
          : '';

  return (
    <div className='tutorial-stage tutorial-stage--location'>
      <div className='tutorial-stage-location-shell'>
        <div className='tutorial-stage-location-top'>
          <div className='tutorial-stage-permission'>Localizacao em tempo real</div>
          <div className={`tutorial-stage-location-status ${tutorialLocationStatusTone}`}>{tutorialLocationStatusLabel}</div>
        </div>
        <div className='tutorial-stage-route-board'>
          <div className='tutorial-stage-route-node tutorial-stage-route-node--user'>
            <div className='tutorial-stage-route-dot tutorial-stage-route-dot--user' />
            <span>Você</span>
          </div>
          <div className='tutorial-stage-route-line' />
          <div className='tutorial-stage-route-node tutorial-stage-route-node--target'>
            <div className='tutorial-stage-route-dot tutorial-stage-route-dot--target' />
            <span>Pin</span>
          </div>
        </div>
        <div className='tutorial-stage-location-copy'>Ative o GPS e siga.</div>
        {onRequestLocation && liveTrackingState !== 'active' && (
          <button type='button' onClick={onRequestLocation} className='btn btn-primary tutorial-location-action'>
            {liveTrackingState === 'blocked' ? 'Tentar novamente' : 'Ativar localização agora'}
          </button>
        )}
        {liveLocationStatusText && <div className='tutorial-stage-location-note'>{liveLocationStatusText}</div>}
      </div>
    </div>
  );
};
