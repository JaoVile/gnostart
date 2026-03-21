import type { MapDockButtonDefinition } from '../dockButton.types';

export const cronogramButtonDefinition: MapDockButtonDefinition = {
  panel: 'agenda',
  label: 'Cronograma',
  icon: (
    <svg viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'>
      <rect x='4' y='5' width='16' height='15' rx='2.4' />
      <path d='M8 3.5V7' />
      <path d='M16 3.5V7' />
      <path d='M4 9.5H20' />
      <path d='M8 13H11' />
      <path d='M13 13H16' />
      <path d='M8 16.5H11' />
    </svg>
  ),
};
