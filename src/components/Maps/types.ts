export type PoiType = 'atividade' | 'servico' | 'banheiro' | 'entrada';

export type PoiAccessCount = Record<string, number>;
export type AgendaDayId = '21';
export type PoiDataSource = 'local-workspace' | 'local-backup' | 'front-seed';
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

export type MapBuildRegistration = {
  mapPixelWidth: number;
  mapPixelHeight: number;
  overlayWest: number;
  overlayEast: number;
  overlaySouth: number;
  overlayNorth: number;
  primarySurfaceUrl: string;
  logicalMaskSource: string;
  logicalMaskMode: string;
  logicalWhiteThreshold: number;
  freeWalkNavigationEnabled: boolean;
  poiLayoutSignature: string;
};

export type AdminWorkspaceSnapshot = {
  version: number;
  pois: PointData[];
  draftPoiIds: string[];
  updatedAt: string;
  build?: MapBuildRegistration;
};

export type AdminAgendaPoiLinkSnapshot = {
  version: number;
  links: AgendaSessionPoiLinkOverrides;
  updatedAt: string;
};

export type PoiRuntimeBackupSnapshot = {
  version: number;
  pois: PointData[];
  build?: MapBuildRegistration;
};

export type PoiAdminExportSnapshot = {
  version: number;
  eventName: string;
  updatedAt: string;
  draftPoiIds: string[];
  pois: PointData[];
  build?: MapBuildRegistration;
};

export type InitialPoiRuntimeState = {
  pois: PointData[];
  source: PoiDataSource;
  draftPoiIds: string[];
  buildWarning?: string | null;
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
