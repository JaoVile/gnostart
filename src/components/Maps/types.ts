export type PoiType = 'atividade' | 'servico' | 'banheiro' | 'entrada';

export type PoiAccessCount = Record<string, number>;
export type AgendaDayId = '21';
export type PoiDataSource = 'backend' | 'local-workspace' | 'local-backup' | 'front-seed';
export type DockPanel = 'pins' | 'route' | 'agenda' | 'partners' | null;
export type DockPanelKey = Exclude<DockPanel, null>;
export type AgendaSessionPoiLinkOverrides = Record<string, string>;

export interface AgendaSpeaker {
  name: string;
  role: string;
}

export interface AgendaSession {
  id: string;
  dayId: AgendaDayId;
  weekday: string;
  dateLabel: string;
  category: string;
  title: string;
  summary: string;
  venue: string;
  audience: string;
  startTime: string;
  endTime: string;
  accent: string;
  mapQuery?: string;
  linkedPoiId?: string;
  speakers: AgendaSpeaker[];
}

export interface PointData {
  id: string;
  x: number;
  y: number;
  nome: string;
  tipo: PoiType;
  descricao?: string;
  imagemUrl?: string;
  contato?: string;
  corDestaque?: string;
  selo?: string;
  nodeId?: string;
}

export type EditingPoi = Partial<PointData>;

export type AdminWorkspaceSnapshot = {
  version: number;
  pois: PointData[];
  draftPoiIds: string[];
  updatedAt: string;
};

export type AdminAgendaPoiLinkSnapshot = {
  version: number;
  links: AgendaSessionPoiLinkOverrides;
  updatedAt: string;
};

export type PoiRuntimeBackupSnapshot = {
  version: number;
  pois: PointData[];
};

export type InitialPoiRuntimeState = {
  pois: PointData[];
  source: PoiDataSource;
  draftPoiIds: string[];
};

export type TapIndicator = {
  id: number;
  x: number;
  y: number;
};

export type ImagePoint = {
  x: number;
  y: number;
};

export type ManualRouteOrigin = {
  id: 'manual_map_origin';
  label: string;
  x: number;
  y: number;
  lat: number;
  lng: number;
  snappedNodeId: string | null;
  nearestPoiId: string | null;
};

export type LiveTrackingState = 'idle' | 'requesting' | 'active' | 'blocked' | 'unsupported' | 'error';
export type LiveLocationSource = 'gps';
export type LiveLocationContextState = 'idle' | 'loading' | 'ready' | 'error';

export type LiveLocationState = {
  lat: number;
  lng: number;
  x: number;
  y: number;
  accuracyMeters: number;
  capturedAt: number;
  isInsideEvent: boolean;
  usedBoundaryGrace: boolean;
  snappedNodeId: string | null;
  nearestPoiId: string | null;
};
