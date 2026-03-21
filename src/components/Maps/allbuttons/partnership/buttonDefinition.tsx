import type { MapDockButtonDefinition } from '../dockButton.types';

export const partnershipButtonDefinition: MapDockButtonDefinition = {
  panel: 'partners',
  label: 'Parceiros',
  icon: (
    <svg viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'>
      <path d='M7 12.5L9.9 15.4L17 8.3' />
      <path d='M5 6.5H11' />
      <path d='M13 6.5H19' />
      <path d='M4.5 18H10.5' />
      <path d='M13.5 18H19.5' />
    </svg>
  ),
};
