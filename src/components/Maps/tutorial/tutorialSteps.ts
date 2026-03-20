import type { TutorialVisual } from '../routes-pins-previews/TutorialStage';

export interface TutorialStep {
  eyebrow: string;
  title: string;
  text: string;
  visual: TutorialVisual;
}

export const tutorialSteps: readonly TutorialStep[] = [
  {
    eyebrow: 'Startup Day',
    title: 'Mapa e agenda',
    text: 'Tudo essencial em um fluxo unico.',
    visual: 'intro',
  },
  {
    eyebrow: 'Pins',
    title: 'Abrir local',
    text: 'Toque, veja e siga.',
    visual: 'pins',
  },
  {
    eyebrow: 'GPS',
    title: 'Ativar e navegar',
    text: 'Sua posicao vira a origem automatica.',
    visual: 'location',
  },
] as const;
