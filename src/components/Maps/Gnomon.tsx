import {
  Circle,
  CircleMarker,
  ImageOverlay,
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
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
import { findNearestNode, findPath } from '../../utils/pathfinding';
import {
  createPoi,
  deletePoi,
  fetchMapBootstrap,
  trackPoiAccess,
  updatePoi,
  type MapPoiDto,
  type UpsertPoiPayload,
} from '../../services/mapApi';
import {
  EVENT_BOUNDARY_IMAGE_POINTS,
  MAP_CENTER,
  MAP_EAST,
  MAP_NORTH,
  MAP_OVERLAY_EAST,
  MAP_OVERLAY_NORTH,
  MAP_OVERLAY_SOUTH,
  MAP_OVERLAY_WEST,
  MAP_PIXEL_HEIGHT,
  MAP_PIXEL_WIDTH,
  MAP_SOUTH,
  MAP_WEST,
} from '../../config/mapConfig';
import rawInitialPoisSeed from '../../data/locaisEventoSocialSeed.json';
import brandIcon from '../../assets/icone.png';

type PoiType = 'atividade' | 'servico' | 'banheiro' | 'entrada';

type PoiAccessCount = Record<string, number>;
type AgendaDayId = '21';
type PoiDataSource = 'backend' | 'local-workspace' | 'local-backup' | 'front-seed';
type DockPanel = 'pins' | 'route' | 'agenda' | null;

interface AgendaSpeaker {
  name: string;
  role: string;
}

interface AgendaSession {
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

interface PointData {
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

const agendaDays: { id: AgendaDayId; weekday: string; dateLabel: string }[] = [
  { id: '21', weekday: 'SAB', dateLabel: '21' },
];

const saturdayAgendaMeta: Pick<AgendaSession, 'dayId' | 'weekday' | 'dateLabel'> = {
  dayId: '21',
  weekday: 'SAB',
  dateLabel: '21',
};

const BRAND_COLORS = {
  ink: '#5c33ad',
  inkSoft: '#7b56ca',
  primary: '#6a38d0',
  primaryStrong: '#5326b8',
  primarySoft: '#8d6fe7',
  primarySoftest: '#efe8ff',
  highlight: '#d9c8ff',
  highlightSoft: '#f5efff',
  surface: '#ffffff',
  surfaceSoft: '#f6f2fc',
  border: '#ddd4ee',
  textMuted: '#6f677f',
} as const;

const BRAND_PALETTE = new Set<string>(Object.values(BRAND_COLORS));

const agendaCategoryAccents: Record<string, string> = {
  'Palco Principal': BRAND_COLORS.primary,
  'Arena Experiência': BRAND_COLORS.primarySoft,
  'Oficina Game': BRAND_COLORS.primaryStrong,
  Hotseat: BRAND_COLORS.ink,
  Intervalo: BRAND_COLORS.highlight,
};

const poiTypeAccentMap: Record<PoiType, string> = {
  atividade: BRAND_COLORS.primary,
  servico: BRAND_COLORS.ink,
  banheiro: BRAND_COLORS.primarySoft,
  entrada: BRAND_COLORS.highlight,
};

const getAgendaAccent = (category: string) => agendaCategoryAccents[category] ?? BRAND_COLORS.primary;

const createAgendaSession = (
  session: Omit<AgendaSession, 'dayId' | 'weekday' | 'dateLabel'>,
): AgendaSession => ({
  ...saturdayAgendaMeta,
  ...session,
  accent: getAgendaAccent(session.category),
});

const agendaVenuePriority: Record<string, number> = {
  'Recepção e Credenciamento': 0,
  'Palco Principal': 1,
  'Laboratório Game': 2,
  'Sala de Economia Criativa 01': 3,
  'Sala de Economia Criativa 02': 4,
  'Arena Experiência': 5,
  'Área de Alimentação': 6,
};

const compareAgendaSessions = (left: AgendaSession, right: AgendaSession) => {
  const startDifference = parseAgendaTimeToMinutes(left.startTime) - parseAgendaTimeToMinutes(right.startTime);
  if (startDifference !== 0) return startDifference;

  const venueDifference = (agendaVenuePriority[left.venue] ?? 99) - (agendaVenuePriority[right.venue] ?? 99);
  if (venueDifference !== 0) return venueDifference;

  const endDifference = parseAgendaTimeToMinutes(left.endTime) - parseAgendaTimeToMinutes(right.endTime);
  if (endDifference !== 0) return endDifference;

  return left.title.localeCompare(right.title, 'pt-BR');
};

const agendaSessions: AgendaSession[] = [
  createAgendaSession({
    id: 'agenda_21_credenciamento',
    category: 'Palco Principal',
    title: 'Credenciamento',
    summary: 'Recepção inicial, credenciamento e orientações de chegada para abrir o único dia oficial do evento com fluxo organizado.',
    venue: 'Recepção e Credenciamento',
    audience: 'Público geral',
    startTime: '09:00',
    endTime: '09:45',
    accent: '#4c6fff',
    linkedPoiId: 'recepcao_credenciamento',
    speakers: [{ name: 'Equipe do evento', role: 'Credenciamento e recepção' }],
  }),
  createAgendaSession({
    id: 'agenda_21_arena_experiencia',
    category: 'Arena Experiência',
    title: 'Espaços dos parceiros abertos ao público',
    summary: 'SENAI - Sistema FIEPE, SENAC, Jardim Digital, ASCES e UNINASSAU funcionam continuamente das 09h às 17h na Arena Experiência.',
    venue: 'Arena Experiência',
    audience: 'Circulação livre',
    startTime: '09:00',
    endTime: '17:00',
    accent: '#15803d',
    mapQuery: 'arena experiencia',
    speakers: [{ name: 'Parceiros do evento', role: 'Ativações abertas' }],
  }),
  createAgendaSession({
    id: 'agenda_21_oficina_gamelab_01',
    category: 'Oficina Game',
    title: 'Oficina 01: GameLab - Do zero ao jogo: criando experiências na prática',
    summary: 'Laboratório Game no Arena Porto Digital com Gustavo Tenorio e Rafael Silva, em uma oficina prática de criação de jogos.',
    venue: 'Laboratório Game',
    audience: 'Estudantes, devs e criadores',
    startTime: '09:00',
    endTime: '11:00',
    accent: '#0d9488',
    mapQuery: 'laboratorio game',
    speakers: [
      { name: 'Gustavo Tenorio', role: 'PLAYNAMBUCO' },
      { name: 'Rafael Silva', role: 'PLAYNAMBUCO' },
    ],
  }),
  createAgendaSession({
    id: 'agenda_21_abertura_institucional',
    category: 'Palco Principal',
    title: 'Abertura institucional',
    summary: 'Boas-vindas oficiais e alinhamento da programação do sábado 21, com abertura do palco principal.',
    venue: 'Palco Principal',
    audience: 'Público geral',
    startTime: '09:45',
    endTime: '10:00',
    accent: '#ea580c',
    linkedPoiId: 'palco_principal',
    speakers: [{ name: 'Organização Gnostart', role: 'Abertura oficial' }],
  }),
  createAgendaSession({
    id: 'agenda_21_palestra_tempo_dinheiro_atencao',
    category: 'Palco Principal',
    title: 'Palestra: Tempo, dinheiro e atenção: acelere seus resultados financeiros dominando os três recursos mais escassos do mundo',
    summary: 'Gui Junqueira conduz a palestra principal da manhã sobre tempo, dinheiro e atenção como recursos decisivos para acelerar resultados.',
    venue: 'Palco Principal',
    audience: 'Empreendedores, gestores e investidores',
    startTime: '10:00',
    endTime: '11:00',
    accent: '#7c3aed',
    linkedPoiId: 'palco_principal',
    speakers: [{ name: 'Gui Junqueira', role: 'Palestrante' }],
  }),
  createAgendaSession({
    id: 'agenda_21_painel_agreste_transformacao',
    category: 'Palco Principal',
    title: 'Painel: Agreste em Transformação - Inovação, Desafios e Oportunidades',
    summary: 'Debate sobre inovação regional, desafios e oportunidades no Agreste com setor público, academia, ecossistema e lideranças empresariais.',
    venue: 'Palco Principal',
    audience: 'Ecossistema de inovação, poder público e lideranças',
    startTime: '11:00',
    endTime: '12:00',
    accent: '#2563eb',
    linkedPoiId: 'palco_principal',
    speakers: [
      { name: 'Teresa Maciel', role: 'Secretaria Executiva da SECTI' },
      { name: 'Pamela Dias', role: 'Gestora do Porto Digital Caruaru' },
      { name: 'Mendonca Filho', role: 'Deputado Federal' },
      { name: 'Jaime Anselmo', role: 'Secretário da SEDETEC - Caruaru' },
      { name: 'Luverson Ferreira', role: 'Empresário e Conselheiro da ACIC' },
      { name: 'Claudia Brainer', role: 'Asces-Unita' },
      { name: 'Dilson Cavalcanti', role: 'Diretor do Campus Agreste da UFPE' },
    ],
  }),
  createAgendaSession({
    id: 'agenda_21_hotseat_maturidade_digital',
    category: 'Hotseat',
    title: 'Hotseat: Maturidade digital no interior',
    summary: 'Aprendendo com quem constrói empresas no ecossistema: "Maturidade digital no interior: como avaliar o estágio real da empresa antes de investir em novas ferramentas."',
    venue: 'Sala de Economia Criativa 01',
    audience: 'Empresas, consultores e lideranças',
    startTime: '11:00',
    endTime: '11:45',
    accent: '#db2777',
    mapQuery: 'sala de economia criativa 01',
    speakers: [
      { name: 'Rafael Soares', role: 'Tapioca Valley' },
      { name: 'Pamela Rita', role: 'Tapioca Valley' },
      { name: 'Fabio Moura', role: 'CaruaHub' },
      { name: 'Deivid Figueiroa', role: 'CaruaHub' },
    ],
  }),
  createAgendaSession({
    id: 'agenda_21_hotseat_erros_caros',
    category: 'Hotseat',
    title: 'Hotseat: Erros caros em projetos de tecnologia',
    summary: 'Aprendendo com quem constrói empresas no ecossistema: "Erros caros em projetos de tecnologia: aprendizados reais de quem já enfrentou atrasos, retrabalho e baixo retorno."',
    venue: 'Sala de Economia Criativa 02',
    audience: 'Empresas, devs e gestores de projetos',
    startTime: '11:00',
    endTime: '11:45',
    accent: '#be185d',
    mapQuery: 'sala de economia criativa 02',
    speakers: [
      { name: 'Arthur Bessone', role: 'Tapioca Valley' },
      { name: 'Joao Moises', role: 'Manguezal' },
      { name: 'Vandilma Benevides', role: 'CaruaHub' },
      { name: 'Inacio Ferreira', role: 'CaruaHub' },
    ],
  }),
  createAgendaSession({
    id: 'agenda_21_intervalo_almoco',
    category: 'Intervalo',
    title: 'Intervalo para almoço',
    summary: 'Pausa de almoço para alimentação, networking e circulação pelos espaços abertos do evento.',
    venue: 'Área de Alimentação',
    audience: 'Público geral',
    startTime: '12:00',
    endTime: '13:00',
    accent: '#16a34a',
    linkedPoiId: 'area_alimentacao',
    speakers: [{ name: 'Área de Alimentação', role: 'Funcionamento livre' }],
  }),
  createAgendaSession({
    id: 'agenda_21_pitch_open_mic',
    category: 'Palco Principal',
    title: 'Pitch de Startups / Open Mic',
    summary: 'Espaço aberto para ideias, negócios e conexões no palco principal, com participação livre em formato microfone aberto.',
    venue: 'Palco Principal',
    audience: 'Empreendedores e comunidade',
    startTime: '13:00',
    endTime: '14:00',
    accent: '#f59e0b',
    linkedPoiId: 'palco_principal',
    speakers: [{ name: 'Participantes do evento', role: 'Open mic' }],
  }),
  createAgendaSession({
    id: 'agenda_21_oficina_gamelab_02',
    category: 'Oficina Game',
    title: 'Oficina 02: GameLab - Do zero ao jogo: criando experiências na prática',
    summary: 'Segunda rodada do Laboratório Game na Arena Porto Digital, mantendo a trilha prática de criação de jogos com PLAYNAMBUCO.',
    venue: 'Laboratório Game',
    audience: 'Estudantes, devs e criadores',
    startTime: '13:00',
    endTime: '15:00',
    accent: '#0f766e',
    mapQuery: 'laboratorio game',
    speakers: [
      { name: 'Gustavo Tenorio', role: 'PLAYNAMBUCO' },
      { name: 'Rafael Silva', role: 'PLAYNAMBUCO' },
    ],
  }),
  createAgendaSession({
    id: 'agenda_21_painel_mobilidade_futuro',
    category: 'Palco Principal',
    title: 'Painel: Mobilidade do Futuro - Energia, IA e Veículos Inteligentes no Brasil',
    summary: 'Painel sobre energia, inteligência artificial e veículos inteligentes no Brasil, conectado ao futuro da mobilidade.',
    venue: 'Palco Principal',
    audience: 'Indústria, tecnologia e mobilidade',
    startTime: '14:00',
    endTime: '15:00',
    accent: '#4f46e5',
    linkedPoiId: 'palco_principal',
    speakers: [
      { name: 'Joao Moizes', role: 'Voxar Labs' },
      { name: 'Artur Bezerra', role: 'EPTAR' },
      { name: 'Antonio Almeida', role: 'UNINASSAU' },
      { name: 'Jackson Carvalho', role: 'ACIC' },
      { name: 'Bruno Brasil', role: 'SENAI' },
    ],
  }),
  createAgendaSession({
    id: 'agenda_21_hotseat_tecnologia_gestao',
    category: 'Hotseat',
    title: 'Hotseat: Tecnologia resolve gestão?',
    summary: 'Aprendendo com quem constrói empresas no ecossistema: "Tecnologia resolve gestão? Os limites entre ferramenta, processo e cultura nas empresas do Agreste."',
    venue: 'Sala de Economia Criativa 01',
    audience: 'Empresarios, gestores e consultores',
    startTime: '14:00',
    endTime: '14:45',
    accent: '#ec4899',
    mapQuery: 'sala de economia criativa 01',
    speakers: [
      { name: 'Pamela Rita', role: 'Tapioca Valley' },
      { name: 'Arthur Bessone', role: 'Tapioca Valley' },
      { name: 'Felipe Belone', role: 'Tapioca Valley' },
      { name: 'Fabio Moura', role: 'CaruaHub' },
    ],
  }),
  createAgendaSession({
    id: 'agenda_21_hotseat_ecossistema_pratica',
    category: 'Hotseat',
    title: 'Hotseat: Ecossistema na prática',
    summary: 'Aprendendo com quem constrói empresas no ecossistema: "Ecossistema na prática: como empresas, especialistas e empreendedores podem resolver gargalos estruturais de forma colaborativa."',
    venue: 'Sala de Economia Criativa 02',
    audience: 'Empreendedores e articuladores do ecossistema',
    startTime: '14:00',
    endTime: '14:45',
    accent: '#e11d48',
    mapQuery: 'sala de economia criativa 02',
    speakers: [
      { name: 'Hildegard Assis', role: 'Tapioca Valley' },
      { name: 'Pamela Dias', role: 'Tapioca Valley' },
      { name: 'Inacio Ferreira', role: 'CaruaHub' },
      { name: 'Ana Amorim', role: 'Varejo Venture' },
    ],
  }),
  createAgendaSession({
    id: 'agenda_21_palestra_ian_rochlin',
    category: 'Palco Principal',
    title: 'Palestra: De uma Comunidade Global de Games ao Shark Tank',
    summary: 'Ian Freitas Rochlin compartilha a trajetoria de uma comunidade global de games ate o Shark Tank.',
    venue: 'Palco Principal',
    audience: 'Games, criadores e startups',
    startTime: '15:00',
    endTime: '16:00',
    accent: '#9333ea',
    linkedPoiId: 'palco_principal',
    speakers: [{ name: 'Ian Freitas Rochlin', role: 'Palestrante' }],
  }),
  createAgendaSession({
    id: 'agenda_21_jornada_inove_ai',
    category: 'Palco Principal',
    title: 'Painel: II Jornada INOVE AI',
    summary: 'Apresentação dos pitches dos squads semifinalistas do projeto, compondo a II Jornada INOVE AI no palco principal.',
    venue: 'Palco Principal',
    audience: 'Educação, inovação e investidores',
    startTime: '16:00',
    endTime: '17:00',
    accent: '#7c2d12',
    linkedPoiId: 'palco_principal',
    speakers: [{ name: 'Squads semifinalistas', role: 'Apresentação dos pitches do projeto' }],
  }),
  createAgendaSession({
    id: 'agenda_21_encerramento',
    category: 'Palco Principal',
    title: 'Encerramento',
    summary: 'Fechamento oficial do sábado 21 no palco principal, com orientações finais ao público e encerramento do evento.',
    venue: 'Palco Principal',
    audience: 'Público geral',
    startTime: '17:00',
    endTime: '17:15',
    accent: '#b45309',
    linkedPoiId: 'palco_principal',
    speakers: [{ name: 'Organização Gnostart', role: 'Fechamento' }],
  }),
];

type EditingPoi = Partial<PointData>;
type AdminWorkspaceSnapshot = {
  pois: PointData[];
  draftPoiIds: string[];
  updatedAt: string;
};

type InitialPoiRuntimeState = {
  pois: PointData[];
  source: PoiDataSource;
  draftPoiIds: string[];
};
type TapIndicator = {
  id: number;
  x: number;
  y: number;
};

type ImagePoint = {
  x: number;
  y: number;
};

type LiveTrackingState = 'idle' | 'requesting' | 'active' | 'blocked' | 'unsupported' | 'error';
type LiveLocationSource = 'gps' | 'mock';

type LiveLocationState = {
  lat: number;
  lng: number;
  x: number;
  y: number;
  accuracyMeters: number;
  capturedAt: number;
  isInsideEvent: boolean;
  snappedNodeId: string | null;
  nearestPoiId: string | null;
};

const createIcon = (label: string, color: string, size = 30, isHighlighted = false) =>
  new L.DivIcon({
    html: `<div style='background:${color}; color:white; width:${size}px; height:${size}px; display:flex; align-items:center; justify-content:center; border-radius:50%; border:${isHighlighted ? 3 : 2}px solid white; box-shadow:${isHighlighted ? '0 10px 22px rgba(15,23,42,0.42)' : '0 3px 8px rgba(15,23,42,0.35)'}; font-size:${size * 0.45}px; font-weight:700; transform:${isHighlighted ? 'scale(1.06)' : 'scale(1)'};'>${label}</div>`,
    className: 'custom-poi-icon',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

const poiGlyphs = {
  entrada:
    "<svg viewBox='0 0 24 24' width='16' height='16' fill='none' xmlns='http://www.w3.org/2000/svg'><path d='M3.8 3.8H12.2V20.2H3.8Z' stroke='white' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round'/><path d='M20.2 12H9.2' stroke='white' stroke-width='1.9' stroke-linecap='round'/><path d='M15.3 7.2L20.1 12L15.3 16.8' stroke='white' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round'/></svg>",
  banheiro:
    "<svg viewBox='0 0 24 24' width='16' height='16' fill='none' xmlns='http://www.w3.org/2000/svg'><circle cx='8' cy='5.6' r='1.9' stroke='white' stroke-width='1.8'/><circle cx='16' cy='5.6' r='1.9' stroke='white' stroke-width='1.8'/><path d='M8 8.4V19.6M6 12H10M16 8.4V19.6M14 11.4H18' stroke='white' stroke-width='1.8' stroke-linecap='round'/></svg>",
  atividade:
    "<svg viewBox='0 0 24 24' width='16' height='16' fill='none' xmlns='http://www.w3.org/2000/svg'><path d='M12 3.2L13.8 8.2L19.2 8.4L14.9 11.7L16.5 17L12 13.8L7.5 17L9.1 11.7L4.8 8.4L10.2 8.2L12 3.2Z' stroke='white' stroke-width='1.8' stroke-linejoin='round'/></svg>",
  servico:
    "<svg viewBox='0 0 24 24' width='16' height='16' fill='none' xmlns='http://www.w3.org/2000/svg'><path d='M3 8.9L5.1 4H18.9L21 8.9' stroke='white' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round'/><path d='M4.1 8.9V20H19.9V8.9' stroke='white' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round'/><path d='M9 20V14.2H15V20' stroke='white' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round'/></svg>",
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const hexToRgb = (value: string) => {
  const sanitized = value.replace('#', '').trim();
  if (!/^[0-9a-f]{6}$/i.test(sanitized)) return null;
  return {
    r: Number.parseInt(sanitized.slice(0, 2), 16),
    g: Number.parseInt(sanitized.slice(2, 4), 16),
    b: Number.parseInt(sanitized.slice(4, 6), 16),
  };
};

const rgbToHex = (r: number, g: number, b: number) => {
  const toHex = (value: number) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const mixColors = (baseHex: string, targetHex: string, weight: number) => {
  const base = hexToRgb(baseHex);
  const target = hexToRgb(targetHex);
  if (!base || !target) return baseHex;
  const clampedWeight = Math.max(0, Math.min(1, weight));
  const mix = (from: number, to: number) => from * (1 - clampedWeight) + to * clampedWeight;
  return rgbToHex(mix(base.r, target.r), mix(base.g, target.g), mix(base.b, target.b));
};

const normalizeHexColor = (value?: string) => {
  if (!value) return undefined;
  const trimmed = value.trim();
  const short = /^#([0-9a-f]{3})$/i.exec(trimmed);
  if (short) {
    const [, raw] = short;
    return `#${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`.toLowerCase();
  }
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed.toLowerCase();
  return undefined;
};

const isBrandPaletteColor = (value?: string) => {
  const normalized = normalizeHexColor(value);
  return normalized ? BRAND_PALETTE.has(normalized) : false;
};

const normalizeBadgeText = (value?: string) => {
  if (!value) return undefined;
  const normalized = value.trim();
  if (!normalized) return undefined;
  return normalized.slice(0, 3).toUpperCase();
};

const getPoiBadgeText = (poi: PointData) => {
  const customBadge = normalizeBadgeText(poi.selo);
  if (customBadge) return customBadge;
  const fallback = poi.nome.trim().charAt(0).toUpperCase();
  return fallback || 'P';
};

const getPoiAccentColor = (poi: PointData) => {
  const customAccent = normalizeHexColor(poi.corDestaque);
  if (customAccent && isBrandPaletteColor(customAccent)) {
    return customAccent;
  }

  return poiTypeAccentMap[poi.tipo];
};

const getPoiPalette = (poi: PointData) => {
  const accent = getPoiAccentColor(poi);
  return {
    accent,
    from: mixColors(accent, BRAND_COLORS.surface, 0.17),
    to: mixColors(accent, BRAND_COLORS.ink, 0.2),
  };
};

const createPoiIcon = (
  type: PoiType,
  fromColor: string,
  toColor: string,
  badgeColor: string,
  badgeText: string,
  size = 34,
  isHighlighted = false,
) =>
  new L.DivIcon({
    html: `<div style='position:relative; width:${size}px; height:${size}px; display:flex; align-items:center; justify-content:center; border-radius:999px; background:linear-gradient(145deg, ${fromColor}, ${toColor}); border:${isHighlighted ? 3 : 2}px solid rgba(255,255,255,0.95); box-shadow:${isHighlighted ? '0 12px 24px rgba(15,23,42,0.42)' : '0 5px 12px rgba(15,23,42,0.3)'}; transform:${isHighlighted ? 'scale(1.08)' : 'scale(1)'};'><div style='position:absolute; z-index:0; bottom:-5px; left:50%; width:${Math.max(10, Math.round(size * 0.34))}px; height:${Math.max(10, Math.round(size * 0.34))}px; background:${toColor}; transform:translateX(-50%) rotate(45deg); border-radius:0 0 4px 0; opacity:0.9;'></div><div style='position:relative; z-index:1; width:${Math.max(18, Math.round(size * 0.58))}px; height:${Math.max(18, Math.round(size * 0.58))}px; display:flex; align-items:center; justify-content:center; border-radius:999px; background:rgba(255,255,255,0.14);'>${poiGlyphs[type]}</div><span style='position:absolute; top:${isHighlighted ? -8 : -7}px; right:${isHighlighted ? -10 : -8}px; min-width:${Math.max(18, Math.round(size * 0.45))}px; height:${Math.max(18, Math.round(size * 0.45))}px; padding:0 4px; display:flex; align-items:center; justify-content:center; border-radius:999px; background:${badgeColor}; color:#ffffff; border:2px solid rgba(255,255,255,0.95); font-size:${Math.max(8, Math.round(size * 0.22))}px; font-weight:800; letter-spacing:0.02em; line-height:1;'>${escapeHtml(
      badgeText,
    )}</span></div>`,
    className: 'custom-poi-icon',
    iconSize: [size, size + 8],
    iconAnchor: [size / 2, Math.round(size * 0.88)],
    popupAnchor: [0, -Math.round(size * 0.68)],
  });

const poiIconCache = new Map<string, L.DivIcon>();

const getPoiIcon = (poi: PointData, isHighlighted = false) => {
  const palette = getPoiPalette(poi);
  const badgeText = getPoiBadgeText(poi);
  const accentForBadge = mixColors(palette.accent, BRAND_COLORS.ink, 0.14);
  const size = isHighlighted ? 46 : 36;
  const cacheKey = `${poi.id}|${poi.tipo}|${palette.from}|${palette.to}|${accentForBadge}|${badgeText}|${size}|${isHighlighted ? 1 : 0}`;
  const cached = poiIconCache.get(cacheKey);
  if (cached) return cached;

  const icon = createPoiIcon(
    poi.tipo,
    palette.from,
    palette.to,
    accentForBadge,
    badgeText,
    size,
    isHighlighted,
  );
  poiIconCache.set(cacheKey, icon);
  return icon;
};

const stateIcons = {
  novo: createIcon('+', BRAND_COLORS.highlight, 22),
  origem: createIcon('O', BRAND_COLORS.primary, 40, true),
  destino: createIcon('D', BRAND_COLORS.ink, 40, true),
};

const MAP_WIDTH = MAP_PIXEL_WIDTH;
const MAP_HEIGHT = MAP_PIXEL_HEIGHT;
const MAP_DEFAULT_ZOOM = 18.5;
const MAP_MOBILE_DEFAULT_ZOOM = 18.2;
const MAP_MIN_ZOOM = 16.9;
const MAP_MAX_ZOOM = 20;
const PINS_VISIBILITY_MIN_ZOOM = 17.55;
const ROUTE_REVEAL_MIN_DURATION_MS = 900;
const ROUTE_REVEAL_MAX_DURATION_MS = 1800;
const ROUTE_REVEAL_MS_PER_METER = 7;
const PRESENTATION_WALKER_MIN_DURATION_MS = 2500;
const PRESENTATION_WALKER_MAX_DURATION_MS = 5200;
const PRESENTATION_WALKER_MS_PER_METER = 16;
const TAP_FEEDBACK_DURATION_MS = 560;
const TAP_FEEDBACK_MAX_MOVE_PX = 12;
const DEFAULT_MAP_BACKGROUND_URL = '/maps/mapa-background.jpeg';
const DEFAULT_MAP_OVERLAY_URL = import.meta.env.VITE_MAP_OVERLAY_URL || '/maps/mapa-visual.png';
const BASEMAP_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const BASEMAP_TILE_ATTRIBUTION = '&copy; OpenStreetMap contributors';
const MAP_BACKGROUND_PADDING_RATIO = {
  north: 3,
  south: 5,
  east: 3.4,
  west: 3,
} as const;
const MAP_LAT_SPAN = MAP_NORTH - MAP_SOUTH;
const MAP_LNG_SPAN = MAP_EAST - MAP_WEST;
const mapBackgroundBounds = new L.LatLngBounds(
  [MAP_SOUTH - MAP_LAT_SPAN * MAP_BACKGROUND_PADDING_RATIO.south, MAP_WEST - MAP_LNG_SPAN * MAP_BACKGROUND_PADDING_RATIO.west],
  [MAP_NORTH + MAP_LAT_SPAN * MAP_BACKGROUND_PADDING_RATIO.north, MAP_EAST + MAP_LNG_SPAN * MAP_BACKGROUND_PADDING_RATIO.east],
);
const mapOverlayBounds = new L.LatLngBounds(
  [MAP_OVERLAY_SOUTH, MAP_OVERLAY_WEST],
  [MAP_OVERLAY_NORTH, MAP_OVERLAY_EAST],
);
const AVERAGE_WALKING_SPEED_MPS = 1.4;
const WALKER_PROGRESS_UPDATE_MS = 250;

const imageToLatLng = (x: number, y: number): [number, number] => {
  const latSpan = MAP_OVERLAY_NORTH - MAP_OVERLAY_SOUTH;
  const lngSpan = MAP_OVERLAY_EAST - MAP_OVERLAY_WEST;
  const lat = MAP_OVERLAY_NORTH - (y / MAP_HEIGHT) * latSpan;
  const lng = MAP_OVERLAY_WEST + (x / MAP_WIDTH) * lngSpan;
  return [lat, lng];
};

const projectLatLngToImage = (lat: number, lng: number, clampToMap = true): { x: number; y: number } => {
  const latSpan = MAP_OVERLAY_NORTH - MAP_OVERLAY_SOUTH;
  const lngSpan = MAP_OVERLAY_EAST - MAP_OVERLAY_WEST;
  const xRatio = (lng - MAP_OVERLAY_WEST) / lngSpan;
  const yRatio = (MAP_OVERLAY_NORTH - lat) / latSpan;

  const x = xRatio * MAP_WIDTH;
  const y = yRatio * MAP_HEIGHT;

  if (!clampToMap) {
    return { x, y };
  }

  return {
    x: Math.max(0, Math.min(MAP_WIDTH, x)),
    y: Math.max(0, Math.min(MAP_HEIGHT, y)),
  };
};

const latLngToImage = (lat: number, lng: number) => projectLatLngToImage(lat, lng, true);
const latLngToImageRaw = (lat: number, lng: number) => projectLatLngToImage(lat, lng, false);
const eventBoundaryLatLngPoints = EVENT_BOUNDARY_IMAGE_POINTS.map((point) => imageToLatLng(point.x, point.y));

const getImagePointDistance = (from: ImagePoint, to: ImagePoint) => Math.hypot(from.x - to.x, from.y - to.y);

const isPointInsidePolygon = (point: ImagePoint, polygon: ImagePoint[]) => {
  let isInside = false;

  for (
    let currentIndex = 0, previousIndex = polygon.length - 1;
    currentIndex < polygon.length;
    previousIndex = currentIndex, currentIndex += 1
  ) {
    const currentPoint = polygon[currentIndex];
    const previousPoint = polygon[previousIndex];

    const intersects =
      currentPoint.y > point.y !== previousPoint.y > point.y &&
      point.x <
        ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) /
          ((previousPoint.y - currentPoint.y) || Number.EPSILON) +
          currentPoint.x;

    if (intersects) {
      isInside = !isInside;
    }
  }

  return isInside;
};

const formatClockTimeLabel = (timestamp: number) =>
  new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(timestamp);

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
const MAX_DEFAULT_VISIBLE_PINS = 20;
const POI_ACCESS_STORAGE_KEY = 'gnostart.poiAccessCount';
const POI_RUNTIME_BACKUP_STORAGE_KEY = 'gnostart.poiRuntimeBackup';
const ADMIN_POI_WORKSPACE_STORAGE_KEY = 'gnostart.adminPoiWorkspace';
const TUTORIAL_STORAGE_KEY = 'gnostart.mapTutorialSeen';
const MOBILE_MEDIA_QUERY = '(max-width: 900px)';
const COMPACT_MEDIA_QUERY = '(max-width: 1180px), (max-height: 760px)';
const PRESENTATION_MODE_QUERY_KEY = 'modo';
const PRESENTATION_MODE_DEFAULT = true;
const POI_DATA_EXPORT_FILENAME = 'locais_evento_social.json';
const EVENT_NAME = 'GNOSTART';
const EVENT_LABEL = `Evento ${EVENT_NAME}`;
const FRONT_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3333';
const LIVE_LOCATION_NODE_MAX_DISTANCE = 92;
const LIVE_LOCATION_NEAREST_POI_MAX_DISTANCE = 180;
const LIVE_LOCATION_WARNING_ACCURACY_METERS = 35;
const LIVE_LOCATION_WATCH_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 5000,
  timeout: 12000,
};

const getPresentationModeFromQuery = () => {
  if (typeof window === 'undefined') return PRESENTATION_MODE_DEFAULT;
  const rawMode = new URLSearchParams(window.location.search)
    .get(PRESENTATION_MODE_QUERY_KEY)
    ?.trim()
    .toLowerCase();

  if (rawMode === 'admin' || rawMode === 'edicao') return false;
  if (rawMode === 'apresentacao' || rawMode === 'demo') return true;
  return PRESENTATION_MODE_DEFAULT;
};

const getModeUrl = (mode: 'admin' | 'apresentacao') => {
  if (typeof window === 'undefined') return `?${PRESENTATION_MODE_QUERY_KEY}=${mode}`;
  const params = new URLSearchParams(window.location.search);
  params.set(PRESENTATION_MODE_QUERY_KEY, mode);
  const queryString = params.toString();
  const query = queryString ? `?${queryString}` : '';
  return `${window.location.pathname}${query}${window.location.hash}`;
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

const tutorialSteps = [
  {
    title: 'Bem-vindo(a) ao mapa',
    text: 'Puxe a alça de ações para cima ou toque em um atalho para abrir Agenda, Locais e Rotas.',
  },
  {
    title: 'Encontre os pontos do evento',
    text: 'No painel Locais, pesquise por atividades, serviços e acessos. Toque em Ver para abrir detalhes.',
  },
  {
    title: 'Trace rotas em segundos',
    text: 'No painel Rotas, defina origem e destino. As sugestões aparecem enquanto você digita.',
  },
  {
    title: 'Acompanhe sua circulação',
    text: 'Toque em um ponto e use Traçar rota até aqui para navegar pelas áreas permitidas.',
  },
] as const;

const parseAgendaTimeToMinutes = (timeLabel: string) => {
  const [hours, minutes] = timeLabel.split(':').map((value) => Number.parseInt(value, 10));
  return hours * 60 + minutes;
};

const formatAgendaDuration = (startTime: string, endTime: string) => {
  const durationMinutes = Math.max(0, parseAgendaTimeToMinutes(endTime) - parseAgendaTimeToMinutes(startTime));
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;

  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}min`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}min`;
};

const rawInitialPois: PointData[] = [
  {
    id: 'entrada_principal',
    nome: 'Entrada Principal',
    tipo: 'entrada',
    x: 1049,
    y: 748,
    descricao: 'Acesso principal do evento social.',
    imagemUrl: '/images/pois/indicadores/entrada.svg',
    corDestaque: BRAND_COLORS.highlight,
    selo: 'EP',
    nodeId: '1005_630',
  },
  {
    id: 'recepcao_credenciamento',
    nome: 'Recepção e Credenciamento',
    tipo: 'servico',
    x: 861,
    y: 685,
    descricao: 'Retirada de pulseiras e apoio inicial.',
    imagemUrl: '/images/pois/indicadores/apoio.svg',
    contato: '(81) 99999-1010',
    corDestaque: BRAND_COLORS.ink,
    selo: 'RC',
    nodeId: '825_570',
  },
  {
    id: 'palco_principal',
    nome: 'Palco Principal',
    tipo: 'atividade',
    x: 1375,
    y: 331,
    descricao: 'Programação principal do evento.',
    imagemUrl: '/images/pois/indicadores/evento.svg',
    corDestaque: BRAND_COLORS.primary,
    selo: 'PAL',
    nodeId: '1305_285',
  },
  {
    id: 'lounge_convivio',
    nome: 'Lounge de Convívio',
    tipo: 'atividade',
    x: 350,
    y: 704,
    descricao: 'Espaço para descanso e networking.',
    imagemUrl: '/images/pois/indicadores/evento.svg',
    corDestaque: BRAND_COLORS.primaryStrong,
    selo: 'LNG',
    nodeId: '330_585',
  },
  {
    id: 'espaco_fotos',
    nome: 'Espaço de Fotos',
    tipo: 'atividade',
    x: 1440,
    y: 711,
    descricao: 'Área cenográfica para fotos.',
    imagemUrl: '/images/pois/indicadores/evento.svg',
    corDestaque: BRAND_COLORS.primarySoft,
    selo: 'FTO',
    nodeId: '1380_600',
  },
  {
    id: 'area_alimentacao',
    nome: 'Área de Alimentação',
    tipo: 'servico',
    x: 835,
    y: 284,
    descricao: 'Ponto de alimentação e bebidas.',
    imagemUrl: '/images/pois/indicadores/apoio.svg',
    corDestaque: BRAND_COLORS.inkSoft,
    selo: 'ALI',
    nodeId: '795_270',
  },
  {
    id: 'posto_apoio',
    nome: 'Posto de Apoio',
    tipo: 'servico',
    x: 426,
    y: 315,
    descricao: 'Informações e apoio ao participante.',
    imagemUrl: '/images/pois/indicadores/apoio.svg',
    contato: '(81) 99999-2020',
    corDestaque: BRAND_COLORS.primaryStrong,
    selo: 'SOS',
    nodeId: '405_255',
  },
  {
    id: 'banheiro_social',
    nome: 'Banheiro Social',
    tipo: 'banheiro',
    x: 1163,
    y: 149,
    descricao: 'Banheiro de apoio ao público.',
    imagemUrl: '/images/pois/indicadores/banheiro.svg',
    corDestaque: BRAND_COLORS.primarySoft,
    selo: 'WC',
    nodeId: '1110_120',
  },
  {
    id: 'saida_lateral',
    nome: 'Saída Lateral',
    tipo: 'entrada',
    x: 658,
    y: 83,
    descricao: 'Entrada secundária para fluxo de evacuação.',
    imagemUrl: '/images/pois/indicadores/entrada.svg',
    corDestaque: BRAND_COLORS.highlight,
    selo: 'S2',
    nodeId: '630_75',
  },
];

const attachNearestNode = (poi: PointData): PointData => {
  if (poi.nodeId) return poi;
  const nearestNode = findNearestNode(poi.x, poi.y, 90);
  return { ...poi, nodeId: nearestNode ?? undefined };
};

const fromApiPoi = (poi: MapPoiDto): PointData => attachNearestNode(poi);

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
  return importedSeedPois.length > 0 ? importedSeedPois : rawInitialPois.map(attachNearestNode);
};

const loadPoiRuntimeBackup = (): PointData[] => {
  if (typeof window === 'undefined') return [];

  try {
    const rawValue = window.localStorage.getItem(POI_RUNTIME_BACKUP_STORAGE_KEY);
    if (!rawValue) return [];
    return parseStoredPoiList(JSON.parse(rawValue));
  } catch {
    return [];
  }
};

const persistPoiRuntimeBackup = (value: PointData[]) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(POI_RUNTIME_BACKUP_STORAGE_KEY, JSON.stringify(value));
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
    const pois = parseStoredPoiList(parsed?.pois);
    if (pois.length === 0) return null;

    const validPoiIds = new Set(pois.map((poi) => poi.id));
    const draftPoiIds = Array.isArray(parsed?.draftPoiIds)
      ? parsed.draftPoiIds.filter((id): id is string => typeof id === 'string' && validPoiIds.has(id))
      : [];

    return {
      pois,
      draftPoiIds,
      updatedAt: typeof parsed?.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
};

const persistAdminWorkspaceSnapshot = (value: AdminWorkspaceSnapshot) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(ADMIN_POI_WORKSPACE_STORAGE_KEY, JSON.stringify(value));
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

const upsertPoiInCollection = (collection: PointData[], nextPoi: PointData) => {
  const index = collection.findIndex((item) => item.id === nextPoi.id);
  if (index === -1) return [...collection, nextPoi];

  const nextCollection = [...collection];
  nextCollection[index] = nextPoi;
  return nextCollection;
};

const normalizeContact = (value?: string) => value?.trim() ?? '';
const normalizeForSearch = (value?: string) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

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

const getPoiGalleryImages = (poi: PointData) => {
  return Array.from(new Set([poi.imagemUrl, defaultPoiImages[poi.tipo]].filter(Boolean) as string[]));
};

const MapController = ({
  routeLatLngPoints,
  onRouteViewportSettledChange,
}: {
  routeLatLngPoints: [number, number][];
  onRouteViewportSettledChange: (isSettled: boolean) => void;
}) => {
  const lastRouteKeyRef = useRef('');

  useEffect(() => {
    if (routeLatLngPoints.length < 2) {
      lastRouteKeyRef.current = '';
      onRouteViewportSettledChange(true);
      return;
    }

    const routeKey = routeLatLngPoints
      .map(([lat, lng]) => `${lat.toFixed(6)},${lng.toFixed(6)}`)
      .join('|');

    if (routeKey === lastRouteKeyRef.current) return;

    lastRouteKeyRef.current = routeKey;
    onRouteViewportSettledChange(true);
  }, [routeLatLngPoints, onRouteViewportSettledChange]);

  return null;
};

const MapSizeSync = () => {
  const map = useMap();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncSize = () => {
      map.invalidateSize({ pan: false, animate: false });
    };

    const rafId = window.requestAnimationFrame(syncSize);
    const timeoutId = window.setTimeout(syncSize, 150);

    map.whenReady(syncSize);
    window.addEventListener('resize', syncSize);
    window.visualViewport?.addEventListener('resize', syncSize);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
      window.removeEventListener('resize', syncSize);
      window.visualViewport?.removeEventListener('resize', syncSize);
    };
  }, [map]);

  return null;
};

const ModaCenterMap = () => {
  const [initialPoiRuntime] = useState(getInitialPoiRuntimeState);
  const [isPresentationMode] = useState(getPresentationModeFromQuery);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(MOBILE_MEDIA_QUERY).matches : false,
  );
  const [isCompactViewport, setIsCompactViewport] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(COMPACT_MEDIA_QUERY).matches : false,
  );
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false,
  );
  const [isPinsPanelOpen, setIsPinsPanelOpen] = useState(false);
  const [isRoutePanelOpen, setIsRoutePanelOpen] = useState(false);
  const [isAgendaPanelOpen, setIsAgendaPanelOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminAccessMenuOpen, setIsAdminAccessMenuOpen] = useState(false);
  const [adminLinkCopied, setAdminLinkCopied] = useState(false);
  const [pois, setPois] = useState<PointData[]>(initialPoiRuntime.pois);
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
  const [mapOverlayUrl, setMapOverlayUrl] = useState(DEFAULT_MAP_OVERLAY_URL);
  const [rota, setRota] = useState<number[][] | null>(null);
  const [editingPoi, setEditingPoi] = useState<EditingPoi | null>(null);
  const [focusPoint, setFocusPoint] = useState<PointData | null>(null);
  const [activePoiId, setActivePoiId] = useState<string | null>(null);
  const [expandedPopupPoiId, setExpandedPopupPoiId] = useState<string | null>(null);
  const [mapZoomLevel, setMapZoomLevel] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(MOBILE_MEDIA_QUERY).matches
      ? MAP_MOBILE_DEFAULT_ZOOM
      : MAP_DEFAULT_ZOOM,
  );
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
  const [selectedDestinationId, setSelectedDestinationId] = useState('');
  const [originQuery, setOriginQuery] = useState('');
  const [destinationQuery, setDestinationQuery] = useState('');
  const [showOriginSuggestions, setShowOriginSuggestions] = useState(false);
  const [showDestinationSuggestions, setShowDestinationSuggestions] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [tutorialStepIndex, setTutorialStepIndex] = useState(0);
  const [selectedAgendaDay, setSelectedAgendaDay] = useState<AgendaDayId>('21');
  const [favoriteAgendaIds, setFavoriteAgendaIds] = useState<string[]>([]);
  const [routeMessage, setRouteMessage] = useState('Escolha um destino e deixe o GPS preencher sua origem automaticamente.');
  const [isRouteViewportSettled, setIsRouteViewportSettled] = useState(true);
  const [routeRevealProgress, setRouteRevealProgress] = useState(0);
  const [walkerProgress, setWalkerProgress] = useState(0);
  const [walkerPosition, setWalkerPosition] = useState<[number, number] | null>(null);
  const [liveTrackingState, setLiveTrackingState] = useState<LiveTrackingState>('idle');
  const [liveLocation, setLiveLocation] = useState<LiveLocationState | null>(null);
  const [liveLocationMessage, setLiveLocationMessage] = useState<string | null>(null);
  const [liveLocationSource, setLiveLocationSource] = useState<LiveLocationSource | null>(null);
  const [isLocationTestOpen, setIsLocationTestOpen] = useState(false);
  const [testLocationLatInput, setTestLocationLatInput] = useState(() => MAP_CENTER[0].toFixed(6));
  const [testLocationLngInput, setTestLocationLngInput] = useState(() => MAP_CENTER[1].toFixed(6));
  const [tapIndicators, setTapIndicators] = useState<TapIndicator[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const walkerTimerRef = useRef<number | null>(null);
  const routeRevealFrameRef = useRef<number | null>(null);
  const liveLocationWatchIdRef = useRef<number | null>(null);
  const lastLiveRouteKeyRef = useRef('');
  const tapIndicatorIdRef = useRef(0);
  const tapIndicatorTimeoutsRef = useRef<number[]>([]);
  const adminImportInputRef = useRef<HTMLInputElement | null>(null);
  const pointerGestureRef = useRef(new Map<number, { startX: number; startY: number; moved: boolean }>());
  const lastPanelStateRef = useRef({
    pins: false,
    route: false,
    agenda: false,
    tutorial: false,
  });
  const activeDockPanel: DockPanel = isPinsPanelOpen ? 'pins' : isRoutePanelOpen ? 'route' : isAgendaPanelOpen ? 'agenda' : null;
  const isDockPanelOpen = activeDockPanel !== null;

  const closeDockPanel = useCallback(() => {
    setIsPinsPanelOpen(false);
    setIsRoutePanelOpen(false);
    setIsAgendaPanelOpen(false);
  }, []);

  const openDockPanel = useCallback((panel: Exclude<DockPanel, null>) => {
    setIsPinsPanelOpen(panel === 'pins');
    setIsRoutePanelOpen(panel === 'route');
    setIsAgendaPanelOpen(panel === 'agenda');
    setIsTutorialOpen(false);
  }, []);

  const toggleDockPanel = useCallback(
    (panel: Exclude<DockPanel, null>) => {
      if (activeDockPanel === panel) {
        closeDockPanel();
        return;
      }
      openDockPanel(panel);
    },
    [activeDockPanel, closeDockPanel, openDockPanel],
  );

  useEffect(() => {
    if (!isPresentationMode || !isAdmin) return;
    setIsAdmin(false);
    setEditingPoi(null);
  }, [isPresentationMode, isAdmin]);

  useEffect(() => {
    if (!isAdminAccessMenuOpen || typeof window === 'undefined') return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsAdminAccessMenuOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isAdminAccessMenuOpen]);

  const openAdminMode = () => {
    if (typeof window === 'undefined') return;
    window.location.href = getModeUrl('admin');
  };

  const copyAdminModeLink = async () => {
    if (typeof window === 'undefined') return;
    const absoluteUrl = `${window.location.origin}${getModeUrl('admin')}`;
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setAdminLinkCopied(true);
      window.setTimeout(() => setAdminLinkCopied(false), 1800);
    } catch {
      window.prompt('Copie o link de acesso admin:', absoluteUrl);
    }
  };

  const playUiSound = useCallback(
    (variant: 'tap' | 'panel' | 'route') => {
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

  const stopLiveLocationTracking = useCallback(
    (options?: { clearLocation?: boolean; keepMessage?: boolean }) => {
      if (typeof window !== 'undefined' && liveLocationWatchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(liveLocationWatchIdRef.current);
      }

      liveLocationWatchIdRef.current = null;
      setLiveLocationSource(null);
      setLiveTrackingState('idle');

      if (options?.clearLocation !== false) {
        setLiveLocation(null);
      }

      if (!options?.keepMessage) {
        setLiveLocationMessage(null);
      }
    },
    [],
  );

  const findNearestPoiForLiveLocation = useCallback(
    (point: ImagePoint) => {
      let nearestPoiId: string | null = null;
      let nearestDistance = Infinity;

      for (const poi of pois) {
        if (!poi.nodeId) continue;
        const distance = getImagePointDistance(point, { x: poi.x, y: poi.y });
        if (distance < nearestDistance && distance <= LIVE_LOCATION_NEAREST_POI_MAX_DISTANCE) {
          nearestDistance = distance;
          nearestPoiId = poi.id;
        }
      }

      return nearestPoiId;
    },
    [pois],
  );

  const applyLiveLocationSample = useCallback(
    (
      sample: {
        lat: number;
        lng: number;
        accuracyMeters: number;
        capturedAt: number;
      },
      source: LiveLocationSource,
    ) => {
      const rawPoint = latLngToImageRaw(sample.lat, sample.lng);
      const isInsideEvent = isPointInsidePolygon(rawPoint, EVENT_BOUNDARY_IMAGE_POINTS);
      const snappedNodeId = isInsideEvent
        ? findNearestNode(Math.round(rawPoint.x), Math.round(rawPoint.y), LIVE_LOCATION_NODE_MAX_DISTANCE)
        : null;
      const nearestPoiId = isInsideEvent ? findNearestPoiForLiveLocation(rawPoint) : null;

      setLiveLocation({
        lat: sample.lat,
        lng: sample.lng,
        x: rawPoint.x,
        y: rawPoint.y,
        accuracyMeters: sample.accuracyMeters,
        capturedAt: sample.capturedAt,
        isInsideEvent,
        snappedNodeId,
        nearestPoiId,
      });
      setLiveLocationSource(source);
      setLiveTrackingState('active');

      if (!isInsideEvent) {
        setLiveLocationMessage(
          source === 'mock'
            ? 'A localização de teste foi aplicada, mas caiu fora da área delimitada do evento.'
            : 'Sua localização foi encontrada, mas está fora da área delimitada do evento.',
        );
        return;
      }

      if (!snappedNodeId) {
        setLiveLocationMessage(
          source === 'mock'
            ? 'A localização de teste foi aplicada dentro do evento, mas ainda não encaixou na malha de rotas.'
            : 'Sua localização foi encontrada dentro do evento, mas ainda não encaixou na malha de rotas.',
        );
        return;
      }

      const accuracyLabel = formatDistanceLabel(sample.accuracyMeters);
      setLiveLocationMessage(
        source === 'mock'
          ? `Localização de teste aplicada com sucesso. Precisão simulada: ${accuracyLabel}.`
          : `Sua posição está sendo atualizada automaticamente. Precisão aproximada: ${accuracyLabel}.`,
      );
    },
    [findNearestPoiForLiveLocation],
  );

  const startLiveLocationTracking = useCallback(() => {
    if (typeof window === 'undefined') return;

    if (!('geolocation' in navigator)) {
      setLiveTrackingState('unsupported');
      setLiveLocationMessage('Este navegador não oferece geolocalização em tempo real.');
      return;
    }

    stopLiveLocationTracking({ clearLocation: false, keepMessage: true });
    setSelectedOriginId('');
    setOriginQuery('');
    setLiveTrackingState('requesting');
    setLiveLocationMessage('Estamos buscando sua posição para preencher a origem automaticamente...');

    liveLocationWatchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        applyLiveLocationSample(
          {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracyMeters: position.coords.accuracy,
            capturedAt: position.timestamp,
          },
          'gps',
        );
      },
      (error) => {
        setLiveTrackingState(error.code === error.PERMISSION_DENIED ? 'blocked' : 'error');
        setLiveLocationMessage(mapGeolocationErrorMessage(error));

        if (error.code === error.PERMISSION_DENIED) {
          setLiveLocation(null);
          setLiveLocationSource(null);
        }
      },
      LIVE_LOCATION_WATCH_OPTIONS,
    );
  }, [applyLiveLocationSample, stopLiveLocationTracking]);

  const seedTestLocationWithEventCenter = () => {
    setTestLocationLatInput(MAP_CENTER[0].toFixed(6));
    setTestLocationLngInput(MAP_CENTER[1].toFixed(6));
  };

  const applyMockLocation = () => {
    const lat = Number.parseFloat(testLocationLatInput.replace(',', '.'));
    const lng = Number.parseFloat(testLocationLngInput.replace(',', '.'));

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setLiveTrackingState('error');
      setLiveLocationMessage('Informe latitude e longitude válidas para aplicar a localização de teste.');
      return;
    }

    stopLiveLocationTracking({ clearLocation: false, keepMessage: true });
    setSelectedOriginId('');
    setOriginQuery('');
    applyLiveLocationSample(
      {
        lat,
        lng,
        accuracyMeters: 4,
        capturedAt: Date.now(),
      },
      'mock',
    );
  };

  const spawnTapIndicator = useCallback(
    (x: number, y: number) => {
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
    [playUiSound],
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
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleMotionPreferenceChange = () => setPrefersReducedMotion(mediaQuery.matches);

    handleMotionPreferenceChange();
    mediaQuery.addEventListener('change', handleMotionPreferenceChange);

    return () => mediaQuery.removeEventListener('change', handleMotionPreferenceChange);
  }, []);

  useEffect(() => {
    const previousState = lastPanelStateRef.current;
    const hasPanelOpened =
      (!previousState.pins && isPinsPanelOpen) ||
      (!previousState.route && isRoutePanelOpen) ||
      (!previousState.agenda && isAgendaPanelOpen) ||
      (!previousState.tutorial && isTutorialOpen);

    if (hasPanelOpened) {
      playUiSound('panel');
    }

    lastPanelStateRef.current = {
      pins: isPinsPanelOpen,
      route: isRoutePanelOpen,
      agenda: isAgendaPanelOpen,
      tutorial: isTutorialOpen,
    };
  }, [isPinsPanelOpen, isRoutePanelOpen, isAgendaPanelOpen, isTutorialOpen, playUiSound]);

  useEffect(() => {
    return () => {
      tapIndicatorTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      tapIndicatorTimeoutsRef.current = [];

      if (liveLocationWatchIdRef.current !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(liveLocationWatchIdRef.current);
        liveLocationWatchIdRef.current = null;
      }

      if (routeRevealFrameRef.current !== null) {
        window.cancelAnimationFrame(routeRevealFrameRef.current);
      }

      if (audioContextRef.current) {
        void audioContextRef.current.close().catch(() => undefined);
      }
    };
  }, []);

  const syncBootstrap = useCallback(
    async (options?: { forceReplace?: boolean }) => {
      try {
        setBackendSyncState('loading');
        const bootstrap = await fetchMapBootstrap();
        const backendPois = Array.isArray(bootstrap.pois) ? bootstrap.pois.map(fromApiPoi) : [];
        const nextOverlayUrl =
          typeof bootstrap.map?.overlayUrl === 'string' && bootstrap.map.overlayUrl.trim().length > 0
            ? bootstrap.map.overlayUrl
            : DEFAULT_MAP_OVERLAY_URL;

        setServerPois(backendPois);
        setMapOverlayUrl(nextOverlayUrl);
        persistPoiRuntimeBackup(backendPois);
        setBackendSyncState('ready');

        const shouldPreserveWorkspace = !options?.forceReplace && poiDataSource === 'local-workspace';
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
        console.error('Falha ao sincronizar dados do mapa no backend:', error);
        setBackendSyncState('error');
        setAdminStatusMessage(
          poiDataSource === 'local-workspace'
            ? 'Não foi possível atualizar o servidor agora, mas sua edição local continua disponível.'
            : 'Servidor indisponível. O mapa segue usando a base local.',
        );
      }
    },
    [poiDataSource],
  );

  useEffect(() => {
    void syncBootstrap();
  }, [syncBootstrap]);

  const walkerIcon = useMemo(
    () =>
      new L.DivIcon({
        className: 'gps-walker-wrapper',
        html: `<div class='gps-walker-icon'><span class='gps-walker-pulse'></span><span class='gps-walker-core'><svg viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'><circle cx='12' cy='4.6' r='2.2' fill='white'/><path d='M12 7.6L10.3 12.2L6.6 15.6M12 7.6L14.6 11.8L17.8 10.4M10.8 12.4L13.2 16.4L11 20.2M13.1 16.4L16.6 20.2' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/></svg></span></div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      }),
    [],
  );

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
  const arePinsHiddenByZoom = !isAdmin && mapZoomLevel < PINS_VISIBILITY_MIN_ZOOM;

  const orderedByAccessPois = useMemo(() => {
    return [...pois].sort((a, b) => {
      const accessDiff = (poiAccessCount[b.id] ?? 0) - (poiAccessCount[a.id] ?? 0);
      if (accessDiff !== 0) return accessDiff;
      return a.nome.localeCompare(b.nome);
    });
  }, [pois, poiAccessCount]);

  const searchablePois = useMemo(() => {
    const query = normalizeForSearch(searchTerm.trim());
    return orderedByAccessPois.filter((poi) => {
      if (!enabledTypes[poi.tipo]) return false;
      if (!query) return true;
      return (
        normalizeForSearch(poi.nome).includes(query) ||
        normalizeForSearch(poi.descricao ?? '').includes(query) ||
        normalizeForSearch(poi.tipo).includes(query)
      );
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
          const normalizedName = normalizeForSearch(poi.nome);
          const normalizedType = normalizeForSearch(poi.tipo);
          return normalizedName.includes(query) || normalizedType.includes(query);
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

  const originSuggestions = useMemo(() => {
    return getRouteSuggestions(originQuery);
  }, [originQuery, getRouteSuggestions]);

  const destinationSuggestions = useMemo(() => {
    return getRouteSuggestions(destinationQuery);
  }, [destinationQuery, getRouteSuggestions]);

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
      if (session.linkedPoiId) {
        return pois.some((poi) => poi.id === session.linkedPoiId);
      }

      const query = normalizeForSearch(session.mapQuery || session.venue);
      return pois.some((poi) =>
        normalizeForSearch(`${poi.nome} ${poi.descricao ?? ''} ${poi.selo ?? ''}`).includes(query),
      );
    }).length;

    return {
      sessionCount: agendaSessionsForSelectedDay.length,
      venueCount,
      speakerCount,
      connectedCount,
      windowLabel: `${firstSession.startTime} - ${lastSession.endTime}`,
    };
  }, [agendaSessionsForSelectedDay, pois]);

  const autoVisiblePois = useMemo(() => {
    return orderedByAccessPois.filter((poi) => enabledTypes[poi.tipo]).slice(0, MAX_DEFAULT_VISIBLE_PINS);
  }, [orderedByAccessPois, enabledTypes]);

  const visiblePois = useMemo(() => {
    if (isAdmin) return pois;

    if (arePinsHiddenByZoom) {
      const essentialPoiIds = new Set(
        [activePoiId, selectedOriginId, selectedDestinationId].filter((id): id is string => Boolean(id)),
      );
      return pois.filter((poi) => essentialPoiIds.has(poi.id));
    }

    const manualSelectionSet = new Set(manualVisiblePoiIds);
    const basePois =
      manualVisiblePoiIds.length > 0
        ? pois.filter((poi) => manualSelectionSet.has(poi.id) && enabledTypes[poi.tipo])
        : autoVisiblePois;

    const resultById = new Map(basePois.map((poi) => [poi.id, poi]));
    [activePoiId, selectedOriginId, selectedDestinationId].forEach((id) => {
      if (!id) return;
      const poi = pois.find((item) => item.id === id);
      if (poi) resultById.set(poi.id, poi);
    });

    return Array.from(resultById.values());
  }, [
    isAdmin,
    pois,
    manualVisiblePoiIds,
    enabledTypes,
    autoVisiblePois,
    arePinsHiddenByZoom,
    activePoiId,
    selectedOriginId,
    selectedDestinationId,
  ]);

  const getPoiById = (id: string) => pois.find((poi) => poi.id === id);
  const liveLocationNearestPoi = useMemo(
    () => (liveLocation?.nearestPoiId ? pois.find((poi) => poi.id === liveLocation.nearestPoiId) ?? null : null),
    [liveLocation?.nearestPoiId, pois],
  );
  const hasLiveLocationFix = Boolean(liveLocation?.isInsideEvent && liveLocation?.snappedNodeId);
  const liveLocationMarkerPosition = useMemo<[number, number] | null>(
    () => (liveLocation ? [liveLocation.lat, liveLocation.lng] : null),
    [liveLocation],
  );
  const liveLocationAccuracyLabel = liveLocation ? formatDistanceLabel(liveLocation.accuracyMeters) : null;
  const liveLocationUpdatedAtLabel = liveLocation ? formatClockTimeLabel(liveLocation.capturedAt) : null;
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
  const draftPoiIdSet = useMemo(() => new Set(draftPoiIds), [draftPoiIds]);
  const filteredAdminPois = useMemo(() => {
    const normalizedQuery = normalizeForSearch(adminSearchTerm);

    return pois
      .filter((poi) => {
        if (adminTypeFilter !== 'todos' && poi.tipo !== adminTypeFilter) return false;
        if (!normalizedQuery) return true;
        return normalizeForSearch(`${poi.nome} ${poi.descricao ?? ''} ${poi.selo ?? ''} ${poi.id}`).includes(
          normalizedQuery,
        );
      })
      .sort((left, right) => {
        const leftIsDraft = draftPoiIdSet.has(left.id);
        const rightIsDraft = draftPoiIdSet.has(right.id);
        if (leftIsDraft !== rightIsDraft) return leftIsDraft ? -1 : 1;
        return left.nome.localeCompare(right.nome);
      });
  }, [adminSearchTerm, adminTypeFilter, draftPoiIdSet, pois]);
  const disconnectedPoiCount = useMemo(() => pois.filter((poi) => !poi.nodeId).length, [pois]);
  const syncedPoiCount = useMemo(() => pois.length - draftPoiIds.length, [pois.length, draftPoiIds.length]);

  const autoOriginPoi = useMemo(() => {
    if (liveLocation?.nearestPoiId) {
      return pois.find((poi) => poi.id === liveLocation.nearestPoiId) ?? null;
    }

    return null;
  }, [liveLocation?.nearestPoiId, pois]);
  const routeOriginSummaryName = hasLiveLocationFix
    ? liveLocationOriginLabel
    : 'Aguardando sua localização exata';
  const routeOriginSummaryHelp = hasLiveLocationFix
    ? `Atualizada automaticamente. Última leitura às ${liveLocationUpdatedAtLabel ?? '--'}.`
    : 'Assim que o GPS fixar sua posição, a origem será usada automaticamente.';
  const displayedOriginQuery = hasLiveLocationFix ? liveLocationOriginLabel : originQuery;
  const routeMetricLabel = hasLiveLocationFix ? 'Precisão GPS' : 'Progresso';
  const routeMetricValue = hasLiveLocationFix ? liveLocationAccuracyLabel ?? '--' : `${Math.round(walkerProgress * 100)}%`;
  const routeMarkerPosition = hasLiveLocationFix ? liveLocationMarkerPosition : walkerPosition;

  const clearRoute = () => {
    setSelectedOriginId('');
    setSelectedDestinationId('');
    setOriginQuery('');
    setDestinationQuery('');
    setShowOriginSuggestions(false);
    setShowDestinationSuggestions(false);
    setRota(null);
    setIsRouteViewportSettled(true);
    setRouteMessage('Rota limpa. Assim que o GPS estiver ativo, basta escolher o destino.');
  };

  const selectOriginPoi = (poi: PointData) => {
    stopLiveLocationTracking();
    setSelectedOriginId(poi.id);
    setOriginQuery(poi.nome);
    setShowOriginSuggestions(false);
  };

  const selectDestinationPoi = (poi: PointData, options?: { buildInstantly?: boolean }) => {
    setSelectedDestinationId(poi.id);
    setDestinationQuery(poi.nome);
    setShowDestinationSuggestions(false);

    if (options?.buildInstantly === false) return;

    if (hasLiveLocationFix) {
      buildRouteFromLiveLocation(poi.id);
      return;
    }

    if (liveTrackingState === 'requesting') {
      setRouteMessage(`Destino definido em ${poi.nome}. Estamos aguardando sua localização para montar a rota automaticamente.`);
      return;
    }

    if (liveTrackingState === 'active' && !hasLiveLocationFix) {
      setRouteMessage(`Destino definido em ${poi.nome}. Sua localização ainda não conseguiu encaixar na malha de rotas.`);
      return;
    }

    if (liveTrackingState === 'blocked' || liveTrackingState === 'unsupported') {
      setRouteMessage(`Destino definido em ${poi.nome}. Libere o GPS para iniciar a rota até aqui.`);
      return;
    }

    startLiveLocationTracking();
    setRouteMessage(`Destino definido em ${poi.nome}. Estamos buscando sua localização exata para iniciar a rota.`);
  };

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

  const getAgendaSessionPoi = (session: AgendaSession) => {
    if (session.linkedPoiId) {
      const linkedPoi = getPoiById(session.linkedPoiId);
      if (linkedPoi) return linkedPoi;
    }

    const query = normalizeForSearch(session.mapQuery || session.venue);
    return (
      pois.find((poi) =>
        normalizeForSearch(`${poi.nome} ${poi.descricao ?? ''} ${poi.selo ?? ''}`).includes(query),
      ) ?? null
    );
  };

  const handleAgendaSessionFocus = (session: AgendaSession) => {
    const matchedPoi = getAgendaSessionPoi(session);
    if (!matchedPoi) return;
    focusPoi(matchedPoi, true);
    closeDockPanel();
  };

  const toggleAgendaFavorite = (sessionId: string) => {
    setFavoriteAgendaIds((prev) =>
      prev.includes(sessionId) ? prev.filter((id) => id !== sessionId) : [...prev, sessionId],
    );
  };

  const commitRoutePath = (routePath: number[][], originLabel: string, destinationLabel: string) => {
    const pathLatLng = routePath.map(([y, x]) => imageToLatLng(x, y));
    const distanceMeters = getPathDistanceMeters(pathLatLng);
    const etaMinutes = distanceMeters / (AVERAGE_WALKING_SPEED_MPS * 60);
    const distanceLabel = formatDistanceLabel(distanceMeters);
    const etaLabel = formatWalkingTimeLabel(etaMinutes);

    setIsRouteViewportSettled(false);
    setRouteRevealProgress(0);
    setRota(routePath);
    playUiSound('route');
    setRouteMessage(
      `Rota pronta: ${originLabel} -> ${destinationLabel}. Distância: ${distanceLabel} | Tempo médio: ${etaLabel}.`,
    );
  };

  const buildRouteFromNodeToPoi = (originNodeId: string, originLabel: string, destinationPoi: PointData) => {
    if (!destinationPoi.nodeId) {
      setRota(null);
      setRouteMessage(`"${destinationPoi.nome}" ainda não está conectado à malha de rotas.`);
      return;
    }

    if (originNodeId === destinationPoi.nodeId) {
      setRota(null);
      setRouteMessage(`Você já está em ${destinationPoi.nome}.`);
      return;
    }

    const path = findPath(originNodeId, destinationPoi.nodeId);
    if (!path) {
      setRota(null);
      setRouteMessage(`Não encontramos rota entre ${originLabel} e ${destinationPoi.nome}.`);
      return;
    }

    commitRoutePath(path, originLabel, destinationPoi.nome);
  };

  const buildRouteFromLiveLocation = (destinationId: string) => {
    const destinationPoi = getPoiById(destinationId);

    if (!destinationPoi) {
      setRota(null);
      setRouteMessage('Escolha um destino válido antes de iniciar a navegação.');
      return;
    }

    if (!liveLocation) {
      setRota(null);
      setRouteMessage('Ainda não recebemos sua localização. Toque em "Usar meu GPS" novamente.');
      return;
    }

    if (!liveLocation.isInsideEvent) {
      setRota(null);
      setRouteMessage('Sua localização atual está fora da área delimitada do evento.');
      return;
    }

    if (!liveLocation.snappedNodeId) {
      setRota(null);
      setRouteMessage('Sua localização foi lida, mas ainda não conseguiu encaixar nos corredores do mapa.');
      return;
    }

    buildRouteFromNodeToPoi(liveLocation.snappedNodeId, liveLocationOriginLabel, destinationPoi);
  };

  const buildRoute = (originId: string, destinationId: string) => {
    const originPoi = getPoiById(originId);
    const destinationPoi = getPoiById(destinationId);
    let origem: PointData;
    let destino: PointData;

    if (!originPoi || !destinationPoi) {
      setRota(null);
      setRouteMessage('Escolha um local atual e um destino válidos.');
      return;
    }

    origem = originPoi;
    destino = destinationPoi;

    if (originPoi.id === destinationPoi.id) {
      setRota(null);
      setRouteMessage('O local atual e o destino precisam ser diferentes.');
      return;
    }

    if (!originPoi.nodeId || !destinationPoi.nodeId) {
      setRota(null);
      setRouteMessage('Não foi possível conectar um dos pontos à malha de rotas.');
      return;
    }

    const caminho = findPath(originPoi.nodeId, destinationPoi.nodeId);
    if (!caminho) {
      setRota(null);
      setRouteMessage(`Não encontramos rota entre ${origem.nome} e ${destino.nome}.`);
      return;
    }

    const caminhoLatLng = caminho.map(([y, x]) => imageToLatLng(x, y));
    const distanceMeters = getPathDistanceMeters(caminhoLatLng);
    const etaMinutes = distanceMeters / (AVERAGE_WALKING_SPEED_MPS * 60);
    const distanceLabel = formatDistanceLabel(distanceMeters);
    const etaLabel = formatWalkingTimeLabel(etaMinutes);

    setIsRouteViewportSettled(false);
    setRouteRevealProgress(0);
    setRota(caminho);
    playUiSound('route');
    setRouteMessage(
      `Rota pronta: ${origem.nome} -> ${destino.nome}. Distância: ${distanceLabel} | Tempo médio: ${etaLabel}.`,
    );
  };

  const navigateToPoi = (poi: PointData) => {
    if (!poi.nodeId) {
      setRouteMessage(`"${poi.nome}" ainda não está conectado à malha de rotas.`);
      return;
    }

    openDockPanel('route');
    selectDestinationPoi(poi, { buildInstantly: false });

    if (hasLiveLocationFix) {
      buildRouteFromLiveLocation(poi.id);
      return;
    }

    if (liveTrackingState === 'requesting') {
      setRota(null);
      setRouteMessage(`Destino definido em ${poi.nome}. Estamos aguardando sua localização para montar a rota.`);
      return;
    }

    if (liveTrackingState === 'active' && !hasLiveLocationFix) {
      setRota(null);
      setRouteMessage(`Destino definido em ${poi.nome}. Sua localização ainda não conseguiu encaixar na malha de rotas.`);
      return;
    }

    if (liveTrackingState === 'blocked' || liveTrackingState === 'unsupported') {
      setRota(null);
      setRouteMessage(`Destino definido em ${poi.nome}. Libere o GPS para iniciar a rota até aqui.`);
      return;
    }

    startLiveLocationTracking();
    setRota(null);
    setRouteMessage(`Destino definido em ${poi.nome}. Estamos buscando sua localização exata para iniciar a rota.`);
  };
  const handleMarkerSelection = (poi: PointData) => {
    if (isAdmin) {
      setEditingPoi({ ...poi });
      setFocusPoint(poi);
      return;
    }

    focusPoi(poi, true);
  };

  const updatePoiPosition = (poiId: string, lat: number, lng: number) => {
    if (!isAdmin) return;

    const mapped = latLngToImage(lat, lng);
    const nextX = Math.round(mapped.x);
    const nextY = Math.round(mapped.y);
    const nearestNode = findNearestNode(nextX, nextY, 90);

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

  const startNewPoiDraft = () => {
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
      nodeId: findNearestNode(fallbackX, fallbackY, 90) ?? undefined,
    });
    setAdminStatusMessage('Novo ponto pronto para edição. Clique no mapa para reposicionar se precisar.');
  };

  const MapEvents = () => {
    useMapEvents({
      click(e) {
        if (!isAdmin) {
          setActivePoiId(null);
          return;
        }

        const mapped = latLngToImage(e.latlng.lat, e.latlng.lng);
        const x = Math.round(mapped.x);
        const y = Math.round(mapped.y);

        setEditingPoi({
          nome: '',
          tipo: 'atividade',
          x,
          y,
          descricao: '',
          imagemUrl: defaultPoiImages.atividade,
          contato: '',
          corDestaque: '',
          selo: '',
        });
      },
      zoomend(event) {
        setMapZoomLevel(event.target.getZoom());
      },
    });

    return null;
  };

  const buildPoiFromEditingState = () => {
    const currentEditingPoi = editingPoi;

    if (!currentEditingPoi || !currentEditingPoi.nome || !currentEditingPoi.tipo) {
      alert('Informe nome e tipo do ponto.');
      return null;
    }

    if (typeof currentEditingPoi.x !== 'number' || typeof currentEditingPoi.y !== 'number') {
      alert('Coordenadas inválidas para o ponto.');
      return null;
    }

    const nearestNode = findNearestNode(currentEditingPoi.x, currentEditingPoi.y, 90);
    if (!nearestNode) {
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
      nodeId: nearestNode,
    } satisfies PointData;
  };

  const salvarRascunhoPonto = () => {
    const novoPonto = buildPoiFromEditingState();
    if (!novoPonto) return;

    setPois((prev) => upsertPoiInCollection(prev, novoPonto));
    setDraftPoiIds((prev) => (prev.includes(novoPonto.id) ? prev : [...prev, novoPonto.id]));
    setPoiDataSource('local-workspace');
    setEditingPoi(novoPonto);
    setFocusPoint(novoPonto);
    setActivePoiId(novoPonto.id);
    setAdminStatusMessage(`Rascunho salvo localmente para ${novoPonto.nome}.`);
  };

  const publishPoiToBackend = async (poi: PointData, currentServerPois = serverPois) => {
    const existsOnBackend = currentServerPois.some((item) => item.id === poi.id);
    const syncedPoi = existsOnBackend
      ? await updatePoi(poi.id, toPoiApiPayload(poi))
      : await createPoi(toPoiApiPayload(poi, { includeId: true }));

    return fromApiPoi(syncedPoi);
  };

  const publicarPontoAtual = async () => {
    const novoPonto = buildPoiFromEditingState();
    if (!novoPonto) return;

    try {
      const normalizedPoi = await publishPoiToBackend(novoPonto);

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

  const publicarRascunhos = async () => {
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
        const normalizedPoi = await publishPoiToBackend(poi, nextServerPois);
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

  const removerPontoLocal = (id: string) => {
    if (!window.confirm('Remover este ponto apenas da edição local?')) return;

    setPois((prev) => prev.filter((poi) => poi.id !== id));
    setDraftPoiIds((prev) => prev.filter((poiId) => poiId !== id));
    setManualVisiblePoiIds((prev) => prev.filter((poiId) => poiId !== id));
    setPoiDataSource('local-workspace');
    setFocusPoint((prev) => (prev?.id === id ? null : prev));
    if (editingPoi?.id === id) setEditingPoi(null);
    if (activePoiId === id) setActivePoiId(null);
    if (selectedOriginId === id || selectedDestinationId === id) {
      clearRoute();
    }
    setAdminStatusMessage('Ponto removido apenas da edição local.');
  };

  const abrirImportadorJson = () => {
    adminImportInputRef.current?.click();
  };

  const handleAdminImportFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
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

  const restaurarFontePrincipal = () => {
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
      setAdminStatusMessage('Workspace descartado. Voltamos ao backup local mais recente.');
      return;
    }

    setPois(getFrontSeedPois());
    setPoiDataSource('front-seed');
    setAdminStatusMessage('Workspace descartado. Voltamos ao conjunto local padrao.');
  };

  const salvarPonto = async () => {
    await publicarPontoAtual();
    /*
    return;

    if (!editingPoi || !editingPoi.nome || !editingPoi.tipo) {
      alert('Informe nome e tipo do ponto.');
      return;
    }

    if (typeof editingPoi.x !== 'number' || typeof editingPoi.y !== 'number') {
      alert('Coordenadas inválidas para o ponto.');
      return;
    }

    const nearestNode = findNearestNode(editingPoi.x, editingPoi.y, 90);
    if (!nearestNode) {
      alert('Este ponto está longe dos corredores de rota. Marque mais perto de um caminho.');
      return;
    }

    const baseId = editingPoi.nome
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    const novoPonto: PointData = {
      id: editingPoi.id || `${baseId || 'ponto'}_${Date.now()}`,
      x: editingPoi.x,
      y: editingPoi.y,
      nome: editingPoi.nome.trim(),
      tipo: editingPoi.tipo,
      descricao: editingPoi.descricao?.trim() || undefined,
      imagemUrl: editingPoi.imagemUrl?.trim() || defaultPoiImages[editingPoi.tipo],
      contato: normalizeContact(editingPoi.contato) || undefined,
      corDestaque: normalizeHexColor(editingPoi.corDestaque),
      selo: normalizeBadgeText(editingPoi.selo),
      nodeId: nearestNode,
    };

    try {
      const syncedPoi = editingPoi.id
        ? await updatePoi(editingPoi.id, toPoiApiPayload(novoPonto))
        : await createPoi(toPoiApiPayload(novoPonto, { includeId: true }));

      const normalizedPoi = fromApiPoi(syncedPoi);

      setPois((prev) => {
        const index = prev.findIndex((item) => item.id === normalizedPoi.id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = normalizedPoi;
          return updated;
        }
        return [...prev, normalizedPoi];
      });

      setEditingPoi(null);
    } catch (error) {
      console.error('Falha ao salvar ponto no backend:', error);
      alert('Não foi possível salvar o ponto no servidor. Confira a API e a ADMIN_API_KEY.');
    }
    */
  };

  const deletarPonto = async (id: string) => {
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
      if (selectedOriginId === id || selectedDestinationId === id) {
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

  const toggleManualVisibility = (poiId: string) => {
    setManualVisiblePoiIds((prev) =>
      prev.includes(poiId) ? prev.filter((id) => id !== poiId) : [...prev, poiId],
    );
  };

  const baixarJson = () => {
    const payload = JSON.stringify(pois, null, 2);
    const dataStr = `data:text/json;charset=utf-8,${encodeURIComponent(payload)}`;
    const link = document.createElement('a');
    link.setAttribute('href', dataStr);
    link.setAttribute('download', POI_DATA_EXPORT_FILENAME);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleManualRoute = () => {
    if (!selectedDestinationId) {
      setRouteMessage('Informe local atual e destino antes de traçar a rota.');
      return;
    }

    if (hasLiveLocationFix) {
      buildRouteFromLiveLocation(selectedDestinationId);
      return;
    }

    if (liveTrackingState === 'requesting') {
      setRouteMessage('Ainda estamos buscando sua localização para montar a rota automaticamente.');
      return;
    }

    if (!selectedOriginId) {
      setRouteMessage('Informe local atual e destino antes de traçar a rota.');
      return;
    }

    buildRoute(selectedOriginId, selectedDestinationId);
  };

  useEffect(() => {
    if (!selectedDestinationId || !hasLiveLocationFix || !liveLocation?.snappedNodeId) {
      lastLiveRouteKeyRef.current = '';
      return;
    }

    const routeKey = `${selectedDestinationId}:${liveLocation.snappedNodeId}`;
    if (routeKey === lastLiveRouteKeyRef.current) return;

    lastLiveRouteKeyRef.current = routeKey;
    buildRouteFromLiveLocation(selectedDestinationId);
  }, [selectedDestinationId, hasLiveLocationFix, liveLocation?.snappedNodeId]);

  useEffect(() => {
    if (routeRevealFrameRef.current !== null) {
      window.cancelAnimationFrame(routeRevealFrameRef.current);
      routeRevealFrameRef.current = null;
    }

    if (routeLatLngPoints.length === 0) {
      setRouteRevealProgress(0);
      return;
    }

    if (routeLatLngPoints.length === 1 || prefersReducedMotion) {
      setRouteRevealProgress(1);
      return;
    }

    if (!isRouteViewportSettled) {
      setRouteRevealProgress(0);
      return;
    }

    setRouteRevealProgress(0);
    const animationStart = performance.now();
    const animationDurationMs = getAdaptiveAnimationDuration(
      routeDistanceMeters,
      ROUTE_REVEAL_MIN_DURATION_MS,
      ROUTE_REVEAL_MAX_DURATION_MS,
      ROUTE_REVEAL_MS_PER_METER,
    );

    const revealStep = () => {
      const elapsed = performance.now() - animationStart;
      const progress = Math.min(1, elapsed / animationDurationMs);
      setRouteRevealProgress(easeInOutCubic(progress));

      if (progress < 1) {
        routeRevealFrameRef.current = window.requestAnimationFrame(revealStep);
        return;
      }

      routeRevealFrameRef.current = null;
    };

    routeRevealFrameRef.current = window.requestAnimationFrame(revealStep);

    return () => {
      if (routeRevealFrameRef.current !== null) {
        window.cancelAnimationFrame(routeRevealFrameRef.current);
        routeRevealFrameRef.current = null;
      }
    };
  }, [routeLatLngPoints, routeDistanceMeters, prefersReducedMotion, isRouteViewportSettled]);

  useEffect(() => {
    if (walkerTimerRef.current !== null) {
      window.clearInterval(walkerTimerRef.current);
      walkerTimerRef.current = null;
    }

    if (routeLatLngPoints.length === 0) {
      setWalkerPosition(null);
      setWalkerProgress(0);
      return;
    }

    if (routeLatLngPoints.length === 1) {
      setWalkerPosition(routeLatLngPoints[0]);
      setWalkerProgress(1);
      return;
    }

    if (!isRouteRevealComplete) {
      setWalkerPosition(null);
      setWalkerProgress(0);
      return;
    }

    setWalkerPosition(routeLatLngPoints[0]);
    setWalkerProgress(0);

    const realWalkingDurationMs = (routeDistanceMeters / AVERAGE_WALKING_SPEED_MPS) * 1000;
    const animationDurationMs = isPresentationMode
      ? getAdaptiveAnimationDuration(
          routeDistanceMeters,
          PRESENTATION_WALKER_MIN_DURATION_MS,
          PRESENTATION_WALKER_MAX_DURATION_MS,
          PRESENTATION_WALKER_MS_PER_METER,
        )
      : Number.isFinite(realWalkingDurationMs) && realWalkingDurationMs > 0
        ? realWalkingDurationMs
        : 1;
    const tickMs = WALKER_PROGRESS_UPDATE_MS;
    const animationStart = performance.now();

    const tickWalker = () => {
      const elapsed = performance.now() - animationStart;
      const progress = Math.min(1, elapsed / animationDurationMs);
      setWalkerProgress(progress);
      setWalkerPosition(getPointAlongPath(routeLatLngPoints, progress));

      if (progress >= 1 && walkerTimerRef.current !== null) {
        window.clearInterval(walkerTimerRef.current);
        walkerTimerRef.current = null;
      }
    };

    tickWalker();
    walkerTimerRef.current = window.setInterval(tickWalker, tickMs);

    return () => {
      if (walkerTimerRef.current !== null) {
        window.clearInterval(walkerTimerRef.current);
        walkerTimerRef.current = null;
      }
    };
  }, [routeLatLngPoints, routeDistanceMeters, isRouteRevealComplete, isPresentationMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY);
    const handleMediaChange = () => setIsMobile(mediaQuery.matches);

    handleMediaChange();
    mediaQuery.addEventListener('change', handleMediaChange);
    return () => mediaQuery.removeEventListener('change', handleMediaChange);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(COMPACT_MEDIA_QUERY);
    const handleMediaChange = () => setIsCompactViewport(mediaQuery.matches);

    handleMediaChange();
    mediaQuery.addEventListener('change', handleMediaChange);
    return () => mediaQuery.removeEventListener('change', handleMediaChange);
  }, []);

  useEffect(() => {
    closeDockPanel();
  }, [closeDockPanel, isMobile]);

  useEffect(() => {
    if (!selectedOriginId) return;
    const origin = pois.find((poi) => poi.id === selectedOriginId);
    if (origin) setOriginQuery(origin.nome);
  }, [selectedOriginId, pois]);

  useEffect(() => {
    if (!selectedDestinationId) return;
    const destination = pois.find((poi) => poi.id === selectedDestinationId);
    if (destination) setDestinationQuery(destination.nome);
  }, [selectedDestinationId, pois]);

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
    setManualVisiblePoiIds((prev) => prev.filter((id) => pois.some((poi) => poi.id === id)));
  }, [pois]);

  useEffect(() => {
    if (activePoiId && !pois.some((poi) => poi.id === activePoiId)) {
      setActivePoiId(null);
    }
  }, [activePoiId, pois]);

  useEffect(() => {
    if (!selectedOriginId && !selectedDestinationId) return;
    const missingOrigin = selectedOriginId && !pois.some((poi) => poi.id === selectedOriginId);
    const missingDestination = selectedDestinationId && !pois.some((poi) => poi.id === selectedDestinationId);
    if (missingOrigin || missingDestination) {
      clearRoute();
    }
  }, [pois, selectedDestinationId, selectedOriginId]);

  useEffect(() => {
    setExpandedPopupPoiId(null);
  }, [activePoiId]);

  const getMarkerIcon = (poi: PointData, isActive: boolean) => {
    if (!isAdmin) {
      if (poi.id === selectedOriginId) return stateIcons.origem;
      if (poi.id === selectedDestinationId) return stateIcons.destino;
      if (isActive) return getPoiIcon(poi, true);
    }
    return getPoiIcon(poi, false);
  };
  const currentTutorialStep = tutorialSteps[tutorialStepIndex];
  const mapOverlayOpacity = 1;
  const basemapOpacity = 0;
  const resolvedDefaultZoom = isMobile ? MAP_MOBILE_DEFAULT_ZOOM : MAP_DEFAULT_ZOOM;
  const popupZoomTier =
    mapZoomLevel < 17.8 ? 'popup-zoom-overview' : mapZoomLevel < 18.9 ? 'popup-zoom-balanced' : 'popup-zoom-focus';
  const popupSizePreset = isMobile
    ? popupZoomTier === 'popup-zoom-overview'
      ? { minWidth: 206, maxWidth: 270 }
      : popupZoomTier === 'popup-zoom-balanced'
        ? { minWidth: 194, maxWidth: 252 }
        : { minWidth: 182, maxWidth: 236 }
    : popupZoomTier === 'popup-zoom-overview'
      ? { minWidth: 228, maxWidth: 316 }
      : popupZoomTier === 'popup-zoom-balanced'
        ? { minWidth: 214, maxWidth: 294 }
        : { minWidth: 202, maxWidth: 270 };
  const dockWidth = isMobile
    ? '100vw'
    : isCompactViewport
      ? 'min(520px, calc(100vw - 24px))'
      : 'min(560px, calc(100vw - 48px))';
  const dockBottom = isMobile ? 0 : 22;
  const dockPanelTop = isMobile
    ? 'calc(env(safe-area-inset-top, 0px) + 118px)'
    : isCompactViewport
      ? 118
      : 138;
  const dockPanelBottom = isMobile ? 'calc(84px + env(safe-area-inset-bottom, 0px))' : isCompactViewport ? 82 : 94;
  const adminTriggerTopOffset = isMobile
    ? 'calc(env(safe-area-inset-top, 0px) + 72px)'
    : isCompactViewport
      ? 60
      : 72;
  const isCompactAdminLayout = isMobile || isCompactViewport;
  const adminPanelWidth = isCompactAdminLayout ? 'min(100vw, 390px)' : '340px';
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
      : liveLocationSource === 'mock'
        ? 'Usar GPS real'
        : hasLiveLocationFix
        ? 'Reiniciar GPS'
        : 'Usar meu GPS';
  const shouldShowStopLiveLocation = liveTrackingState !== 'idle' && liveTrackingState !== 'unsupported';
  const liveLocationSourceLabel =
    liveLocationSource === 'mock' ? 'Fonte simulada' : liveLocationSource === 'gps' ? 'Fonte GPS' : 'Sem fonte ativa';
  const liveLocationCard = (
    <div
      style={{
        borderRadius: 16,
        border: `1px solid ${liveLocationStatusTone}`,
        background: 'rgba(255, 255, 255, 0.96)',
        boxShadow: '0 18px 30px rgba(106, 56, 208, 0.12)',
        padding: 14,
        display: 'grid',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ display: 'grid', gap: 4 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              width: 'fit-content',
              borderRadius: 999,
              padding: '4px 9px',
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              background: `${liveLocationStatusTone}22`,
              color: liveLocationStatusTone,
            }}
          >
            {liveLocationHeadline}
          </span>
          <strong style={{ fontSize: 16, color: 'var(--color-text)' }}>{routeOriginSummaryName}</strong>
          <span style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--color-text-muted)' }}>{liveLocationStatusText}</span>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type='button'
            onClick={startLiveLocationTracking}
            style={{ ...actionButton, flex: 'initial', padding: '10px 12px' }}
            className='btn btn-primary'
          >
            {liveLocationPrimaryActionLabel}
          </button>
          {shouldShowStopLiveLocation && (
            <button
              type='button'
              onClick={() => stopLiveLocationTracking()}
              style={{ ...actionButton, flex: 'initial', padding: '10px 12px' }}
              className='btn btn-neutral'
            >
              Usar origem manual
            </button>
          )}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: 8,
        }}
      >
        <div
          style={{
            borderRadius: 12,
            background: 'rgba(106, 56, 208, 0.06)',
            padding: '10px 12px',
            display: 'grid',
            gap: 3,
          }}
        >
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Área</span>
          <strong style={{ fontSize: 13, color: 'var(--color-text)' }}>
            {liveLocation ? (liveLocation.isInsideEvent ? 'Dentro da operação' : 'Fora da área') : 'Aguardando GPS'}
          </strong>
        </div>
        <div
          style={{
            borderRadius: 12,
            background: 'rgba(106, 56, 208, 0.06)',
            padding: '10px 12px',
            display: 'grid',
            gap: 3,
          }}
        >
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Precisão</span>
          <strong style={{ fontSize: 13, color: isLiveLocationAccuracyWeak ? BRAND_COLORS.highlight : BRAND_COLORS.ink }}>
            {liveLocationAccuracyLabel ?? '--'}
          </strong>
        </div>
        <div
          style={{
            borderRadius: 12,
            background: 'rgba(106, 56, 208, 0.06)',
            padding: '10px 12px',
            display: 'grid',
            gap: 3,
          }}
        >
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Atualizado</span>
          <strong style={{ fontSize: 13, color: 'var(--color-text)' }}>{liveLocationUpdatedAtLabel ?? '--'}</strong>
        </div>
        <div
          style={{
            borderRadius: 12,
            background: 'rgba(106, 56, 208, 0.06)',
            padding: '10px 12px',
            display: 'grid',
            gap: 3,
          }}
        >
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Fonte</span>
          <strong style={{ fontSize: 13, color: 'var(--color-text)' }}>{liveLocationSourceLabel}</strong>
        </div>
      </div>

      <div
        style={{
          borderRadius: 14,
          border: '1px dashed rgba(106, 56, 208, 0.18)',
          padding: 12,
          display: 'grid',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'grid', gap: 3 }}>
            <strong style={{ fontSize: 14, color: 'var(--color-text)' }}>Teste em casa</strong>
            <span style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--color-text-muted)' }}>
              Simule uma posição manual para validar a navegação sem sair de casa.
            </span>
          </div>
          <button
            type='button'
            onClick={() => setIsLocationTestOpen((prev) => !prev)}
            style={{ ...actionButton, flex: 'initial', padding: '9px 12px' }}
            className='btn btn-neutral'
          >
            {isLocationTestOpen ? 'Ocultar teste' : 'Abrir teste'}
          </button>
        </div>

        {isLocationTestOpen && (
          <div style={{ display: 'grid', gap: 8 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
                gap: 8,
              }}
            >
              <input
                value={testLocationLatInput}
                onChange={(event) => setTestLocationLatInput(event.target.value)}
                style={{ ...inputStyle, margin: 0 }}
                placeholder='Latitude simulada'
              />
              <input
                value={testLocationLngInput}
                onChange={(event) => setTestLocationLngInput(event.target.value)}
                style={{ ...inputStyle, margin: 0 }}
                placeholder='Longitude simulada'
              />
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type='button'
                onClick={applyMockLocation}
                style={{ ...actionButton, flex: 'initial', padding: '9px 12px' }}
                className='btn btn-primary'
              >
                Aplicar localização teste
              </button>
              <button
                type='button'
                onClick={seedTestLocationWithEventCenter}
                style={{ ...actionButton, flex: 'initial', padding: '9px 12px' }}
                className='btn btn-neutral'
              >
                Preencher com centro do evento
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ fontSize: 11, lineHeight: 1.5, color: 'var(--color-text-muted)' }}>
        {routeOriginSummaryHelp}
        {isLiveLocationAccuracyWeak && ' O sinal está mais fraco do que o ideal; se puder, teste perto de uma área aberta.'}
      </div>
    </div>
  );

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
        }}
      >
        {isAdmin && (
          <>
            <input
              ref={adminImportInputRef}
              type='file'
              accept='application/json'
              onChange={handleAdminImportFileChange}
              style={{ display: 'none' }}
            />

            <div
              style={{
                padding: '18px',
                background: 'linear-gradient(180deg, var(--color-ink-soft), var(--color-ink))',
                color: 'var(--color-text-inverse)',
                display: 'grid',
                gap: 10,
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: '18px' }}>Painel administrativo</h2>
                <p style={{ margin: '6px 0 0 0', fontSize: '12px', opacity: 0.82 }}>
                  Gestão de pontos com base local de segurança. A malha de rotas continua vindo do grafo local do aplicativo.
                </p>
              </div>

              <div
                style={{
                  display: 'grid',
                  gap: 8,
                  padding: 10,
                  borderRadius: 14,
                  background: 'rgba(255,255,255,0.18)',
                  border: '1px solid rgba(255,255,255,0.18)',
                }}
              >
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    width: 'fit-content',
                    padding: '6px 10px',
                    borderRadius: 999,
                    background: currentSourceMeta.tint,
                    color: currentSourceMeta.tone,
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  {currentSourceMeta.label}
                </div>
                <div style={{ fontSize: 12, opacity: 0.88 }}>{backendSyncLabel}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                  <div
                    style={{
                      padding: '8px 10px',
                      borderRadius: 12,
                      background: 'rgba(255,255,255,0.18)',
                    }}
                  >
                    <div style={{ fontSize: 10, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Pontos
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800 }}>{pois.length}</div>
                  </div>
                  <div
                    style={{
                      padding: '8px 10px',
                      borderRadius: 12,
                      background: 'rgba(255,255,255,0.18)',
                    }}
                  >
                    <div style={{ fontSize: 10, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Rascunhos
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800 }}>{draftPoiIds.length}</div>
                  </div>
                  <div
                    style={{
                      padding: '8px 10px',
                      borderRadius: 12,
                      background: 'rgba(255,255,255,0.18)',
                    }}
                  >
                    <div style={{ fontSize: 10, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Publicados
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800 }}>{syncedPoiCount}</div>
                  </div>
                  <div
                    style={{
                      padding: '8px 10px',
                      borderRadius: 12,
                      background: 'rgba(255,255,255,0.18)',
                    }}
                  >
                    <div style={{ fontSize: 10, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Sem rota
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800 }}>{disconnectedPoiCount}</div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ padding: '10px', display: 'grid', gap: 8, borderBottom: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={startNewPoiDraft}
                  className='btn btn-primary'
                  style={{
                    ...actionButton,
                    padding: '10px 12px',
                  }}
                >
                  Novo ponto
                </button>
                <button
                  onClick={() => void syncBootstrap({ forceReplace: true })}
                  className='btn btn-neutral'
                  style={{
                    ...actionButton,
                    padding: '10px 12px',
                  }}
                >
                  Atualizar servidor
                </button>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={abrirImportadorJson}
                  className='btn btn-neutral'
                  style={{ ...actionButton, padding: '10px 12px' }}
                >
                  Importar JSON
                </button>
                <button
                  onClick={publicarRascunhos}
                  className='btn btn-success'
                  style={{ ...actionButton, padding: '10px 12px' }}
                >
                  Publicar rascunhos
                </button>
              </div>

              <input
                value={adminSearchTerm}
                onChange={(e) => setAdminSearchTerm(e.target.value)}
                style={{ ...inputStyle, margin: 0 }}
                placeholder='Buscar por nome, selo ou id'
              />

              <select
                value={adminTypeFilter}
                onChange={(e) => setAdminTypeFilter(e.target.value as 'todos' | PoiType)}
                style={{ ...inputStyle, margin: 0 }}
              >
                <option value='todos'>Todos os tipos</option>
                <option value='atividade'>Atividades</option>
                <option value='servico'>Serviços</option>
                <option value='banheiro'>Banheiros</option>
                <option value='entrada'>Entradas</option>
              </select>

              {adminStatusMessage && (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 12,
                    background: 'rgba(245, 248, 252, 0.95)',
                    border: '1px solid rgba(203, 213, 225, 0.8)',
                    color: 'var(--color-text-muted)',
                    fontSize: 12,
                    lineHeight: 1.45,
                  }}
                >
                  {adminStatusMessage}
                </div>
              )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
              {filteredAdminPois.map((poi) => {
                const isDraft = draftPoiIdSet.has(poi.id);
                return (
                  <button
                    key={poi.id}
                    onClick={() => {
                      setEditingPoi({ ...poi });
                      setFocusPoint(poi);
                      setActivePoiId(poi.id);
                    }}
                    style={{
                      width: '100%',
                      border: '1px solid #edf1f4',
                      borderRadius: '12px',
                      background: editingPoi?.id === poi.id ? 'var(--color-primary-soft)' : 'white',
                      marginBottom: '8px',
                      textAlign: 'left',
                      padding: '11px',
                      cursor: 'pointer',
                      boxShadow: editingPoi?.id === poi.id ? '0 10px 24px rgba(37, 99, 235, 0.08)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          minWidth: 24,
                          height: 24,
                          padding: '0 6px',
                          borderRadius: 999,
                          background: getPoiAccentColor(poi),
                          color: '#ffffff',
                          border: '1px solid rgba(255,255,255,0.88)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 10,
                          fontWeight: 800,
                          letterSpacing: '0.03em',
                          flexShrink: 0,
                        }}
                      >
                        {getPoiBadgeText(poi)}
                      </span>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: '14px',
                          minWidth: 0,
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          flex: 1,
                        }}
                      >
                        {poi.nome}
                      </div>
                      {isDraft && (
                        <span
                          style={{
                            padding: '4px 8px',
                            borderRadius: 999,
                            background: 'rgba(245, 158, 11, 0.14)',
                            color: '#9a6700',
                            fontSize: 10,
                            fontWeight: 800,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                          }}
                        >
                          Rascunho
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '11px', color: '#5f6c7a', marginTop: '5px' }}>
                      {poi.tipo.toUpperCase()} {poi.nodeId ? '| conectado' : '| sem rota'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#7b8794', marginTop: '3px' }}>
                      x: {Math.round(poi.x)} | y: {Math.round(poi.y)} | id: {poi.id}
                    </div>
                  </button>
                );
              })}

              {filteredAdminPois.length === 0 && (
                <div
                  style={{
                    padding: '14px',
                    borderRadius: 14,
                    border: '1px dashed var(--color-border-strong)',
                    color: 'var(--color-text-soft)',
                    fontSize: 12,
                  }}
                >
                  Nenhum ponto encontrado com o filtro atual.
                </div>
              )}
            </div>

            <div
              style={{
                padding: '14px',
                borderTop: '1px solid var(--color-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <button
                onClick={restaurarFontePrincipal}
                className='btn btn-neutral'
                style={{ padding: '12px' }}
              >
                Descartar workspace
              </button>
              <button
                onClick={baixarJson}
                className='btn btn-success'
                style={{ padding: '12px' }}
              >
                Baixar JSON
              </button>
              <button
                onClick={() => {
                  setIsAdmin(false);
                  setEditingPoi(null);
                }}
                className='btn btn-danger'
              >
                Sair do modo admin
              </button>
            </div>
          </>
        )}
      </div>

      <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>
        {isAdmin && editingPoi && (
          <div
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              width: '330px',
              maxHeight: '86vh',
              overflowY: 'auto',
              background: 'var(--color-surface)',
              padding: '18px',
              borderRadius: '12px',
              border: '1px solid var(--color-border)',
              boxShadow: 'var(--shadow-float)',
              zIndex: 3000,
            }}
            className='map-floating-panel'
          >
            <h3 style={{ marginTop: 0, marginBottom: '12px' }}>
              {editingPoi.id ? 'Editar ponto' : 'Novo ponto'}
            </h3>

            <div
              style={{
                display: 'grid',
                gap: 8,
                marginBottom: 12,
                padding: '10px 12px',
                borderRadius: 12,
                background: 'var(--color-surface-soft)',
                border: '1px solid var(--color-border)',
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    minHeight: 28,
                    padding: '0 10px',
                    borderRadius: 999,
                    background: editingPoiIsDraft ? 'rgba(217, 200, 255, 0.22)' : 'rgba(106, 56, 208, 0.1)',
                    color: editingPoiIsDraft ? BRAND_COLORS.ink : BRAND_COLORS.primaryStrong,
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  {editingPoiIsDraft ? 'Rascunho local' : 'Sem rascunho pendente'}
                </span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    minHeight: 28,
                    padding: '0 10px',
                    borderRadius: 999,
                    background: editingPoiExistsOnBackend ? 'rgba(106, 56, 208, 0.12)' : 'rgba(23, 19, 31, 0.08)',
                    color: editingPoiExistsOnBackend ? BRAND_COLORS.primaryStrong : BRAND_COLORS.textMuted,
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  {editingPoiExistsOnBackend ? 'Já está no servidor' : 'Ainda não publicado'}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                x: {typeof editingPoi.x === 'number' ? Math.round(editingPoi.x) : '-'} | y:{' '}
                {typeof editingPoi.y === 'number' ? Math.round(editingPoi.y) : '-'} | node:{' '}
                {editingPoi.nodeId || 'sem conexão'}
              </div>
            </div>

            <label className='map-input-label'>Nome</label>
            <input
              value={editingPoi.nome || ''}
              onChange={(e) => setEditingPoi({ ...editingPoi, nome: e.target.value })}
              style={inputStyle}
              placeholder='Ex: Palco Principal'
            />

            <label className='map-input-label'>Tipo</label>
            <select
              value={editingPoi.tipo || 'atividade'}
              onChange={(e) => setEditingPoi({ ...editingPoi, tipo: e.target.value as PoiType })}
              style={inputStyle}
            >
              <option value='atividade'>Atividade</option>
              <option value='servico'>Serviço</option>
              <option value='banheiro'>Banheiro</option>
              <option value='entrada'>Entrada</option>
            </select>

            <label className='map-input-label'>Descrição</label>
            <input
              value={editingPoi.descricao || ''}
              onChange={(e) => setEditingPoi({ ...editingPoi, descricao: e.target.value })}
              style={inputStyle}
              placeholder='Informação curta sobre o ponto'
            />

            <label className='map-input-label'>URL da foto</label>
            <input
              value={editingPoi.imagemUrl || ''}
              onChange={(e) => setEditingPoi({ ...editingPoi, imagemUrl: e.target.value })}
              style={inputStyle}
              placeholder='https://...'
            />

            <label className='map-input-label'>Contato (opcional)</label>
            <input
              value={editingPoi.contato || ''}
              onChange={(e) => setEditingPoi({ ...editingPoi, contato: e.target.value })}
              style={inputStyle}
              placeholder='Telefone, e-mail ou URL'
            />

            <label className='map-input-label'>Cor de destaque (opcional)</label>
            <input
              value={editingPoi.corDestaque || ''}
              onChange={(e) => setEditingPoi({ ...editingPoi, corDestaque: e.target.value })}
              style={inputStyle}
              placeholder={BRAND_COLORS.primary}
            />
            {hasInvalidEditingAccentColor && (
              <div style={{ marginTop: '-7px', marginBottom: 8, fontSize: 11, color: 'var(--color-primary-strong)' }}>
                Use apenas cores da paleta: `#6a38d0`, `#4b229f`, `#8d6fe7` ou `#d9c8ff`.
              </div>
            )}

            <label className='map-input-label'>Selo do ponto (opcional)</label>
            <input
              value={editingPoi.selo || ''}
              onChange={(e) => setEditingPoi({ ...editingPoi, selo: e.target.value })}
              style={inputStyle}
              placeholder='Ex: PAL, WC, VIP'
            />

            <div
              style={{
                marginTop: '-2px',
                marginBottom: 8,
                padding: '7px 9px',
                border: '1px dashed #d5dfeb',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: '#f7fbff',
              }}
            >
                <span
                style={{
                  minWidth: 28,
                  height: 28,
                  padding: '0 7px',
                  borderRadius: 999,
                  background: editingAccentColorPreview,
                  color: '#ffffff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: 11,
                }}
              >
                {editingBadgePreview}
              </span>
              <span style={{ fontSize: 11, color: '#4f647d' }}>
                Prévia do destaque visual deste ponto.
              </span>
            </div>

            <div style={{ display: 'grid', gap: 10, marginTop: '12px' }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={salvarRascunhoPonto} style={{ ...actionButton }} className='btn btn-neutral'>
                  Salvar rascunho
                </button>
                <button onClick={salvarPonto} style={{ ...actionButton }} className='btn btn-primary'>
                  Publicar agora
                </button>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                {editingPoi.id && (
                  <button
                    onClick={() => removerPontoLocal(editingPoi.id!)}
                    style={{ ...actionButton }}
                    className='btn btn-neutral'
                  >
                    Remover local
                  </button>
                )}
                {editingPoi.id && editingPoiExistsOnBackend && (
                  <button
                    onClick={() => deletarPonto(editingPoi.id!)}
                    style={{ ...actionButton }}
                    className='btn btn-danger'
                  >
                    Excluir do servidor
                  </button>
                )}
              </div>

              <button
                onClick={() => setEditingPoi(null)}
                style={{ ...actionButton, width: '100%' }}
                className='btn btn-neutral'
              >
                Fechar
              </button>
            </div>
          </div>
        )}

        {!isAdmin && (
          <div className='map-brand-header'>
            <span className='map-brand-icon-shell'>
              <img src={brandIcon} alt='Logo do evento' className='map-brand-icon' />
            </span>
          </div>
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
            <div className={`map-action-sheet-body ${isDockPanelOpen ? 'active' : ''}`}>
              <div className='map-action-sheet-scroll'>
                {activeDockPanel === 'pins' && (
                  <div className='map-sheet-panel map-sheet-panel-pins'>
                    <div className='pin-panel-hero'>
                      <div>
                        <div className='map-sheet-eyebrow'>Descoberta inteligente</div>
                        <div className='map-panel-title'>Explorar locais</div>
                        <div className='pin-panel-subtitle'>
                          Encontre atividades e serviços do evento com foco rápido no mapa.
                        </div>
                      </div>
                      <button
                        onClick={closeDockPanel}
                        className='pin-panel-close'
                        title='Fechar painel de locais'
                      >
                        x
                      </button>
                    </div>

                    <div className='pin-search-box'>
                      <input
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder='Buscar atividade, serviço, banheiro ou entrada...'
                        className='map-input pin-search-input'
                        style={{ ...inputStyle, marginBottom: 0 }}
                      />
                      <span className='pin-search-label'>Buscar</span>
                    </div>

                    <div className='pin-filter-row'>
                      {(Object.keys(poiTypeLabels) as PoiType[]).map((type) => (
                        <button
                          key={`filter_${type}`}
                          onClick={() => toggleType(type)}
                          className={`map-chip pin-filter-chip pin-filter-chip-${type} ${enabledTypes[type] ? 'active' : ''}`}
                        >
                          <span className={`pin-filter-dot pin-filter-dot-${type}`} />
                          {poiTypeLabels[type]}
                        </button>
                      ))}
                    </div>

                    <div className='pin-panel-meta'>
                      <span>{`${searchablePois.length} locais prontos para explorar`}</span>
                      {!isPresentationMode && (
                        <button
                          onClick={() => setManualVisiblePoiIds([])}
                          disabled={manualVisiblePoiIds.length === 0}
                          className='map-inline-link'
                          style={{ color: manualVisiblePoiIds.length > 0 ? 'var(--color-primary)' : 'var(--color-text-soft)' }}
                        >
                          Modo inteligente
                        </button>
                      )}
                    </div>

                    {arePinsHiddenByZoom && (
                      <div className='map-sheet-inline-status'>
                        Aproxime o mapa para revelar os pontos na tela. A lista continua disponível logo abaixo.
                      </div>
                    )}

                    <div className='map-list-shell pin-results-shell'>
                      {searchablePois.map((poi) => {
                        const checked = manualVisiblePoiIds.includes(poi.id);
                        const accentColor = getPoiAccentColor(poi);
                        return (
                          <div
                            key={`catalog_${poi.id}`}
                            className={`map-list-item pin-result-row ${checked ? 'active' : ''}`}
                            style={{
                              gridTemplateColumns: isPresentationMode ? '1fr auto' : '22px 1fr auto',
                              borderLeft: `3px solid ${accentColor}`,
                            }}
                          >
                            {!isPresentationMode && (
                              <input
                                className='pin-select-check'
                                type='checkbox'
                                checked={checked}
                                onChange={() => toggleManualVisibility(poi.id)}
                                title='Controlar visibilidade manual deste ponto'
                              />
                            )}
                            <button
                              onClick={() => focusPoi(poi, true)}
                              className='pin-result-main'
                            >
                              <span
                                className={`pin-result-type-mark pin-result-type-mark-${poi.tipo}`}
                                style={{
                                  background: accentColor,
                                  boxShadow: `0 0 0 3px ${mixColors(accentColor, '#ffffff', 0.74)}`,
                                }}
                              />
                              <span className='pin-result-text'>
                                <span className='pin-result-title'>{poi.nome}</span>
                                <span className='pin-result-subtitle'>{poiTypeSingularLabels[poi.tipo]}</span>
                              </span>
                            </button>
                            <button
                              onClick={() => focusPoi(poi, true)}
                              className='pin-result-open'
                            >
                              Ver
                            </button>
                          </div>
                        );
                      })}

                      {searchablePois.length === 0 && (
                        <div className='pin-empty-state'>
                          Nenhum ponto encontrado para esse filtro.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeDockPanel === 'agenda' && (
                  <div className='agenda-panel-shell map-sheet-panel map-sheet-panel-agenda'>
                    <div className='agenda-panel-hero'>
                      <div className='agenda-panel-hero-copy'>
                        <div className='map-sheet-eyebrow'>Programação oficial</div>
                        <div className='map-panel-title'>Cronograma do evento</div>
                        <div className='agenda-panel-subtitle'>
                          Sábado 21 é o único dia do evento, com palco principal, Arena Porto Digital e Arena Experiência organizados por horário e espaço.
                        </div>
                      </div>
                      <button
                        onClick={closeDockPanel}
                        className='pin-panel-close'
                        title='Fechar cronograma'
                      >
                        x
                      </button>
                    </div>

                    <div className='agenda-panel-highlights'>
                      <article className='agenda-highlight-card'>
                        <span className='agenda-highlight-label'>Janela do dia</span>
                        <strong className='agenda-highlight-value'>{agendaDayStats.windowLabel}</strong>
                      </article>
                      <article className='agenda-highlight-card'>
                        <span className='agenda-highlight-label'>Sessões</span>
                        <strong className='agenda-highlight-value'>{agendaDayStats.sessionCount}</strong>
                      </article>
                      <article className='agenda-highlight-card'>
                        <span className='agenda-highlight-label'>Palestrantes</span>
                        <strong className='agenda-highlight-value'>{agendaDayStats.speakerCount}</strong>
                      </article>
                      <article className='agenda-highlight-card'>
                        <span className='agenda-highlight-label'>No mapa</span>
                        <strong className='agenda-highlight-value'>{`${agendaDayStats.connectedCount}/${agendaDayStats.sessionCount}`}</strong>
                      </article>
                    </div>

                    <div className='agenda-day-strip' role='tablist' aria-label='Dia do cronograma'>
                      {agendaDays.map((day) => (
                        <button
                          key={`agenda_day_${day.id}`}
                          onClick={() => setSelectedAgendaDay(day.id)}
                          className={`agenda-day-chip ${selectedAgendaDay === day.id ? 'active' : ''}`}
                          role='tab'
                          aria-selected={selectedAgendaDay === day.id}
                        >
                          <span className='agenda-day-weekday'>{day.weekday}</span>
                          <span className='agenda-day-number'>{day.dateLabel}</span>
                        </button>
                      ))}
                    </div>

                    <div className='agenda-panel-caption'>
                      {selectedAgendaDayMeta.weekday} {selectedAgendaDayMeta.dateLabel} reúne toda a programação oficial em um único dia, com paralelos organizados por horário e espaço.
                    </div>

                    <div className='agenda-session-list'>
                      {agendaSessionsForSelectedDay.map((session, index) => {
                        const isFavorite = favoriteAgendaIds.includes(session.id);
                        const matchedPoi = getAgendaSessionPoi(session);
                        const durationLabel = formatAgendaDuration(session.startTime, session.endTime);

                        return (
                          <article
                            key={session.id}
                            className={`agenda-session-card ${matchedPoi ? 'interactive' : ''}`}
                            style={{ '--agenda-accent': session.accent } as CSSProperties}
                            onClick={matchedPoi ? () => handleAgendaSessionFocus(session) : undefined}
                            onKeyDown={
                              matchedPoi
                                ? (event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                      event.preventDefault();
                                      handleAgendaSessionFocus(session);
                                    }
                                  }
                                : undefined
                            }
                            role={matchedPoi ? 'button' : undefined}
                            tabIndex={matchedPoi ? 0 : undefined}
                          >
                            <div className='agenda-session-rail'>
                              <span className='agenda-session-day-badge'>{`${session.weekday} ${session.dateLabel}`}</span>
                              <span className='agenda-session-time'>{session.startTime}</span>
                              <span className='agenda-session-time agenda-session-time-end'>{session.endTime}</span>
                              <span className='agenda-session-duration'>{durationLabel}</span>
                            </div>

                            <div className='agenda-session-main'>
                              <div className='agenda-session-topline'>
                                <div className='agenda-session-topline-tags'>
                                  <span className='agenda-session-tag'>{session.category}</span>
                                  {index === 0 && <span className='agenda-session-priority-badge'>Em destaque</span>}
                                </div>
                                <button
                                  type='button'
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    toggleAgendaFavorite(session.id);
                                  }}
                                  className={`agenda-favorite-btn ${isFavorite ? 'active' : ''}`}
                                  aria-pressed={isFavorite}
                                  title={isFavorite ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
                                >
                                  <svg viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'>
                                    <path d='M12 20.2L10.6 18.9C5.6 14.3 2.4 11.4 2.4 7.8C2.4 5.2 4.4 3.2 7 3.2C8.5 3.2 9.9 3.9 10.8 5.1L12 6.6L13.2 5.1C14.1 3.9 15.5 3.2 17 3.2C19.6 3.2 21.6 5.2 21.6 7.8C21.6 11.4 18.4 14.3 13.4 18.9L12 20.2Z' />
                                  </svg>
                                </button>
                              </div>

                              <div className='agenda-session-title'>{session.title}</div>
                              <div className='agenda-session-summary'>{session.summary}</div>

                              <div className='agenda-session-meta'>
                                <span className='agenda-session-meta-item'>{session.venue}</span>
                                <span className='agenda-session-meta-separator' />
                                <span className='agenda-session-meta-item'>{session.audience}</span>
                                <span className='agenda-session-meta-separator' />
                                <span className='agenda-session-meta-item'>{durationLabel}</span>
                              </div>

                              <div className='agenda-speaker-row'>
                                <div className='agenda-speaker-stack'>
                                  {session.speakers.map((speaker) => (
                                    <span key={`${session.id}_${speaker.name}`} className='agenda-speaker-avatar' title={speaker.name}>
                                      {speaker.name
                                        .split(' ')
                                        .slice(0, 2)
                                        .map((part) => part.charAt(0))
                                        .join('')}
                                    </span>
                                  ))}
                                </div>
                                <div className='agenda-speaker-copy'>
                                  <span className='agenda-speaker-roleline'>
                                    {session.speakers.map((speaker) => speaker.role).join(' / ')}
                                  </span>
                                  {session.speakers.map((speaker) => speaker.name).join(' • ')}
                                </div>
                              </div>

                              <div className='agenda-session-footer'>
                                <span className='agenda-session-status'>
                                  {isFavorite ? 'Salvo para você' : 'Sugestão para você'}
                                </span>
                                <button
                                  type='button'
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleAgendaSessionFocus(session);
                                  }}
                                  className='agenda-session-map-link'
                                  disabled={!matchedPoi}
                                >
                                  <span>{matchedPoi ? 'Ver no mapa' : 'Sem local vinculado'}</span>
                                  {matchedPoi && (
                                    <svg viewBox='0 0 20 20' aria-hidden='true'>
                                      <path d='M6 10H14' />
                                      <path d='M10.5 6.5L14 10L10.5 13.5' />
                                    </svg>
                                  )}
                                </button>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                )}

                {activeDockPanel === 'route' && (
                  <div className='map-sheet-panel map-sheet-panel-route'>
                    <div className='route-panel-hero'>
                      <div>
                        <div className='map-sheet-eyebrow'>Navegação guiada</div>
                        <div className='map-panel-title'>Painel de rota</div>
                        <div className='route-panel-subtitle'>
                          Escolha o destino e deixe a origem automática cuidar do restante.
                        </div>
                      </div>
                      <button
                        onClick={closeDockPanel}
                        className='pin-panel-close'
                        title='Fechar painel de rota'
                      >
                        x
                      </button>
                    </div>

                    {liveLocationCard}

                    <div className='route-field-grid'>
                      <div className='route-auto-origin-card'>
                        <span className='route-auto-origin-label'>Origem automática</span>
                        <strong className='route-auto-origin-name'>{routeOriginSummaryName}</strong>
                        <span className='route-auto-origin-help'>{routeOriginSummaryHelp}</span>
                      </div>

                      <div className='route-field-card'>
                        <label className='map-input-label route-field-label'>Destino</label>
                        <div className='route-field-input-wrap'>
                          <input
                            value={destinationQuery}
                            onChange={(e) => {
                              setDestinationQuery(e.target.value);
                              setSelectedDestinationId('');
                              setShowDestinationSuggestions(true);
                            }}
                            onFocus={() => setShowDestinationSuggestions(true)}
                            onBlur={() => window.setTimeout(() => setShowDestinationSuggestions(false), 120)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && destinationSuggestions.length > 0) {
                                e.preventDefault();
                                selectDestinationPoi(destinationSuggestions[0]);
                              }
                            }}
                            autoFocus={isMobile}
                            className='map-input route-field-input'
                            style={{ ...inputStyle, margin: 0 }}
                            placeholder='Ex.: Palco Principal, banheiro...'
                          />
                          <span className='route-field-hint'>Selecione um destino ou toque em um ponto no mapa</span>
                          {showDestinationSuggestions && (
                            <div className='route-suggestions'>
                              {destinationSuggestions.map((poi) => (
                                <button
                                  key={`destination_suggestion_${poi.id}`}
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => selectDestinationPoi(poi)}
                                  className='route-suggestion-item'
                                >
                                  <span className='route-suggestion-name'>{poi.nome}</span>
                                  <span className='route-suggestion-type'>{poi.tipo.toUpperCase()}</span>
                                </button>
                              ))}
                              {destinationSuggestions.length === 0 && (
                                <div className='route-suggestion-empty'>Nenhuma sugestão para destino.</div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className='route-action-row'>
                      <button onClick={clearRoute} style={{ ...actionButton }} className='btn btn-neutral route-secondary-action'>
                        Limpar
                      </button>
                    </div>

                    <div className='route-feedback-card'>
                      <div className='route-feedback-title'>Resumo da navegação</div>
                      <div className='route-feedback-text'>{routeMessage}</div>
                    </div>

                    {routeDistanceMeters > 0 && (
                      <div className='route-metrics-card'>
                        <div className='route-metric-item'>
                          <span className='route-metric-label'>Distância</span>
                          <span className='route-metric-value'>{formatDistanceLabel(routeDistanceMeters)}</span>
                        </div>
                        <div className='route-metric-item'>
                          <span className='route-metric-label'>Tempo médio</span>
                          <span className='route-metric-value'>{formatWalkingTimeLabel(routeEtaMinutes)}</span>
                        </div>
                        {!isPresentationMode && (
                          <div className='route-metric-item'>
                            <span className='route-metric-label'>{routeMetricLabel}</span>
                            <span className='route-metric-value'>{routeMetricValue}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className='map-action-dock-buttons'>
              <button
                onClick={() => toggleDockPanel('agenda')}
                className={`map-toggle-btn map-toggle-btn-agenda ${activeDockPanel === 'agenda' ? 'active' : ''} ${activeDockPanel && activeDockPanel !== 'agenda' ? 'dimmed' : ''}`}
                aria-pressed={activeDockPanel === 'agenda'}
              >
                <span className='map-toggle-btn-icon' aria-hidden='true'>
                  <svg viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'>
                    <rect x='4' y='5' width='16' height='15' rx='2.4' />
                    <path d='M8 3.5V7' />
                    <path d='M16 3.5V7' />
                    <path d='M4 9.5H20' />
                    <path d='M8 13H11' />
                    <path d='M13 13H16' />
                    <path d='M8 16.5H11' />
                  </svg>
                </span>
                <span className='map-toggle-btn-label'>Cronograma</span>
              </button>
              <button
                onClick={() => toggleDockPanel('pins')}
                className={`map-toggle-btn map-toggle-btn-pins ${activeDockPanel === 'pins' ? 'active' : ''} ${activeDockPanel && activeDockPanel !== 'pins' ? 'dimmed' : ''}`}
                aria-pressed={activeDockPanel === 'pins'}
              >
                <span className='map-toggle-btn-icon' aria-hidden='true'>
                  <svg viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'>
                    <path d='M4 9L12 3L20 9V19A2 2 0 0 1 18 21H6A2 2 0 0 1 4 19V9Z' />
                    <path d='M9 21V13H15V21' />
                  </svg>
                </span>
                <span className='map-toggle-btn-label'>Locais</span>
              </button>
              <button
                onClick={() => toggleDockPanel('route')}
                className={`map-toggle-btn map-toggle-btn-route ${activeDockPanel === 'route' ? 'active' : ''} ${activeDockPanel && activeDockPanel !== 'route' ? 'dimmed' : ''}`}
                aria-pressed={activeDockPanel === 'route'}
              >
                <span className='map-toggle-btn-icon' aria-hidden='true'>
                  <svg viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'>
                    <circle cx='7' cy='17' r='2.2' />
                    <circle cx='17' cy='7' r='2.2' />
                    <path d='M9.4 15.6L14.6 10.4' />
                    <path d='M11.5 6.3H7.8A2.8 2.8 0 0 0 5 9.1V12.7' />
                    <path d='M12.5 17.7H16.2A2.8 2.8 0 0 0 19 14.9V11.3' />
                  </svg>
                </span>
                <span className='map-toggle-btn-label'>Rotas</span>
              </button>
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
            </div>
          </div>
        )}

        {false && !isAdmin && isPinsPanelOpen && (
          <div
            style={{
              position: 'fixed',
              top: dockPanelTop,
              left: '50%',
              right: 'auto',
              bottom: dockPanelBottom,
              transform: 'translateX(-50%)',
              zIndex: 3210,
              width: dockWidth,
              maxHeight: 'none',
              overflowY: 'auto',
              padding: isMobile ? 12 : 14,
            }}
            className='map-floating-panel dock-sheet-panel'
          >
            <div className='pin-panel-hero'>
              <div>
                <div className='map-panel-title'>Explorar locais</div>
                <div className='pin-panel-subtitle'>
                  Encontre atividades e serviços do evento com foco rápido no mapa.
                </div>
              </div>
              <button
                onClick={() => setIsPinsPanelOpen(false)}
                className='pin-panel-close'
                title='Fechar painel de locais'
              >
                x
              </button>
            </div>

            <div className='pin-search-box'>
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder='Buscar atividade, serviço, banheiro ou entrada...'
                className='map-input pin-search-input'
                style={{ ...inputStyle, marginBottom: 0 }}
              />
              <span className='pin-search-label'>Buscar</span>
            </div>

            <div className='pin-filter-row'>
              {(Object.keys(poiTypeLabels) as PoiType[]).map((type) => (
                <button
                  key={`filter_${type}`}
                  onClick={() => toggleType(type)}
                  className={`map-chip pin-filter-chip ${enabledTypes[type] ? 'active' : ''}`}
                >
                  <span className={`pin-filter-dot pin-filter-dot-${type}`} />
                  {poiTypeLabels[type]}
                </button>
              ))}
            </div>

            <div className='pin-panel-meta'>
              <span>{isPresentationMode ? `${searchablePois.length} resultados` : `${visiblePois.length} visíveis`}</span>
              {!isPresentationMode && (
                <button
                  onClick={() => setManualVisiblePoiIds([])}
                  disabled={manualVisiblePoiIds.length === 0}
                  className='map-inline-link'
                  style={{ color: manualVisiblePoiIds.length > 0 ? 'var(--color-primary)' : 'var(--color-text-soft)' }}
                >
                  Modo inteligente
                </button>
              )}
            </div>

            <div
              style={{
                maxHeight: isMobile ? 190 : 320,
                overflowY: 'auto',
              }}
              className='map-list-shell pin-results-shell'
            >
              {searchablePois.map((poi) => {
                const checked = manualVisiblePoiIds.includes(poi.id);
                const accentColor = getPoiAccentColor(poi);
                return (
                  <div
                    key={`catalog_${poi.id}`}
                    className={`map-list-item pin-result-row ${checked ? 'active' : ''}`}
                    style={{
                      gridTemplateColumns: isPresentationMode ? '1fr auto' : '22px 1fr auto',
                      borderLeft: `3px solid ${accentColor}`,
                    }}
                  >
                    {!isPresentationMode && (
                      <input
                        className='pin-select-check'
                        type='checkbox'
                        checked={checked}
                        onChange={() => toggleManualVisibility(poi.id)}
                        title='Controlar visibilidade manual deste ponto'
                      />
                    )}
                    <button
                      onClick={() => focusPoi(poi, true)}
                      className='pin-result-main'
                    >
                      <span
                        className={`pin-result-type-mark pin-result-type-mark-${poi.tipo}`}
                        style={{
                          background: accentColor,
                          boxShadow: `0 0 0 3px ${mixColors(accentColor, '#ffffff', 0.74)}`,
                        }}
                      />
                      <span className='pin-result-text'>
                        <span className='pin-result-title'>{poi.nome}</span>
                        <span className='pin-result-subtitle'>{poiTypeSingularLabels[poi.tipo]}</span>
                      </span>
                    </button>
                    <button
                      onClick={() => focusPoi(poi, true)}
                      className='pin-result-open'
                    >
                      Ver
                    </button>
                  </div>
                );
              })}

              {searchablePois.length === 0 && (
                <div className='pin-empty-state'>
                  Nenhum ponto encontrado para esse filtro.
                </div>
              )}
            </div>
          </div>
        )}
        {false && !isAdmin && isAgendaPanelOpen && (
          <div
            style={{
              position: 'fixed',
              top: dockPanelTop,
              left: '50%',
              right: 'auto',
              bottom: dockPanelBottom,
              transform: 'translateX(-50%)',
              zIndex: 3210,
              width: dockWidth,
              maxHeight: 'none',
              overflowY: 'auto',
              padding: isMobile ? 12 : 14,
            }}
            className='map-floating-panel agenda-panel-shell dock-sheet-panel'
          >
            <div className='agenda-panel-hero'>
              <div>
                <div className='agenda-panel-eyebrow'>Programação oficial</div>
                <div className='map-panel-title'>Cronograma do evento</div>
                <div className='agenda-panel-subtitle'>
                  Sábado 21 é o único dia do evento, com palco principal, Arena Porto Digital e Arena Experiência organizados por horário e espaço.
                </div>
              </div>
              <button
                onClick={() => setIsAgendaPanelOpen(false)}
                className='pin-panel-close'
                title='Fechar cronograma'
              >
                x
              </button>
            </div>

            <div className='agenda-day-strip' role='tablist' aria-label='Dia do cronograma'>
              {agendaDays.map((day) => (
                <button
                  key={`agenda_day_${day.id}`}
                  onClick={() => setSelectedAgendaDay(day.id)}
                  className={`agenda-day-chip ${selectedAgendaDay === day.id ? 'active' : ''}`}
                  role='tab'
                  aria-selected={selectedAgendaDay === day.id}
                >
                  <span className='agenda-day-weekday'>{day.weekday}</span>
                  <span className='agenda-day-number'>{day.dateLabel}</span>
                </button>
              ))}
            </div>

            <div className='agenda-panel-caption'>
              {selectedAgendaDayMeta.weekday} {selectedAgendaDayMeta.dateLabel} reúne toda a programação oficial em um único dia, com paralelos organizados por horário e espaço.
            </div>

            <div className='agenda-session-list'>
              {agendaSessionsForSelectedDay.map((session) => {
                const isFavorite = favoriteAgendaIds.includes(session.id);
                const matchedPoi = getAgendaSessionPoi(session);

                return (
                  <article
                    key={session.id}
                    className='agenda-session-card'
                    style={{ '--agenda-accent': session.accent } as CSSProperties}
                    onClick={matchedPoi ? () => handleAgendaSessionFocus(session) : undefined}
                    onKeyDown={
                      matchedPoi
                        ? (event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              handleAgendaSessionFocus(session);
                            }
                          }
                        : undefined
                    }
                    role={matchedPoi ? 'button' : undefined}
                    tabIndex={matchedPoi ? 0 : undefined}
                  >
                    <div className='agenda-session-rail'>
                      <span className='agenda-session-time'>{session.startTime}</span>
                      <span className='agenda-session-time agenda-session-time-end'>{session.endTime}</span>
                    </div>

                    <div className='agenda-session-main'>
                      <div className='agenda-session-topline'>
                        <span className='agenda-session-tag'>{session.category}</span>
                        <button
                          type='button'
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleAgendaFavorite(session.id);
                          }}
                          className={`agenda-favorite-btn ${isFavorite ? 'active' : ''}`}
                          aria-pressed={isFavorite}
                          title={isFavorite ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
                        >
                          <svg viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'>
                            <path d='M12 20.2L10.6 18.9C5.6 14.3 2.4 11.4 2.4 7.8C2.4 5.2 4.4 3.2 7 3.2C8.5 3.2 9.9 3.9 10.8 5.1L12 6.6L13.2 5.1C14.1 3.9 15.5 3.2 17 3.2C19.6 3.2 21.6 5.2 21.6 7.8C21.6 11.4 18.4 14.3 13.4 18.9L12 20.2Z' />
                          </svg>
                        </button>
                      </div>

                      <div className='agenda-session-title'>{session.title}</div>
                      <div className='agenda-session-summary'>{session.summary}</div>

                      <div className='agenda-session-meta'>
                        <span className='agenda-session-meta-item'>{session.venue}</span>
                        <span className='agenda-session-meta-separator' />
                        <span className='agenda-session-meta-item'>{session.audience}</span>
                      </div>

                      <div className='agenda-speaker-row'>
                        <div className='agenda-speaker-stack'>
                          {session.speakers.map((speaker) => (
                            <span key={`${session.id}_${speaker.name}`} className='agenda-speaker-avatar' title={speaker.name}>
                              {speaker.name
                                .split(' ')
                                .slice(0, 2)
                                .map((part) => part.charAt(0))
                                .join('')}
                            </span>
                          ))}
                        </div>
                        <div className='agenda-speaker-copy'>
                          {session.speakers.map((speaker) => speaker.name).join(' • ')}
                        </div>
                      </div>

                      <div className='agenda-session-footer'>
                        <span className='agenda-session-status'>
                          {isFavorite ? 'Salvo para você' : 'Sugestão para você'}
                        </span>
                        <button
                          type='button'
                          onClick={(event) => {
                            event.stopPropagation();
                            handleAgendaSessionFocus(session);
                          }}
                          className='agenda-session-map-link'
                          disabled={!matchedPoi}
                        >
                          {matchedPoi ? 'Ver no mapa' : 'Sem local vinculado'}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}
        {false && !isAdmin && isRoutePanelOpen && (
          <div
            style={{
              position: 'fixed',
              top: dockPanelTop,
              left: '50%',
              right: 'auto',
              bottom: dockPanelBottom,
              transform: 'translateX(-50%)',
              zIndex: 3210,
              width: dockWidth,
              maxHeight: 'none',
              overflowY: 'auto',
              padding: isMobile ? 12 : 14,
            }}
            className='map-floating-panel dock-sheet-panel'
          >
            <div className='route-panel-hero'>
              <div>
                <div className='route-panel-eyebrow'>Navegação guiada</div>
                <div className='map-panel-title'>Painel de rota</div>
                <div className='route-panel-subtitle'>
                  {isMobile
                    ? 'Arraste o dock para cima, digite seu destino e deixe a origem ser sugerida automaticamente.'
                    : 'Defina origem e destino para seguir o melhor caminho durante o evento.'}
                </div>
              </div>
              <button
                onClick={() => setIsRoutePanelOpen(false)}
                className='pin-panel-close'
                title='Fechar painel de rota'
              >
                x
              </button>
            </div>

            {liveLocationCard}

            <div className='route-field-grid'>
              {!isMobile && (
                <div className='route-field-card'>
                  <label className='map-input-label route-field-label'>Origem</label>
                  <div className='route-field-input-wrap'>
                    <input
                      value={displayedOriginQuery}
                      onChange={(e) => {
                        setOriginQuery(e.target.value);
                        setSelectedOriginId('');
                        setShowOriginSuggestions(true);
                      }}
                      onFocus={() => setShowOriginSuggestions(true)}
                      onBlur={() => window.setTimeout(() => setShowOriginSuggestions(false), 120)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && originSuggestions.length > 0) {
                          e.preventDefault();
                          selectOriginPoi(originSuggestions[0]);
                        }
                      }}
                      className='map-input route-field-input'
                      disabled={hasLiveLocationFix || liveTrackingState === 'requesting'}
                      style={{ ...inputStyle, margin: 0 }}
                      placeholder='Ex.: Entrada Sul, banheiro...'
                    />
                    <span className='route-field-hint'>Onde você está agora</span>
                    {showOriginSuggestions && !hasLiveLocationFix && liveTrackingState !== 'requesting' && (
                      <div className='route-suggestions'>
                        {originSuggestions.map((poi) => (
                          <button
                            key={`origin_suggestion_${poi.id}`}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => selectOriginPoi(poi)}
                            className='route-suggestion-item'
                          >
                            <span className='route-suggestion-name'>{poi.nome}</span>
                            <span className='route-suggestion-type'>{poi.tipo.toUpperCase()}</span>
                          </button>
                        ))}
                        {originSuggestions.length === 0 && (
                          <div className='route-suggestion-empty'>Nenhuma sugestão para local atual.</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {isMobile && (
                <div className='route-auto-origin-card'>
                  <span className='route-auto-origin-label'>Origem sugerida</span>
                  <strong className='route-auto-origin-name'>
                    {autoOriginPoi?.nome || 'Será definida automaticamente pelo fluxo de entrada'}
                  </strong>
                  <span className='route-auto-origin-help'>
                    Quando o QR estiver ligado, esta origem poderá ser preenchida sem intervenção manual.
                  </span>
                </div>
              )}

              <div className='route-field-card'>
                <label className='map-input-label route-field-label'>Destino</label>
                <div className='route-field-input-wrap'>
                  <input
                    value={destinationQuery}
                    onChange={(e) => {
                      setDestinationQuery(e.target.value);
                      setSelectedDestinationId('');
                      setShowDestinationSuggestions(true);
                    }}
                    onFocus={() => setShowDestinationSuggestions(true)}
                    onBlur={() => window.setTimeout(() => setShowDestinationSuggestions(false), 120)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && destinationSuggestions.length > 0) {
                        e.preventDefault();
                        selectDestinationPoi(destinationSuggestions[0]);
                      }
                    }}
                    autoFocus={isMobile}
                    className='map-input route-field-input'
                    style={{ ...inputStyle, margin: 0 }}
                    placeholder='Ex.: Palco Principal, banheiro...'
                  />
                  <span className='route-field-hint'>Para onde você quer ir</span>
                  {showDestinationSuggestions && (
                    <div className='route-suggestions'>
                      {destinationSuggestions.map((poi) => (
                        <button
                          key={`destination_suggestion_${poi.id}`}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => selectDestinationPoi(poi)}
                          className='route-suggestion-item'
                        >
                          <span className='route-suggestion-name'>{poi.nome}</span>
                          <span className='route-suggestion-type'>{poi.tipo.toUpperCase()}</span>
                        </button>
                      ))}
                      {destinationSuggestions.length === 0 && (
                        <div className='route-suggestion-empty'>Nenhuma sugestão para destino.</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className='route-action-row'>
              <button
                onClick={handleManualRoute}
                style={{ ...actionButton }}
                className='btn btn-primary route-primary-action'
              >
                Traçar rota
              </button>
              <button onClick={clearRoute} style={{ ...actionButton }} className='btn btn-neutral route-secondary-action'>
                Limpar
              </button>
            </div>

            <div className='route-feedback-card'>
              <div className='route-feedback-title'>Resumo da navegação</div>
              <div className='route-feedback-text'>{routeMessage}</div>
            </div>

            {routeDistanceMeters > 0 && (
              <div className='route-metrics-card'>
                <div className='route-metric-item'>
                  <span className='route-metric-label'>Distância</span>
                  <span className='route-metric-value'>{formatDistanceLabel(routeDistanceMeters)}</span>
                </div>
                <div className='route-metric-item'>
                  <span className='route-metric-label'>Tempo médio</span>
                  <span className='route-metric-value'>{formatWalkingTimeLabel(routeEtaMinutes)}</span>
                </div>
                {!isPresentationMode && (
                  <div className='route-metric-item'>
                    <span className='route-metric-label'>{routeMetricLabel}</span>
                    <span className='route-metric-value'>{routeMetricValue}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!isAdmin && isTutorialOpen && (
          <div className='map-tutorial-overlay'>
            <div className='map-tutorial-card'>
              <div className='map-tutorial-progress'>
                {tutorialSteps.map((step, index) => (
                  <div
                    key={step.title}
                    className={`map-tutorial-progress-item ${index <= tutorialStepIndex ? 'active' : ''}`}
                  />
                ))}
              </div>

              <div className='tutorial-top-row'>
                <span className='tutorial-step-pill'>
                  Passo {tutorialStepIndex + 1} de {tutorialSteps.length}
                </span>
                <button onClick={closeTutorial} className='tutorial-skip-button'>
                  Pular
                </button>
              </div>
              <div className='tutorial-eyebrow'>Guia rápido</div>
              <div className='tutorial-title'>{currentTutorialStep.title}</div>
              <div className='tutorial-copy'>{currentTutorialStep.text}</div>

              <div className='tutorial-action-row'>
                {tutorialStepIndex > 0 && (
                  <button
                    onClick={() => setTutorialStepIndex((prev) => Math.max(0, prev - 1))}
                    style={{ ...actionButton }}
                    className='btn btn-neutral tutorial-back-action'
                  >
                    Voltar
                  </button>
                )}

                {tutorialStepIndex < tutorialSteps.length - 1 ? (
                  <button
                    onClick={() =>
                      setTutorialStepIndex((prev) => Math.min(tutorialSteps.length - 1, prev + 1))
                    }
                    style={{ ...actionButton }}
                    className='btn btn-primary tutorial-primary-action'
                  >
                    Próximo
                  </button>
                ) : (
                  <button
                    onClick={closeTutorial}
                    style={{ ...actionButton }}
                    className='btn btn-success tutorial-primary-action'
                  >
                    Iniciar mapa
                  </button>
                )}
              </div>
            </div>
          </div>
        )}


        {isPresentationMode && !isAdmin && (
          <>
            <button
              onClick={() => setIsAdminAccessMenuOpen((prev) => !prev)}
              style={{ top: isMobile ? 'calc(env(safe-area-inset-top, 0px) + 10px)' : 14 }}
              className='map-admin-trigger'
              title='Abrir menu de acesso admin'
            >
              Acesso
            </button>

            {isAdminAccessMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: isMobile ? 'calc(env(safe-area-inset-top, 0px) + 50px)' : 54,
                  left: 12,
                  zIndex: 1250,
                  width: isMobile ? 'min(86vw, 300px)' : 300,
                  borderRadius: 12,
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  boxShadow: 'var(--shadow-float)',
                  padding: 12,
                  display: 'grid',
                  gap: 8,
                }}
                className='map-floating-panel'
              >
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-text)' }}>Menu administrativo</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
                  Acesso rápido para abrir o modo de edição do mapa.
                </div>
                <button
                  onClick={openAdminMode}
                  style={{ ...actionButton, padding: '9px 10px' }}
                  className='btn btn-primary'
                >
                  Abrir modo administrativo
                </button>
                <button
                  onClick={() => {
                    void copyAdminModeLink();
                  }}
                  style={{ ...actionButton, padding: '9px 10px' }}
                  className='btn btn-neutral'
                >
                  {adminLinkCopied ? 'Link copiado' : 'Copiar link administrativo'}
                </button>
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--color-text-muted)',
                    borderTop: '1px dashed var(--color-border)',
                    paddingTop: 7,
                    wordBreak: 'break-all',
                  }}
                >
                  API em uso: {FRONT_API_BASE_URL}
                </div>
              </div>
            )}
          </>
        )}

        {!isPresentationMode && !isAdmin && (
          <button
            onClick={() => setIsAdmin(true)}
            style={{ top: adminTriggerTopOffset }}
            className='map-admin-trigger'
            title='Abrir painel admin'
          >
            Admin
          </button>
        )}

          <MapContainer
            center={MAP_CENTER}
            zoom={resolvedDefaultZoom}
            minZoom={MAP_MIN_ZOOM}
            maxZoom={MAP_MAX_ZOOM}
          maxBounds={undefined}
          maxBoundsViscosity={0}
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
          <TileLayer
            url={BASEMAP_TILE_URL}
            attribution={BASEMAP_TILE_ATTRIBUTION}
            className='basemap-street-layer'
            opacity={basemapOpacity}
            keepBuffer={8}
            updateWhenIdle={true}
            updateWhenZooming={false}
            updateInterval={140}
          />
          <ImageOverlay url={DEFAULT_MAP_BACKGROUND_URL} bounds={mapBackgroundBounds} opacity={1} zIndex={1} />
          <ImageOverlay url={mapOverlayUrl} bounds={mapOverlayBounds} opacity={mapOverlayOpacity} zIndex={20} />
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
          <MapEvents />
          <MapSizeSync />
          <MapController
            routeLatLngPoints={routeLatLngPoints}
            onRouteViewportSettledChange={setIsRouteViewportSettled}
          />

          {!isAdmin && liveLocation && liveLocationMarkerPosition && liveLocation.isInsideEvent && (
            <>
              <Circle
                center={liveLocationMarkerPosition}
                radius={Math.max(4, liveLocation.accuracyMeters)}
                pathOptions={{
                  color: isLiveLocationAccuracyWeak ? BRAND_COLORS.highlight : BRAND_COLORS.primary,
                  weight: 1.5,
                  opacity: 0.38,
                  fillColor: isLiveLocationAccuracyWeak ? BRAND_COLORS.highlight : BRAND_COLORS.primary,
                  fillOpacity: 0.08,
                }}
                interactive={false}
              />
              <Marker position={liveLocationMarkerPosition} icon={walkerIcon} interactive={false} zIndexOffset={1900}>
                <Tooltip permanent direction='top' offset={[0, -14]} className='route-walker-label'>
                  Você está aqui
                </Tooltip>
              </Marker>
            </>
          )}

          {routeLatLngPoints.length > 1 && (
            <>
              <Polyline
                positions={visibleRouteLatLngPoints}
                pathOptions={{
                  color: BRAND_COLORS.primarySoft,
                  weight: isMobile ? 13 : 15,
                  opacity: 0.24,
                  lineCap: 'round',
                  lineJoin: 'round',
                  className: 'route-glow-line',
                }}
              />
              <Polyline
                positions={visibleRouteLatLngPoints}
                pathOptions={{
                  color: BRAND_COLORS.primary,
                  weight: isMobile ? 7 : 8,
                  opacity: 0.95,
                  lineCap: 'round',
                  lineJoin: 'round',
                  className: 'route-main-line',
                }}
              />
              <Polyline
                positions={visibleRouteLatLngPoints}
                pathOptions={{
                  color: BRAND_COLORS.highlightSoft,
                  weight: isMobile ? 3.4 : 4,
                  opacity: 0.95,
                  dashArray: '10, 16',
                  lineCap: 'round',
                  lineJoin: 'round',
                  className: 'route-flow-line',
                }}
              />
              {isRouteViewportSettled && !isRouteRevealComplete && routeRevealHeadPoint && (
                <CircleMarker
                  center={routeRevealHeadPoint}
                  radius={isMobile ? 7 : 8}
                  interactive={false}
                  pathOptions={{
                    color: BRAND_COLORS.surface,
                    weight: 3,
                    fillColor: BRAND_COLORS.primaryStrong,
                    fillOpacity: 1,
                  }}
                />
              )}
              {!hasLiveLocationFix && routeMarkerPosition && (
                <Marker position={routeMarkerPosition} icon={walkerIcon} interactive={false} zIndexOffset={1900}>
                  <Tooltip permanent direction='top' offset={[0, -14]} className='route-walker-label'>
                    {routeRemainingEtaLabel === 'chegando'
                      ? 'Chegando ao destino'
                      : `Chegada em ~${routeRemainingEtaLabel}`}
                  </Tooltip>
                </Marker>
              )}
            </>
          )}

          {visiblePois.map((poi) => {
            const isActive = poi.id === activePoiId;
            const popupImage = poi.imagemUrl || defaultPoiImages[poi.tipo];
            const popupAccentColor = getPoiAccentColor(poi);
            const popupBadgeText = getPoiBadgeText(poi);
            const popupGallery = getPoiGalleryImages(poi);
            const popupHeroImage = popupGallery[0] ?? popupImage;
            const relatedSessions = agendaSessions
              .filter((session) => {
                if (session.linkedPoiId) return session.linkedPoiId === poi.id;
                const query = normalizeForSearch(session.mapQuery || session.venue);
                return normalizeForSearch(`${poi.nome} ${poi.descricao ?? ''} ${poi.selo ?? ''}`).includes(query);
              })
              .slice(0, 3);
            const isPopupExpanded = expandedPopupPoiId === poi.id;
            const popupDetailsId = `popup-details-${poi.id}`;
            return (
              <Marker
                key={poi.id}
                position={imageToLatLng(poi.x, poi.y)}
                icon={getMarkerIcon(poi, isActive)}
                draggable={isAdmin}
                eventHandlers={{
                  click: () => handleMarkerSelection(poi),
                  dragend: (event) => {
                    if (!isAdmin) return;
                    const marker = event.target as L.Marker;
                    const latLng = marker.getLatLng();
                    updatePoiPosition(poi.id, latLng.lat, latLng.lng);
                  },
                }}
              >
                <Popup
                  autoPan={false}
                  minWidth={popupSizePreset.minWidth}
                  maxWidth={popupSizePreset.maxWidth}
                >
                  <div
                    style={{ '--popup-accent': popupAccentColor } as CSSProperties}
                    className={`store-popup-card ${popupZoomTier} ${isMobile ? 'popup-screen-mobile' : 'popup-screen-desktop'} ${isPopupExpanded ? 'expanded' : ''}`}
                  >
                    <div className='store-popup-header'>
                      <img
                        src={popupImage}
                        alt={poi.nome}
                        loading='lazy'
                        decoding='async'
                        className='store-popup-thumb'
                      />
                      <div className='store-popup-heading'>
                        <span className='store-popup-badge'>{popupBadgeText}</span>
                        <div className='store-popup-title'>{poi.nome}</div>
                        <div className='store-popup-subtitle'>
                          {relatedSessions.length > 0 ? `${EVENT_LABEL} · ${relatedSessions.length} no cronograma` : EVENT_LABEL}
                        </div>
                      </div>
                    </div>

                    {popupGallery.length > 0 && (
                      <div className='store-popup-hero-shell'>
                        <img
                          src={popupHeroImage}
                          alt={poi.nome}
                          loading='lazy'
                          decoding='async'
                          className='store-popup-hero'
                        />
                      </div>
                    )}

                    <button
                      type='button'
                      onClick={() => setExpandedPopupPoiId((prev) => (prev === poi.id ? null : poi.id))}
                      aria-expanded={isPopupExpanded}
                      aria-controls={popupDetailsId}
                      className={`store-popup-disclosure ${isPopupExpanded ? 'expanded' : ''}`}
                    >
                      <span>{isPopupExpanded ? 'Ocultar detalhes' : 'Mais detalhes e cronograma'}</span>
                      <svg viewBox='0 0 20 20' aria-hidden='true'>
                        <path d='M5 7.5L10 12.5L15 7.5' />
                      </svg>
                    </button>

                    <div
                      id={popupDetailsId}
                      className={`store-popup-expand-panel ${isPopupExpanded ? 'expanded' : ''}`}
                    >
                      <div className='store-popup-expand-panel-inner'>
                        {(poi.descricao || poi.contato) && (
                          <div className='store-popup-copy-block'>
                            {poi.descricao && <p className='store-popup-body-copy'>{poi.descricao}</p>}
                            <div className='store-popup-meta-row'>
                              {poi.contato && <span className='store-popup-meta-chip'>{poi.contato}</span>}
                              {relatedSessions.length > 0 && (
                                <span className='store-popup-meta-chip'>{relatedSessions.length} no cronograma</span>
                              )}
                            </div>
                          </div>
                        )}

                        <div className='store-popup-agenda-block'>
                          <div className='store-popup-section-title'>Cronograma relacionado</div>

                          {relatedSessions.length > 0 ? (
                            <div className='store-popup-agenda-list'>
                              {relatedSessions.map((session) => (
                                <article key={session.id} className='store-popup-agenda-item'>
                                  <div className='store-popup-agenda-time'>
                                    {session.weekday} {session.dateLabel} · {session.startTime} - {session.endTime}
                                  </div>
                                  <div className='store-popup-agenda-name'>{session.title}</div>
                                  <div className='store-popup-agenda-venue'>{session.venue}</div>
                                </article>
                              ))}
                            </div>
                          ) : (
                            <div className='store-popup-empty-state'>
                              Este espaço ainda não tem horários vinculados no cronograma.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className='store-popup-actions'>
                      <button
                        type='button'
                        onClick={() => {
                          focusPoi(poi, false, { moveCamera: false });
                          navigateToPoi(poi);
                        }}
                        className='popup-action-btn popup-action-primary'
                      >
                        Traçar rota até aqui
                      </button>
                    </div>
                  </div>
                </Popup>

                {isActive && (
                  <Tooltip permanent direction='bottom' offset={[0, 18]} className='poi-selected-label'>
                    {poi.nome}
                  </Tooltip>
                )}
              </Marker>
            );
          })}

          {isAdmin &&
            editingPoi &&
            !editingPoi.id &&
            typeof editingPoi.x === 'number' &&
            typeof editingPoi.y === 'number' && (
              <Marker position={imageToLatLng(editingPoi.x, editingPoi.y)} icon={stateIcons.novo} />
            )}
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




          
