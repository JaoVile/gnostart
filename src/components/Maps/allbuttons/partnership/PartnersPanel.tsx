import type { CSSProperties } from 'react';
import { partnerSections, type PartnerPanelItem } from './partnerData';
import './partnership.css';

const getPartnerVisualStyle = (item: PartnerPanelItem): CSSProperties | undefined => {
  if (item.visualSurface !== 'dark') return undefined;

  return {
    background:
      'linear-gradient(180deg, rgba(28, 34, 52, 0.98), rgba(12, 15, 24, 0.98)), radial-gradient(circle at top, rgba(255, 255, 255, 0.06), transparent 55%)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 12px 22px rgba(8, 10, 18, 0.28)',
  };
};

const renderPartnerVisual = (item: PartnerPanelItem) => {
  if (item.imageSrc) {
    return (
      <img
        src={item.imageSrc}
        alt={item.name}
        loading='lazy'
        decoding='async'
        className={`partner-card-image ${item.kind === 'person' ? 'is-person' : 'is-brand'}`}
      />
    );
  }

  const initials = item.name
    .split(' ')
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();

  return <span className='partner-card-fallback'>{initials}</span>;
};

export const PartnersPanel = () => (
  <div className='partners-panel-shell map-sheet-panel map-sheet-panel-partners'>
    <div className='partners-panel-hero'>
      <div className='partners-panel-hero-copy'>
        <div className='map-sheet-eyebrow'>Ecossistema GNOSTART</div>
        <div className='map-panel-title'>Parceiros do evento</div>
      
      </div>
    </div>

    {partnerSections.map((section) => (
      <section key={section.id} className='partners-section-block'>
        <div className='partners-section-header'>
          <div className='partners-section-title'>{section.title}</div>
          <div className='partners-section-subtitle'>{section.subtitle}</div>
        </div>

        <div className={`partners-card-grid ${section.id === 'people' ? 'is-people' : 'is-brands'}`}>
          {section.items.map((item) => (
            <article
              key={item.id}
              className={`partner-card ${item.kind === 'person' ? 'is-person' : 'is-brand'}`}
              style={{ '--partner-accent': item.accent } as CSSProperties}
            >
              <div
                className={`partner-card-visual ${item.kind === 'person' ? 'is-person' : 'is-brand'}`}
                style={getPartnerVisualStyle(item)}
              >
                {renderPartnerVisual(item)}
              </div>

              <div className='partner-card-content'>
                <span className='partner-card-badge'>{item.badge}</span>
                <div className='partner-card-title'>{item.name}</div>
                <div className='partner-card-subtitle'>{item.subtitle}</div>
                <div className='partner-card-summary'>{item.summary}</div>
              </div>
            </article>
          ))}
        </div>
      </section>
    ))}
  </div>
);
