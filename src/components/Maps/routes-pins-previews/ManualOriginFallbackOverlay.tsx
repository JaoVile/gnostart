import type { LiveTrackingState } from '../types';

export interface ManualOriginFallbackOverlayProps {
  isOpen: boolean;
  mode?: 'fallback' | 'reposition' | null;
  destinationName: string | null;
  liveTrackingState: LiveTrackingState;
  statusMessage?: string | null;
  onRetryGps: () => void;
  onUseMainPoints: () => void;
}

export const ManualOriginFallbackOverlay = ({
  isOpen,
  mode,
  destinationName,
  liveTrackingState,
  statusMessage,
  onRetryGps,
  onUseMainPoints,
}: ManualOriginFallbackOverlayProps) => {
  if (!isOpen) return null;

  const gpsStatusLabel =
    liveTrackingState === 'requesting'
      ? 'GPS tentando em segundo plano'
      : liveTrackingState === 'active'
        ? 'GPS ativo, aguardando encaixe'
        : liveTrackingState === 'blocked'
          ? 'GPS bloqueado'
          : liveTrackingState === 'unsupported'
            ? 'GPS indisponivel'
            : liveTrackingState === 'error'
              ? 'GPS com falha'
              : 'GPS aguardando nova tentativa';
  const isRepositionMode = mode === 'reposition';
  const title = isRepositionMode ? 'Toque em outro ponto do mapa' : 'Localizacao demorando demais';
  const copy = isRepositionMode
    ? 'Escolha outro corredor ou uma area proxima de um pin para reposicionar sua origem manual.'
    : destinationName
      ? `A localizacao esta demorando mais do que o esperado. Para gerar a rota ate ${destinationName}, toque no mapa onde voce esta agora ou use os pontos principais no painel de rota.`
      : 'A localizacao esta demorando mais do que o esperado. Toque no mapa onde voce esta agora ou use os pontos principais no painel de rota.';

  return (
    <div className='manual-origin-overlay' aria-live='polite'>
      <div className='manual-origin-overlay-card' role='status'>
        <span className='manual-origin-overlay-badge'>Localizacao manual</span>
        <strong className='manual-origin-overlay-title'>{title}</strong>
        <span className='manual-origin-overlay-copy'>{copy}</span>
        <div className='manual-origin-overlay-status-row'>
          <span className='manual-origin-overlay-status'>{gpsStatusLabel}</span>
          <div className='manual-origin-overlay-actions'>
            {!isRepositionMode && (
              <button type='button' onClick={onUseMainPoints} className='manual-origin-overlay-action manual-origin-overlay-action-secondary'>
                Usar pontos principais
              </button>
            )}
            <button type='button' onClick={onRetryGps} className='manual-origin-overlay-action'>
              Tentar GPS de novo
            </button>
          </div>
        </div>
        {statusMessage && <div className='manual-origin-overlay-note'>{statusMessage}</div>}
      </div>
    </div>
  );
};
