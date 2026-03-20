import { useEffect, useState, type CSSProperties } from 'react';

export interface LiveLocationCardData {
  headline: string;
  originName: string;
  statusText: string;
  primaryActionLabel: string;
  showStopAction: boolean;
  areaLabel: string;
  accuracyLabel: string;
  updatedAtLabel: string;
  sourceLabel: string;
  latLabel: string;
  lngLabel: string;
  mapPointLabel: string;
  backendStateLabel: string;
  resolvedAddress: string;
  venueName: string;
  venueStatusLabel: string;
  venueDistanceLabel: string;
  externalRouteLabel: string;
  helpText: string;
  tone: string;
  isAccuracyWeak: boolean;
}

export interface LiveLocationCardProps {
  data: LiveLocationCardData;
  onPrimaryAction: () => void;
  onStopAction: () => void;
}

export const LiveLocationCard = ({ data, onPrimaryAction, onStopAction }: LiveLocationCardProps) => {
  const [copyState, setCopyState] = useState<'idle' | 'done' | 'error'>('idle');
  const hasCoordinates = data.latLabel !== '--' && data.lngLabel !== '--';

  useEffect(() => {
    if (copyState === 'idle') return;
    const timer = window.setTimeout(() => setCopyState('idle'), 1800);
    return () => window.clearTimeout(timer);
  }, [copyState]);

  const handleCopyCoordinates = async () => {
    if (!hasCoordinates || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      setCopyState('error');
      return;
    }

    try {
      await navigator.clipboard.writeText(`${data.latLabel}, ${data.lngLabel}`);
      setCopyState('done');
    } catch {
      setCopyState('error');
    }
  };

  return (
    <div
      style={{
        borderRadius: 16,
        border: `1px solid ${data.tone}`,
        background: 'rgba(255, 255, 255, 0.96)',
        boxShadow: '0 18px 30px rgba(106, 56, 208, 0.12)',
        padding: 14,
        display: 'grid',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ display: 'grid', gap: 4 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              width: 'fit-content',
              borderRadius: 999,
              padding: '4px 9px',
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              background: `${data.tone}22`,
              color: data.tone,
            }}
          >
            {data.headline}
          </span>
          <strong style={{ fontSize: 16, color: 'var(--color-text)' }}>{data.originName}</strong>
          <span style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--color-text-muted)' }}>{data.statusText}</span>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type='button'
            onClick={onPrimaryAction}
            style={{ flex: 'initial', padding: '10px 12px' }}
            className='btn btn-primary'
          >
            {data.primaryActionLabel}
          </button>
          {data.showStopAction && (
            <button
              type='button'
              onClick={onStopAction}
              style={{ flex: 'initial', padding: '10px 12px' }}
              className='btn btn-neutral'
            >
              Usar origem manual
            </button>
          )}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: 8,
        }}
      >
        <CardMetric label='Area' value={data.areaLabel} />
        <CardMetric
          label='Precisao'
          value={data.accuracyLabel}
          valueTone={data.isAccuracyWeak ? 'var(--color-highlight)' : 'var(--color-ink)'}
        />
        <CardMetric label='Atualizado' value={data.updatedAtLabel} />
        <CardMetric label='Fonte' value={data.sourceLabel} />
        <div
          style={{
            borderRadius: 12,
            background: 'rgba(106, 56, 208, 0.06)',
            padding: '10px 12px',
            display: 'grid',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Lat/Lng</span>
          <strong style={{ fontSize: 13, color: 'var(--color-text)' }}>{`${data.latLabel}, ${data.lngLabel}`}</strong>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              type='button'
              onClick={() => {
                void handleCopyCoordinates();
              }}
              disabled={!hasCoordinates}
              style={{ minHeight: 32, padding: '0 10px', flex: '0 0 auto' }}
              className='btn btn-neutral'
            >
              {copyState === 'done' ? 'Copiado' : 'Copiar'}
            </button>
            {copyState === 'error' && (
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Copie manualmente se o navegador bloquear.</span>
            )}
          </div>
        </div>
        <CardMetric label='x/y no mapa' value={data.mapPointLabel} />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 8,
        }}
      >
        <CardMetric label='Validacao externa' value={data.backendStateLabel} />
        <CardMetric
          label='Endereco'
          value={data.resolvedAddress}
          valueStyle={{ fontSize: 12, lineHeight: 1.45, wordBreak: 'break-word' }}
        />
        <div
          style={{
            borderRadius: 12,
            background: 'rgba(106, 56, 208, 0.06)',
            padding: '10px 12px',
            display: 'grid',
            gap: 3,
          }}
        >
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Venue</span>
          <strong style={{ fontSize: 13, color: 'var(--color-text)' }}>{data.venueName}</strong>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            {data.venueStatusLabel}
            {data.venueDistanceLabel !== '--' ? ` | ${data.venueDistanceLabel}` : ''}
          </span>
        </div>
        <CardMetric label='Rota externa' value={data.externalRouteLabel} />
      </div>

      <div style={{ fontSize: 11, lineHeight: 1.5, color: 'var(--color-text-muted)' }}>{data.helpText}</div>
    </div>
  );
};

interface CardMetricProps {
  label: string;
  value: string;
  valueTone?: string;
  valueStyle?: CSSProperties;
}

const CardMetric = ({ label, value, valueTone, valueStyle }: CardMetricProps) => (
  <div
    style={{
      borderRadius: 12,
      background: 'rgba(106, 56, 208, 0.06)',
      padding: '10px 12px',
      display: 'grid',
      gap: 3,
    }}
  >
    <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{label}</span>
    <strong
      style={{
        fontSize: 13,
        color: valueTone ?? 'var(--color-text)',
        ...valueStyle,
      }}
    >
      {value}
    </strong>
  </div>
);
