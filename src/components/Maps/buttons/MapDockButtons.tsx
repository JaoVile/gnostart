import type { ReactNode } from 'react';

type DockPanelKey = 'agenda' | 'pins' | 'partners';
type ActiveDockPanel = DockPanelKey | 'route' | null;

export interface MapDockButtonsProps {
  activeDockPanel: ActiveDockPanel;
  onTogglePanel: (panel: DockPanelKey) => void;
}

const buttonDefinitions: Array<{
  panel: DockPanelKey;
  label: string;
  icon: ReactNode;
}> = [
  {
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
  },
  {
    panel: 'pins',
    label: 'Locais',
    icon: (
      <svg viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'>
        <path d='M4 9L12 3L20 9V19A2 2 0 0 1 18 21H6A2 2 0 0 1 4 19V9Z' />
        <path d='M9 21V13H15V21' />
      </svg>
    ),
  },
  {
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
  },
];

export const MapDockButtons = ({ activeDockPanel, onTogglePanel }: MapDockButtonsProps) => (
  <div className='map-action-dock-buttons'>
    {buttonDefinitions.map((button) => (
      <button
        key={button.panel}
        onClick={() => onTogglePanel(button.panel)}
        className={`map-toggle-btn map-toggle-btn-${button.panel} ${activeDockPanel === button.panel ? 'active' : ''} ${
          activeDockPanel && activeDockPanel !== button.panel ? 'dimmed' : ''
        }`}
        aria-pressed={activeDockPanel === button.panel}
      >
        <span className='map-toggle-btn-icon' aria-hidden='true'>
          {button.icon}
        </span>
        <span className='map-toggle-btn-label'>{button.label}</span>
      </button>
    ))}
  </div>
);
