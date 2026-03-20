import type { CSSProperties } from 'react';
import { partnerPanelSummary, partnerSections, type PartnerPanelItem } from './partnerData';

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
        <div className='map-sheet-eyebrow'>Ecossistema ativo</div>
        <div className='map-panel-title'>Parceiros e convidados</div>
        <div className='partners-panel-subtitle'>
          Logos, marcas e pessoas que ajudam a sustentar o dia 21. A base abaixo ja esta organizada para leitura rapida
          no mobile.
        </div>
      </div>
    </div>

    <div className='partners-overview-grid'>
      <article className='partners-overview-card'>
        <span className='partners-overview-label'>Rede institucional</span>
        <strong className='partners-overview-value'>{partnerPanelSummary.institutionalCount}</strong>
      </article>
      <article className='partners-overview-card'>
        <span className='partners-overview-label'>Expositores</span>
        <strong className='partners-overview-value'>{partnerPanelSummary.ecosystemCount}</strong>
      </article>
      <article className='partners-overview-card'>
        <span className='partners-overview-label'>Food</span>
        <strong className='partners-overview-value'>{partnerPanelSummary.foodCount}</strong>
      </article>
      <article className='partners-overview-card'>
        <span className='partners-overview-label'>Pessoas</span>
        <strong className='partners-overview-value'>{partnerPanelSummary.peopleCount}</strong>
      </article>
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
              <div className={`partner-card-visual ${item.kind === 'person' ? 'is-person' : 'is-brand'}`}>
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
