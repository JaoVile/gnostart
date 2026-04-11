import { useCallback, type ChangeEvent, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { CURRENT_MAP_BUILD_REGISTRATION, describeMapBuildRegistrationDifference } from './buildRegistration';
import { agendaSessions } from '../data/agenda';
import { defaultPoiImages, normalizeBadgeText, normalizeHexColor } from '../map/poiVisuals';
import { findPoiPhotoOption, getAutoAssignedPoiPhotoReference } from '../map/poiPhotos';
import type {
  AgendaSessionPoiLinkOverrides,
  EditingPoi,
  MapBuildRegistration,
  PointData,
  PoiAdminExportSnapshot,
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
  draftPoiIds: string[];
  setDraftPoiIds: Dispatch<SetStateAction<string[]>>;
  setManualVisiblePoiIds: Dispatch<SetStateAction<string[]>>;
  setPoiDataSource: Dispatch<SetStateAction<PoiDataSource>>;
  setAdminStatusMessage: Dispatch<SetStateAction<string | null>>;
  setPoiAccessCount: Dispatch<SetStateAction<PoiAccessCount>>;
  adminImportInputRef: RefObject<HTMLInputElement | null>;
  effectiveAdminAgendaPoiLinks: AgendaSessionPoiLinkOverrides;
  setAdminAgendaPoiLinks: Dispatch<SetStateAction<AgendaSessionPoiLinkOverrides>>;
  latLngToImageOverlay: (lat: number, lng: number) => { x: number; y: number };
  mapWidth: number;
  mapHeight: number;
  freeWalkNavigationEnabled: boolean;
  findNearestNodeFn: (x: number, y: number, maxDistance: number) => string | null;
  parseStoredPoiImport: (
    value: unknown,
  ) => {
    pois: PointData[];
    draftPoiIds: string[];
    build: MapBuildRegistration | null;
  };
  loadPoiRuntimeBackup: () => PointData[];
  getFrontSeedPois: () => PointData[];
  clearAdminWorkspaceSnapshot: () => void;
  eventName: string;
  exportFileName: string;
  currentMapBuildLabel: string;
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
  draftPoiIds,
  setDraftPoiIds,
  setManualVisiblePoiIds,
  setPoiDataSource,
  setAdminStatusMessage,
  setPoiAccessCount,
  adminImportInputRef,
  effectiveAdminAgendaPoiLinks,
  setAdminAgendaPoiLinks,
  latLngToImageOverlay,
  mapWidth,
  mapHeight,
  freeWalkNavigationEnabled,
  findNearestNodeFn,
  parseStoredPoiImport,
  loadPoiRuntimeBackup,
  getFrontSeedPois,
  clearAdminWorkspaceSnapshot,
  eventName,
  exportFileName,
  currentMapBuildLabel,
}: UsePoiAdminOptions) => {
  const clampMapCoordinate = useCallback(
    (value: number, axis: 'x' | 'y') => {
      const maxValue = axis === 'x' ? mapWidth : mapHeight;
      return Math.max(0, Math.min(maxValue, Math.round(value)));
    },
    [mapHeight, mapWidth],
  );

  const resolveNodeId = useCallback(
    (x: number, y: number) => (freeWalkNavigationEnabled ? undefined : findNearestNodeFn(x, y, 90) ?? undefined),
    [findNearestNodeFn, freeWalkNavigationEnabled],
  );

  const normalizePoiForExport = useCallback((poi: PointData): PointData => {
    const imagemUrl = getAutoAssignedPoiPhotoReference(poi.id, poi.nome, poi.imagemUrl);
    return imagemUrl && imagemUrl !== poi.imagemUrl ? { ...poi, imagemUrl } : poi;
  }, []);

  const applyExistingPoiPosition = useCallback(
    (poiId: string, nextX: number, nextY: number) => {
      const nearestNode = resolveNodeId(nextX, nextY);

      setPois((prev) =>
        prev.map((poi) =>
          poi.id === poiId
            ? {
                ...poi,
                x: nextX,
                y: nextY,
                nodeId: nearestNode,
              }
            : poi,
        ),
      );

      setDraftPoiIds((prev) => (prev.includes(poiId) ? prev : [...prev, poiId]));
      setPoiDataSource('local-workspace');

      if (activePoiId === poiId) {
        setFocusPoint((prev) =>
          prev?.id === poiId
            ? {
                ...prev,
                x: nextX,
                y: nextY,
                nodeId: nearestNode,
              }
            : prev,
        );
      }

      return nearestNode;
    },
    [activePoiId, resolveNodeId, setDraftPoiIds, setFocusPoint, setPoiDataSource, setPois],
  );

  const updatePoiPosition = useCallback(
    (poiId: string, lat: number, lng: number) => {
      if (!isAdmin) return;

      const mapped = latLngToImageOverlay(lat, lng);
      const nextX = clampMapCoordinate(mapped.x, 'x');
      const nextY = clampMapCoordinate(mapped.y, 'y');
      const nearestNode = applyExistingPoiPosition(poiId, nextX, nextY);

      setEditingPoi((prev) =>
        prev?.id === poiId
          ? {
              ...prev,
              x: nextX,
              y: nextY,
              nodeId: nearestNode,
            }
          : prev,
      );
      setAdminStatusMessage('Posicao atualizada na edicao local.');
    },
    [
      applyExistingPoiPosition,
      clampMapCoordinate,
      isAdmin,
      latLngToImageOverlay,
      setAdminStatusMessage,
      setEditingPoi,
    ],
  );

  const updateEditingPoiCoordinates = useCallback(
    (x: number, y: number) => {
      if (!editingPoi) return;

      const nextX = clampMapCoordinate(x, 'x');
      const nextY = clampMapCoordinate(y, 'y');

      if (editingPoi.id) {
        const nearestNode = applyExistingPoiPosition(editingPoi.id, nextX, nextY);
        setEditingPoi((current) =>
          current
            ? {
                ...current,
                x: nextX,
                y: nextY,
                nodeId: nearestNode,
              }
            : current,
        );
        setAdminStatusMessage('Posicao ajustada com coordenadas na edicao local.');
        return;
      }

      setEditingPoi((current) =>
        current
          ? {
              ...current,
              x: nextX,
              y: nextY,
              nodeId: resolveNodeId(nextX, nextY),
            }
          : current,
      );
      setAdminStatusMessage('Posicao do novo ponto ajustada no rascunho atual.');
    },
    [applyExistingPoiPosition, clampMapCoordinate, editingPoi, resolveNodeId, setAdminStatusMessage, setEditingPoi],
  );

  const salvarLocalizacaoAtual = useCallback(() => {
    if (!editingPoi) return;

    if (typeof editingPoi.x !== 'number' || typeof editingPoi.y !== 'number') {
      window.alert('Coordenadas invalidas para salvar a localizacao deste ponto.');
      return;
    }

    const nextX = clampMapCoordinate(editingPoi.x, 'x');
    const nextY = clampMapCoordinate(editingPoi.y, 'y');
    const nextNodeId = resolveNodeId(nextX, nextY);
    const nextImageUrl = getAutoAssignedPoiPhotoReference(editingPoi.id, editingPoi.nome, editingPoi.imagemUrl);

    if (!editingPoi.id) {
      setEditingPoi((current) =>
        current
          ? {
              ...current,
              x: nextX,
              y: nextY,
              nodeId: nextNodeId,
              imagemUrl: nextImageUrl ?? current.imagemUrl,
            }
          : current,
      );
      setAdminStatusMessage('Localizacao registrada no editor. Agora salve o rascunho para incluir este novo ponto no arquivo.');
      return;
    }

    applyExistingPoiPosition(editingPoi.id, nextX, nextY);
    setEditingPoi((current) => {
      if (!current || current.id !== editingPoi.id) return current;

      return {
        ...current,
        x: nextX,
        y: nextY,
        nodeId: nextNodeId,
        imagemUrl: nextImageUrl ?? current.imagemUrl,
      };
    });
    setFocusPoint((current) => {
      if (!current || current.id !== editingPoi.id) return current;

      return {
        ...current,
        x: nextX,
        y: nextY,
        nodeId: nextNodeId,
        imagemUrl: nextImageUrl ?? current.imagemUrl,
      };
    });
    setAdminStatusMessage(
      `Localizacao salva no workspace para ${editingPoi.nome?.trim() || editingPoi.id}. Baixe o JSON ou copie o log quando quiser.`,
    );
  }, [
    editingPoi,
    clampMapCoordinate,
    resolveNodeId,
    setEditingPoi,
    setAdminStatusMessage,
    applyExistingPoiPosition,
    setFocusPoint,
  ]);

  const handleAdminMapPointPick = useCallback(
    (point: { x: number; y: number }) => {
      const nextX = clampMapCoordinate(point.x, 'x');
      const nextY = clampMapCoordinate(point.y, 'y');

      if (editingPoi) {
        updateEditingPoiCoordinates(nextX, nextY);
        return;
      }

      setEditingPoi({
        nome: '',
        tipo: 'atividade',
        x: nextX,
        y: nextY,
        descricao: '',
        imagemUrl: defaultPoiImages.atividade,
        contato: '',
        corDestaque: '',
        selo: '',
        nodeId: resolveNodeId(nextX, nextY),
      });
      setAdminStatusMessage('Novo ponto criado na posicao clicada. Complete os dados e salve quando quiser.');
    },
    [clampMapCoordinate, editingPoi, resolveNodeId, setAdminStatusMessage, setEditingPoi, updateEditingPoiCoordinates],
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
      nodeId: resolveNodeId(fallbackX, fallbackY),
    });
    setAdminStatusMessage('Novo ponto pronto para edicao. Clique no mapa para reposicionar se precisar.');
  }, [focusPoint, mapHeight, mapWidth, resolveNodeId, setAdminStatusMessage, setEditingPoi]);

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

    const nearestNode = resolveNodeId(currentEditingPoi.x, currentEditingPoi.y);
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

    const resolvedPoiId = currentEditingPoi.id || `${baseId || 'ponto'}_${Date.now()}`;
    const resolvedImageUrl =
      getAutoAssignedPoiPhotoReference(
        resolvedPoiId,
        currentEditingPoi.nome.trim(),
        currentEditingPoi.imagemUrl?.trim() || defaultPoiImages[currentEditingPoi.tipo],
      ) ?? defaultPoiImages[currentEditingPoi.tipo];

    return {
      id: resolvedPoiId,
      x: currentEditingPoi.x,
      y: currentEditingPoi.y,
      nome: currentEditingPoi.nome.trim(),
      tipo: currentEditingPoi.tipo,
      descricao: currentEditingPoi.descricao?.trim() || undefined,
      imagemUrl: resolvedImageUrl,
      contato: normalizeContact(currentEditingPoi.contato) || undefined,
      corDestaque: normalizeHexColor(currentEditingPoi.corDestaque),
      selo: normalizeBadgeText(currentEditingPoi.selo),
      nodeId: nearestNode,
    } satisfies PointData;
  }, [editingPoi, freeWalkNavigationEnabled, resolveNodeId]);

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

  const salvarPonto = useCallback(() => {
    salvarRascunhoPonto();
  }, [salvarRascunhoPonto]);

  const deletarPonto = useCallback((id: string) => {
    if (!window.confirm('Apagar este ponto definitivamente?')) return;

    setPois((prev) => prev.filter((poi) => poi.id !== id));
    setDraftPoiIds((prev) => prev.filter((poiId) => poiId !== id));
    setPoiAccessCount((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setManualVisiblePoiIds((prev) => prev.filter((poiId) => poiId !== id));
    setPoiDataSource('local-workspace');
    if (activePoiId === id) setActivePoiId(null);
    if (selectedDestinationId === id) {
      clearRoute();
    }
    setEditingPoi(null);
    setAdminStatusMessage('Ponto removido da edicao local.');
  }, [
    activePoiId,
    clearRoute,
    selectedDestinationId,
    setActivePoiId,
    setAdminStatusMessage,
    setDraftPoiIds,
    setEditingPoi,
    setManualVisiblePoiIds,
    setPoiAccessCount,
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
        const importedSnapshot = parseStoredPoiImport(parsed);
        const importedPois = importedSnapshot.pois;

        if (importedPois.length === 0) {
          window.alert('O arquivo JSON nao possui pontos validos.');
          return;
        }

        setPois(importedPois);
        setDraftPoiIds(
          importedSnapshot.draftPoiIds.length > 0 ? importedSnapshot.draftPoiIds : importedPois.map((poi) => poi.id),
        );
        setPoiDataSource('local-workspace');
        setEditingPoi(importedPois[0]);
        setFocusPoint(importedPois[0]);
        setActivePoiId(importedPois[0].id);
        clearRoute();
        const buildMessage = describeMapBuildRegistrationDifference(importedSnapshot.build, CURRENT_MAP_BUILD_REGISTRATION);
        setAdminStatusMessage(
          buildMessage
            ? `${importedPois.length} ponto(s) importados para a edicao local. ${buildMessage}`
            : `${importedPois.length} ponto(s) importados para a edicao local na build atual (${currentMapBuildLabel}).`,
        );
      } catch (error) {
        console.error('Falha ao importar JSON de pontos:', error);
        window.alert('Nao foi possivel importar este arquivo JSON.');
      }
    },
    [
      clearRoute,
      currentMapBuildLabel,
      parseStoredPoiImport,
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
    if (!window.confirm('Descartar a edicao local e voltar para a base?')) return;

    setDraftPoiIds([]);
    setEditingPoi(null);
    clearAdminWorkspaceSnapshot();

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
    setAdminStatusMessage,
    setDraftPoiIds,
    setEditingPoi,
    setPoiDataSource,
    setPois,
  ]);

  const toggleManualVisibility = useCallback((poiId: string) => {
    setManualVisiblePoiIds((prev) =>
      prev.includes(poiId) ? prev.filter((id) => id !== poiId) : [...prev, poiId],
    );
  }, [setManualVisiblePoiIds]);

  const baixarJson = useCallback(() => {
    const exportedPois = pois.map(normalizePoiForExport);
    const payload: PoiAdminExportSnapshot = {
      version: 7,
      eventName,
      updatedAt: new Date().toISOString(),
      draftPoiIds,
      pois: exportedPois,
      build: CURRENT_MAP_BUILD_REGISTRATION,
    };
    const payloadText = JSON.stringify(payload, null, 2);
    const dataStr = `data:text/json;charset=utf-8,${encodeURIComponent(payloadText)}`;
    const link = document.createElement('a');
    link.setAttribute('href', dataStr);
    link.setAttribute('download', exportFileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setAdminStatusMessage(`JSON baixado com registro da build atual (${currentMapBuildLabel}).`);
  }, [currentMapBuildLabel, draftPoiIds, eventName, exportFileName, normalizePoiForExport, pois, setAdminStatusMessage]);

  const buildAdminTextLog = useCallback(() => {
    const exportedPois = pois.map(normalizePoiForExport);
    const lines = [
      `Evento: ${eventName}`,
      `Gerado em: ${new Date().toISOString()}`,
      `Build: ${currentMapBuildLabel}`,
      `Total de pontos: ${exportedPois.length}`,
      `Rascunhos locais: ${draftPoiIds.length}`,
      '',
      'ESPACOS',
      '',
    ];

    exportedPois.forEach((poi, index) => {
      const photoOption = findPoiPhotoOption(poi.imagemUrl);
      const photoLabel = photoOption?.fileName ?? poi.imagemUrl?.trim() ?? 'SEM FOTO';
      const statusLabel = draftPoiIds.includes(poi.id) ? 'RASCUNHO' : 'OK';

      lines.push(
        `${index + 1}. ${poi.nome}`,
        `id: ${poi.id}`,
        `tipo: ${poi.tipo}`,
        `x: ${Math.round(poi.x)} | y: ${Math.round(poi.y)} | node: ${poi.nodeId ?? (freeWalkNavigationEnabled ? 'livre' : 'sem conexao')}`,
        `foto: ${photoLabel}`,
        `imagemUrl: ${poi.imagemUrl ?? 'SEM FOTO'}`,
        `selo: ${poi.selo ?? '-'}`,
        `contato: ${poi.contato ?? '-'}`,
        `status: ${statusLabel}`,
        `descricao: ${poi.descricao ?? '-'}`,
        '',
      );
    });

    return lines.join('\n');
  }, [currentMapBuildLabel, draftPoiIds, eventName, freeWalkNavigationEnabled, normalizePoiForExport, pois]);

  const baixarLogCompleto = useCallback(() => {
    const logText = buildAdminTextLog();
    const dataStr = `data:text/plain;charset=utf-8,${encodeURIComponent(logText)}`;
    const fileName = exportFileName.replace(/\.json$/i, '_log.txt');
    const link = document.createElement('a');
    link.setAttribute('href', dataStr);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setAdminStatusMessage('Log completo dos espacos baixado com sucesso.');
  }, [buildAdminTextLog, exportFileName, setAdminStatusMessage]);

  const copiarLogCompleto = useCallback(async () => {
    const logText = buildAdminTextLog();

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(logText);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = logText;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
      }
      setAdminStatusMessage('Log completo copiado. Agora voce pode me enviar o texto direto.');
    } catch (error) {
      console.error('Falha ao copiar log completo do admin:', error);
      window.alert('Nao foi possivel copiar o log automaticamente. Use o botao de baixar log.');
    }
  }, [buildAdminTextLog, setAdminStatusMessage]);

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
      setAdminStatusMessage(
        nextPoiId && nextPoiId !== session.linkedPoiId
          ? 'Vinculo manual do cronograma salvo localmente.'
          : 'Cronograma voltou a usar o vinculo automatico deste horario.',
      );
    },
    [effectiveAdminAgendaPoiLinks, setAdminAgendaPoiLinks, setAdminStatusMessage],
  );

  const handleResetAdminAgendaPoiLinks = useCallback(() => {
    setAdminAgendaPoiLinks({});
    setAdminStatusMessage('Todos os vinculos manuais do cronograma foram removidos.');
  }, [setAdminAgendaPoiLinks, setAdminStatusMessage]);

  return {
    updatePoiPosition,
    salvarLocalizacaoAtual,
    startNewPoiDraft,
    salvarRascunhoPonto,
    abrirImportadorJson,
    handleAdminMapPointPick,
    handleAdminImportFileChange,
    restaurarFontePrincipal,
    salvarPonto,
    deletarPonto,
    toggleManualVisibility,
    baixarJson,
    baixarLogCompleto,
    copiarLogCompleto,
    updateEditingPoiCoordinates,
    handleSetAdminAgendaPoiLink,
    handleResetAdminAgendaPoiLinks,
  };
};
