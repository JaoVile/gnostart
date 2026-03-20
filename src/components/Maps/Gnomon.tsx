import {
  Circle,
  CircleMarker,
  ImageOverlay,
  MapContainer,
  Polygon,
  TileLayer,
  Tooltip,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { findNearestNode } from '../../utils/pathfinding';
import {
  createPoi,
  deletePoi,
  fetchMapBootstrap,
  saveAgendaPoiLinks,
  trackPoiAccess,
  updatePoi,
  type MapPoiDto,
  type UpsertPoiPayload,
} from '../../services/mapApi';
import { type LocationContextResponse } from '../../services/locationApi';
import { MapDockButtons } from './buttons/MapDockButtons';
import { MapHeader } from './header/MapHeader';
import { MapAdminEditor, MapAdminPanel } from './admin/MapAdminPanel';
import { AgendaPanel } from './agenda/AgendaPanel';
import { AgendaNotificationStack } from './agenda/AgendaNotificationStack';
import { useAgendaNotifications } from './agenda/useAgendaNotifications';
import { LiveLocationCard } from './location/LiveLocationCard';
import { useLiveLocation } from './location/useLiveLocation';
import { useMapDock } from './dock/useMapDock';
import { MapController, MapInteractionEvents, MapSizeSync, MapViewportBoundsController } from './map/MapControllers';
import { MapPoiLayer, MapPresenceLayer, MapRouteLayer } from './map/MapLayers';
import {
  clampNumber,
  eventBoundaryLatLngPoints,
  formatClockTimeLabel,
  getClosestPointOnPolygonEdges,
  getDistanceToPolygonEdges,
  getImagePointDistance,
  imageToLatLng,
  isPointInsidePolygon,
  latLngToImageOverlay,
  latLngToImageRaw,
  mapOverlayBounds,
  mapViewportBounds,
  MAP_HEIGHT,
  MAP_WIDTH,
} from './map/mapProjection';
import {
  BRAND_COLORS,
  SOFT_PIN_COLORS,
  getPoiAccentColor,
  getPoiBadgeText,
  getPoiIcon,
  isBrandPaletteColor,
  mixColors,
  normalizeBadgeText,
  normalizeHexColor,
  stateIcons,
} from './map/poiVisuals';
import { useMapBootstrap } from './map/useMapBootstrap';
import { PartnersPanel } from './partners/PartnersPanel';
import { ManualOriginFallbackOverlay } from './routes-pins-previews/ManualOriginFallbackOverlay';
import { PinPanel } from './routes-pins-previews/PinPanel';
import { RoutePanel } from './routes-pins-previews/RoutePanel';
import { useRouteNavigation } from './routes-pins-previews/useRouteNavigation';
import { usePoiAdmin } from './admin/usePoiAdmin';
import { MapTutorialOverlay } from './tutorial/MapTutorialOverlay';
import { tutorialSteps } from './tutorial/tutorialSteps';
import { agendaDays, agendaSessions, compareAgendaSessions, formatAgendaDuration } from './data/agenda';
import type {
  AdminAgendaPoiLinkSnapshot,
  AdminWorkspaceSnapshot,
  AgendaDayId,
  AgendaSession,
  AgendaSessionPoiLinkOverrides,
  DockPanelKey,
  EditingPoi,
  InitialPoiRuntimeState,
  LiveLocationContextState,
  LiveLocationSource,
  LiveLocationState,
  LiveTrackingState,
  ManualRouteOrigin,
  PoiAccessCount,
  PoiDataSource,
  PointData,
  PoiRuntimeBackupSnapshot,
  PoiType,
  TapIndicator,
} from './types';
import {
  getPoiSearchTerms,
  normalizeContact,
  normalizeForSearch,
  resolveAgendaSessionPoi,
  sessionMatchesPoi,
  upsertPoiInCollection,
} from './utils/poiMatching';
import {
  EVENT_BOUNDARY_IMAGE_POINTS,
  FREE_WALK_NAVIGATION_ENABLED,
  MAP_CENTER,
  MAP_VIEW_CENTER,
  OFFICIAL_MAP_BOUNDS_VISCOSITY,
  OFFICIAL_MAP_SURFACE_URLS,
  MAP_OVERLAY_EAST,
  MAP_OVERLAY_NORTH,
  MAP_OVERLAY_SOUTH,
  MAP_OVERLAY_WEST,
  getPoiAutoVisibleLimit,
  getPoiPinScaleTier,
  getPoiPreviewSizeLimits,
  shouldShowPoiPins,
} from '../../config/mapConfig';
import rawInitialPoisSeed from '../../data/locaisEventoSocialSeed.json';
import brandIcon from '../../assets/icone.svg';

const DEFAULT_DOCK_PANEL_HEIGHTS: Record<DockPanelKey, number> = {
  pins: 0.66,
  route: 0.7,
  agenda: 0.9,
  partners: 0.9,
};

const MIN_DOCK_PANEL_HEIGHTS: Record<DockPanelKey, number> = {
  pins: 0.34,
  route: 0.38,
  agenda: 0.42,
  partners: 0.42,
};

const getLiveRouteOriginKey = (location: Pick<LiveLocationState, 'x' | 'y' | 'snappedNodeId'>) => {
  if (!FREE_WALK_NAVIGATION_ENABLED) {
    return location.snappedNodeId ?? '';
  }

  const bucketedX = Math.round(location.x / LIVE_ROUTE_REFRESH_BUCKET_PX) * LIVE_ROUTE_REFRESH_BUCKET_PX;
  const bucketedY = Math.round(location.y / LIVE_ROUTE_REFRESH_BUCKET_PX) * LIVE_ROUTE_REFRESH_BUCKET_PX;
  return `${bucketedX}_${bucketedY}`;
};

const getLiveRouteKey = (destinationId: string, location: Pick<LiveLocationState, 'x' | 'y' | 'snappedNodeId'>) =>
  `${destinationId}:${getLiveRouteOriginKey(location)}`;
const ROUTE_REVEAL_MIN_DURATION_MS = 1000;
const ROUTE_REVEAL_MAX_DURATION_MS = 3000;
const ROUTE_REVEAL_MS_PER_METER = 11;
const LIVE_ROUTE_REFRESH_BUCKET_PX = 12;
const MANUAL_ROUTE_ORIGIN_NODE_MAX_DISTANCE = 110;
const MANUAL_ROUTE_ORIGIN_POI_MAX_DISTANCE = 120;
const MANUAL_ROUTE_FALLBACK_TIMEOUT_MS = 1000;
const PRESENTATION_WALKER_MIN_DURATION_MS = 2500;
const PRESENTATION_WALKER_MAX_DURATION_MS = 5200;
const PRESENTATION_WALKER_MS_PER_METER = 16;
const TAP_FEEDBACK_DURATION_MS = 560;
const TAP_FEEDBACK_MAX_MOVE_PX = 12;
const BASEMAP_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const BASEMAP_TILE_ATTRIBUTION = '&copy; OpenStreetMap contributors';
// OSM nativo costuma ir ate z19. Acima disso, o Leaflet sobre-amplia os tiles.
const BASEMAP_TILE_MAX_NATIVE_ZOOM = 19;
const BASEMAP_TILE_MAX_ZOOM = 30;
const AVERAGE_WALKING_SPEED_MPS = 1.4;
const WALKER_PROGRESS_UPDATE_MS = 250;

const canUseBrowserImageLoader = () => typeof window !== 'undefined' && typeof window.Image !== 'undefined';
const preloadMapSurface = (url: string) =>
  new Promise<boolean>((resolve) => {
    if (!canUseBrowserImageLoader()) {
      resolve(false);
      return;
    }

    const image = new window.Image();
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.src = url;
  });

const mapGeolocationErrorMessage = (error: GeolocationPositionError) => {
  if (error.code === error.PERMISSION_DENIED) {
    return 'A permissão de localização foi negada. Libere o GPS no navegador para usar a origem automática.';
  }

  if (error.code === error.POSITION_UNAVAILABLE) {
    return 'Não conseguimos ler sua posição agora. Confira o GPS do celular e tente novamente.';
  }

  if (error.code === error.TIMEOUT) {
    return 'O GPS demorou mais do que o esperado para responder. Tente novamente em um local aberto.';
  }

  return 'Não foi possível iniciar a localização em tempo real.';
};

const isGeolocationSecureContext = () => {
  if (typeof window === 'undefined') return false;
  return window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
};

const getGeolocationSecureContextMessage = () =>
  'A localização em tempo real exige conexão segura. Abra o mapa pelo domínio oficial com HTTPS para usar o GPS.';

const toRadians = (value: number) => (value * Math.PI) / 180;

const getLatLngDistanceMeters = (from: [number, number], to: [number, number]) => {
  const earthRadius = 6371000;
  const [fromLat, fromLng] = from;
  const [toLat, toLng] = to;
  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);
  const lat1 = toRadians(fromLat);
  const lat2 = toRadians(toLat);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const haversine = sinLat ** 2 + Math.cos(lat1) * Math.cos(lat2) * sinLng ** 2;
  const centralAngle = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  return earthRadius * centralAngle;
};

const MAP_OVERLAY_WIDTH_METERS = getLatLngDistanceMeters(
  [MAP_CENTER[0], MAP_OVERLAY_WEST],
  [MAP_CENTER[0], MAP_OVERLAY_EAST],
);
const MAP_OVERLAY_HEIGHT_METERS = getLatLngDistanceMeters(
  [MAP_OVERLAY_SOUTH, MAP_CENTER[1]],
  [MAP_OVERLAY_NORTH, MAP_CENTER[1]],
);
const MAP_METERS_PER_IMAGE_PIXEL =
  ((MAP_OVERLAY_WIDTH_METERS / MAP_WIDTH) + (MAP_OVERLAY_HEIGHT_METERS / MAP_HEIGHT)) / 2;
const metersToImagePixels = (meters: number) => meters / MAP_METERS_PER_IMAGE_PIXEL;
const getLiveLocationBoundaryGraceMeters = (accuracyMeters: number) =>
  clampNumber(
    Math.max(LIVE_LOCATION_BOUNDARY_GRACE_MIN_METERS, accuracyMeters * LIVE_LOCATION_BOUNDARY_ACCURACY_FACTOR),
    LIVE_LOCATION_BOUNDARY_GRACE_MIN_METERS,
    LIVE_LOCATION_BOUNDARY_GRACE_MAX_METERS,
  );

const getPathDistanceMeters = (positions: [number, number][]) => {
  if (positions.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < positions.length; i += 1) {
    total += getLatLngDistanceMeters(positions[i - 1], positions[i]);
  }
  return total;
};

const formatDistanceLabel = (meters: number) => {
  if (!Number.isFinite(meters) || meters <= 0) return '0 m';
  if (meters >= 1000) return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
  const rounded = Math.max(5, Math.round(meters / 5) * 5);
  return `${rounded} m`;
};

const isLiveLocationAccuracyReliable = (accuracyMeters: number) =>
  Number.isFinite(accuracyMeters) && accuracyMeters <= LIVE_LOCATION_MAX_POSITION_ACCURACY_METERS;

const formatWalkingTimeLabel = (minutes: number) => {
  if (!Number.isFinite(minutes) || minutes <= 0.45) return '< 1 min';
  const rounded = Math.max(1, Math.round(minutes));
  if (rounded >= 60) {
    const hours = Math.floor(rounded / 60);
    const restMinutes = rounded % 60;
    return restMinutes > 0 ? `${hours}h ${restMinutes}min` : `${hours}h`;
  }
  return `${rounded} min`;
};

const easeInOutCubic = (value: number) =>
  value < 0.5 ? 4 * value ** 3 : 1 - ((-2 * value + 2) ** 3) / 2;

const getAdaptiveAnimationDuration = (
  distanceMeters: number,
  minDurationMs: number,
  maxDurationMs: number,
  msPerMeter: number,
) => {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return minDurationMs;
  return Math.min(maxDurationMs, Math.max(minDurationMs, distanceMeters * msPerMeter));
};

const getPointAlongPath = (positions: [number, number][], progress: number): [number, number] => {
  if (positions.length === 0) return [MAP_CENTER[0], MAP_CENTER[1]];
  if (positions.length === 1) return positions[0];

  const clampedProgress = Math.max(0, Math.min(1, progress));
  const segmentDistances: number[] = [];
  let totalDistance = 0;
  for (let i = 1; i < positions.length; i += 1) {
    const distance = getLatLngDistanceMeters(positions[i - 1], positions[i]);
    segmentDistances.push(distance);
    totalDistance += distance;
  }

  if (totalDistance <= 0) return positions[positions.length - 1];

  const targetDistance = totalDistance * clampedProgress;
  let coveredDistance = 0;

  for (let i = 1; i < positions.length; i += 1) {
    const segmentDistance = segmentDistances[i - 1];
    if (coveredDistance + segmentDistance >= targetDistance) {
      const ratio =
        segmentDistance > 0 ? (targetDistance - coveredDistance) / segmentDistance : 0;
      const [startLat, startLng] = positions[i - 1];
      const [endLat, endLng] = positions[i];
      return [startLat + (endLat - startLat) * ratio, startLng + (endLng - startLng) * ratio];
    }
    coveredDistance += segmentDistance;
  }

  return positions[positions.length - 1];
};

const getPathSliceUntilProgress = (positions: [number, number][], progress: number): [number, number][] => {
  if (positions.length === 0) return [];
  if (positions.length === 1) return positions;

  const clampedProgress = Math.max(0, Math.min(1, progress));
  if (clampedProgress <= 0) return [positions[0]];
  if (clampedProgress >= 1) return positions;

  const segmentDistances: number[] = [];
  let totalDistance = 0;
  for (let i = 1; i < positions.length; i += 1) {
    const distance = getLatLngDistanceMeters(positions[i - 1], positions[i]);
    segmentDistances.push(distance);
    totalDistance += distance;
  }

  if (totalDistance <= 0) return positions;

  const targetDistance = totalDistance * clampedProgress;
  let coveredDistance = 0;
  const revealedPath: [number, number][] = [positions[0]];

  for (let i = 1; i < positions.length; i += 1) {
    const segmentDistance = segmentDistances[i - 1];
    if (coveredDistance + segmentDistance >= targetDistance) {
      const ratio = segmentDistance > 0 ? (targetDistance - coveredDistance) / segmentDistance : 0;
      const [startLat, startLng] = positions[i - 1];
      const [endLat, endLng] = positions[i];
      revealedPath.push([startLat + (endLat - startLat) * ratio, startLng + (endLng - startLng) * ratio]);
      return revealedPath;
    }

    revealedPath.push(positions[i]);
    coveredDistance += segmentDistance;
  }

  return positions;
};
const POI_ACCESS_STORAGE_KEY = 'gnostart.poiAccessCount';
const POI_RUNTIME_BACKUP_STORAGE_KEY = 'gnostart.poiRuntimeBackup';
const ADMIN_POI_WORKSPACE_STORAGE_KEY = 'gnostart.adminPoiWorkspace';
const ADMIN_AGENDA_POI_LINKS_STORAGE_KEY = 'gnostart.adminAgendaPoiLinks';
const TUTORIAL_STORAGE_KEY = 'gnostart.mapTutorialSeen.v2';
const MOBILE_MEDIA_QUERY = '(max-width: 900px)';
const COMPACT_MEDIA_QUERY = '(max-width: 1180px), (max-height: 760px)';
const PRESENTATION_MODE_QUERY_KEY = 'modo';
const PRESENTATION_MODE_DEFAULT = true;
const POI_STORAGE_SCHEMA_VERSION = 6;
const POI_DATA_EXPORT_FILENAME = 'locais_evento_social.json';
const EVENT_NAME = 'GNOSTART';
const EVENT_LABEL = `Evento ${EVENT_NAME}`;
const REMOVED_POI_IDS = new Set<string>();
const PUBLICLY_HIDDEN_POI_IDS = new Set<string>();
const LIVE_LOCATION_STORAGE_KEY = 'gnostart.liveLocationSnapshot';
const LIVE_LOCATION_NODE_MAX_DISTANCE = 150;
const LIVE_LOCATION_NEAREST_POI_MAX_DISTANCE = 180;
const LIVE_LOCATION_WARNING_ACCURACY_METERS = 35;
const LIVE_LOCATION_MAX_POSITION_ACCURACY_METERS = 120;
const LIVE_LOCATION_RESTORE_MAX_AGE_MS = 25000;
const LIVE_LOCATION_STALE_RESTART_AFTER_MS = 15000;
const LIVE_LOCATION_CONTEXT_REFRESH_INTERVAL_MS = 15000;
const LIVE_LOCATION_CONTEXT_MIN_MOVE_METERS = 12;
const LIVE_LOCATION_BOUNDARY_GRACE_MIN_METERS = 12;
const LIVE_LOCATION_BOUNDARY_GRACE_MAX_METERS = 60;
const LIVE_LOCATION_BOUNDARY_ACCURACY_FACTOR = 0.6;
const LIVE_LOCATION_REFRESH_INTERVAL_MS = 4000;
const LIVE_LOCATION_WATCH_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 1000,
  timeout: 10000,
};
const LIVE_LOCATION_REFRESH_OPTIONS: PositionOptions = {
  ...LIVE_LOCATION_WATCH_OPTIONS,
  maximumAge: 0,
  timeout: 12000,
};
// Ajuste manual rapido de layout. Troque estes valores para calibrar a interface sem expor botoes no app.
const BRAND_LOGO_SCALE = 1.2;

const getPresentationModeFromQuery = () => {
  if (typeof window === 'undefined') return PRESENTATION_MODE_DEFAULT;
  const rawMode = new URLSearchParams(window.location.search)
    .get(PRESENTATION_MODE_QUERY_KEY)
    ?.trim()
    .toLowerCase();

  if (rawMode === 'admin' || rawMode === 'edicao') return false;
  if (rawMode === 'apresentacao') return true;
  return PRESENTATION_MODE_DEFAULT;
};

const defaultPoiImages: Record<PoiType, string> = {
  entrada: '/images/pois/indicadores/entrada.svg',
  banheiro: '/images/pois/indicadores/banheiro.svg',
  atividade: '/images/pois/indicadores/evento.svg',
  servico: '/images/pois/indicadores/apoio.svg',
};

const poiTypeLabels: Record<PoiType, string> = {
  atividade: 'Atividades',
  servico: 'Serviços',
  banheiro: 'Banheiros',
  entrada: 'Entradas',
};

const poiTypeSingularLabels: Record<PoiType, string> = {
  atividade: 'Atividade',
  servico: 'Serviço',
  banheiro: 'Banheiro',
  entrada: 'Entrada',
};

const rawInitialPois: PointData[] = [
  {
    id: 'entrada_principal',
    nome: 'Entrada Principal',
    tipo: 'entrada',
    x: 747,
    y: 399,
    descricao: 'Acesso principal do evento para o publico.',
    imagemUrl: '/images/pois/indicadores/entrada.svg',
    corDestaque: SOFT_PIN_COLORS.greenSoft,
    selo: 'ENT',
  },
  {
    id: 'credenciamento',
    nome: 'Credenciamento',
    tipo: 'servico',
    x: 777,
    y: 399,
    descricao: 'Retirada de pulseiras, orientacoes e apoio inicial.',
    imagemUrl: '/images/pois/indicadores/apoio.svg',
    corDestaque: SOFT_PIN_COLORS.blueSoft,
    selo: 'CRD',
  },
  {
    id: 'entrada_caravanas',
    nome: 'Entrada Caravanas',
    tipo: 'entrada',
    x: 713,
    y: 328,
    descricao: 'Acesso reservado para grupos e caravanas.',
    imagemUrl: '/images/pois/indicadores/entrada.svg',
    corDestaque: SOFT_PIN_COLORS.greenLeaf,
    selo: 'CAR',
  },
  {
    id: 'palco_principal',
    nome: 'Palco Principal',
    tipo: 'atividade',
    x: 784,
    y: 342,
    descricao: 'Area central das palestras e conteudos principais.',
    imagemUrl: '/images/pois/indicadores/evento.svg',
    corDestaque: SOFT_PIN_COLORS.amberSoft,
    selo: 'PAL',
  },
  {
    id: 'banheiros',
    nome: 'Banheiros',
    tipo: 'banheiro',
    x: 764,
    y: 313,
    descricao: 'Conjunto de banheiros de apoio ao publico.',
    imagemUrl: '/images/pois/indicadores/banheiro.svg',
    corDestaque: SOFT_PIN_COLORS.skySoft,
    selo: 'WC',
  },
  {
    id: 'estande_realidade_virtual',
    nome: 'Estande Realidade Virtual',
    tipo: 'atividade',
    x: 733,
    y: 330,
    descricao: 'Espaco de demonstracao e experiencia imersiva.',
    imagemUrl: '/images/pois/indicadores/evento.svg',
    corDestaque: SOFT_PIN_COLORS.violetSoft,
    selo: 'ERV',
  },
  {
    id: 'espaco_instagramavel',
    nome: 'Espaco Instagramavel',
    tipo: 'atividade',
    x: 745,
    y: 326,
    descricao: 'Cenario visual para fotos e conteudo do evento.',
    imagemUrl: '/images/pois/indicadores/evento.svg',
    corDestaque: SOFT_PIN_COLORS.periwinkle,
    selo: 'IGR',
  },
  {
    id: 'area_startups',
    nome: 'Area das Startups',
    tipo: 'atividade',
    x: 797,
    y: 393,
    descricao: 'Espaco com as startups participantes do Startup Day.',
    imagemUrl: '/images/pois/indicadores/evento.svg',
    corDestaque: SOFT_PIN_COLORS.violetDeep,
    selo: 'STP',
  },
  {
    id: 'barracas_prefeitura',
    nome: 'Barracas Prefeitura',
    tipo: 'servico',
    x: 721,
    y: 383,
    descricao: 'Area institucional com os espacos da prefeitura.',
    imagemUrl: '/images/pois/indicadores/apoio.svg',
    corDestaque: SOFT_PIN_COLORS.slateSoft,
    selo: 'PREF',
  },
  {
    id: 'jardim_digital',
    nome: 'Jardim Digital',
    tipo: 'servico',
    x: 733,
    y: 385,
    descricao: 'Espaco parceiro voltado a tecnologia e inovacao.',
    imagemUrl: '/images/pois/indicadores/apoio.svg',
    corDestaque: SOFT_PIN_COLORS.tealSoft,
    selo: 'JD',
  },
  {
    id: 'arena_experiencia',
    nome: 'Arena Experiencia',
    tipo: 'atividade',
    x: 700,
    y: 371,
    descricao: 'Area continua com os espacos dos parceiros e ativacoes abertas ao publico ao longo do dia.',
    imagemUrl: '/images/pois/indicadores/evento.svg',
    corDestaque: SOFT_PIN_COLORS.violetSoft,
    selo: 'ARE',
  },
  {
    id: 'laboratorio_game',
    nome: 'Laboratório Game',
    tipo: 'atividade',
    x: 742,
    y: 338,
    descricao: 'Espaco das oficinas GameLab na Arena Porto Digital.',
    imagemUrl: '/images/pois/indicadores/evento.svg',
    corDestaque: SOFT_PIN_COLORS.violetSoft,
    selo: 'GLB',
  },
  {
    id: 'sala_economia_criativa_01',
    nome: 'Sala de Economia Criativa 01',
    tipo: 'servico',
    x: 665,
    y: 341,
    descricao: 'Sala reservada para hotseats e encontros do ecossistema.',
    imagemUrl: '/images/pois/indicadores/apoio.svg',
    corDestaque: SOFT_PIN_COLORS.blueSoft,
    selo: 'EC1',
  },
  {
    id: 'sala_economia_criativa_02',
    nome: 'Sala de Economia Criativa 02',
    tipo: 'servico',
    x: 665,
    y: 367,
    descricao: 'Sala reservada para hotseats e encontros do ecossistema.',
    imagemUrl: '/images/pois/indicadores/apoio.svg',
    corDestaque: SOFT_PIN_COLORS.blueDeep,
    selo: 'EC2',
  },
  {
    id: 'armazem_da_criatividade_1773977448618',
    nome: 'Armazem da Criatividade',
    tipo: 'entrada',
    x: 813,
    y: 376,
    descricao: 'Acesso lateral para o Laboratorio Game e para as salas de Economia Criativa 01 e 02.',
    imagemUrl: '/images/pois/indicadores/entrada.svg',
    corDestaque: SOFT_PIN_COLORS.greenSoft,
    selo: 'ARM',
  },
  {
    id: 'senac',
    nome: 'SENAC',
    tipo: 'servico',
    x: 688,
    y: 331,
    descricao: 'Espaco da instituicao parceira SENAC.',
    imagemUrl: '/images/pois/indicadores/apoio.svg',
    corDestaque: SOFT_PIN_COLORS.blueSoft,
    selo: 'SNC',
  },
  {
    id: 'senai',
    nome: 'SENAI',
    tipo: 'servico',
    x: 680,
    y: 374,
    descricao: 'Espaco da instituicao parceira SENAI.',
    imagemUrl: '/images/pois/indicadores/apoio.svg',
    corDestaque: SOFT_PIN_COLORS.blueDeep,
    selo: 'SNI',
  },
  {
    id: 'asces',
    nome: 'ASCES',
    tipo: 'servico',
    x: 680,
    y: 341,
    descricao: 'Espaco da instituicao parceira ASCES.',
    imagemUrl: '/images/pois/indicadores/apoio.svg',
    corDestaque: SOFT_PIN_COLORS.silverSoft,
    selo: 'ASC',
  },
  {
    id: 'nassau',
    nome: 'UNINASSAU',
    tipo: 'servico',
    x: 698,
    y: 393,
    descricao: 'Espaco da instituicao parceira UNINASSAU.',
    imagemUrl: '/images/pois/indicadores/apoio.svg',
    corDestaque: SOFT_PIN_COLORS.warmSand,
    selo: 'NAS',
  },
  {
    id: 'credenciamento_caravanas',
    nome: 'Credenciamento Caravanas',
    tipo: 'servico',
    x: 714,
    y: 341,
    descricao: 'Atendimento e credenciamento dedicados aos grupos e caravanas.',
    imagemUrl: '/images/pois/indicadores/apoio.svg',
    corDestaque: SOFT_PIN_COLORS.tealSoft,
    selo: 'CCV',
  },
  {
    id: 'cafeteria_1773957701772',
    nome: 'CAFETERIA',
    tipo: 'servico',
    x: 809,
    y: 392,
    imagemUrl: '/images/pois/indicadores/evento.svg',
  },
];

const attachNearestNode = (poi: PointData): PointData => {
  if (FREE_WALK_NAVIGATION_ENABLED) return poi;
  if (poi.nodeId) return poi;
  const nearestNode = findNearestNode(poi.x, poi.y, 90);
  return { ...poi, nodeId: nearestNode ?? undefined };
};

const isPoiRemoved = (id: string) => REMOVED_POI_IDS.has(id);

const fromApiPoi = (poi: MapPoiDto): PointData => attachNearestNode(poi);

const sanitizePoiCollection = (poiList: PointData[]) => poiList.filter((poi) => !isPoiRemoved(poi.id));

const toPoiApiPayload = (
  poi: PointData,
  options?: {
    includeId?: boolean;
  },
): UpsertPoiPayload => ({
  ...(options?.includeId ? { id: poi.id } : {}),
  nome: poi.nome,
  tipo: poi.tipo,
  x: poi.x,
  y: poi.y,
  descricao: poi.descricao,
  imagemUrl: poi.imagemUrl,
  contato: poi.contato,
  corDestaque: poi.corDestaque,
  selo: poi.selo,
  nodeId: poi.nodeId,
});

const isPoiType = (value: unknown): value is PoiType =>
  value === 'atividade' || value === 'servico' || value === 'banheiro' || value === 'entrada';

const sanitizeStoredPoi = (value: unknown): PointData | null => {
  if (!value || typeof value !== 'object') return null;

  const candidate = value as Record<string, unknown>;
  const x = typeof candidate.x === 'number' ? candidate.x : Number(candidate.x);
  const y = typeof candidate.y === 'number' ? candidate.y : Number(candidate.y);

  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.nome !== 'string' ||
    !isPoiType(candidate.tipo) ||
    !Number.isFinite(x) ||
    !Number.isFinite(y)
  ) {
    return null;
  }

  if (isPoiRemoved(candidate.id)) {
    return null;
  }

  return attachNearestNode({
    id: candidate.id,
    nome: candidate.nome.trim(),
    tipo: candidate.tipo,
    x,
    y,
    descricao: typeof candidate.descricao === 'string' ? candidate.descricao : undefined,
    imagemUrl: typeof candidate.imagemUrl === 'string' ? candidate.imagemUrl : undefined,
    contato: typeof candidate.contato === 'string' ? candidate.contato : undefined,
    corDestaque: typeof candidate.corDestaque === 'string' ? candidate.corDestaque : undefined,
    selo: typeof candidate.selo === 'string' ? candidate.selo : undefined,
    nodeId: typeof candidate.nodeId === 'string' ? candidate.nodeId : undefined,
  });
};

const parseStoredPoiList = (value: unknown) =>
  (Array.isArray(value) ? value.map(sanitizeStoredPoi).filter(Boolean) : []) as PointData[];

const getFrontSeedPois = () => {
  const importedSeedPois = parseStoredPoiList(rawInitialPoisSeed);
  return importedSeedPois.length > 0 ? importedSeedPois : sanitizePoiCollection(rawInitialPois.map(attachNearestNode));
};

const loadPoiRuntimeBackup = (): PointData[] => {
  if (typeof window === 'undefined') return [];

  try {
    const rawValue = window.localStorage.getItem(POI_RUNTIME_BACKUP_STORAGE_KEY);
    if (!rawValue) return [];
    const parsed = JSON.parse(rawValue) as Partial<PoiRuntimeBackupSnapshot> | PointData[];
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return [];
    }

    if (parsed.version !== POI_STORAGE_SCHEMA_VERSION) {
      return [];
    }

    return parseStoredPoiList(parsed.pois);
  } catch {
    return [];
  }
};

const persistPoiRuntimeBackup = (value: PointData[]) => {
  if (typeof window === 'undefined') return;

  try {
    const snapshot: PoiRuntimeBackupSnapshot = {
      version: POI_STORAGE_SCHEMA_VERSION,
      pois: value,
    };
    window.localStorage.setItem(POI_RUNTIME_BACKUP_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignora erro de storage para não interromper o mapa.
  }
};

const loadAdminWorkspaceSnapshot = (): AdminWorkspaceSnapshot | null => {
  if (typeof window === 'undefined') return null;

  try {
    const rawValue = window.localStorage.getItem(ADMIN_POI_WORKSPACE_STORAGE_KEY);
    if (!rawValue) return null;

    const parsed = JSON.parse(rawValue) as Partial<AdminWorkspaceSnapshot>;
    if (parsed.version !== POI_STORAGE_SCHEMA_VERSION) return null;
    const pois = parseStoredPoiList(parsed?.pois);
    if (pois.length === 0) return null;

    const validPoiIds = new Set(pois.map((poi) => poi.id));
    const draftPoiIds = Array.isArray(parsed?.draftPoiIds)
      ? parsed.draftPoiIds.filter((id): id is string => typeof id === 'string' && validPoiIds.has(id))
      : [];

    return {
      version: POI_STORAGE_SCHEMA_VERSION,
      pois,
      draftPoiIds,
      updatedAt: typeof parsed?.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
};

const persistAdminWorkspaceSnapshot = (value: Omit<AdminWorkspaceSnapshot, 'version'>) => {
  if (typeof window === 'undefined') return;

  try {
    const snapshot: AdminWorkspaceSnapshot = {
      version: POI_STORAGE_SCHEMA_VERSION,
      pois: value.pois,
      draftPoiIds: value.draftPoiIds,
      updatedAt: value.updatedAt,
    };
    window.localStorage.setItem(ADMIN_POI_WORKSPACE_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignora erro de storage para não interromper o admin.
  }
};

const clearAdminWorkspaceSnapshot = () => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(ADMIN_POI_WORKSPACE_STORAGE_KEY);
  } catch {
    // Ignora erro de storage para não interromper o admin.
  }
};

const sanitizeAgendaPoiLinkRecord = (value: unknown): AgendaSessionPoiLinkOverrides => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      ([sessionId, poiId]) => typeof sessionId === 'string' && typeof poiId === 'string' && poiId.trim().length > 0,
    ),
  );
};

const loadAdminAgendaPoiLinks = (): AgendaSessionPoiLinkOverrides => {
  if (typeof window === 'undefined') return {};

  try {
    const rawValue = window.localStorage.getItem(ADMIN_AGENDA_POI_LINKS_STORAGE_KEY);
    if (!rawValue) return {};

    const parsed = JSON.parse(rawValue) as Partial<AdminAgendaPoiLinkSnapshot> | Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    const hasVersionedShape = 'version' in parsed || 'links' in parsed;
    if (hasVersionedShape) {
      const snapshot = parsed as Partial<AdminAgendaPoiLinkSnapshot>;
      if (snapshot.version !== POI_STORAGE_SCHEMA_VERSION) return {};
      return sanitizeAgendaPoiLinkRecord(snapshot.links);
    }

    return sanitizeAgendaPoiLinkRecord(parsed);
  } catch {
    return {};
  }
};

const persistAdminAgendaPoiLinks = (value: AgendaSessionPoiLinkOverrides) => {
  if (typeof window === 'undefined') return;

  try {
    const snapshot: AdminAgendaPoiLinkSnapshot = {
      version: POI_STORAGE_SCHEMA_VERSION,
      links: value,
      updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(ADMIN_AGENDA_POI_LINKS_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignora erro de storage para nao interromper o admin.
  }
};

const getInitialPoiRuntimeState = (): InitialPoiRuntimeState => {
  const workspaceSnapshot = loadAdminWorkspaceSnapshot();
  if (workspaceSnapshot) {
    return {
      pois: workspaceSnapshot.pois,
      source: 'local-workspace',
      draftPoiIds: workspaceSnapshot.draftPoiIds,
    };
  }

  const runtimeBackup = loadPoiRuntimeBackup();
  if (runtimeBackup.length > 0) {
    return {
      pois: runtimeBackup,
      source: 'local-backup',
      draftPoiIds: [],
    };
  }

  return {
    pois: getFrontSeedPois(),
    source: 'front-seed',
    draftPoiIds: [],
  };
};

const loadPoiAccessCount = (): PoiAccessCount => {
  if (typeof window === 'undefined') return {};

  try {
    const rawValue = window.localStorage.getItem(POI_ACCESS_STORAGE_KEY);
    if (!rawValue) return {};
    const parsed = JSON.parse(rawValue) as PoiAccessCount;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const persistPoiAccessCount = (value: PoiAccessCount) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(POI_ACCESS_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Ignora erro de storage para não quebrar a UX.
  }
};

const sanitizeStoredLiveLocation = (value: unknown): LiveLocationState | null => {
  if (!value || typeof value !== 'object') return null;

  const candidate = value as Record<string, unknown>;
  const lat = typeof candidate.lat === 'number' ? candidate.lat : Number(candidate.lat);
  const lng = typeof candidate.lng === 'number' ? candidate.lng : Number(candidate.lng);
  const x = typeof candidate.x === 'number' ? candidate.x : Number(candidate.x);
  const y = typeof candidate.y === 'number' ? candidate.y : Number(candidate.y);
  const accuracyMeters =
    typeof candidate.accuracyMeters === 'number' ? candidate.accuracyMeters : Number(candidate.accuracyMeters);
  const capturedAt = typeof candidate.capturedAt === 'number' ? candidate.capturedAt : Number(candidate.capturedAt);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(accuracyMeters) ||
    !Number.isFinite(capturedAt)
  ) {
    return null;
  }

  return {
    lat,
    lng,
    x,
    y,
    accuracyMeters,
    capturedAt,
    isInsideEvent: candidate.isInsideEvent === true,
    usedBoundaryGrace: candidate.usedBoundaryGrace === true,
    snappedNodeId: typeof candidate.snappedNodeId === 'string' ? candidate.snappedNodeId : null,
    nearestPoiId: typeof candidate.nearestPoiId === 'string' ? candidate.nearestPoiId : null,
  };
};

const loadPersistedLiveLocation = (): LiveLocationState | null => {
  if (typeof window === 'undefined') return null;

  try {
    const rawValue = window.localStorage.getItem(LIVE_LOCATION_STORAGE_KEY);
    if (!rawValue) return null;

    const parsed = sanitizeStoredLiveLocation(JSON.parse(rawValue));
    if (!parsed) return null;
    if (Date.now() - parsed.capturedAt > LIVE_LOCATION_RESTORE_MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
};

const persistLiveLocationSnapshot = (value: LiveLocationState | null) => {
  if (typeof window === 'undefined') return;

  try {
    if (!value) {
      window.localStorage.removeItem(LIVE_LOCATION_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(LIVE_LOCATION_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Ignora erro de storage para não quebrar a UX.
  }
};

const getPoiGalleryImages = (poi: PointData) => {
  return Array.from(new Set([poi.imagemUrl, defaultPoiImages[poi.tipo]].filter(Boolean) as string[]));
};

const ModaCenterMap = () => {
  const [initialPoiRuntime] = useState(getInitialPoiRuntimeState);
  const [isPresentationMode] = useState(getPresentationModeFromQuery);
  const [isAdmin, setIsAdmin] = useState(() => !getPresentationModeFromQuery());
  const [pois, setPois] = useState<PointData[]>(initialPoiRuntime.pois);
  const [officialMapSurfaceUrl, setOfficialMapSurfaceUrl] = useState<string | null>(null);
  const [serverPois, setServerPois] = useState<PointData[]>([]);
  const [poiDataSource, setPoiDataSource] = useState<PoiDataSource>(initialPoiRuntime.source);
  const [draftPoiIds, setDraftPoiIds] = useState<string[]>(initialPoiRuntime.draftPoiIds);
  const [backendSyncState, setBackendSyncState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [adminSearchTerm, setAdminSearchTerm] = useState('');
  const [adminTypeFilter, setAdminTypeFilter] = useState<'todos' | PoiType>('todos');
  const [adminStatusMessage, setAdminStatusMessage] = useState<string | null>(
    initialPoiRuntime.source === 'local-workspace'
      ? 'Edição local carregada. Revise os pontos e publique apenas quando estiver tudo certo.'
      : null,
  );
  const [adminAgendaPoiLinks, setAdminAgendaPoiLinks] = useState<AgendaSessionPoiLinkOverrides>(loadAdminAgendaPoiLinks);
  const [rota, setRota] = useState<number[][] | null>(null);
  const [editingPoi, setEditingPoi] = useState<EditingPoi | null>(null);
  const [focusPoint, setFocusPoint] = useState<PointData | null>(null);
  const [activePoiId, setActivePoiId] = useState<string | null>(null);
  const [expandedPopupPoiId, setExpandedPopupPoiId] = useState<string | null>(null);
  const [mapZoomLevel, setMapZoomLevel] = useState(0);
  const [mapZoomRange, setMapZoomRange] = useState<{ min: number; max?: number }>({ min: 0 });
  const handleMapZoomLevelChange = useCallback((value: number) => {
    setMapZoomLevel((current) => (current === value ? current : value));
  }, []);
  const handleMapZoomRangeChange = useCallback((minZoom: number, maxZoom: number | null) => {
    const resolvedMaxZoom = maxZoom ?? undefined;
    setMapZoomRange((current) =>
      current.min === minZoom && current.max === resolvedMaxZoom
        ? current
        : { min: minZoom, max: resolvedMaxZoom },
    );
  }, []);
  const [poiAccessCount, setPoiAccessCount] = useState<PoiAccessCount>(loadPoiAccessCount);
  const [searchTerm, setSearchTerm] = useState('');
  const [enabledTypes, setEnabledTypes] = useState<Record<PoiType, boolean>>({
    atividade: true,
    servico: true,
    banheiro: true,
    entrada: true,
  });
  const [manualVisiblePoiIds, setManualVisiblePoiIds] = useState<string[]>([]);
  const [selectedOriginId, setSelectedOriginId] = useState('');
  const [manualMapOrigin, setManualMapOrigin] = useState<ManualRouteOrigin | null>(null);
  const [originQuery, setOriginQuery] = useState('');
  const [showOriginSuggestions, setShowOriginSuggestions] = useState(false);
  const [selectedDestinationId, setSelectedDestinationId] = useState('');
  const [destinationQuery, setDestinationQuery] = useState('');
  const [showDestinationSuggestions, setShowDestinationSuggestions] = useState(false);
  const [isManualOriginPickerOpen, setIsManualOriginPickerOpen] = useState(false);
  const [manualOriginPickerMode, setManualOriginPickerMode] = useState<'fallback' | 'reposition' | null>(null);
  const [isManualOriginRequired, setIsManualOriginRequired] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [tutorialStepIndex, setTutorialStepIndex] = useState(0);
  const {
    isMobile,
    isCompactViewport,
    prefersReducedMotion,
    viewportHeight,
    isPinsPanelOpen,
    isRoutePanelOpen,
    isAgendaPanelOpen,
    isPartnersPanelOpen,
    dockPanelHeights,
    isDockSheetDragging,
    activeDockPanel,
    isDockPanelOpen,
    dockSheetBodyRef,
    closeDockPanel,
    openDockPanel,
    toggleDockPanel,
    handleDockSheetDragPointerDown,
    handleDockSheetDragPointerMove,
    handleDockSheetDragPointerUp,
    handleDockSheetDragPointerCancel,
  } = useMapDock({
    defaultDockPanelHeights: DEFAULT_DOCK_PANEL_HEIGHTS,
    minDockPanelHeights: MIN_DOCK_PANEL_HEIGHTS,
    mobileMediaQuery: MOBILE_MEDIA_QUERY,
    compactMediaQuery: COMPACT_MEDIA_QUERY,
    onOpenPanel: () => setIsTutorialOpen(false),
  });
  const [selectedAgendaDay, setSelectedAgendaDay] = useState<AgendaDayId>('21');
  const [favoriteAgendaIds, setFavoriteAgendaIds] = useState<string[]>([]);
  const [routeMessage, setRouteMessage] = useState(
    'Escolha um destino e deixe o GPS preencher sua origem automaticamente. Para testes, voce tambem pode definir uma origem manual.',
  );
  const [isRouteViewportSettled, setIsRouteViewportSettled] = useState(true);
  const [shouldAnimateRouteReveal, setShouldAnimateRouteReveal] = useState(false);
  const [routeRevealProgress, setRouteRevealProgress] = useState(0);
  const [walkerProgress, setWalkerProgress] = useState(0);
  const [walkerPosition, setWalkerPosition] = useState<[number, number] | null>(null);
  const [restoredLiveLocation] = useState<LiveLocationState | null>(() => loadPersistedLiveLocation());
  const [liveTrackingState, setLiveTrackingState] = useState<LiveTrackingState>(() =>
    restoredLiveLocation ? 'requesting' : 'idle',
  );
  const [liveLocation, setLiveLocation] = useState<LiveLocationState | null>(restoredLiveLocation);
  const [liveLocationMessage, setLiveLocationMessage] = useState<string | null>(() =>
    restoredLiveLocation ? 'Última posição válida recuperada. Atualizando o GPS em tempo real...' : null,
  );
  const [liveLocationSource, setLiveLocationSource] = useState<LiveLocationSource | null>(() =>
    restoredLiveLocation ? 'gps' : null,
  );
  const [liveLocationContext, setLiveLocationContext] = useState<LocationContextResponse | null>(null);
  const [liveLocationContextState, setLiveLocationContextState] = useState<LiveLocationContextState>('idle');
  const [liveLocationContextMessage, setLiveLocationContextMessage] = useState<string | null>(null);
  const [tapIndicators, setTapIndicators] = useState<TapIndicator[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const walkerTimerRef = useRef<number | null>(null);
  const routeRevealFrameRef = useRef<number | null>(null);
  const liveLocationWatchIdRef = useRef<number | null>(null);
  const liveLocationPollIntervalRef = useRef<number | null>(null);
  const liveLocationLastSampleAtRef = useRef<number>(restoredLiveLocation?.capturedAt ?? 0);
  const liveLocationRef = useRef<LiveLocationState | null>(restoredLiveLocation);
  const liveLocationContextRequestIdRef = useRef(0);
  const liveLocationContextLastRequestRef = useRef<{ lat: number; lng: number; requestedAt: number } | null>(null);
  const geolocationPermissionStatusRef = useRef<PermissionStatus | null>(null);
  const lastLiveRouteKeyRef = useRef('');
  const lastAnimatedLiveRouteDestinationRef = useRef<string | null>(null);
  const tapIndicatorIdRef = useRef(0);
  const tapIndicatorTimeoutsRef = useRef<number[]>([]);
  const manualOriginFallbackTimerRef = useRef<number | null>(null);
  const adminImportInputRef = useRef<HTMLInputElement | null>(null);
  const hasLoggedBootstrapFailureRef = useRef(false);
  const suppressAdminMapClickRef = useRef(false);
  const adminMapClickTimeoutRef = useRef<number | null>(null);
  const pointerGestureRef = useRef(new Map<number, { startX: number; startY: number; moved: boolean }>());
  const hasAutoOpenedPinsLocationPromptRef = useRef(false);
  const lastPanelStateRef = useRef({
    pins: false,
    route: false,
    agenda: false,
    partners: false,
    tutorial: false,
  });
  const publicPois = useMemo(
    () => pois.filter((poi) => !PUBLICLY_HIDDEN_POI_IDS.has(poi.id)),
    [pois],
  );
  const effectiveAdminAgendaPoiLinks = useMemo(() => {
    const validSessionIds = new Set(agendaSessions.map((session) => session.id));
    const validPoiIds = new Set(pois.map((poi) => poi.id));

    return Object.fromEntries(
      Object.entries(adminAgendaPoiLinks).filter(
        ([sessionId, poiId]) => validSessionIds.has(sessionId) && validPoiIds.has(poiId),
      ),
    );
  }, [adminAgendaPoiLinks, pois]);
  const effectiveManualVisiblePoiIds = useMemo(
    () => manualVisiblePoiIds.filter((id) => publicPois.some((poi) => poi.id === id)),
    [manualVisiblePoiIds, publicPois],
  );

  const suppressNextAdminMapClick = useCallback((durationMs = 180) => {
    if (typeof window === 'undefined') return;

    suppressAdminMapClickRef.current = true;
    if (adminMapClickTimeoutRef.current !== null) {
      window.clearTimeout(adminMapClickTimeoutRef.current);
    }

    adminMapClickTimeoutRef.current = window.setTimeout(() => {
      suppressAdminMapClickRef.current = false;
      adminMapClickTimeoutRef.current = null;
    }, durationMs);
  }, []);

  useEffect(() => {
    if (!isPresentationMode || !isAdmin) return;
    setIsAdmin(false);
    setEditingPoi(null);
  }, [isPresentationMode, isAdmin]);

  useEffect(() => {
    if (typeof window === 'undefined' || isAdmin) return;
    if (window.localStorage.getItem(TUTORIAL_STORAGE_KEY) === '1') return;

    const openTutorialOnEntry = window.requestAnimationFrame(() => {
      closeDockPanel();
      setTutorialStepIndex(0);
      setIsTutorialOpen(true);
    });

    return () => window.cancelAnimationFrame(openTutorialOnEntry);
  }, [closeDockPanel, isAdmin]);

  const playUiSound = useCallback(
    (variant: 'tap' | 'panel' | 'route' | 'alert') => {
      if (typeof window === 'undefined' || isAdmin) return;
      if (!window.AudioContext) return;

      const context = audioContextRef.current ?? new window.AudioContext();
      audioContextRef.current = context;
      if (context.state === 'suspended') {
        void context.resume().catch(() => undefined);
      }

      const soundMap = {
        tap: {
          type: 'sine' as OscillatorType,
          start: 880,
          end: 640,
          gain: 0.015,
          duration: 0.065,
          filter: 1650,
        },
        panel: {
          type: 'triangle' as OscillatorType,
          start: 430,
          end: 620,
          gain: 0.018,
          duration: 0.11,
          filter: 1350,
        },
        route: {
          type: 'triangle' as OscillatorType,
          start: 540,
          end: 840,
          gain: 0.022,
          duration: 0.14,
          filter: 1500,
        },
        alert: {
          type: 'sine' as OscillatorType,
          start: 720,
          end: 620,
          gain: 0.012,
          duration: 0.08,
          filter: 1460,
        },
      };

      const settings = soundMap[variant];
      const now = context.currentTime + 0.01;
      const oscillator = context.createOscillator();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();

      oscillator.type = settings.type;
      oscillator.frequency.setValueAtTime(settings.start, now);
      oscillator.frequency.exponentialRampToValueAtTime(settings.end, now + settings.duration);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(settings.filter, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(settings.gain, now + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + settings.duration);

      oscillator.connect(filter);
      filter.connect(gain);
      gain.connect(context.destination);

      oscillator.start(now);
      oscillator.stop(now + settings.duration + 0.04);
    },
    [isAdmin],
  );

  const { startLiveLocationTracking, stopLiveLocationTracking } = useLiveLocation({
    restoredLiveLocation,
    pois: publicPois,
    liveTrackingState,
    setLiveTrackingState,
    liveLocation,
    setLiveLocation,
    setLiveLocationMessage,
    setLiveLocationSource,
    setLiveLocationContext,
    setLiveLocationContextState,
    setLiveLocationContextMessage,
    liveLocationWatchIdRef,
    liveLocationPollIntervalRef,
    liveLocationLastSampleAtRef,
    liveLocationRef,
    liveLocationContextRequestIdRef,
    liveLocationContextLastRequestRef,
    geolocationPermissionStatusRef,
    latLngToImageRaw,
    eventBoundaryImagePoints: EVENT_BOUNDARY_IMAGE_POINTS,
    metersToImagePixels,
    getLiveLocationBoundaryGraceMeters,
    isPointInsidePolygon,
    getDistanceToPolygonEdges,
    getClosestPointOnPolygonEdges,
    findNearestNodeFn: findNearestNode,
    getImagePointDistance,
    isLiveLocationAccuracyReliable,
    formatDistanceLabel,
    getLatLngDistanceMeters,
    persistLiveLocationSnapshot,
    isGeolocationSecureContext,
    getGeolocationSecureContextMessage,
    mapGeolocationErrorMessage,
    freeWalkNavigationEnabled: FREE_WALK_NAVIGATION_ENABLED,
    config: {
      liveLocationNearestPoiMaxDistance: LIVE_LOCATION_NEAREST_POI_MAX_DISTANCE,
      liveLocationWarningAccuracyMeters: LIVE_LOCATION_WARNING_ACCURACY_METERS,
      liveLocationBoundaryGraceMaxMeters: LIVE_LOCATION_BOUNDARY_GRACE_MAX_METERS,
      liveLocationNodeMaxDistance: LIVE_LOCATION_NODE_MAX_DISTANCE,
      liveLocationRefreshIntervalMs: LIVE_LOCATION_REFRESH_INTERVAL_MS,
      liveLocationWatchOptions: LIVE_LOCATION_WATCH_OPTIONS,
      liveLocationRefreshOptions: LIVE_LOCATION_REFRESH_OPTIONS,
      liveLocationStaleRestartAfterMs: LIVE_LOCATION_STALE_RESTART_AFTER_MS,
      liveLocationContextRefreshIntervalMs: LIVE_LOCATION_CONTEXT_REFRESH_INTERVAL_MS,
      liveLocationContextMinMoveMeters: LIVE_LOCATION_CONTEXT_MIN_MOVE_METERS,
    },
  });

  const spawnTapIndicator = useCallback(
    (x: number, y: number) => {
      if (typeof window === 'undefined' || isAdmin) return;

      const nextId = tapIndicatorIdRef.current;
      tapIndicatorIdRef.current += 1;
      setTapIndicators((prev) => [...prev, { id: nextId, x, y }]);
      playUiSound('tap');

      const timeoutId = window.setTimeout(() => {
        setTapIndicators((prev) => prev.filter((indicator) => indicator.id !== nextId));
        tapIndicatorTimeoutsRef.current = tapIndicatorTimeoutsRef.current.filter((id) => id !== timeoutId);
      }, TAP_FEEDBACK_DURATION_MS);

      tapIndicatorTimeoutsRef.current.push(timeoutId);
    },
    [isAdmin, playUiSound],
  );

  const handleRootPointerDownCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointerGestureRef.current.set(event.pointerId, {
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    });
  };

  const handleRootPointerMoveCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    const trackedPointer = pointerGestureRef.current.get(event.pointerId);
    if (!trackedPointer || trackedPointer.moved) return;

    const moveX = event.clientX - trackedPointer.startX;
    const moveY = event.clientY - trackedPointer.startY;
    if (Math.hypot(moveX, moveY) > TAP_FEEDBACK_MAX_MOVE_PX) {
      trackedPointer.moved = true;
    }
  };

  const handleRootPointerUpCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    const trackedPointer = pointerGestureRef.current.get(event.pointerId);
    pointerGestureRef.current.delete(event.pointerId);
    if (!trackedPointer || trackedPointer.moved) return;
    spawnTapIndicator(event.clientX, event.clientY);
  };

  const handleRootPointerCancelCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointerGestureRef.current.delete(event.pointerId);
  };

  useEffect(() => {
    const previousState = lastPanelStateRef.current;
    const hasPanelOpened =
      (!previousState.pins && isPinsPanelOpen) ||
      (!previousState.route && isRoutePanelOpen) ||
      (!previousState.agenda && isAgendaPanelOpen) ||
      (!previousState.partners && isPartnersPanelOpen) ||
      (!previousState.tutorial && isTutorialOpen);

    if (hasPanelOpened) {
      playUiSound('panel');
    }

    lastPanelStateRef.current = {
      pins: isPinsPanelOpen,
      route: isRoutePanelOpen,
      agenda: isAgendaPanelOpen,
      partners: isPartnersPanelOpen,
      tutorial: isTutorialOpen,
    };
  }, [isPinsPanelOpen, isRoutePanelOpen, isAgendaPanelOpen, isPartnersPanelOpen, isTutorialOpen, playUiSound]);


  useEffect(() => {
    return () => {
      tapIndicatorTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      tapIndicatorTimeoutsRef.current = [];
      if (adminMapClickTimeoutRef.current !== null) {
        window.clearTimeout(adminMapClickTimeoutRef.current);
        adminMapClickTimeoutRef.current = null;
      }

      if (liveLocationWatchIdRef.current !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(liveLocationWatchIdRef.current);
        liveLocationWatchIdRef.current = null;
      }

      if (liveLocationPollIntervalRef.current !== null) {
        window.clearInterval(liveLocationPollIntervalRef.current);
        liveLocationPollIntervalRef.current = null;
      }

      if (routeRevealFrameRef.current !== null) {
        window.cancelAnimationFrame(routeRevealFrameRef.current);
      }

      if (audioContextRef.current) {
        void audioContextRef.current.close().catch(() => undefined);
      }
    };
  }, []);


  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (
      isAdmin ||
      isTutorialOpen ||
      liveTrackingState === 'requesting' ||
      liveTrackingState === 'active' ||
      hasAutoOpenedPinsLocationPromptRef.current
    ) {
      return;
    }

    hasAutoOpenedPinsLocationPromptRef.current = true;
    const timeoutId = window.setTimeout(() => {
      openDockPanel('pins');
    }, 280);

    return () => window.clearTimeout(timeoutId);
  }, [isAdmin, isTutorialOpen, liveTrackingState, openDockPanel]);




  const legacySyncBootstrap = useCallback(
    async (options?: { forceReplace?: boolean }) => {
      try {
        setBackendSyncState('loading');
        const bootstrap = await fetchMapBootstrap();
        const backendPois = Array.isArray(bootstrap.pois) ? sanitizePoiCollection(bootstrap.pois.map(fromApiPoi)) : [];
        const backendAgendaPoiLinks = sanitizeAgendaPoiLinkRecord(bootstrap.agendaPoiLinks);

        setServerPois(backendPois);
        setAdminAgendaPoiLinks(backendAgendaPoiLinks);
        persistPoiRuntimeBackup(backendPois);
        setBackendSyncState('ready');
        hasLoggedBootstrapFailureRef.current = false;

        const shouldPreserveWorkspace =
          !options?.forceReplace && poiDataSource === 'local-workspace' && draftPoiIds.length > 0;
        if (!shouldPreserveWorkspace) {
          if (backendPois.length > 0) {
            setPois(backendPois);
            setPoiDataSource('backend');
          }
          setDraftPoiIds([]);
          clearAdminWorkspaceSnapshot();
        }

        setAdminStatusMessage(
          shouldPreserveWorkspace
            ? 'Servidor sincronizado em segundo plano. Sua edição local continua ativa para revisão.'
            : 'Dados do servidor carregados com sucesso.',
        );
      } catch (error) {
        if (!hasLoggedBootstrapFailureRef.current) {
          console.warn('Bootstrap do mapa indisponivel no backend. O app vai continuar com a base local.', error);
          hasLoggedBootstrapFailureRef.current = true;
        }
        setBackendSyncState('error');
        setAdminStatusMessage(
          poiDataSource === 'local-workspace'
            ? 'Não foi possível atualizar o servidor agora, mas sua edição local continua disponível.'
            : 'Servidor indisponível. O mapa segue usando a base local.',
        );
      }
    },
    [draftPoiIds.length, poiDataSource],
  );

  const { syncBootstrap } = useMapBootstrap({
    poiDataSource,
    draftPoiIdsLength: draftPoiIds.length,
    fromApiPoi,
    sanitizePoiCollection,
    persistPoiRuntimeBackup,
    sanitizeAgendaPoiLinkRecord,
    clearAdminWorkspaceSnapshot,
    setBackendSyncState,
    setServerPois,
    setAdminAgendaPoiLinks,
    setPois,
    setPoiDataSource,
    setDraftPoiIds,
    setAdminStatusMessage,
  });

  const routeShadowColor = mixColors(BRAND_COLORS.ink, BRAND_COLORS.primaryStrong, 0.24);
  const routeGuideColor = mixColors(BRAND_COLORS.highlight, BRAND_COLORS.surface, 0.36);
  const shouldWarnLiveLocationAccuracy = Boolean(
    liveLocation && liveLocation.accuracyMeters > LIVE_LOCATION_WARNING_ACCURACY_METERS,
  );
  const liveLocationMarkerTone =
    liveLocation && !liveLocation.isInsideEvent
      ? mixColors(BRAND_COLORS.ink, BRAND_COLORS.highlight, 0.2)
      : shouldWarnLiveLocationAccuracy
        ? mixColors(BRAND_COLORS.highlight, BRAND_COLORS.primaryStrong, 0.28)
        : BRAND_COLORS.primaryStrong;
  const previewMarkerTone = mixColors(BRAND_COLORS.primaryStrong, BRAND_COLORS.ink, 0.1);

  const renderPresenceMarker = (
    position: [number, number],
    options: {
      label: string;
      tone: string;
      accuracyMeters?: number;
    },
  ) => {
    const outerRadius = isMobile ? 11 : 12;
    const middleRadius = isMobile ? 7 : 8;
    const coreRadius = isMobile ? 2.6 : 3;
    const haloTone = mixColors(options.tone, BRAND_COLORS.surface, 0.18);
    const ringTone = mixColors(options.tone, BRAND_COLORS.surface, 0.5);

    return (
      <>
        {typeof options.accuracyMeters === 'number' && (
          <Circle
            center={position}
            radius={Math.max(6, options.accuracyMeters)}
            pathOptions={{
              color: options.tone,
              weight: 1.4,
              opacity: 0.2,
              fillColor: options.tone,
              fillOpacity: 0.08,
            }}
            interactive={false}
          />
        )}
        <CircleMarker
          center={position}
          radius={outerRadius}
          interactive={false}
          pathOptions={{
            stroke: false,
            fillColor: haloTone,
            fillOpacity: 0.24,
          }}
        />
        <CircleMarker
          center={position}
          radius={middleRadius}
          interactive={false}
          pathOptions={{
            color: ringTone,
            weight: 3,
            fillColor: options.tone,
            fillOpacity: 1,
          }}
        >
          <Tooltip permanent direction='top' offset={[0, -16]} className='route-walker-label'>
            {options.label}
          </Tooltip>
        </CircleMarker>
        <CircleMarker
          center={position}
          radius={coreRadius}
          interactive={false}
          pathOptions={{
            stroke: false,
            fillColor: BRAND_COLORS.surface,
            fillOpacity: 0.98,
          }}
        />
      </>
    );
  };

  const routeLatLngPoints = useMemo<[number, number][]>(
    () => (rota ? rota.map(([y, x]) => imageToLatLng(x, y)) : []),
    [rota],
  );
  const animatedRouteLatLngPoints = useMemo<[number, number][]>(
    () => getPathSliceUntilProgress(routeLatLngPoints, routeRevealProgress),
    [routeLatLngPoints, routeRevealProgress],
  );
  const visibleRouteLatLngPoints =
    routeLatLngPoints.length > 1 && isRouteViewportSettled ? animatedRouteLatLngPoints : [];
  const routeRevealHeadPoint =
    visibleRouteLatLngPoints.length > 0 ? visibleRouteLatLngPoints[visibleRouteLatLngPoints.length - 1] : null;
  const isRouteRevealComplete =
    routeLatLngPoints.length <= 1 || prefersReducedMotion || routeRevealProgress >= 0.999;

  const routeDistanceMeters = useMemo(() => getPathDistanceMeters(routeLatLngPoints), [routeLatLngPoints]);
  const routeEtaMinutes = routeDistanceMeters / (AVERAGE_WALKING_SPEED_MPS * 60);
  const routeRemainingEtaLabel =
    walkerProgress >= 0.995
      ? 'chegando'
      : formatWalkingTimeLabel(routeEtaMinutes * Math.max(0, 1 - walkerProgress));
  const arePinsHiddenByZoom = !shouldShowPoiPins(mapZoomLevel, mapZoomRange.min, isMobile, isAdmin);

  const orderedByAccessPois = useMemo(() => {
    return [...publicPois].sort((a, b) => {
      const accessDiff = (poiAccessCount[b.id] ?? 0) - (poiAccessCount[a.id] ?? 0);
      if (accessDiff !== 0) return accessDiff;
      return a.nome.localeCompare(b.nome);
    });
  }, [poiAccessCount, publicPois]);

  const searchablePois = useMemo(() => {
    const query = normalizeForSearch(searchTerm.trim());
    return orderedByAccessPois.filter((poi) => {
      if (!enabledTypes[poi.tipo]) return false;
      if (!query) return true;
      return getPoiSearchTerms(poi).some((term) => term.includes(query) || query.includes(term));
    });
  }, [orderedByAccessPois, searchTerm, enabledTypes]);

  const routeSuggestionPois = useMemo(
    () => [...orderedByAccessPois].sort((a, b) => a.nome.localeCompare(b.nome)),
    [orderedByAccessPois],
  );

  const getRouteSuggestions = useCallback((rawQuery: string) => {
    const query = normalizeForSearch(rawQuery.trim());
    const baseList = query
      ? routeSuggestionPois.filter((poi) => {
          const poiTerms = getPoiSearchTerms(poi);
          return poiTerms.some((term) => term.includes(query) || query.includes(term));
        })
      : routeSuggestionPois;

    return [...baseList]
      .sort((a, b) => {
        if (!query) return a.nome.localeCompare(b.nome);

        const aName = normalizeForSearch(a.nome);
        const bName = normalizeForSearch(b.nome);
        const aType = normalizeForSearch(a.tipo);
        const bType = normalizeForSearch(b.tipo);

        const aStarts = Number(aName.startsWith(query));
        const bStarts = Number(bName.startsWith(query));
        if (aStarts !== bStarts) return bStarts - aStarts;

        const aTypeStarts = Number(aType.startsWith(query));
        const bTypeStarts = Number(bType.startsWith(query));
        if (aTypeStarts !== bTypeStarts) return bTypeStarts - aTypeStarts;

        return a.nome.localeCompare(b.nome);
      })
      .slice(0, 8);
  }, [routeSuggestionPois]);

  const destinationSuggestions = useMemo(() => {
    return getRouteSuggestions(destinationQuery);
  }, [destinationQuery, getRouteSuggestions]);
  const originSuggestions = useMemo(() => {
    return getRouteSuggestions(originQuery).filter((poi) => poi.id !== selectedDestinationId);
  }, [originQuery, getRouteSuggestions, selectedDestinationId]);

  const selectedAgendaDayMeta = useMemo(
    () => agendaDays.find((day) => day.id === selectedAgendaDay) ?? agendaDays[0],
    [selectedAgendaDay],
  );

  const agendaSessionsForSelectedDay = useMemo(
    () => agendaSessions.filter((session) => session.dayId === selectedAgendaDay).sort(compareAgendaSessions),
    [selectedAgendaDay],
  );

  const agendaDayStats = useMemo(() => {
    if (agendaSessionsForSelectedDay.length === 0) {
      return {
        sessionCount: 0,
        venueCount: 0,
        speakerCount: 0,
        connectedCount: 0,
        windowLabel: '--',
      };
    }

    const firstSession = agendaSessionsForSelectedDay[0];
    const lastSession = agendaSessionsForSelectedDay[agendaSessionsForSelectedDay.length - 1];
    const speakerCount = new Set(
      agendaSessionsForSelectedDay.flatMap((session) => session.speakers.map((speaker) => speaker.name)),
    ).size;
    const venueCount = new Set(agendaSessionsForSelectedDay.map((session) => session.venue)).size;
    const connectedCount = agendaSessionsForSelectedDay.filter((session) => {
      return resolveAgendaSessionPoi(session, pois, effectiveAdminAgendaPoiLinks) !== null;
    }).length;

    return {
      sessionCount: agendaSessionsForSelectedDay.length,
      venueCount,
      speakerCount,
      connectedCount,
      windowLabel: `${firstSession.startTime} - ${lastSession.endTime}`,
    };
  }, [agendaSessionsForSelectedDay, effectiveAdminAgendaPoiLinks, pois]);
  const agendaPanelSessions = useMemo(
    () =>
      agendaSessionsForSelectedDay.map((session) => {
        const matchedPoi = resolveAgendaSessionPoi(session, pois, effectiveAdminAgendaPoiLinks);
        return {
          id: session.id,
          weekday: session.weekday,
          dateLabel: session.dateLabel,
          category: session.category,
          title: session.title,
          summary: session.summary,
          venue: session.venue,
          audience: session.audience,
          startTime: session.startTime,
          endTime: session.endTime,
          accent: session.accent,
          durationLabel: formatAgendaDuration(session.startTime, session.endTime),
          isFavorite: favoriteAgendaIds.includes(session.id),
          hasLinkedPoi: Boolean(matchedPoi),
          linkedPoiImage: matchedPoi ? matchedPoi.imagemUrl || defaultPoiImages[matchedPoi.tipo] : null,
          linkedPoiName: matchedPoi?.nome ?? null,
          speakers: session.speakers,
        };
      }),
    [agendaSessionsForSelectedDay, effectiveAdminAgendaPoiLinks, favoriteAgendaIds, pois],
  );
  const agendaNotificationSessions = useMemo(
    () =>
      agendaSessions.map((session) => ({
        id: session.id,
        title: session.title,
        summary: session.summary,
        venue: session.venue,
        startTime: session.startTime,
        endTime: session.endTime,
        accent: session.accent,
        hasLinkedPoi: Boolean(resolveAgendaSessionPoi(session, pois, effectiveAdminAgendaPoiLinks)),
      })),
    [effectiveAdminAgendaPoiLinks, pois],
  );

  const autoVisiblePois = useMemo(() => {
    return orderedByAccessPois.filter((poi) => enabledTypes[poi.tipo]).slice(0, getPoiAutoVisibleLimit());
  }, [orderedByAccessPois, enabledTypes]);

  const visiblePois = useMemo(() => {
    if (isAdmin) return pois;

    if (arePinsHiddenByZoom) {
      return [];
    }

    const manualSelectionSet = new Set(effectiveManualVisiblePoiIds);
    const basePois =
      effectiveManualVisiblePoiIds.length > 0
        ? publicPois.filter((poi) => manualSelectionSet.has(poi.id) && enabledTypes[poi.tipo])
        : autoVisiblePois;

    const resultById = new Map(basePois.map((poi) => [poi.id, poi]));
    [activePoiId, selectedDestinationId].forEach((id) => {
      if (!id) return;
      const poi = publicPois.find((item) => item.id === id);
      if (poi) resultById.set(poi.id, poi);
    });

    return Array.from(resultById.values());
  }, [
    isAdmin,
    pois,
    publicPois,
    effectiveManualVisiblePoiIds,
    enabledTypes,
    autoVisiblePois,
    arePinsHiddenByZoom,
    activePoiId,
    selectedDestinationId,
  ]);

  const getPoiById = useCallback((id: string) => pois.find((poi) => poi.id === id), [pois]);
  const selectedOriginPoi = useMemo(
    () => (selectedOriginId ? pois.find((poi) => poi.id === selectedOriginId) ?? null : null),
    [selectedOriginId, pois],
  );
  const selectedDestinationPoi = useMemo(
    () => (selectedDestinationId ? pois.find((poi) => poi.id === selectedDestinationId) ?? null : null),
    [selectedDestinationId, pois],
  );
  const manualMapOriginNearestPoi = useMemo(
    () =>
      manualMapOrigin?.nearestPoiId ? publicPois.find((poi) => poi.id === manualMapOrigin.nearestPoiId) ?? null : null,
    [manualMapOrigin, publicPois],
  );
  const liveLocationNearestPoi = useMemo(
    () => (liveLocation?.nearestPoiId ? publicPois.find((poi) => poi.id === liveLocation.nearestPoiId) ?? null : null),
    [liveLocation, publicPois],
  );
  const hasLiveLocationFix = Boolean(
    liveLocation?.isInsideEvent && (FREE_WALK_NAVIGATION_ENABLED || liveLocation?.snappedNodeId),
  );
  const liveLocationMarkerPosition = useMemo<[number, number] | null>(
    () => (liveLocation ? imageToLatLng(liveLocation.x, liveLocation.y) : null),
    [liveLocation],
  );
  const manualMapOriginMarkerPosition = useMemo<[number, number] | null>(
    () => (manualMapOrigin ? imageToLatLng(manualMapOrigin.x, manualMapOrigin.y) : null),
    [manualMapOrigin],
  );
  const liveLocationMapPoint = useMemo(() => {
    if (!liveLocation) return null;
    return {
      x: Math.round(liveLocation.x),
      y: Math.round(liveLocation.y),
    };
  }, [liveLocation]);
  const liveLocationAccuracyLabel = liveLocation ? formatDistanceLabel(liveLocation.accuracyMeters) : null;
  const liveLocationUpdatedAtLabel = liveLocation ? formatClockTimeLabel(liveLocation.capturedAt) : null;
  const liveLocationLatLabel = liveLocation ? liveLocation.lat.toFixed(6) : '--';
  const liveLocationLngLabel = liveLocation ? liveLocation.lng.toFixed(6) : '--';
  const liveLocationOriginLabel = liveLocationNearestPoi
    ? `Minha localização perto de ${liveLocationNearestPoi.nome}`
    : 'Minha localização em tempo real';
  const liveLocationStatusTone =
    liveTrackingState === 'active' && hasLiveLocationFix
      ? BRAND_COLORS.primary
      : liveTrackingState === 'blocked' || liveTrackingState === 'error'
        ? BRAND_COLORS.ink
        : liveTrackingState === 'requesting'
          ? BRAND_COLORS.highlight
          : BRAND_COLORS.primarySoft;
  const liveLocationHeadline =
    liveTrackingState === 'active' && hasLiveLocationFix
      ? 'Origem automática ativa'
      : liveTrackingState === 'requesting'
        ? 'Buscando sua localização'
        : liveTrackingState === 'blocked'
          ? 'Localização bloqueada'
          : liveTrackingState === 'unsupported'
            ? 'Geolocalização indisponível'
            : liveTrackingState === 'error'
              ? 'Falha no GPS'
              : 'Ative sua localização';
  const liveLocationStatusText =
    liveLocationMessage ??
    (liveTrackingState === 'idle'
      ? 'Use o GPS do celular para preencher a origem automaticamente e acompanhar a rota em tempo real.'
      : 'Aguardando atualizações da sua posição.');
  const hasConfirmedLiveLocationAccess = liveTrackingState === 'requesting' || liveTrackingState === 'active';
  const shouldShowPinsLocationPrompt = !isAdmin && !hasConfirmedLiveLocationAccess;
  const draftPoiIdSet = useMemo(() => new Set(draftPoiIds), [draftPoiIds]);
  const filteredAdminPois = useMemo(() => {
    const normalizedQuery = normalizeForSearch(adminSearchTerm);

    return pois
      .filter((poi) => {
        if (adminTypeFilter !== 'todos' && poi.tipo !== adminTypeFilter) return false;
        if (!normalizedQuery) return true;
        return getPoiSearchTerms(poi).some((term) => term.includes(normalizedQuery) || normalizedQuery.includes(term));
      })
      .sort((left, right) => {
        const leftIsDraft = draftPoiIdSet.has(left.id);
        const rightIsDraft = draftPoiIdSet.has(right.id);
        if (leftIsDraft !== rightIsDraft) return leftIsDraft ? -1 : 1;
        return left.nome.localeCompare(right.nome);
      });
  }, [adminSearchTerm, adminTypeFilter, draftPoiIdSet, pois]);
  const adminAgendaPoiLinkRows = useMemo(
    () =>
      [...agendaSessions]
        .sort(compareAgendaSessions)
        .map((session) => ({
          sessionId: session.id,
          title: session.title,
          venue: session.venue,
          overridePoiId: effectiveAdminAgendaPoiLinks[session.id] ?? null,
          resolvedPoiName: resolveAgendaSessionPoi(session, pois, effectiveAdminAgendaPoiLinks)?.nome ?? null,
        })),
    [effectiveAdminAgendaPoiLinks, pois],
  );
  const adminAgendaPoiLinkOptions = useMemo(
    () =>
      [...pois]
        .sort((left, right) => left.nome.localeCompare(right.nome))
        .map((poi) => ({
          id: poi.id,
          nome: poi.nome,
          isPubliclyHidden: PUBLICLY_HIDDEN_POI_IDS.has(poi.id),
        })),
    [pois],
  );
  const disconnectedPoiCount = useMemo(
    () => (FREE_WALK_NAVIGATION_ENABLED ? 0 : pois.filter((poi) => !poi.nodeId).length),
    [pois],
  );
  const syncedPoiCount = useMemo(() => pois.length - draftPoiIds.length, [pois.length, draftPoiIds.length]);

  const routeOriginSummaryName = hasLiveLocationFix
    ? liveLocationOriginLabel
    : 'Aguardando sua localização exata';
  const routeOriginSummaryHelp = hasLiveLocationFix
    ? liveLocation?.usedBoundaryGrace
      ? `Atualizada automaticamente com ajuste de borda. Última leitura às ${liveLocationUpdatedAtLabel ?? '--'}.`
      : `Atualizada automaticamente. Última leitura às ${liveLocationUpdatedAtLabel ?? '--'}.`
    : 'Assim que o GPS fixar sua posição, a origem será usada automaticamente.';
  const routeMetricLabel = hasLiveLocationFix ? 'Precisão GPS' : 'Progresso';
  const routeMetricValue = hasLiveLocationFix ? liveLocationAccuracyLabel ?? '--' : `${Math.round(walkerProgress * 100)}%`;
  const routeMarkerPosition = hasLiveLocationFix ? liveLocationMarkerPosition : walkerPosition;
  const hasPoiManualRouteOrigin = Boolean(selectedOriginPoi);
  const hasManualMapRouteOrigin = Boolean(manualMapOrigin);
  const hasManualRouteOrigin = hasPoiManualRouteOrigin || hasManualMapRouteOrigin;
  const isManualOriginFallbackRequired = isManualOriginRequired && !hasManualRouteOrigin;
  const getManualOriginRequiredMessage = useCallback((destinationName?: string | null) => {
    if (destinationName) {
      return `A localizacao esta demorando demais para responder. Para ir ate ${destinationName}, toque no mapa onde voce esta ou use os pontos principais no painel de rota.`;
    }
    return 'A localizacao esta demorando demais para responder. Toque no mapa onde voce esta ou use os pontos principais no painel de rota.';
  }, []);
  const activeRouteOriginSummaryName = hasPoiManualRouteOrigin
    ? selectedOriginPoi?.nome ?? 'Origem de teste'
    : hasManualMapRouteOrigin
      ? manualMapOriginNearestPoi
        ? `Ponto escolhido perto de ${manualMapOriginNearestPoi.nome}`
        : manualMapOrigin?.label ?? 'Origem manual no mapa'
      : isManualOriginFallbackRequired
        ? 'Confirme onde voce esta'
        : routeOriginSummaryName;
  const activeRouteOriginSummaryHelp = hasPoiManualRouteOrigin
    ? 'Origem manual de teste ativa. Enquanto ela estiver definida, a rota sera calculada entre pontos do evento.'
    : hasManualMapRouteOrigin
      ? 'Origem manual no mapa ativa. Se o GPS falhar, toque novamente no mapa para reposicionar sua saida.'
      : isManualOriginFallbackRequired
        ? getManualOriginRequiredMessage(selectedDestinationPoi?.nome ?? null)
        : routeOriginSummaryHelp;
  const activeRouteMetricLabel = hasManualRouteOrigin ? 'Modo' : routeMetricLabel;
  const activeRouteMetricValue = hasPoiManualRouteOrigin
    ? 'Teste entre pontos'
    : hasManualMapRouteOrigin
      ? 'Origem no mapa'
      : routeMetricValue;
  const {
    clearManualRouteOrigin,
    clearRoute,
    selectDestinationPoi,
    selectOriginPoi,
    selectManualMapOrigin,
    navigateToPoi,
  } = useRouteNavigation({
    pois,
    selectedOriginId,
    setSelectedOriginId,
    manualMapOrigin,
    setManualMapOrigin,
    setOriginQuery,
    setShowOriginSuggestions,
    selectedDestinationId,
    setSelectedDestinationId,
    setDestinationQuery,
    setShowDestinationSuggestions,
    setRota,
    setIsRouteViewportSettled,
    setShouldAnimateRouteReveal,
    setRouteRevealProgress,
    setRouteMessage,
    setWalkerPosition,
    setWalkerProgress,
    lastLiveRouteKeyRef,
    lastAnimatedLiveRouteDestinationRef,
    routeRevealFrameRef,
    walkerTimerRef,
    getPoiById,
    imageToLatLng,
    getPathDistanceMeters,
    formatDistanceLabel,
    formatWalkingTimeLabel,
    getImagePointDistance,
    liveLocation,
    liveTrackingState,
    hasLiveLocationFix,
    requireManualOriginConfirmation: isManualOriginFallbackRequired,
    liveLocationOriginLabel,
    startLiveLocationTracking,
    onPlayRouteSound: () => playUiSound('route'),
    onNavigateToPoiStart: closeDockPanel,
    routeLatLngPoints,
    routeDistanceMeters,
    isRouteRevealComplete,
    isRouteViewportSettled,
    shouldAnimateRouteReveal,
    prefersReducedMotion,
    isPresentationMode,
    getPointAlongPath,
    getAdaptiveAnimationDuration,
    easeInOutCubic,
    getLiveRouteKey,
    freeWalkNavigationEnabled: FREE_WALK_NAVIGATION_ENABLED,
    config: {
      averageWalkingSpeedMps: AVERAGE_WALKING_SPEED_MPS,
      routeRevealMinDurationMs: ROUTE_REVEAL_MIN_DURATION_MS,
      routeRevealMaxDurationMs: ROUTE_REVEAL_MAX_DURATION_MS,
      routeRevealMsPerMeter: ROUTE_REVEAL_MS_PER_METER,
      presentationWalkerMinDurationMs: PRESENTATION_WALKER_MIN_DURATION_MS,
      presentationWalkerMaxDurationMs: PRESENTATION_WALKER_MAX_DURATION_MS,
      presentationWalkerMsPerMeter: PRESENTATION_WALKER_MS_PER_METER,
      walkerProgressUpdateMs: WALKER_PROGRESS_UPDATE_MS,
    },
  });
  const liveLocationBackendStateLabel =
    liveLocationContextState === 'loading'
      ? 'Validando no backend'
      : liveLocationContextState === 'error'
        ? 'Falha na validacao'
        : liveLocationContext?.provider.googleConfigured
          ? liveLocationContext.provider.googleUsed
            ? 'Backend + Google'
            : 'Backend pronto'
          : liveLocationContext
            ? 'Backend local'
            : 'Aguardando validacao';
  const liveLocationResolvedAddress =
    liveLocationContext?.reverseGeocode?.formattedAddress ?? liveLocationContext?.venue?.formattedAddress ?? '--';
  const liveLocationVenueDistanceLabel =
    liveLocationContext?.venue?.distanceMeters != null ? formatDistanceLabel(liveLocationContext.venue.distanceMeters) : '--';
  const liveLocationVenueStatusLabel =
    liveLocationContext?.venue?.isWithinRadius == null
      ? liveLocation
        ? 'Sem validacao de venue'
        : 'Aguardando GPS'
      : liveLocationContext.venue.isWithinRadius
        ? 'Dentro do raio do evento'
        : 'Fora do raio do evento';
  const liveLocationExternalRouteLabel = liveLocationContext?.externalRoute
    ? [
        liveLocationContext.externalRoute.distanceMeters != null
          ? formatDistanceLabel(liveLocationContext.externalRoute.distanceMeters)
          : null,
        liveLocationContext.externalRoute.durationSeconds != null
          ? formatWalkingTimeLabel(liveLocationContext.externalRoute.durationSeconds / 60)
          : null,
      ]
        .filter(Boolean)
        .join(' | ')
    : liveLocationContext?.venue?.isWithinRadius
      ? 'Voce ja esta no raio do evento'
      : '--';
  const liveLocationContextHelp =
    liveLocationContextMessage ??
    liveLocationContext?.warnings?.[0] ??
    (liveLocationContext?.provider.googleConfigured
      ? 'O backend pode validar endereco e contexto externo sem mexer na rota interna do evento.'
      : 'O backend ja esta pronto; basta adicionar a chave do Google para ativar validacao externa e apoio de rota.');
  const selectedDestinationSupportsGuidedRoute = Boolean(
    selectedDestinationPoi && (FREE_WALK_NAVIGATION_ENABLED || selectedDestinationPoi.nodeId),
  );
  const manualOriginOverlayStatusMessage = isManualOriginFallbackRequired || manualMapOrigin ? routeMessage : null;
  const openManualOriginPicker = useCallback(
    (message?: string) => {
      closeDockPanel();
      setExpandedPopupPoiId(null);
      setActivePoiId(null);
      setManualOriginPickerMode('reposition');
      setIsManualOriginPickerOpen(true);
      if (message) {
        setRouteMessage(message);
      }
    },
    [closeDockPanel],
  );
  const handleRetryGpsAfterManualFallback = useCallback(() => {
    setIsManualOriginRequired(false);
    setIsManualOriginPickerOpen(false);
    setManualOriginPickerMode(null);
    setRouteMessage(
      'Estamos tentando localizar voce novamente pelo GPS. Se demorar, toque no mapa onde voce esta ou use os pontos principais.',
    );
    void startLiveLocationTracking();
  }, [startLiveLocationTracking]);
  const handleUseMainPointsForRoute = useCallback(() => {
    setIsManualOriginPickerOpen(false);
    setManualOriginPickerMode(null);
    setRouteMessage(
      'A localizacao esta demorando demais para responder. Escolha sua origem pelos pontos principais para gerar a rota.',
    );
    openDockPanel('route');
  }, [openDockPanel]);
  const handleRouteOriginSuggestionSelect = useCallback(
    (poi: PointData) => {
      setIsManualOriginRequired(false);
      setIsManualOriginPickerOpen(false);
      setManualOriginPickerMode(null);
      selectOriginPoi(poi);
    },
    [selectOriginPoi],
  );

  const handlePublicMapClick = useCallback(
    (point: { lat: number; lng: number; x: number; y: number }) => {
      setActivePoiId(null);
      setExpandedPopupPoiId(null);

      if (!isManualOriginPickerOpen) return;

      let nearestPoi: PointData | null = null;
      let nearestDistance = Infinity;

      for (const poi of publicPois) {
        const distance = getImagePointDistance({ x: point.x, y: point.y }, { x: poi.x, y: poi.y });
        if (distance < nearestDistance && distance <= MANUAL_ROUTE_ORIGIN_POI_MAX_DISTANCE) {
          nearestDistance = distance;
          nearestPoi = poi;
        }
      }

      const corridorNodeId = findNearestNode(point.x, point.y, MANUAL_ROUTE_ORIGIN_NODE_MAX_DISTANCE);
      const resolvedNodeId = corridorNodeId ?? nearestPoi?.nodeId ?? null;
      const isManualOriginAllowed = Boolean(corridorNodeId || nearestPoi);

      if (!isManualOriginAllowed) {
        setRouteMessage('Marque sua origem apenas sobre um corredor de rota ou bem perto de um pin do mapa.');
        return;
      }

      setIsManualOriginRequired(false);
      setIsManualOriginPickerOpen(false);
      setManualOriginPickerMode(null);
      selectManualMapOrigin({
        id: 'manual_map_origin',
        label: nearestPoi ? `Ponto escolhido perto de ${nearestPoi.nome}` : 'Ponto escolhido no mapa',
        x: point.x,
        y: point.y,
        lat: point.lat,
        lng: point.lng,
        snappedNodeId: resolvedNodeId,
        nearestPoiId: nearestPoi?.id ?? null,
      });
    },
    [getImagePointDistance, isManualOriginPickerOpen, publicPois, selectManualMapOrigin],
  );

  useEffect(() => {
    if (selectedOriginId || manualMapOrigin || !selectedDestinationId || !selectedDestinationSupportsGuidedRoute) {
      setIsManualOriginRequired(false);
    }
  }, [manualMapOrigin, selectedDestinationId, selectedDestinationSupportsGuidedRoute, selectedOriginId]);

  const closeTutorial = () => {
    setIsTutorialOpen(false);
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(TUTORIAL_STORAGE_KEY, '1');
  };

  const registerPoiAccess = (poiId: string) => {
    setPoiAccessCount((prev) => ({
      ...prev,
      [poiId]: (prev[poiId] ?? 0) + 1,
    }));
    void trackPoiAccess(poiId).catch((error) => {
      console.warn('Não foi possível registrar acesso do POI no backend:', error);
    });
  };

  const focusPoi = (poi: PointData, registerAccess = true, options?: { moveCamera?: boolean }) => {
    if (registerAccess) registerPoiAccess(poi.id);
    if (isMobile) closeDockPanel();
    setActivePoiId(poi.id);
    if (options?.moveCamera === false) return;
    setFocusPoint(poi);
  };

  const handlePoiListView = (poi: PointData) => {
    focusPoi(poi, true);
    closeDockPanel();
  };

  const handlePoiListNavigate = (poi: PointData) => {
    focusPoi(poi, true);
    selectDestinationPoi(poi);
    closeDockPanel();
  };

  const getAgendaSessionPoi = (session: AgendaSession) => {
    return resolveAgendaSessionPoi(session, pois, effectiveAdminAgendaPoiLinks);
  };

  const handleAgendaSessionFocus = (session: AgendaSession) => {
    const matchedPoi = getAgendaSessionPoi(session);
    if (!matchedPoi) return;
    focusPoi(matchedPoi, true);
    closeDockPanel();
  };
  const handleAgendaSessionFocusById = (sessionId: string) => {
    const session = agendaSessions.find((item) => item.id === sessionId);
    if (!session) return;
    handleAgendaSessionFocus(session);
  };
  const handleAgendaSessionNavigateById = (sessionId: string) => {
    const session = agendaSessions.find((item) => item.id === sessionId);
    if (!session) return;
    const matchedPoi = getAgendaSessionPoi(session);
    if (!matchedPoi) return;
    focusPoi(matchedPoi, false, { moveCamera: false });
    navigateToPoi(matchedPoi);
  };

  const toggleAgendaFavorite = (sessionId: string) => {
    setFavoriteAgendaIds((prev) =>
      prev.includes(sessionId) ? prev.filter((id) => id !== sessionId) : [...prev, sessionId],
    );
  };

  const handleMarkerSelection = (poi: PointData) => {
    if (isAdmin) {
      setEditingPoi({ ...poi });
      setFocusPoint(poi);
      return;
    }

    focusPoi(poi, true);
  };

  const legacyUpdatePoiPosition = (poiId: string, lat: number, lng: number) => {
    if (!isAdmin) return;

    const mapped = latLngToImageOverlay(lat, lng);
    const nextX = Math.round(mapped.x);
    const nextY = Math.round(mapped.y);
    const nearestNode = FREE_WALK_NAVIGATION_ENABLED ? null : findNearestNode(nextX, nextY, 90);

    setPois((prev) =>
      prev.map((poi) =>
        poi.id === poiId
          ? {
              ...poi,
              x: nextX,
              y: nextY,
              nodeId: nearestNode ?? undefined,
            }
          : poi,
      ),
    );

    setEditingPoi((prev) =>
      prev?.id === poiId
        ? {
            ...prev,
            x: nextX,
            y: nextY,
            nodeId: nearestNode ?? undefined,
          }
        : prev,
    );

    setDraftPoiIds((prev) => (prev.includes(poiId) ? prev : [...prev, poiId]));
    setPoiDataSource('local-workspace');
    setAdminStatusMessage('Posição atualizada na edição local. Publique quando quiser enviar ao servidor.');

    if (activePoiId === poiId) {
      setFocusPoint((prev) =>
        prev?.id === poiId
          ? {
              ...prev,
              x: nextX,
              y: nextY,
              nodeId: nearestNode ?? undefined,
            }
          : prev,
      );
    }
  };

  const legacyStartNewPoiDraft = () => {
    const fallbackX = focusPoint?.x ?? Math.round(MAP_WIDTH / 2);
    const fallbackY = focusPoint?.y ?? Math.round(MAP_HEIGHT / 2);
    setEditingPoi({
      nome: '',
      tipo: 'atividade',
      x: fallbackX,
      y: fallbackY,
      descricao: '',
      imagemUrl: defaultPoiImages.atividade,
      contato: '',
      corDestaque: '',
      selo: '',
      nodeId: FREE_WALK_NAVIGATION_ENABLED ? undefined : findNearestNode(fallbackX, fallbackY, 90) ?? undefined,
    });
    setAdminStatusMessage('Novo ponto pronto para edição. Clique no mapa para reposicionar se precisar.');
  };

  const legacyBuildPoiFromEditingState = () => {
    const currentEditingPoi = editingPoi;

    if (!currentEditingPoi || !currentEditingPoi.nome || !currentEditingPoi.tipo) {
      alert('Informe nome e tipo do ponto.');
      return null;
    }

    if (typeof currentEditingPoi.x !== 'number' || typeof currentEditingPoi.y !== 'number') {
      alert('Coordenadas inválidas para o ponto.');
      return null;
    }

    const nearestNode = FREE_WALK_NAVIGATION_ENABLED ? null : findNearestNode(currentEditingPoi.x, currentEditingPoi.y, 90);
    if (!FREE_WALK_NAVIGATION_ENABLED && !nearestNode) {
      alert('Este ponto está longe dos corredores de rota. Marque mais perto de um caminho.');
      return null;
    }

    const baseId = currentEditingPoi.nome
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    return {
      id: currentEditingPoi.id || `${baseId || 'ponto'}_${Date.now()}`,
      x: currentEditingPoi.x,
      y: currentEditingPoi.y,
      nome: currentEditingPoi.nome.trim(),
      tipo: currentEditingPoi.tipo,
      descricao: currentEditingPoi.descricao?.trim() || undefined,
      imagemUrl: currentEditingPoi.imagemUrl?.trim() || defaultPoiImages[currentEditingPoi.tipo],
      contato: normalizeContact(currentEditingPoi.contato) || undefined,
      corDestaque: normalizeHexColor(currentEditingPoi.corDestaque),
      selo: normalizeBadgeText(currentEditingPoi.selo),
      nodeId: nearestNode ?? undefined,
    } satisfies PointData;
  };

  const legacySalvarRascunhoPonto = () => {
    const novoPonto = legacyBuildPoiFromEditingState();
    if (!novoPonto) return;

    setPois((prev) => upsertPoiInCollection(prev, novoPonto));
    setDraftPoiIds((prev) => (prev.includes(novoPonto.id) ? prev : [...prev, novoPonto.id]));
    setPoiDataSource('local-workspace');
    setEditingPoi(novoPonto);
    setFocusPoint(novoPonto);
    setActivePoiId(novoPonto.id);
    setAdminStatusMessage(`Rascunho salvo localmente para ${novoPonto.nome}.`);
  };

  const legacyPublishPoiToBackend = async (poi: PointData, currentServerPois = serverPois) => {
    const existsOnBackend = currentServerPois.some((item) => item.id === poi.id);
    const syncedPoi = existsOnBackend
      ? await updatePoi(poi.id, toPoiApiPayload(poi))
      : await createPoi(toPoiApiPayload(poi, { includeId: true }));

    return fromApiPoi(syncedPoi);
  };

  const legacyPublicarPontoAtual = async () => {
    const novoPonto = legacyBuildPoiFromEditingState();
    if (!novoPonto) return;

    try {
      const normalizedPoi = await legacyPublishPoiToBackend(novoPonto);

      setPois((prev) => upsertPoiInCollection(prev, normalizedPoi));
      setServerPois((prev) => upsertPoiInCollection(prev, normalizedPoi));
      setDraftPoiIds((prev) => prev.filter((id) => id !== normalizedPoi.id));
      setEditingPoi(normalizedPoi);
      setFocusPoint(normalizedPoi);
      setActivePoiId(normalizedPoi.id);
      setBackendSyncState('ready');
      setAdminStatusMessage(`Ponto ${normalizedPoi.nome} publicado no servidor.`);
    } catch (error) {
      console.error('Falha ao publicar ponto no backend:', error);
      alert('Não foi possível publicar o ponto no servidor. Confira a API e a ADMIN_API_KEY.');
      setBackendSyncState('error');
    }
  };

  const legacyPublicarRascunhos = async () => {
    if (draftPoiIds.length === 0) {
      setAdminStatusMessage('Não há rascunhos pendentes para publicar.');
      return;
    }

    let nextPois = [...pois];
    let nextServerPois = [...serverPois];
    const remainingDraftIds: string[] = [];
    let syncedCount = 0;

    for (const poiId of draftPoiIds) {
      const poi = nextPois.find((item) => item.id === poiId);
      if (!poi) continue;

      try {
        const normalizedPoi = await legacyPublishPoiToBackend(poi, nextServerPois);
        nextPois = upsertPoiInCollection(nextPois, normalizedPoi);
        nextServerPois = upsertPoiInCollection(nextServerPois, normalizedPoi);
        syncedCount += 1;
      } catch (error) {
        console.error(`Falha ao publicar o rascunho ${poiId}:`, error);
        remainingDraftIds.push(poiId);
      }
    }

    setPois(nextPois);
    setServerPois(nextServerPois);
    setDraftPoiIds(remainingDraftIds);
    setBackendSyncState(remainingDraftIds.length > 0 ? 'error' : 'ready');
    setAdminStatusMessage(
      remainingDraftIds.length > 0
        ? `${syncedCount} rascunho(s) publicados e ${remainingDraftIds.length} permaneceram pendentes.`
        : `${syncedCount} rascunho(s) publicados com sucesso.`,
    );
  };

  const legacyRemoverPontoLocal = (id: string) => {
    if (!window.confirm('Remover este ponto apenas da edição local?')) return;

    setPois((prev) => prev.filter((poi) => poi.id !== id));
    setDraftPoiIds((prev) => prev.filter((poiId) => poiId !== id));
    setManualVisiblePoiIds((prev) => prev.filter((poiId) => poiId !== id));
    setPoiDataSource('local-workspace');
    setFocusPoint((prev) => (prev?.id === id ? null : prev));
    if (editingPoi?.id === id) setEditingPoi(null);
    if (activePoiId === id) setActivePoiId(null);
    if (selectedDestinationId === id) {
      clearRoute();
    }
    setAdminStatusMessage('Ponto removido apenas da edição local.');
  };

  const legacyAbrirImportadorJson = () => {
    adminImportInputRef.current?.click();
  };

  const legacyHandleAdminImportFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const content = await file.text();
      const parsed = JSON.parse(content) as unknown;
      const importedPois = parseStoredPoiList(parsed);

      if (importedPois.length === 0) {
        alert('O arquivo JSON não possui pontos válidos.');
        return;
      }

      setPois(importedPois);
      setDraftPoiIds(importedPois.map((poi) => poi.id));
      setPoiDataSource('local-workspace');
      setEditingPoi(importedPois[0]);
      setFocusPoint(importedPois[0]);
      setActivePoiId(importedPois[0].id);
      clearRoute();
      setAdminStatusMessage(`${importedPois.length} ponto(s) importados para a edição local.`);
    } catch (error) {
      console.error('Falha ao importar JSON de pontos:', error);
      alert('Não foi possível importar este arquivo JSON.');
    }
  };

  const legacyRestaurarFontePrincipal = () => {
    if (!window.confirm('Descartar a edição local e voltar para a fonte principal?')) return;

    setDraftPoiIds([]);
    setEditingPoi(null);
    clearAdminWorkspaceSnapshot();

    if (serverPois.length > 0) {
      setPois(serverPois);
      setPoiDataSource('backend');
      setAdminStatusMessage('Edição local descartada. Voltamos aos dados do servidor.');
      return;
    }

    const runtimeBackup = loadPoiRuntimeBackup();
    if (runtimeBackup.length > 0) {
      setPois(runtimeBackup);
      setPoiDataSource('local-backup');
      setAdminStatusMessage('Base de trabalho descartada. Voltamos ao backup local mais recente.');
      return;
    }

    setPois(getFrontSeedPois());
    setPoiDataSource('front-seed');
    setAdminStatusMessage('Base de trabalho descartada. Voltamos ao conjunto local padrão.');
  };

  const legacySalvarPonto = async () => {
    await legacyPublicarPontoAtual();
  };

  const legacyDeletarPonto = async (id: string) => {
    if (!window.confirm('Apagar este ponto permanentemente?')) return;

    try {
      await deletePoi(id);

      setPois((prev) => prev.filter((poi) => poi.id !== id));
      setServerPois((prev) => prev.filter((poi) => poi.id !== id));
      setDraftPoiIds((prev) => prev.filter((poiId) => poiId !== id));
      setPoiAccessCount((prev) => {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setManualVisiblePoiIds((prev) => prev.filter((poiId) => poiId !== id));
      if (activePoiId === id) setActivePoiId(null);
      if (selectedDestinationId === id) {
        clearRoute();
      }
      setEditingPoi(null);
      setBackendSyncState('ready');
      setAdminStatusMessage('Ponto removido do servidor com sucesso.');
    } catch (error) {
      console.error('Falha ao deletar ponto no backend:', error);
      alert('Não foi possível excluir o ponto no servidor. Confira a API e a ADMIN_API_KEY.');
    }
  };

  const toggleType = (type: PoiType) => {
    setEnabledTypes((prev) => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

  const legacyToggleManualVisibility = (poiId: string) => {
    setManualVisiblePoiIds((prev) =>
      prev.includes(poiId) ? prev.filter((id) => id !== poiId) : [...prev, poiId],
    );
  };

  const legacyBaixarJson = () => {
    const payload = JSON.stringify(pois, null, 2);
    const dataStr = `data:text/json;charset=utf-8,${encodeURIComponent(payload)}`;
    const link = document.createElement('a');
    link.setAttribute('href', dataStr);
    link.setAttribute('download', POI_DATA_EXPORT_FILENAME);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const legacyHandleSetAdminAgendaPoiLink = useCallback(
    (sessionId: string, poiId: string | null) => {
      const session = agendaSessions.find((item) => item.id === sessionId);
      if (!session) return;

      const nextPoiId = poiId?.trim() ?? '';
      const nextLinks = { ...effectiveAdminAgendaPoiLinks };

      if (!nextPoiId || nextPoiId === session.linkedPoiId) {
        delete nextLinks[sessionId];
      } else {
        nextLinks[sessionId] = nextPoiId;
      }

      setAdminAgendaPoiLinks(nextLinks);
      setAdminStatusMessage('Salvando vinculo do cronograma no servidor...');

      void saveAgendaPoiLinks(nextLinks)
        .then((response) => {
          const persistedLinks = sanitizeAgendaPoiLinkRecord(response.links);
          setAdminAgendaPoiLinks(persistedLinks);
          setAdminStatusMessage(
            nextPoiId && nextPoiId !== session.linkedPoiId
              ? 'Vinculo manual do cronograma salvo no servidor.'
              : 'Cronograma voltou a usar o vinculo automatico deste horario.',
          );
        })
        .catch((error) => {
          console.error('Falha ao salvar vinculos do cronograma no backend:', error);
          setAdminStatusMessage(
            'Nao foi possivel salvar o vinculo do cronograma no servidor agora. A alteracao segue apenas neste navegador.',
          );
        });
    },
    [effectiveAdminAgendaPoiLinks],
  );

  const legacyHandleResetAdminAgendaPoiLinks = useCallback(() => {
    setAdminAgendaPoiLinks({});
    setAdminStatusMessage('Removendo vinculos manuais do cronograma no servidor...');

    void saveAgendaPoiLinks({})
      .then((response) => {
        setAdminAgendaPoiLinks(sanitizeAgendaPoiLinkRecord(response.links));
        setAdminStatusMessage('Todos os vinculos manuais do cronograma foram removidos.');
      })
      .catch((error) => {
        console.error('Falha ao limpar vinculos do cronograma no backend:', error);
        setAdminStatusMessage(
          'Nao foi possivel limpar os vinculos do cronograma no servidor agora. A mudanca segue apenas neste navegador.',
        );
      });
  }, []);

  const {
    updatePoiPosition,
    startNewPoiDraft,
    salvarRascunhoPonto,
    publicarRascunhos,
    removerPontoLocal,
    abrirImportadorJson,
    handleAdminImportFileChange,
    restaurarFontePrincipal,
    salvarPonto,
    deletarPonto,
    toggleManualVisibility,
    baixarJson,
    handleSetAdminAgendaPoiLink,
    handleResetAdminAgendaPoiLinks,
  } = usePoiAdmin({
    isAdmin,
    editingPoi,
    setEditingPoi,
    focusPoint,
    setFocusPoint,
    activePoiId,
    setActivePoiId,
    selectedDestinationId,
    clearRoute,
    pois,
    setPois,
    serverPois,
    setServerPois,
    draftPoiIds,
    setDraftPoiIds,
    setManualVisiblePoiIds,
    setPoiDataSource,
    setAdminStatusMessage,
    setBackendSyncState,
    setPoiAccessCount,
    adminImportInputRef,
    effectiveAdminAgendaPoiLinks,
    setAdminAgendaPoiLinks,
    latLngToImageOverlay,
    mapWidth: MAP_WIDTH,
    mapHeight: MAP_HEIGHT,
    freeWalkNavigationEnabled: FREE_WALK_NAVIGATION_ENABLED,
    findNearestNodeFn: findNearestNode,
    parseStoredPoiList,
    loadPoiRuntimeBackup,
    getFrontSeedPois,
    clearAdminWorkspaceSnapshot,
    sanitizeAgendaPoiLinkRecord,
    fromApiPoi,
    toPoiApiPayload,
  });
  void [
    legacySyncBootstrap,
    legacyUpdatePoiPosition,
    legacyStartNewPoiDraft,
    legacySalvarRascunhoPonto,
    legacyPublicarRascunhos,
    legacyRemoverPontoLocal,
    legacyAbrirImportadorJson,
    legacyHandleAdminImportFileChange,
    legacyRestaurarFontePrincipal,
    legacySalvarPonto,
    legacyDeletarPonto,
    legacyToggleManualVisibility,
    legacyBaixarJson,
    legacyHandleSetAdminAgendaPoiLink,
    legacyHandleResetAdminAgendaPoiLinks,
  ];

  useEffect(() => {
    if (!canUseBrowserImageLoader()) {
      setOfficialMapSurfaceUrl(OFFICIAL_MAP_SURFACE_URLS[OFFICIAL_MAP_SURFACE_URLS.length - 1] ?? null);
      return;
    }

    let isCancelled = false;

    const resolveOfficialMapSurface = async () => {
      for (const url of OFFICIAL_MAP_SURFACE_URLS) {
        const exists = await preloadMapSurface(url);
        if (exists) {
          if (!isCancelled) setOfficialMapSurfaceUrl(url);
          return;
        }
      }

      if (!isCancelled) {
        setOfficialMapSurfaceUrl(null);
      }
    };

    resolveOfficialMapSurface();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    closeDockPanel();
  }, [closeDockPanel, isMobile]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (manualOriginFallbackTimerRef.current !== null) {
      window.clearTimeout(manualOriginFallbackTimerRef.current);
      manualOriginFallbackTimerRef.current = null;
    }

    const shouldPromptManualOrigin =
      !isAdmin &&
      selectedDestinationSupportsGuidedRoute &&
      !selectedOriginId &&
      !manualMapOrigin &&
      !isManualOriginRequired &&
      routeLatLngPoints.length <= 1;

    if (!shouldPromptManualOrigin) {
      if (manualOriginPickerMode === 'reposition' && isManualOriginPickerOpen) {
        return;
      }

      if (!selectedDestinationId || !selectedDestinationSupportsGuidedRoute || routeLatLngPoints.length > 1 || selectedOriginId || manualMapOrigin) {
        setIsManualOriginPickerOpen(false);
        setManualOriginPickerMode(null);
      }
      return;
    }

    manualOriginFallbackTimerRef.current = window.setTimeout(() => {
      setManualOriginPickerMode('fallback');
      setIsManualOriginPickerOpen(true);
      setIsManualOriginRequired(true);
      setRota(null);
      setRouteMessage(getManualOriginRequiredMessage(selectedDestinationPoi?.nome ?? null));
    }, MANUAL_ROUTE_FALLBACK_TIMEOUT_MS);

    return () => {
      if (manualOriginFallbackTimerRef.current !== null) {
        window.clearTimeout(manualOriginFallbackTimerRef.current);
        manualOriginFallbackTimerRef.current = null;
      }
    };
  }, [
    isAdmin,
    isManualOriginRequired,
    manualMapOrigin,
    manualOriginPickerMode,
    routeLatLngPoints.length,
    selectedDestinationPoi?.nome,
    selectedDestinationId,
    selectedDestinationSupportsGuidedRoute,
    selectedOriginId,
    getManualOriginRequiredMessage,
    setRota,
    setRouteMessage,
    isManualOriginPickerOpen,
  ]);



  useEffect(() => {
    persistPoiAccessCount(poiAccessCount);
  }, [poiAccessCount]);

  useEffect(() => {
    if (serverPois.length === 0) return;
    persistPoiRuntimeBackup(serverPois);
  }, [serverPois]);

  useEffect(() => {
    if (poiDataSource !== 'local-workspace' && draftPoiIds.length === 0) {
      clearAdminWorkspaceSnapshot();
      return;
    }

    persistAdminWorkspaceSnapshot({
      pois,
      draftPoiIds,
      updatedAt: new Date().toISOString(),
    });
  }, [draftPoiIds, poiDataSource, pois]);

  useEffect(() => {
    persistAdminAgendaPoiLinks(effectiveAdminAgendaPoiLinks);
  }, [effectiveAdminAgendaPoiLinks]);

  useEffect(() => {
    if (activePoiId && !pois.some((poi) => poi.id === activePoiId)) {
      setActivePoiId(null);
    }
  }, [activePoiId, pois]);




  useEffect(() => {
    setExpandedPopupPoiId(null);
  }, [activePoiId]);

  const poiPinScaleTier = getPoiPinScaleTier(mapZoomLevel, mapZoomRange.min, isMobile);
  const getMarkerIcon = (poi: PointData, isActive: boolean) => {
    if (!isAdmin && poi.id === selectedDestinationId) {
      return getPoiIcon(poi, poiPinScaleTier, true);
    }
    if (!isAdmin && isActive) {
      return getPoiIcon(poi, poiPinScaleTier, true);
    }
    return getPoiIcon(poi, poiPinScaleTier, false);
  };
  const currentTutorialStep = tutorialSteps[tutorialStepIndex];
  const isTutorialLocationStep = currentTutorialStep.visual === 'location';
  const canFinishTutorialLocationStep =
    !isTutorialLocationStep || hasConfirmedLiveLocationAccess || liveTrackingState === 'unsupported';
  const mapOverlayOpacity = 1;
  const basemapOpacity = 0;
  const effectiveMapSurfaceUrl = officialMapSurfaceUrl;
  const resolvedDefaultZoom = 17;
  const popupSizePreset = getPoiPreviewSizeLimits(isMobile);
  const dockWidth = isMobile
    ? '100vw'
    : isCompactViewport
      ? 'min(520px, calc(100vw - 24px))'
      : 'min(560px, calc(100vw - 48px))';
  const dockBottom = isMobile ? 0 : 22;
  const activeDockSheetHeight =
    activeDockPanel && viewportHeight > 0 ? Math.round(viewportHeight * dockPanelHeights[activeDockPanel]) : 0;
  const isCompactAdminLayout = isMobile || isCompactViewport;
  const adminPanelWidth = isCompactAdminLayout ? 'min(100vw, 340px)' : '300px';
  const adminDenseButtonStyle: CSSProperties = {
    ...actionButton,
    minHeight: 34,
    padding: '8px 10px',
    borderRadius: '7px',
    fontSize: 12,
    lineHeight: 1.15,
  };
  const adminDenseInputStyle: CSSProperties = {
    ...inputStyle,
    padding: '7px 9px',
    marginTop: '3px',
    marginBottom: '8px',
    borderRadius: '7px',
    fontSize: 13,
  };
  const editingAccentColorPreview =
    (editingPoi?.corDestaque && isBrandPaletteColor(editingPoi.corDestaque) && normalizeHexColor(editingPoi.corDestaque)) ||
    BRAND_COLORS.primary;
  const hasInvalidEditingAccentColor = Boolean(
    editingPoi?.corDestaque?.trim() && !isBrandPaletteColor(editingPoi.corDestaque),
  );
  const editingBadgePreview =
    normalizeBadgeText(editingPoi?.selo) ?? editingPoi?.nome?.trim().charAt(0).toUpperCase() ?? 'P';
  const sourceMetaMap: Record<PoiDataSource, { label: string; tint: string; tone: string }> = {
    backend: {
      label: 'Fonte ativa: servidor',
      tint: 'rgba(106, 56, 208, 0.14)',
      tone: BRAND_COLORS.primaryStrong,
    },
    'local-workspace': {
      label: 'Fonte ativa: edição local',
      tint: 'rgba(217, 200, 255, 0.24)',
      tone: BRAND_COLORS.ink,
    },
    'local-backup': {
      label: 'Fonte ativa: backup local',
      tint: 'rgba(45, 35, 61, 0.12)',
      tone: BRAND_COLORS.ink,
    },
    'front-seed': {
      label: 'Fonte ativa: base local do aplicativo',
      tint: 'rgba(239, 232, 255, 0.92)',
      tone: BRAND_COLORS.primaryStrong,
    },
  };
  const currentSourceMeta = sourceMetaMap[poiDataSource];
  const editingPoiExistsOnBackend = Boolean(editingPoi?.id && serverPois.some((poi) => poi.id === editingPoi.id));
  const editingPoiIsDraft = Boolean(editingPoi?.id && draftPoiIdSet.has(editingPoi.id));
  const backendSyncLabel =
    backendSyncState === 'loading'
      ? 'Conectando com o servidor'
      : backendSyncState === 'ready'
        ? 'Servidor sincronizado'
        : 'Servidor indisponível';
  const isLiveLocationAccuracyWeak = Boolean(
    liveLocation && liveLocation.accuracyMeters > LIVE_LOCATION_WARNING_ACCURACY_METERS,
  );
  const liveLocationPrimaryActionLabel =
    liveTrackingState === 'requesting'
      ? 'Buscando GPS'
      : hasLiveLocationFix
        ? 'Reiniciar GPS'
        : 'Usar meu GPS';
  const shouldShowStopLiveLocation = liveTrackingState !== 'idle' && liveTrackingState !== 'unsupported';
  const liveLocationSourceLabel = liveLocationSource === 'gps' ? 'Fonte GPS' : 'Sem fonte ativa';
  const liveLocationCardHeadline = hasManualRouteOrigin
    ? 'Origem manual ativa'
    : isManualOriginFallbackRequired
      ? 'Confirme sua origem'
      : liveLocationHeadline;
  const liveLocationCardStatusText = hasManualRouteOrigin
    ? 'A rota esta usando a origem manual. Limpe a origem quando quiser voltar ao GPS em tempo real.'
    : isManualOriginFallbackRequired
      ? 'A localizacao esta demorando demais. Marque onde voce esta no mapa ou use os pontos principais para continuar.'
      : liveLocationStatusText;
  const liveLocationCard = (
    <LiveLocationCard
      data={{
        headline: liveLocationCardHeadline,
        originName: activeRouteOriginSummaryName,
        statusText: liveLocationCardStatusText,
        primaryActionLabel: liveLocationPrimaryActionLabel,
        showStopAction: shouldShowStopLiveLocation,
        areaLabel: liveLocation ? (liveLocation.isInsideEvent ? 'Dentro da operação' : 'Fora da área') : 'Aguardando GPS',
        accuracyLabel: liveLocationAccuracyLabel ?? '--',
        updatedAtLabel: liveLocationUpdatedAtLabel ?? '--',
        sourceLabel: liveLocationSourceLabel,
        latLabel: liveLocationLatLabel,
        lngLabel: liveLocationLngLabel,
        mapPointLabel: liveLocationMapPoint ? `x:${liveLocationMapPoint.x} | y:${liveLocationMapPoint.y}` : '--',
        backendStateLabel: liveLocationBackendStateLabel,
        resolvedAddress: liveLocationResolvedAddress,
        venueName: liveLocationContext?.venue?.label ?? 'Evento',
        venueStatusLabel: liveLocationVenueStatusLabel,
        venueDistanceLabel: liveLocationVenueDistanceLabel,
        externalRouteLabel: liveLocationExternalRouteLabel,
        helpText: `${activeRouteOriginSummaryHelp} ${liveLocationContextHelp}${
          isLiveLocationAccuracyWeak ? ' O sinal está mais fraco do que o ideal; se puder, aproxime-se de uma área aberta.' : ''
        }`.trim(),
        tone: liveLocationStatusTone,
        isAccuracyWeak: isLiveLocationAccuracyWeak,
      }}
      onPrimaryAction={startLiveLocationTracking}
      onStopAction={() => stopLiveLocationTracking()}
    />
  );
  const getPoiRelatedSessions = useCallback(
    (poi: PointData) =>
      agendaSessions.filter((session) => sessionMatchesPoi(session, poi, effectiveAdminAgendaPoiLinks)).slice(0, 3),
    [effectiveAdminAgendaPoiLinks],
  );
  const handleAgendaNotificationSound = useCallback(() => {
    playUiSound('alert');
  }, [playUiSound]);
  const { notifications: agendaNotifications, dismissNotification: dismissAgendaNotification } = useAgendaNotifications({
    sessions: agendaNotificationSessions,
    enabled: !isAdmin,
    onTriggerSound: handleAgendaNotificationSound,
  });

  return (
    <div
      onPointerDownCapture={handleRootPointerDownCapture}
      onPointerMoveCapture={handleRootPointerMoveCapture}
      onPointerUpCapture={handleRootPointerUpCapture}
      onPointerCancelCapture={handleRootPointerCancelCapture}
      style={{
        width: '100%',
        height: '100%',
        minHeight: '100dvh',
        position: 'relative',
        display: 'flex',
        overflow: 'hidden',
        background: 'transparent',
      }}
    >
      <div
        style={{
          position: isCompactAdminLayout ? 'absolute' : 'relative',
          inset: isCompactAdminLayout ? '0 auto 0 0' : undefined,
          width: isAdmin ? adminPanelWidth : '0px',
          maxWidth: '100%',
          height: isCompactAdminLayout ? '100%' : undefined,
          maxHeight: isCompactAdminLayout ? '100%' : undefined,
          transition: 'width 0.3s ease',
          background: 'var(--color-surface-strong)',
          borderRight: isAdmin ? '1px solid var(--color-border)' : 'none',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: isAdmin ? '0 6px 20px rgba(106, 56, 208, 0.12)' : 'none',
          zIndex: 1200,
          overflow: 'hidden',
          fontSize: 13,
        }}
      >

        {isAdmin && (
          <MapAdminPanel
            adminImportInputRef={adminImportInputRef}
            onImportFileChange={handleAdminImportFileChange}
            freeWalkNavigationEnabled={FREE_WALK_NAVIGATION_ENABLED}
            currentSourceMeta={currentSourceMeta}
            backendSyncLabel={backendSyncLabel}
            poisCount={pois.length}
            draftPoiCount={draftPoiIds.length}
            syncedPoiCount={syncedPoiCount}
            disconnectedPoiCount={disconnectedPoiCount}
            onStartNewPoiDraft={startNewPoiDraft}
            onRefreshServer={() => void syncBootstrap({ forceReplace: true })}
            onOpenJsonImporter={abrirImportadorJson}
            onPublishDrafts={publicarRascunhos}
            adminDenseButtonStyle={adminDenseButtonStyle}
            adminDenseInputStyle={adminDenseInputStyle}
            adminSearchTerm={adminSearchTerm}
            onAdminSearchTermChange={setAdminSearchTerm}
            adminTypeFilter={adminTypeFilter}
            onAdminTypeFilterChange={setAdminTypeFilter}
            adminStatusMessage={adminStatusMessage}
            adminAgendaPoiLinks={adminAgendaPoiLinkRows}
            adminAgendaPoiLinkOptions={adminAgendaPoiLinkOptions}
            onSetAgendaPoiLink={handleSetAdminAgendaPoiLink}
            onResetAgendaPoiLinks={handleResetAdminAgendaPoiLinks}
            filteredAdminPois={filteredAdminPois}
            draftPoiIdSet={draftPoiIdSet}
            editingPoiId={editingPoi?.id ?? null}
            getPoiAccentColor={getPoiAccentColor}
            getPoiBadgeText={getPoiBadgeText}
            onSelectPoi={(poi) => {
              setEditingPoi({ ...poi });
              setFocusPoint(poi);
              setActivePoiId(poi.id);
            }}
            onRestorePrimarySource={restaurarFontePrincipal}
            onDownloadJson={baixarJson}
            onExitAdmin={() => {
              setIsAdmin(false);
              setEditingPoi(null);
            }}
          />
        )}
      </div>

      <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>

        <MapAdminEditor
          isOpen={isAdmin && Boolean(editingPoi)}
          editingPoi={editingPoi}
          editingPoiIsDraft={editingPoiIsDraft}
          editingPoiExistsOnBackend={editingPoiExistsOnBackend}
          freeWalkNavigationEnabled={FREE_WALK_NAVIGATION_ENABLED}
          brandColors={{
            ink: BRAND_COLORS.ink,
            primaryStrong: BRAND_COLORS.primaryStrong,
            textMuted: BRAND_COLORS.textMuted,
            primary: BRAND_COLORS.primary,
          }}
          editingAccentColorPreview={editingAccentColorPreview}
          editingBadgePreview={editingBadgePreview}
          hasInvalidEditingAccentColor={hasInvalidEditingAccentColor}
          setEditingPoi={setEditingPoi}
          adminDenseInputStyle={adminDenseInputStyle}
          adminDenseButtonStyle={adminDenseButtonStyle}
          onSaveDraft={salvarRascunhoPonto}
          onPublishNow={salvarPonto}
          onRemoveLocal={removerPontoLocal}
          onDeleteFromServer={deletarPonto}
          onClose={() => setEditingPoi(null)}
        />

        {!isAdmin && (
          <MapHeader logoSrc={brandIcon} logoScale={BRAND_LOGO_SCALE} />
        )}

        {!isAdmin && (
          <div
            style={
              {
                position: 'fixed',
                left: '50%',
                bottom: dockBottom,
                transform: 'translateX(-50%)',
                zIndex: 3200,
                width: dockWidth,
              } as CSSProperties
            }
            className={`map-surface-toolbar map-action-dock ${isDockPanelOpen ? `sheet-open panel-${activeDockPanel}` : ''}`}
          >
            <div
              ref={dockSheetBodyRef}
              className={`map-action-sheet-body ${isDockPanelOpen ? 'active' : ''} ${isDockSheetDragging ? 'dragging' : ''}`}
              style={{ '--sheet-height': `${activeDockSheetHeight}px` } as CSSProperties}
            >
              {isDockPanelOpen && (
                <div
                  className='map-sheet-drag-handle-wrap'
                  onPointerDown={handleDockSheetDragPointerDown}
                  onPointerMove={handleDockSheetDragPointerMove}
                  onPointerUp={handleDockSheetDragPointerUp}
                  onPointerCancel={handleDockSheetDragPointerCancel}
                  role='separator'
                  aria-label='Arraste para ajustar a altura do painel'
                  aria-orientation='vertical'
                >
                  <div className='map-sheet-drag-handle' />
                </div>
              )}
              <div className='map-action-sheet-scroll'>
                {activeDockPanel === 'pins' && (
                  <PinPanel
                    shouldShowPinsLocationPrompt={shouldShowPinsLocationPrompt}
                    liveTrackingState={liveTrackingState}
                    liveLocationStatusText={liveLocationStatusText}
                    onRequestLocation={startLiveLocationTracking}
                    searchTerm={searchTerm}
                    onSearchTermChange={setSearchTerm}
                    poiTypeLabels={poiTypeLabels}
                    poiTypeSingularLabels={poiTypeSingularLabels}
                    enabledTypes={enabledTypes}
                    onToggleType={toggleType}
                    searchablePois={searchablePois}
                    manualVisiblePoiIds={effectiveManualVisiblePoiIds}
                    onResetManualVisibility={() => setManualVisiblePoiIds([])}
                    arePinsHiddenByZoom={arePinsHiddenByZoom}
                    isPresentationMode={isPresentationMode}
                    inputStyle={inputStyle}
                    actionButtonStyle={actionButton}
                    getPoiAccentColor={getPoiAccentColor}
                    getPoiAccentRingColor={(accentColor) => mixColors(accentColor, '#ffffff', 0.74)}
                    onToggleManualVisibility={toggleManualVisibility}
                    onFocusPoi={(poi) => focusPoi(poi, true)}
                    onViewPoi={handlePoiListView}
                    onNavigatePoi={handlePoiListNavigate}
                    selectedDestinationPoiName={selectedDestinationPoi?.nome ?? null}
                    routeMessage={routeMessage}
                    routeDistanceMeters={routeDistanceMeters}
                    routeEtaMinutes={routeEtaMinutes}
                    activeRouteMetricLabel={activeRouteMetricLabel}
                    activeRouteMetricValue={activeRouteMetricValue}
                    onClearRoute={clearRoute}
                    formatDistanceLabel={formatDistanceLabel}
                    formatWalkingTimeLabel={formatWalkingTimeLabel}
                  />
                )}

                {activeDockPanel === 'agenda' && (
                  <AgendaPanel
                    days={agendaDays}
                    selectedDayId={selectedAgendaDay}
                    onSelectDay={(dayId) => setSelectedAgendaDay(dayId as AgendaDayId)}
                    selectedDayMeta={selectedAgendaDayMeta}
                    stats={agendaDayStats}
                    sessions={agendaPanelSessions}
                    onToggleFavorite={toggleAgendaFavorite}
                    onOpenOnMap={handleAgendaSessionFocusById}
                  />
                )}

                {activeDockPanel === 'partners' && <PartnersPanel />}

                {activeDockPanel === 'route' && (
                  <RoutePanel
                    liveLocationCard={liveLocationCard}
                    activeRouteOriginSummaryName={activeRouteOriginSummaryName}
                    activeRouteOriginSummaryHelp={activeRouteOriginSummaryHelp}
                    originQuery={originQuery}
                    onOriginQueryChange={(value) => {
                      if (hasManualRouteOrigin) {
                        clearManualRouteOrigin();
                      }
                      setOriginQuery(value);
                      setSelectedOriginId('');
                      setShowOriginSuggestions(true);
                    }}
                    onOriginFocus={() => setShowOriginSuggestions(true)}
                    onOriginBlur={() => window.setTimeout(() => setShowOriginSuggestions(false), 120)}
                    onOriginSuggestionSelect={handleRouteOriginSuggestionSelect}
                    originSuggestions={originSuggestions}
                    showOriginSuggestions={showOriginSuggestions}
                    destinationQuery={destinationQuery}
                    onDestinationQueryChange={(value) => {
                      setDestinationQuery(value);
                      setSelectedDestinationId('');
                      setShowDestinationSuggestions(true);
                    }}
                    onDestinationFocus={() => setShowDestinationSuggestions(true)}
                    onDestinationBlur={() => window.setTimeout(() => setShowDestinationSuggestions(false), 120)}
                    onDestinationSuggestionSelect={selectDestinationPoi}
                    destinationSuggestions={destinationSuggestions}
                    showDestinationSuggestions={showDestinationSuggestions}
                    onClearRoute={clearRoute}
                    onClearManualRouteOrigin={clearManualRouteOrigin}
                    hasManualRouteOrigin={hasManualRouteOrigin}
                    hasManualMapRouteOrigin={hasManualMapRouteOrigin}
                    onRepositionManualOrigin={() =>
                      openManualOriginPicker('Toque em outro corredor ou perto de um pin para mudar sua origem manual.')
                    }
                    routeMessage={routeMessage}
                    routeDistanceMeters={routeDistanceMeters}
                    routeEtaMinutes={routeEtaMinutes}
                    activeRouteMetricLabel={activeRouteMetricLabel}
                    activeRouteMetricValue={activeRouteMetricValue}
                    isPresentationMode={isPresentationMode}
                    isMobile={isMobile}
                    inputStyle={inputStyle}
                    buttonStyle={actionButton}
                    formatDistanceLabel={formatDistanceLabel}
                    formatWalkingTimeLabel={formatWalkingTimeLabel}
                  />
                )}
              </div>
            </div>

            <>
              <MapDockButtons activeDockPanel={activeDockPanel} onTogglePanel={toggleDockPanel} />
              {!isPresentationMode && (
                <button
                  onClick={() => {
                    setTutorialStepIndex(0);
                    closeDockPanel();
                    setIsTutorialOpen(true);
                  }}
                  className={`map-toggle-btn ${isTutorialOpen ? 'active' : ''} ${activeDockPanel ? 'dimmed' : ''}`}
                  aria-pressed={isTutorialOpen}
                >
                  <span className='map-toggle-btn-icon' aria-hidden='true'>
                    <svg viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'>
                      <rect x='4' y='4' width='7' height='7' rx='1.5' />
                      <rect x='13' y='4' width='7' height='7' rx='1.5' />
                      <rect x='4' y='13' width='7' height='7' rx='1.5' />
                      <rect x='13' y='13' width='7' height='7' rx='1.5' />
                    </svg>
                  </span>
                  <span className='map-toggle-btn-label'>Tutorial</span>
                </button>
              )}
            </>
            </div>
        )}

        {!isAdmin && (
          <MapTutorialOverlay
            isOpen={isTutorialOpen}
            tutorialStepIndex={tutorialStepIndex}
            currentTutorialStep={currentTutorialStep}
            liveTrackingState={liveTrackingState}
            liveLocationStatusText={liveLocationStatusText}
            isTutorialLocationStep={isTutorialLocationStep}
            canFinishTutorialLocationStep={canFinishTutorialLocationStep}
            onClose={closeTutorial}
            onPreviousStep={() => setTutorialStepIndex((prev) => Math.max(0, prev - 1))}
            onNextStep={() => setTutorialStepIndex((prev) => Math.min(tutorialSteps.length - 1, prev + 1))}
            onRequestLocation={() => void startLiveLocationTracking()}
          />
        )}
        {!isAdmin && (
          <ManualOriginFallbackOverlay
            isOpen={isManualOriginPickerOpen}
            mode={manualOriginPickerMode}
            destinationName={selectedDestinationPoi?.nome ?? null}
            liveTrackingState={liveTrackingState}
            statusMessage={manualOriginOverlayStatusMessage}
            onRetryGps={handleRetryGpsAfterManualFallback}
            onUseMainPoints={handleUseMainPointsForRoute}
          />
        )}
        {!isAdmin && (
          <AgendaNotificationStack
            notifications={agendaNotifications}
            onDismiss={dismissAgendaNotification}
            onNavigate={(notification) => {
              dismissAgendaNotification(notification.id);
              handleAgendaSessionNavigateById(notification.sessionId);
            }}
          />
        )}
          <MapContainer
            center={MAP_VIEW_CENTER}
            zoom={resolvedDefaultZoom}
            minZoom={mapZoomRange.min}
            maxZoom={mapZoomRange.max}
            maxBounds={mapViewportBounds}
            maxBoundsViscosity={OFFICIAL_MAP_BOUNDS_VISCOSITY}
            style={{ height: '100%', width: '100%', flex: 1, minWidth: 0, minHeight: 0 }}
            zoomControl={false}
            scrollWheelZoom={true}
            doubleClickZoom={true}
            touchZoom={true}
            boxZoom={false}
            keyboard={false}
            dragging={true}
            zoomSnap={0.1}
            zoomDelta={0.1}
            preferCanvas={false}
            zoomAnimation={!prefersReducedMotion}
            markerZoomAnimation={!prefersReducedMotion}
            fadeAnimation={!prefersReducedMotion}
          >
            <MapViewportBoundsController
              isMobile={isMobile}
              mapOverlayBounds={mapOverlayBounds}
              mapViewportBounds={mapViewportBounds}
              onZoomLevelChange={handleMapZoomLevelChange}
              onZoomRangeChange={handleMapZoomRangeChange}
            />
          <TileLayer
            url={BASEMAP_TILE_URL}
            attribution={BASEMAP_TILE_ATTRIBUTION}
            className='basemap-street-layer'
            opacity={basemapOpacity}
            maxNativeZoom={BASEMAP_TILE_MAX_NATIVE_ZOOM}
            maxZoom={BASEMAP_TILE_MAX_ZOOM}
            keepBuffer={8}
            updateWhenIdle={true}
            updateWhenZooming={false}
            updateInterval={140}
          />
          {effectiveMapSurfaceUrl && (
            <ImageOverlay url={effectiveMapSurfaceUrl} bounds={mapOverlayBounds} opacity={mapOverlayOpacity} zIndex={20} />
          )}
          {!isAdmin && (
            <Polygon
              positions={eventBoundaryLatLngPoints}
              pathOptions={{
                color: BRAND_COLORS.highlight,
                weight: 2,
                opacity: 0.72,
                dashArray: '10 10',
                fillColor: BRAND_COLORS.highlight,
                fillOpacity: 0.05,
              }}
              interactive={false}
            />
          )}
          <MapInteractionEvents
            isAdmin={isAdmin}
            suppressAdminMapClickRef={suppressAdminMapClickRef}
            latLngToImageOverlay={latLngToImageOverlay}
            defaultActivityImageUrl={defaultPoiImages.atividade}
            onPublicMapClick={handlePublicMapClick}
            onAdminDraftClick={setEditingPoi}
            onZoomLevelChange={setMapZoomLevel}
          />
          <MapSizeSync />
          <MapController
            routeLatLngPoints={routeLatLngPoints}
            onRouteViewportSettledChange={setIsRouteViewportSettled}
          />


          <MapRouteLayer
            routeLatLngPoints={routeLatLngPoints}
            visibleRouteLatLngPoints={visibleRouteLatLngPoints}
            isMobile={isMobile}
            isRouteViewportSettled={isRouteViewportSettled}
            isRouteRevealComplete={isRouteRevealComplete}
            routeRevealHeadPoint={routeRevealHeadPoint}
            routeShadowColor={routeShadowColor}
            routeGuideColor={routeGuideColor}
            surfaceColor={BRAND_COLORS.surface}
            primaryColor={BRAND_COLORS.primaryStrong}
            mixColors={mixColors}
          />

          {!isAdmin && (
            <MapPresenceLayer
              liveLocation={liveLocation}
              liveLocationMarkerPosition={liveLocationMarkerPosition}
              manualOriginMarkerPosition={manualMapOriginMarkerPosition}
              routeLatLngPoints={routeLatLngPoints}
              hasLiveLocationFix={hasLiveLocationFix}
              routeMarkerPosition={routeMarkerPosition}
              routeRemainingEtaLabel={routeRemainingEtaLabel}
              liveLocationMarkerTone={liveLocationMarkerTone}
              manualOriginMarkerTone={BRAND_COLORS.highlight}
              previewMarkerTone={previewMarkerTone}
              renderPresenceMarker={renderPresenceMarker}
            />
          )}

          <MapPoiLayer
            visiblePois={visiblePois}
            activePoiId={activePoiId}
            selectedDestinationId={selectedDestinationId}
            isAdmin={isAdmin}
            defaultPoiImages={defaultPoiImages}
            imageToLatLng={imageToLatLng}
            getMarkerIcon={getMarkerIcon}
            getPoiAccentColor={getPoiAccentColor}
            getPoiGalleryImages={getPoiGalleryImages}
            getRelatedSessions={getPoiRelatedSessions}
            eventLabel={EVENT_LABEL}
            expandedPopupPoiId={expandedPopupPoiId}
            onToggleExpandedPopup={(poiId) => setExpandedPopupPoiId((prev) => (prev === poiId ? null : poiId))}
            onPopupNavigate={(poi) => {
              focusPoi(poi, false, { moveCamera: false });
              navigateToPoi(poi);
            }}
            onMarkerSelect={handleMarkerSelection}
            onSuppressNextAdminMapClick={suppressNextAdminMapClick}
            onUpdatePoiPosition={updatePoiPosition}
            popupSizePreset={popupSizePreset}
            editingPoi={editingPoi}
            stateIcons={stateIcons}
          />
        </MapContainer>
        <div className='tap-feedback-layer' aria-hidden='true'>
          {tapIndicators.map((indicator) => (
            <span
              key={indicator.id}
              className='tap-indicator'
              style={{ left: indicator.x, top: indicator.y }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  marginTop: '4px',
  marginBottom: '10px',
  borderRadius: '8px',
  border: '1px solid var(--color-border-strong)',
  background: '#fbfdff',
  color: 'var(--color-text)',
  boxSizing: 'border-box',
};

const actionButton: CSSProperties = {
  flex: 1,
  border: 'none',
  padding: '10px',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 700,
  fontFamily: 'inherit',
};

export default ModaCenterMap;




          

