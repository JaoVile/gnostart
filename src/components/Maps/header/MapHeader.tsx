import type { CSSProperties } from 'react';

export interface MapHeaderProps {
  logoSrc: string;
  logoAlt?: string;
  logoScale?: number;
}

export const MapHeader = ({ logoSrc, logoAlt = 'Logo do evento', logoScale = 1.2 }: MapHeaderProps) => (
  <div className='map-brand-header' style={{ '--map-brand-logo-scale': String(logoScale) } as CSSProperties}>
    <span className='map-brand-icon-shell'>
      <img src={logoSrc} alt={logoAlt} className='map-brand-icon' />
    </span>
  </div>
);
