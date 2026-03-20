import type { AgendaSession, AgendaSessionPoiLinkOverrides, PointData, PoiType } from '../types';

export const upsertPoiInCollection = (collection: PointData[], nextPoi: PointData) => {
  const existingIndex = collection.findIndex((poi) => poi.id === nextPoi.id);
  if (existingIndex === -1) return [...collection, nextPoi];

  const nextCollection = [...collection];
  nextCollection[existingIndex] = nextPoi;
  return nextCollection;
};

export const normalizeContact = (value?: string) => value?.trim() ?? '';

export const normalizeForSearch = (value?: string) =>
  value
    ?.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim() ?? '';

export const isPoiType = (value: unknown): value is PoiType =>
  value === 'atividade' || value === 'servico' || value === 'banheiro' || value === 'entrada';

const buildSearchTerms = (...values: Array<string | undefined>) =>
  values.map((value) => normalizeForSearch(value)).filter(Boolean);

export const getPoiSearchTerms = (poi: PointData) =>
  buildSearchTerms(poi.id, poi.nome, poi.tipo, poi.descricao, poi.contato, poi.selo);

const searchTermsMatch = (left: string, right: string) => left === right || left.includes(right) || right.includes(left);

export const resolveSessionPoiLinkId = (
  session: AgendaSession,
  overrides?: AgendaSessionPoiLinkOverrides,
) => overrides?.[session.id] ?? session.linkedPoiId ?? null;

const sessionMatchesPoi = (session: AgendaSession, poi: PointData, overrides?: AgendaSessionPoiLinkOverrides) => {
  const resolvedLinkedPoiId = resolveSessionPoiLinkId(session, overrides);
  if (resolvedLinkedPoiId) return resolvedLinkedPoiId === poi.id;

  const queryTerms = buildSearchTerms(session.title, session.venue, session.mapQuery);
  const poiTerms = getPoiSearchTerms(poi);

  return queryTerms.some((sessionTerm) => poiTerms.some((poiTerm) => searchTermsMatch(sessionTerm, poiTerm)));
};

export const resolveAgendaSessionPoi = (
  session: AgendaSession,
  poiList: PointData[],
  overrides?: AgendaSessionPoiLinkOverrides,
) => poiList.find((poi) => sessionMatchesPoi(session, poi, overrides)) ?? null;
