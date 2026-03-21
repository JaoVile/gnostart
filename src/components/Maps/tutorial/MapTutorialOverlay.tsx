import type { TutorialStep } from './tutorialSteps';
import { useEffect, useState, type CSSProperties } from 'react';

export interface MapTutorialOverlayProps {
  isOpen: boolean;
  currentStep: TutorialStep | null;
  currentStepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onClose: () => void;
}

export const MapTutorialOverlay = ({
  isOpen,
  currentStep,
  currentStepIndex,
  totalSteps,
  onNext,
  onClose,
}: MapTutorialOverlayProps) => {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    setIsAnimating(true);
    const timer = setTimeout(() => setIsAnimating(false), 300);
    return () => clearTimeout(timer);
  }, [currentStepIndex]);

  if (!isOpen || !currentStep) return null;

  const isLastStep = currentStepIndex >= totalSteps - 1;

  return (
    <div className='map-tutorial-overlay' role='dialog' aria-modal='true' aria-label='Como usar o mapa' style={overlayStyle}>
      <style>
        {`
          @keyframes mtFadeUpIn {
            from { opacity: 0; transform: translateY(24px) scale(0.96); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes mtFloatIcon {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-8px); }
          }
        `}
      </style>
      <div className='map-tutorial-card' style={cardStyle}>
        <button type='button' onClick={onClose} className='map-tutorial-close' aria-label='Fechar tutorial'>
          x
        </button>

        <div className='map-tutorial-progress'>
          {Array.from({ length: totalSteps }, (_, index) => (
            <span
              key={`tutorial_progress_${index}`}
              className={`map-tutorial-progress-dot ${index === currentStepIndex ? 'active' : ''}`}
            />
          ))}
        </div>

        {currentStep.icon && (
          <div style={{ ...iconContainerStyle, transform: isAnimating ? 'scale(0.8) translateY(10px)' : 'scale(1) translateY(0px)', opacity: isAnimating ? 0 : 1 }}>
            <div style={iconFloatStyle}>
              {currentStep.icon}
            </div>
          </div>
        )}

        <span className='map-tutorial-eyebrow' style={eyebrowStyle}>{currentStep.eyebrow}</span>
        <h2 className='map-tutorial-title' style={titleStyle}>{currentStep.title}</h2>
        <p className='map-tutorial-copy' style={descriptionStyle}>{currentStep.description}</p>

        <div className='map-tutorial-actions' style={actionsStyle}>
          <button type='button' onClick={onClose} className='map-tutorial-secondary' style={secondaryButtonStyle}>
            Pular
          </button>
          <button type='button' onClick={onNext} className='map-tutorial-primary' style={primaryButtonStyle}>
            {isLastStep ? 'Comecar' : 'Continuar'}
          </button>
        </div>
      </div>
    </div>
  );
};

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(0, 0, 0, 0.45)',
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
  zIndex: 9999,
  padding: '24px',
};

const cardStyle: CSSProperties = {
  background: '#ffffff',
  borderRadius: '28px',
  padding: '36px 24px 28px',
  textAlign: 'center',
  maxWidth: '380px',
  width: '100%',
  boxShadow: '0 24px 48px rgba(0, 0, 0, 0.12), 0 8px 16px rgba(0, 0, 0, 0.08)',
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  animation: 'mtFadeUpIn 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
};

const iconContainerStyle: CSSProperties = {
  fontSize: '64px',
  lineHeight: 1,
  marginBottom: '16px',
  transition: 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease',
};

const iconFloatStyle: CSSProperties = {
  animation: 'mtFloatIcon 3s ease-in-out infinite',
};

const eyebrowStyle: CSSProperties = {
  textTransform: 'uppercase',
  letterSpacing: '1.5px',
  fontSize: '12px',
  color: '#6a38d0',
  fontWeight: 800,
  marginBottom: '12px',
};

const titleStyle: CSSProperties = {
  fontSize: '24px',
  fontWeight: 800,
  color: '#1a1a1a',
  marginBottom: '16px',
  lineHeight: 1.2,
};

const descriptionStyle: CSSProperties = {
  fontSize: '15px',
  color: '#555555',
  lineHeight: 1.5,
  marginBottom: '32px',
};

const actionsStyle: CSSProperties = {
  display: 'flex',
  gap: '12px',
  width: '100%',
};

const secondaryButtonStyle: CSSProperties = { flex: 1 };
const primaryButtonStyle: CSSProperties = { flex: 2 };
