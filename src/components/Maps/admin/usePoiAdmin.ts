import { useCallback, type ChangeEvent, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { createPoi, deletePoi, saveAgendaPoiLinks, updatePoi, type MapPoiDto, type UpsertPoiPayload } from '../../../services/mapApi';
import { agendaSessions } from '../data/agenda';
import { defaultPoiImages, normalizeBadgeText, normalizeHexColor } from '../map/poiVisuals';
import type {
  AgendaSessionPoiLinkOverrides,
  EditingPoi,
  PointData,
  PoiAccessCount,
  PoiDataSource,
} from '../types';
import { normalizeContact, upsertPoiInCollection } from '../utils/poiMatching';

type UsePoiAdminOptions = {
  isAdmin: boolean;
  editingPoi: EditingPoi | null;
  setEditingPoi: Dispatch<SetStateAction<EditingPoi | null>>;
  focusPoint: PointData | null;
  setFocusPoint: Dispatch<SetStateAction<PointData | null>>;
  activePoiId: string | null;
  setActivePoiId: Dispatch<SetStateAction<string | null>>;
  selectedDestinationId: string;
  clearRoute: () => void;
  pois: PointData[];
  setPois: Dispatch<SetStateAction<PointData[]>>;
  serverPois: PointData[];
  setServerPois: Dispatch<SetStateAction<PointData[]>>;
  draftPoiIds: string[];
  setDraftPoiIds: Dispatch<SetStateAction<string[]>>;
  setManualVisiblePoiIds: Dispatch<SetStateAction<string[]>>;
  setPoiDataSource: Dispatch<SetStateAction<PoiDataSource>>;
  setAdminStatusMessage: Dispatch<SetStateAction<string | null>>;
  setBackendSyncState: Dispatch<SetStateAction<'loading' | 'ready' | 'error'>>;
  setPoiAccessCount: Dispatch<SetStateAction<PoiAccessCount>>;
  adminImportInputRef: RefObject<HTMLInputElement | null>;
  effectiveAdminAgendaPoiLinks: AgendaSessionPoiLinkOverrides;
  setAdminAgendaPoiLinks: Dispatch<SetStateAction<AgendaSessionPoiLinkOverrides>>;
  latLngToImageOverlay: (lat: number, lng: number) => { x: number; y: number };
  mapWidth: number;
  mapHeight: number;
  freeWalkNavigationEnabled: boolean;
  findNearestNodeFn: (x: number, y: number, maxDistance: number) => string | null;
  parseStoredPoiList: (value: unknown) => PointData[];
  loadPoiRuntimeBackup: () => PointData[];
  getFrontSeedPois: () => PointData[];
  clearAdminWorkspaceSnapshot: () => void;
  sanitizeAgendaPoiLinkRecord: (value: unknown) => AgendaSessionPoiLinkOverrides;
  fromApiPoi: (poi: MapPoiDto) => PointData;
  toPoiApiPayload: (
    poi: PointData,
    options?: {
      includeId?: boolean;
    },
  ) => UpsertPoiPayload;
};

export const usePoiAdmin = ({
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
  mapWidth,
  mapHeight,
  freeWalkNavigationEnabled,
  findNearestNodeFn,
  parseStoredPoiList,
  loadPoiRuntimeBackup,
  getFrontSeedPois,
  clearAdminWorkspaceSnapshot,
  sanitizeAgendaPoiLinkRecord,
  fromApiPoi,
  toPoiApiPayload,
}: UsePoiAdminOptions) => {
  const updatePoiPosition = useCallback(
    (poiId: string, lat: number, lng: number) => {
      if (!isAdmin) return;

      const mapped = latLngToImageOverlay(lat, lng);
      const nextX = Math.round(mapped.x);
      const nextY = Math.round(mapped.y);
      const nearestNode = freeWalkNavigationEnabled ? null : findNearestNodeFn(nextX, nextY, 90);

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
      setAdminStatusMessage('Posicao atualizada na edicao local. Publique quando quiser enviar ao servidor.');

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
    },
    [
      activePoiId,
      findNearestNodeFn,
      freeWalkNavigationEnabled,
      isAdmin,
      latLngToImageOverlay,
      setAdminStatusMessage,
      setDraftPoiIds,
      setEditingPoi,
      setFocusPoint,
      setPoiDataSource,
      setPois,
    ],
  );

  const startNewPoiDraft = useCallback(() => {
    const fallbackX = focusPoint?.x ?? Math.round(mapWidth / 2);
    const fallbackY = focusPoint?.y ?? Math.round(mapHeight / 2);
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
      nodeId: freeWalkNavigationEnabled ? undefined : findNearestNodeFn(fallbackX, fallbackY, 90) ?? undefined,
    });
    setAdminStatusMessage('Novo ponto pronto para edicao. Clique no mapa para reposicionar se precisar.');
  }, [findNearestNodeFn, focusPoint, freeWalkNavigationEnabled, mapHeight, mapWidth, setAdminStatusMessage, setEditingPoi]);

  const buildPoiFromEditingState = useCallback(() => {
    const currentEditingPoi = editingPoi;

    if (!currentEditingPoi || !currentEditingPoi.nome || !currentEditingPoi.tipo) {
      window.alert('Informe nome e tipo do ponto.');
      return null;
    }

    if (typeof currentEditingPoi.x !== 'number' || typeof currentEditingPoi.y !== 'number') {
      window.alert('Coordenadas invalidas para o ponto.');
      return null;
    }

    const nearestNode = freeWalkNavigationEnabled ? null : findNearestNodeFn(currentEditingPoi.x, currentEditingPoi.y, 90);
    if (!freeWalkNavigationEnabled && !nearestNode) {
      window.alert('Este ponto esta longe dos corredores de rota. Marque mais perto de um caminho.');
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
  }, [editingPoi, findNearestNodeFn, freeWalkNavigationEnabled]);

  const salvarRascunhoPonto = useCallback(() => {
    const novoPonto = buildPoiFromEditingState();
    if (!novoPonto) return;

    setPois((prev) => upsertPoiInCollection(prev, novoPonto));
    setDraftPoiIds((prev) => (prev.includes(novoPonto.id) ? prev : [...prev, novoPonto.id]));
    setPoiDataSource('local-workspace');
    setEditingPoi(novoPonto);
    setFocusPoint(novoPonto);
    setActivePoiId(novoPonto.id);
    setAdminStatusMessage(`Rascunho salvo localmente para ${novoPonto.nome}.`);
  }, [
    buildPoiFromEditingState,
    setActivePoiId,
    setAdminStatusMessage,
    setDraftPoiIds,
    setEditingPoi,
    setFocusPoint,
    setPoiDataSource,
    setPois,
  ]);

  const publishPoiToBackend = useCallback(
    async (poi: PointData, currentServerPois = serverPois) => {
      const existsOnBackend = currentServerPois.some((item) => item.id === poi.id);
      const syncedPoi = existsOnBackend
        ? await updatePoi(poi.id, toPoiApiPayload(poi))
        : await createPoi(toPoiApiPayload(poi, { includeId: true }));

      return fromApiPoi(syncedPoi);
    },
    [fromApiPoi, serverPois, toPoiApiPayload],
  );

  const publicarPontoAtual = useCallback(async () => {
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
      window.alert('Nao foi possivel publicar o ponto no servidor. Confira a API e a ADMIN_API_KEY.');
      setBackendSyncState('error');
    }
  }, [
    buildPoiFromEditingState,
    publishPoiToBackend,
    setActivePoiId,
    setAdminStatusMessage,
    setBackendSyncState,
    setDraftPoiIds,
    setEditingPoi,
    setFocusPoint,
    setPois,
    setServerPois,
  ]);

  const publicarRascunhos = useCallback(async () => {
    if (draftPoiIds.length === 0) {
      setAdminStatusMessage('Nao ha rascunhos pendentes para publicar.');
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
  }, [draftPoiIds, pois, publishPoiToBackend, serverPois, setAdminStatusMessage, setBackendSyncState, setDraftPoiIds, setPois, setServerPois]);

  const removerPontoLocal = useCallback((id: string) => {
    if (!window.confirm('Remover este ponto apenas da edicao local?')) return;

    setPois((prev) => prev.filter((poi) => poi.id !== id));
    setDraftPoiIds((prev) => prev.filter((poiId) => poiId !== id));
    setManualVisiblePoiIds((prev) => prev.filter((poiId) => poiId !== id));
    setPoiDataSource('local-workspace');
    setFocusPoint((prev) => (prev?.id === id ? null : prev));
    setEditingPoi((prev) => (prev?.id === id ? null : prev));
    if (activePoiId === id) setActivePoiId(null);
    if (selectedDestinationId === id) {
      clearRoute();
    }
    setAdminStatusMessage('Ponto removido apenas da edicao local.');
  }, [
    activePoiId,
    clearRoute,
    selectedDestinationId,
    setActivePoiId,
    setAdminStatusMessage,
    setDraftPoiIds,
    setEditingPoi,
    setFocusPoint,
    setManualVisiblePoiIds,
    setPoiDataSource,
    setPois,
  ]);

  const abrirImportadorJson = useCallback(() => {
    adminImportInputRef.current?.click();
  }, [adminImportInputRef]);

  const handleAdminImportFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;

      try {
        const content = await file.text();
        const parsed = JSON.parse(content) as unknown;
        const importedPois = parseStoredPoiList(parsed);

        if (importedPois.length === 0) {
          window.alert('O arquivo JSON nao possui pontos validos.');
          return;
        }

        setPois(importedPois);
        setDraftPoiIds(importedPois.map((poi) => poi.id));
        setPoiDataSource('local-workspace');
        setEditingPoi(importedPois[0]);
        setFocusPoint(importedPois[0]);
        setActivePoiId(importedPois[0].id);
        clearRoute();
        setAdminStatusMessage(`${importedPois.length} ponto(s) importados para a edicao local.`);
      } catch (error) {
        console.error('Falha ao importar JSON de pontos:', error);
        window.alert('Nao foi possivel importar este arquivo JSON.');
      }
    },
    [
      clearRoute,
      parseStoredPoiList,
      setActivePoiId,
      setAdminStatusMessage,
      setDraftPoiIds,
      setEditingPoi,
      setFocusPoint,
      setPoiDataSource,
      setPois,
    ],
  );

  const restaurarFontePrincipal = useCallback(() => {
    if (!window.confirm('Descartar a edicao local e voltar para a fonte principal?')) return;

    setDraftPoiIds([]);
    setEditingPoi(null);
    clearAdminWorkspaceSnapshot();

    if (serverPois.length > 0) {
      setPois(serverPois);
      setPoiDataSource('backend');
      setAdminStatusMessage('Edicao local descartada. Voltamos aos dados do servidor.');
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
    setAdminStatusMessage('Base de trabalho descartada. Voltamos ao conjunto local padrao.');
  }, [
    clearAdminWorkspaceSnapshot,
    getFrontSeedPois,
    loadPoiRuntimeBackup,
    serverPois,
    setAdminStatusMessage,
    setDraftPoiIds,
    setEditingPoi,
    setPoiDataSource,
    setPois,
  ]);

  const salvarPonto = useCallback(async () => {
    await publicarPontoAtual();
  }, [publicarPontoAtual]);

  const deletarPonto = useCallback(async (id: string) => {
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
      window.alert('Nao foi possivel excluir o ponto no servidor. Confira a API e a ADMIN_API_KEY.');
    }
  }, [
    activePoiId,
    clearRoute,
    selectedDestinationId,
    setActivePoiId,
    setAdminStatusMessage,
    setBackendSyncState,
    setDraftPoiIds,
    setEditingPoi,
    setManualVisiblePoiIds,
    setPoiAccessCount,
    setPois,
    setServerPois,
  ]);

  const toggleManualVisibility = useCallback((poiId: string) => {
    setManualVisiblePoiIds((prev) =>
      prev.includes(poiId) ? prev.filter((id) => id !== poiId) : [...prev, poiId],
    );
  }, [setManualVisiblePoiIds]);

  const baixarJson = useCallback(() => {
    const payload = JSON.stringify(pois, null, 2);
    const dataStr = `data:text/json;charset=utf-8,${encodeURIComponent(payload)}`;
    const link = document.createElement('a');
    link.setAttribute('href', dataStr);
    link.setAttribute('download', 'locais_evento_social.json');
    document.body.appendChild(link);
    link.click();
    link.remove();
  }, [pois]);

  const handleSetAdminAgendaPoiLink = useCallback(
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
    [effectiveAdminAgendaPoiLinks, sanitizeAgendaPoiLinkRecord, setAdminAgendaPoiLinks, setAdminStatusMessage],
  );

  const handleResetAdminAgendaPoiLinks = useCallback(() => {
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
  }, [sanitizeAgendaPoiLinkRecord, setAdminAgendaPoiLinks, setAdminStatusMessage]);

  return {
    updatePoiPosition,
    startNewPoiDraft,
    salvarRascunhoPonto,
    publicarPontoAtual,
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
  };
};
