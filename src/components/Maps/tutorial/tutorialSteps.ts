export interface TutorialStep {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  icon?: string;
}

export const tutorialSteps: readonly TutorialStep[] = [
  {
    id: 'welcome',
    eyebrow: 'Boas-vindas',
    title: 'O mapa do evento na palma da sua mão',
    description:
      'Acesse o botão de Cronograma para acompanhar os horários, ver o que esta acontecendo agora e planejar seu proximo destino.',
    icon: '🗺️',
  },
  {
    id: 'pins',
    eyebrow: 'Explorar Locais',
    title: 'Conheca cada espaço e atração',
    description:
      'Toque em qualquer pin do mapa para abrir os detalhes do local, conferir a foto do espaço e navegar pelo conteúdo do evento.',
    icon: '📍',
  },
  {
    id: 'partners',
    eyebrow: 'Parceiros',
    title: 'Veja quem faz parte do evento',
    description:
      'Use o botão de Parceiros para consultar as marcas e instituições envolvidas, sem sair da experiencia principal do evento para realizar pesquisas externas.',
    icon: '🤝',
  },
] as const;
