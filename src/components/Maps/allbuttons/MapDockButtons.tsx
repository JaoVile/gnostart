import type { DockPanel, DockPanelKey } from '../types';
import { cronogramButtonDefinition } from './cronogram/buttonDefinition';
import { localButtonDefinition } from './local/buttonDefinition';
import { partnershipButtonDefinition } from './partnership/buttonDefinition';
import './dock.css';

export interface MapDockButtonsProps {
  activeDockPanel: DockPanel;
  onTogglePanel: (panel: DockPanelKey) => void;
}

const buttonDefinitions = [
  cronogramButtonDefinition,
  localButtonDefinition,
  partnershipButtonDefinition,
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
