import { TutorialStage, type LiveTrackingState } from '../routes-pins-previews/TutorialStage';
import { tutorialSteps, type TutorialStep } from './tutorialSteps';

export interface MapTutorialOverlayProps {
  isOpen: boolean;
  tutorialStepIndex: number;
  currentTutorialStep: TutorialStep;
  liveTrackingState: LiveTrackingState;
  liveLocationStatusText?: string;
  isTutorialLocationStep: boolean;
  canFinishTutorialLocationStep: boolean;
  onClose: () => void;
  onPreviousStep: () => void;
  onNextStep: () => void;
  onRequestLocation: () => void;
}

export const MapTutorialOverlay = ({
  isOpen,
  tutorialStepIndex,
  currentTutorialStep,
  liveTrackingState,
  liveLocationStatusText,
  isTutorialLocationStep,
  canFinishTutorialLocationStep,
  onClose,
  onPreviousStep,
  onNextStep,
  onRequestLocation,
}: MapTutorialOverlayProps) => {
  if (!isOpen) return null;

  return (
    <div className='map-tutorial-overlay'>
      <div className='map-tutorial-card'>
        <div className='map-tutorial-progress' style={{ gridTemplateColumns: `repeat(${tutorialSteps.length}, minmax(0, 1fr))` }}>
          {tutorialSteps.map((step, index) => (
            <div key={step.title} className={`map-tutorial-progress-item ${index <= tutorialStepIndex ? 'active' : ''}`} />
          ))}
        </div>

        <div className='tutorial-top-row'>
          <span className='tutorial-step-pill'>
            Passo {tutorialStepIndex + 1} de {tutorialSteps.length}
          </span>
          <button onClick={onClose} className='tutorial-skip-button'>
            Pular
          </button>
        </div>
        <div className='tutorial-eyebrow'>{currentTutorialStep.eyebrow}</div>
        <div className='tutorial-title'>{currentTutorialStep.title}</div>
        <div className='tutorial-copy'>{currentTutorialStep.text}</div>
        <TutorialStage
          visual={currentTutorialStep.visual}
          liveTrackingState={liveTrackingState}
          liveLocationStatusText={isTutorialLocationStep ? liveLocationStatusText : undefined}
          onRequestLocation={isTutorialLocationStep ? onRequestLocation : undefined}
        />

        <div className='tutorial-action-row'>
          {tutorialStepIndex > 0 && (
            <button onClick={onPreviousStep} className='btn btn-neutral tutorial-back-action' style={{ flex: 1 }}>
              Voltar
            </button>
          )}

          {tutorialStepIndex < tutorialSteps.length - 1 ? (
            <button onClick={onNextStep} className='btn btn-primary tutorial-primary-action' style={{ flex: 1 }}>
              Proximo
            </button>
          ) : (
            <button
              onClick={() => {
                if (!canFinishTutorialLocationStep) {
                  onRequestLocation();
                  return;
                }
                onClose();
              }}
              className='btn btn-success tutorial-primary-action'
              style={{ flex: 1 }}
            >
              {canFinishTutorialLocationStep
                ? 'Concluido'
                : liveTrackingState === 'blocked'
                  ? 'Tentar novamente'
                  : 'Ativar localizacao'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
