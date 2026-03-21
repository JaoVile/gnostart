import type { ReactNode } from 'react';
import type { DockPanelKey } from '../types';

export interface MapDockButtonDefinition {
  panel: DockPanelKey;
  label: string;
  icon: ReactNode;
}
