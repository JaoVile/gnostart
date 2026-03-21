import type { AgendaSession, AgendaSessionPoiLinkOverrides, PointData } from '../types';

const poiSearchAliasMap: Record<string, string[]> = {};

export const normalizeContact = (value?: string) => value?.trim() ?? '';

export const normalizeForSearch = (value?: string) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');

export const buildSearchTerms = (...values: Array<string | undefined>) =>
  Array.from(new Set(values.map((value) => normalizeForSearch(value)).filter((value) => value.length > 0)));

export const getPoiSearchTerms = (poi: PointData) =>
  buildSearchTerms(poi.id, poi.nome, poi.descricao, poi.selo, ...(poiSearchAliasMap[poi.id] ?? []));

export const searchTermsMatch = (left: string, right: string) =>
  left === right || left.includes(right) || right.includes(left);

export const resolveSessionPoiLinkId = (
  session: AgendaSession,
  overrides?: AgendaSessionPoiLinkOverrides,
) => overrides?.[session.id] ?? null;

export const sessionMatchesPoi = (
  session: AgendaSession,
  poi: PointData,
  overrides?: AgendaSessionPoiLinkOverrides,
) => {
  const resolvedLinkedPoiId = resolveSessionPoiLinkId(session, overrides);
  if (resolvedLinkedPoiId) {
    return resolvedLinkedPoiId === poi.id;
  }

  const sessionTerms = buildSearchTerms(session.mapQuery, session.venue);
  if (sessionTerms.length === 0) return false;

  const poiTerms = getPoiSearchTerms(poi);
  return sessionTerms.some((sessionTerm) => poiTerms.some((poiTerm) => searchTermsMatch(sessionTerm, poiTerm)));
};

export const resolveAgendaSessionPoi = (
  session: AgendaSession,
  poiList: PointData[],
  overrides?: AgendaSessionPoiLinkOverrides,
) => poiList.find((poi) => sessionMatchesPoi(session, poi, overrides)) ?? null;

export const upsertPoiInCollection = <T extends { id: string }>(collection: T[], nextPoi: T) => {
  const index = collection.findIndex((item) => item.id === nextPoi.id);
  if (index === -1) return [...collection, nextPoi];

  const nextCollection = [...collection];
  nextCollection[index] = nextPoi;
  return nextCollection;
};
