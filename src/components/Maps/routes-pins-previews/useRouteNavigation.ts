import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import { buildDirectPath, findPath } from '../../../utils/pathfinding';
import type { LiveLocationState, LiveTrackingState, ManualRouteOrigin, PointData } from '../types';

type UseRouteNavigationOptions = {
  pois: PointData[];
  selectedOriginId: string;
  setSelectedOriginId: Dispatch<SetStateAction<string>>;
  manualMapOrigin: ManualRouteOrigin | null;
  setManualMapOrigin: Dispatch<SetStateAction<ManualRouteOrigin | null>>;
  setOriginQuery: Dispatch<SetStateAction<string>>;
  setShowOriginSuggestions: Dispatch<SetStateAction<boolean>>;
  selectedDestinationId: string;
  setSelectedDestinationId: Dispatch<SetStateAction<string>>;
  setDestinationQuery: Dispatch<SetStateAction<string>>;
  setShowDestinationSuggestions: Dispatch<SetStateAction<boolean>>;
  setRota: Dispatch<SetStateAction<number[][] | null>>;
  setIsRouteViewportSettled: Dispatch<SetStateAction<boolean>>;
  setShouldAnimateRouteReveal: Dispatch<SetStateAction<boolean>>;
  setRouteRevealProgress: Dispatch<SetStateAction<number>>;
  setRouteMessage: Dispatch<SetStateAction<string>>;
  setWalkerPosition: Dispatch<SetStateAction<[number, number] | null>>;
  setWalkerProgress: Dispatch<SetStateAction<number>>;
  lastLiveRouteKeyRef: MutableRefObject<string>;
  lastAnimatedLiveRouteDestinationRef: MutableRefObject<string | null>;
  routeRevealFrameRef: MutableRefObject<number | null>;
  walkerTimerRef: MutableRefObject<number | null>;
  getPoiById: (id: string) => PointData | undefined;
  imageToLatLng: (x: number, y: number) => [number, number];
  getPathDistanceMeters: (positions: [number, number][]) => number;
  formatDistanceLabel: (meters: number) => string;
  formatWalkingTimeLabel: (minutes: number) => string;
  getImagePointDistance: (from: { x: number; y: number }, to: { x: number; y: number }) => number;
  liveLocation: LiveLocationState | null;
  liveTrackingState: LiveTrackingState;
  hasLiveLocationFix: boolean;
  requireManualOriginConfirmation: boolean;
  liveLocationOriginLabel: string;
  startLiveLocationTracking: () => Promise<void> | void;
  onPlayRouteSound: () => void;
  onNavigateToPoiStart?: () => void;
  routeLatLngPoints: [number, number][];
  routeDistanceMeters: number;
  isRouteRevealComplete: boolean;
  isRouteViewportSettled: boolean;
  shouldAnimateRouteReveal: boolean;
  prefersReducedMotion: boolean;
  isPresentationMode: boolean;
  getPointAlongPath: (positions: [number, number][], progress: number) => [number, number];
  getAdaptiveAnimationDuration: (
    distanceMeters: number,
    minDurationMs: number,
    maxDurationMs: number,
    msPerMeter: number,
  ) => number;
  easeInOutCubic: (value: number) => number;
  getLiveRouteKey: (destinationId: string, location: Pick<LiveLocationState, 'x' | 'y' | 'snappedNodeId'>) => string;
  freeWalkNavigationEnabled: boolean;
  config: {
    averageWalkingSpeedMps: number;
    routeRevealMinDurationMs: number;
    routeRevealMaxDurationMs: number;
    routeRevealMsPerMeter: number;
    presentationWalkerMinDurationMs: number;
    presentationWalkerMaxDurationMs: number;
    presentationWalkerMsPerMeter: number;
    walkerProgressUpdateMs: number;
  };
};

export const useRouteNavigation = ({
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
  requireManualOriginConfirmation,
  liveLocationOriginLabel,
  startLiveLocationTracking,
  onPlayRouteSound,
  onNavigateToPoiStart,
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
  freeWalkNavigationEnabled,
  config,
}: UseRouteNavigationOptions) => {
  const lastManualRouteKeyRef = useRef('');
  const getManualOriginRequiredMessage = useCallback((destinationLabel?: string) => {
    if (destinationLabel) {
      return `Sua localizacao esta demorando mais do que o esperado. Para ir ate ${destinationLabel}, toque no mapa onde voce esta ou escolha sua origem pelos pontos principais.`;
    }
    return 'Sua localizacao esta demorando mais do que o esperado. Toque no mapa onde voce esta ou escolha sua origem pelos pontos principais.';
  }, []);

  const commitRoutePath = useCallback(
    (
      routePath: number[][],
      originLabel: string,
      destinationLabel: string,
      options?: {
        animateReveal?: boolean;
        announce?: boolean;
        playSound?: boolean;
      },
    ) => {
      const pathLatLng = routePath.map(([y, x]) => imageToLatLng(x, y));
      const distanceMeters = getPathDistanceMeters(pathLatLng);
      const etaMinutes = distanceMeters / (config.averageWalkingSpeedMps * 60);
      const distanceLabel = formatDistanceLabel(distanceMeters);
      const etaLabel = formatWalkingTimeLabel(etaMinutes);
      const shouldAnimateReveal = options?.animateReveal ?? true;
      const shouldAnnounce = options?.announce ?? true;
      const shouldPlaySound = options?.playSound ?? shouldAnimateReveal;

      setShouldAnimateRouteReveal(shouldAnimateReveal);
      setIsRouteViewportSettled(!shouldAnimateReveal);
      setRouteRevealProgress(shouldAnimateReveal ? 0 : 1);
      setRota(routePath);

      if (shouldPlaySound) {
        onPlayRouteSound();
      }

      if (shouldAnnounce) {
        setRouteMessage(
          `Rota pronta: ${originLabel} -> ${destinationLabel}. Distancia: ${distanceLabel} | Tempo medio: ${etaLabel}.`,
        );
      }
    },
    [
      config.averageWalkingSpeedMps,
      formatDistanceLabel,
      formatWalkingTimeLabel,
      getPathDistanceMeters,
      imageToLatLng,
      onPlayRouteSound,
      setIsRouteViewportSettled,
      setRota,
      setRouteMessage,
      setRouteRevealProgress,
      setShouldAnimateRouteReveal,
    ],
  );

  const prependPointToRoutePath = useCallback((routePath: number[][], origin: { x: number; y: number }) => {
    const originPoint: number[] = [Math.round(origin.y), Math.round(origin.x)];
    const [firstPoint] = routePath;
    if (!firstPoint || (firstPoint[0] === originPoint[0] && firstPoint[1] === originPoint[1])) {
      return routePath;
    }
    return [originPoint, ...routePath];
  }, []);

  const getManualRouteKey = useCallback((origin: ManualRouteOrigin, destinationId: string) => {
    if (!destinationId) return '';
    if (origin.snappedNodeId) {
      return `${destinationId}:${origin.snappedNodeId}`;
    }
    return `${destinationId}:${Math.round(origin.x)}_${Math.round(origin.y)}`;
  }, []);

  const buildRouteBetweenPois = useCallback(
    (originId: string, destinationId: string) => {
      const originPoi = getPoiById(originId);
      const destinationPoi = getPoiById(destinationId);

      if (!originPoi || !destinationPoi) {
        setRota(null);
        setRouteMessage('Escolha uma origem e um destino validos para testar a navegacao.');
        return;
      }

      if (originPoi.id === destinationPoi.id) {
        setRota(null);
        setRouteMessage(`Origem e destino apontam para o mesmo ponto em ${destinationPoi.nome}.`);
        return;
      }

      const path = freeWalkNavigationEnabled
        ? buildDirectPath({ x: originPoi.x, y: originPoi.y }, { x: destinationPoi.x, y: destinationPoi.y })
        : originPoi.nodeId && destinationPoi.nodeId
          ? findPath(originPoi.nodeId, destinationPoi.nodeId)
          : null;
      if (!path) {
        setRota(null);
        setRouteMessage(`Nao encontramos rota entre ${originPoi.nome} e ${destinationPoi.nome}.`);
        return;
      }

      lastLiveRouteKeyRef.current = '';
      lastAnimatedLiveRouteDestinationRef.current = null;
      lastManualRouteKeyRef.current = '';
      commitRoutePath(path, originPoi.nome, destinationPoi.nome);
    },
    [
      commitRoutePath,
      freeWalkNavigationEnabled,
      getPoiById,
      lastManualRouteKeyRef,
      lastAnimatedLiveRouteDestinationRef,
      lastLiveRouteKeyRef,
      setRota,
      setRouteMessage,
    ],
  );

  const buildRouteFromLiveLocation = useCallback(
    (
      destinationId: string,
      options?: {
        animateReveal?: boolean;
        announce?: boolean;
        playSound?: boolean;
      },
    ) => {
      const destinationPoi = getPoiById(destinationId);
      if (!destinationPoi) {
        setRota(null);
        setRouteMessage('Escolha um destino valido antes de iniciar a navegacao.');
        return;
      }
      if (requireManualOriginConfirmation) {
        setRota(null);
        setRouteMessage(getManualOriginRequiredMessage(destinationPoi.nome));
        return;
      }
      if (!liveLocation) {
        setRota(null);
        setRouteMessage('Ainda nao recebemos sua localizacao. Toque em "Usar meu GPS" novamente.');
        return;
      }
      if (!liveLocation.isInsideEvent) {
        setRota(null);
        setRouteMessage('Sua localizacao atual esta fora da area delimitada do evento.');
        return;
      }
      if (!freeWalkNavigationEnabled && !liveLocation.snappedNodeId) {
        setRota(null);
        setRouteMessage(
          freeWalkNavigationEnabled
            ? 'Sua localizacao foi lida, mas ainda nao conseguimos confirmar uma origem valida dentro do evento.'
            : 'Sua localizacao foi lida, mas ainda nao conseguiu encaixar nos corredores do mapa.',
        );
        return;
      }
      if (!freeWalkNavigationEnabled && !destinationPoi.nodeId) {
        setRota(null);
        setRouteMessage(
          freeWalkNavigationEnabled
            ? `"${destinationPoi.nome}" nao pode ser usado como destino agora.`
            : `"${destinationPoi.nome}" ainda nao esta conectado a malha de rotas.`,
        );
        return;
      }
      if (
        freeWalkNavigationEnabled
          ? getImagePointDistance({ x: liveLocation.x, y: liveLocation.y }, { x: destinationPoi.x, y: destinationPoi.y }) < 8
          : liveLocation.snappedNodeId === destinationPoi.nodeId
      ) {
        setRota(null);
        setRouteMessage(`Voce ja esta em ${destinationPoi.nome}.`);
        return;
      }

      const path = freeWalkNavigationEnabled
        ? buildDirectPath({ x: liveLocation.x, y: liveLocation.y }, { x: destinationPoi.x, y: destinationPoi.y })
        : liveLocation.snappedNodeId && destinationPoi.nodeId
          ? findPath(liveLocation.snappedNodeId, destinationPoi.nodeId)
          : null;
      if (!path) {
        setRota(null);
        setRouteMessage(`Nao encontramos rota entre ${liveLocationOriginLabel} e ${destinationPoi.nome}.`);
        return;
      }

      lastLiveRouteKeyRef.current = getLiveRouteKey(destinationId, liveLocation);
      lastManualRouteKeyRef.current = '';
      if (options?.animateReveal ?? true) {
        lastAnimatedLiveRouteDestinationRef.current = destinationId;
      }
      commitRoutePath(path, liveLocationOriginLabel, destinationPoi.nome, options);
    },
    [
      commitRoutePath,
      freeWalkNavigationEnabled,
      getImagePointDistance,
      getLiveRouteKey,
      getManualOriginRequiredMessage,
      getPoiById,
      lastManualRouteKeyRef,
      lastAnimatedLiveRouteDestinationRef,
      lastLiveRouteKeyRef,
      liveLocation,
      liveLocationOriginLabel,
      requireManualOriginConfirmation,
      setRota,
      setRouteMessage,
    ],
  );

  const buildRouteFromManualMapOrigin = useCallback(
    (
      origin: ManualRouteOrigin,
      destinationId: string,
      options?: {
        animateReveal?: boolean;
        announce?: boolean;
        playSound?: boolean;
      },
    ) => {
      const manualRouteKey = getManualRouteKey(origin, destinationId);
      if (manualRouteKey && manualRouteKey === lastManualRouteKeyRef.current) {
        return;
      }

      const destinationPoi = getPoiById(destinationId);
      if (!destinationPoi) {
        setRota(null);
        lastManualRouteKeyRef.current = '';
        setRouteMessage('Escolha um destino valido antes de iniciar a navegacao.');
        return;
      }

      if (!freeWalkNavigationEnabled && !destinationPoi.nodeId) {
        setRota(null);
        lastManualRouteKeyRef.current = '';
        setRouteMessage(`"${destinationPoi.nome}" ainda nao esta conectado a malha de rotas.`);
        return;
      }

      if (
        freeWalkNavigationEnabled
          ? getImagePointDistance({ x: origin.x, y: origin.y }, { x: destinationPoi.x, y: destinationPoi.y }) < 8
          : origin.snappedNodeId && origin.snappedNodeId === destinationPoi.nodeId
      ) {
        setRota(null);
        lastManualRouteKeyRef.current = '';
        setRouteMessage(`Voce ja esta em ${destinationPoi.nome}.`);
        return;
      }

      if (!freeWalkNavigationEnabled && !origin.snappedNodeId) {
        setRota(null);
        lastManualRouteKeyRef.current = '';
        setRouteMessage('Toque mais perto de um corredor para marcar sua origem manual no mapa.');
        return;
      }

      const rawPath = freeWalkNavigationEnabled
        ? buildDirectPath({ x: origin.x, y: origin.y }, { x: destinationPoi.x, y: destinationPoi.y })
        : origin.snappedNodeId && destinationPoi.nodeId
          ? findPath(origin.snappedNodeId, destinationPoi.nodeId)
          : null;

      if (!rawPath) {
        setRota(null);
        lastManualRouteKeyRef.current = '';
        setRouteMessage(`Nao encontramos rota entre ${origin.label} e ${destinationPoi.nome}.`);
        return;
      }

      const path = freeWalkNavigationEnabled ? rawPath : prependPointToRoutePath(rawPath, origin);

      lastLiveRouteKeyRef.current = '';
      lastAnimatedLiveRouteDestinationRef.current = null;
      lastManualRouteKeyRef.current = manualRouteKey;
      commitRoutePath(path, origin.label, destinationPoi.nome, options);
    },
    [
      commitRoutePath,
      freeWalkNavigationEnabled,
      getManualRouteKey,
      getImagePointDistance,
      getPoiById,
      lastManualRouteKeyRef,
      lastAnimatedLiveRouteDestinationRef,
      lastLiveRouteKeyRef,
      prependPointToRoutePath,
      setRota,
      setRouteMessage,
    ],
  );

  const clearManualRouteOrigin = useCallback(() => {
    setSelectedOriginId('');
    setManualMapOrigin(null);
    setOriginQuery('');
    setShowOriginSuggestions(false);
    setRota(null);
    setIsRouteViewportSettled(true);
    setShouldAnimateRouteReveal(false);
    lastManualRouteKeyRef.current = '';
    lastLiveRouteKeyRef.current = '';
    lastAnimatedLiveRouteDestinationRef.current = null;
    setRouteMessage('Origem de teste removida. Agora voce pode voltar ao GPS ou escolher outra origem.');
  }, [
    lastManualRouteKeyRef,
    lastAnimatedLiveRouteDestinationRef,
    lastLiveRouteKeyRef,
    setIsRouteViewportSettled,
    setManualMapOrigin,
    setOriginQuery,
    setRota,
    setRouteMessage,
    setSelectedOriginId,
    setShouldAnimateRouteReveal,
    setShowOriginSuggestions,
  ]);

  const clearRoute = useCallback(() => {
    setSelectedDestinationId('');
    setDestinationQuery('');
    setShowDestinationSuggestions(false);
    setRota(null);
    setIsRouteViewportSettled(true);
    setShouldAnimateRouteReveal(false);
    lastManualRouteKeyRef.current = '';
    lastLiveRouteKeyRef.current = '';
    lastAnimatedLiveRouteDestinationRef.current = null;
    setRouteMessage('Rota limpa. Assim que o GPS estiver ativo, basta escolher o destino.');
  }, [
    lastManualRouteKeyRef,
    lastAnimatedLiveRouteDestinationRef,
    lastLiveRouteKeyRef,
    setDestinationQuery,
    setIsRouteViewportSettled,
    setRota,
    setRouteMessage,
    setSelectedDestinationId,
    setShouldAnimateRouteReveal,
    setShowDestinationSuggestions,
  ]);

  const selectDestinationPoi = useCallback(
    (poi: PointData, options?: { buildInstantly?: boolean }) => {
      setSelectedDestinationId(poi.id);
      setDestinationQuery(poi.nome);
      setShowDestinationSuggestions(false);

      if (options?.buildInstantly === false) return;

      if (selectedOriginId) {
        buildRouteBetweenPois(selectedOriginId, poi.id);
        return;
      }

      if (manualMapOrigin) {
        buildRouteFromManualMapOrigin(manualMapOrigin, poi.id, {
          animateReveal: true,
          announce: true,
          playSound: true,
        });
        return;
      }

      if (requireManualOriginConfirmation) {
        setRota(null);
        setRouteMessage(getManualOriginRequiredMessage(poi.nome));
        return;
      }

      if (hasLiveLocationFix) {
        buildRouteFromLiveLocation(poi.id, {
          animateReveal: true,
          announce: true,
          playSound: true,
        });
        return;
      }

      if (liveTrackingState === 'requesting') {
        setRouteMessage(`Destino definido em ${poi.nome}. Estamos aguardando sua localizacao para montar a rota automaticamente.`);
        return;
      }

      if (liveTrackingState === 'active' && !hasLiveLocationFix) {
        setRouteMessage(
          freeWalkNavigationEnabled
            ? `Destino definido em ${poi.nome}. Sua localizacao ainda precisa entrar na area do evento para liberar a rota.`
            : `Destino definido em ${poi.nome}. Sua localizacao ainda nao conseguiu encaixar na malha de rotas.`,
        );
        return;
      }

      if (liveTrackingState === 'blocked' || liveTrackingState === 'unsupported') {
        setRouteMessage(`Destino definido em ${poi.nome}. Libere o GPS para iniciar a rota ate aqui.`);
        return;
      }

      void startLiveLocationTracking();
      setRouteMessage(`Destino definido em ${poi.nome}. Estamos buscando sua localizacao exata para iniciar a rota.`);
    },
    [
      buildRouteBetweenPois,
      buildRouteFromManualMapOrigin,
      buildRouteFromLiveLocation,
      freeWalkNavigationEnabled,
      getManualOriginRequiredMessage,
      hasLiveLocationFix,
      liveTrackingState,
      manualMapOrigin,
      requireManualOriginConfirmation,
      selectedOriginId,
      setDestinationQuery,
      setRota,
      setRouteMessage,
      setSelectedDestinationId,
      setShowDestinationSuggestions,
      startLiveLocationTracking,
    ],
  );

  const selectOriginPoi = useCallback(
    (poi: PointData) => {
      setSelectedOriginId(poi.id);
      setManualMapOrigin(null);
      lastManualRouteKeyRef.current = '';
      setOriginQuery(poi.nome);
      setShowOriginSuggestions(false);
      setRota(null);

      if (!freeWalkNavigationEnabled && !poi.nodeId) {
        setRouteMessage(
          freeWalkNavigationEnabled
            ? `"${poi.nome}" nao pode ser usado como origem agora.`
            : `"${poi.nome}" ainda nao esta conectado a malha de rotas.`,
        );
        return;
      }

      if (selectedDestinationId) {
        buildRouteBetweenPois(poi.id, selectedDestinationId);
        return;
      }

      setRouteMessage(`Origem de teste definida em ${poi.nome}. Agora escolha o destino para validar a rota.`);
    },
    [
      buildRouteBetweenPois,
      freeWalkNavigationEnabled,
      selectedDestinationId,
      lastManualRouteKeyRef,
      setManualMapOrigin,
      setOriginQuery,
      setRota,
      setRouteMessage,
      setSelectedOriginId,
      setShowOriginSuggestions,
    ],
  );

  const selectManualMapOrigin = useCallback(
    (origin: ManualRouteOrigin) => {
      setSelectedOriginId('');
      setManualMapOrigin(origin);
      lastManualRouteKeyRef.current = '';
      setOriginQuery(origin.label);
      setShowOriginSuggestions(false);
      setRota(null);

      if (selectedDestinationId) {
        buildRouteFromManualMapOrigin(origin, selectedDestinationId, {
          animateReveal: true,
          announce: true,
          playSound: true,
        });
        return;
      }

      setRouteMessage(`Origem manual definida em ${origin.label}. Agora escolha o destino para montar a rota.`);
    },
    [
      buildRouteFromManualMapOrigin,
      selectedDestinationId,
      lastManualRouteKeyRef,
      setManualMapOrigin,
      setOriginQuery,
      setRota,
      setRouteMessage,
      setSelectedOriginId,
      setShowOriginSuggestions,
    ],
  );

  const navigateToPoi = useCallback(
    (poi: PointData) => {
      if (!freeWalkNavigationEnabled && !poi.nodeId) {
        setRouteMessage(
          freeWalkNavigationEnabled
            ? `"${poi.nome}" nao pode ser usado como destino agora.`
            : `"${poi.nome}" ainda nao esta conectado a malha de rotas.`,
        );
        return;
      }

      onNavigateToPoiStart?.();
      selectDestinationPoi(poi, { buildInstantly: false });

      if (selectedOriginId) {
        buildRouteBetweenPois(selectedOriginId, poi.id);
        return;
      }

      if (manualMapOrigin) {
        buildRouteFromManualMapOrigin(manualMapOrigin, poi.id, {
          animateReveal: true,
          announce: true,
          playSound: true,
        });
        return;
      }

      if (requireManualOriginConfirmation) {
        setRota(null);
        setRouteMessage(getManualOriginRequiredMessage(poi.nome));
        return;
      }

      if (hasLiveLocationFix) {
        buildRouteFromLiveLocation(poi.id, {
          animateReveal: true,
          announce: true,
          playSound: true,
        });
        return;
      }

      if (liveTrackingState === 'requesting') {
        setRota(null);
        setRouteMessage(`Destino definido em ${poi.nome}. Estamos aguardando sua localizacao para montar a rota.`);
        return;
      }

      if (liveTrackingState === 'active' && !hasLiveLocationFix) {
        setRota(null);
        setRouteMessage(
          freeWalkNavigationEnabled
            ? `Destino definido em ${poi.nome}. Sua localizacao ainda precisa entrar na area do evento para liberar a rota.`
            : `Destino definido em ${poi.nome}. Sua localizacao ainda nao conseguiu encaixar na malha de rotas.`,
        );
        return;
      }

      if (liveTrackingState === 'blocked' || liveTrackingState === 'unsupported') {
        setRota(null);
        setRouteMessage(`Destino definido em ${poi.nome}. Libere o GPS para iniciar a rota ate aqui.`);
        return;
      }

      void startLiveLocationTracking();
      setRota(null);
      setRouteMessage(`Destino definido em ${poi.nome}. Estamos buscando sua localizacao exata para iniciar a rota.`);
    },
    [
      buildRouteBetweenPois,
      buildRouteFromManualMapOrigin,
      buildRouteFromLiveLocation,
      freeWalkNavigationEnabled,
      getManualOriginRequiredMessage,
      hasLiveLocationFix,
      liveTrackingState,
      manualMapOrigin,
      onNavigateToPoiStart,
      requireManualOriginConfirmation,
      selectedOriginId,
      selectDestinationPoi,
      setRota,
      setRouteMessage,
      startLiveLocationTracking,
    ],
  );

  useEffect(() => {
    const currentLiveLocation = liveLocation;
    if (
      requireManualOriginConfirmation ||
      selectedOriginId ||
      manualMapOrigin ||
      !selectedDestinationId ||
      !hasLiveLocationFix ||
      !currentLiveLocation ||
      (!freeWalkNavigationEnabled && !currentLiveLocation.snappedNodeId)
    ) {
      lastLiveRouteKeyRef.current = '';
      return;
    }

    const routeKey = getLiveRouteKey(selectedDestinationId, currentLiveLocation);
    if (routeKey === lastLiveRouteKeyRef.current) return;

    const shouldAnimateLiveRoute = lastAnimatedLiveRouteDestinationRef.current !== selectedDestinationId;
    buildRouteFromLiveLocation(selectedDestinationId, {
      animateReveal: shouldAnimateLiveRoute,
      announce: shouldAnimateLiveRoute,
      playSound: shouldAnimateLiveRoute,
    });
  }, [
    buildRouteFromLiveLocation,
    freeWalkNavigationEnabled,
    getLiveRouteKey,
    hasLiveLocationFix,
    lastAnimatedLiveRouteDestinationRef,
    lastLiveRouteKeyRef,
    liveLocation,
    manualMapOrigin,
    requireManualOriginConfirmation,
    selectedDestinationId,
    selectedOriginId,
  ]);

  useEffect(() => {
    if (!manualMapOrigin || !selectedDestinationId) return;
    buildRouteFromManualMapOrigin(manualMapOrigin, selectedDestinationId, {
      animateReveal: true,
      announce: true,
      playSound: true,
    });
  }, [buildRouteFromManualMapOrigin, manualMapOrigin, selectedDestinationId]);

  useEffect(() => {
    if (routeRevealFrameRef.current !== null) {
      window.cancelAnimationFrame(routeRevealFrameRef.current);
      routeRevealFrameRef.current = null;
    }

    if (routeLatLngPoints.length === 0) {
      setRouteRevealProgress(0);
      return;
    }

    if (routeLatLngPoints.length === 1 || prefersReducedMotion || !shouldAnimateRouteReveal) {
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
      config.routeRevealMinDurationMs,
      config.routeRevealMaxDurationMs,
      config.routeRevealMsPerMeter,
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
  }, [
    config.routeRevealMaxDurationMs,
    config.routeRevealMinDurationMs,
    config.routeRevealMsPerMeter,
    easeInOutCubic,
    getAdaptiveAnimationDuration,
    isRouteViewportSettled,
    prefersReducedMotion,
    routeDistanceMeters,
    routeLatLngPoints,
    routeRevealFrameRef,
    setRouteRevealProgress,
    shouldAnimateRouteReveal,
  ]);

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

    const realWalkingDurationMs = (routeDistanceMeters / config.averageWalkingSpeedMps) * 1000;
    const animationDurationMs = isPresentationMode
      ? getAdaptiveAnimationDuration(
          routeDistanceMeters,
          config.presentationWalkerMinDurationMs,
          config.presentationWalkerMaxDurationMs,
          config.presentationWalkerMsPerMeter,
        )
      : Number.isFinite(realWalkingDurationMs) && realWalkingDurationMs > 0
        ? realWalkingDurationMs
        : 1;
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
    walkerTimerRef.current = window.setInterval(tickWalker, config.walkerProgressUpdateMs);

    return () => {
      if (walkerTimerRef.current !== null) {
        window.clearInterval(walkerTimerRef.current);
        walkerTimerRef.current = null;
      }
    };
  }, [
    config.averageWalkingSpeedMps,
    config.presentationWalkerMaxDurationMs,
    config.presentationWalkerMinDurationMs,
    config.presentationWalkerMsPerMeter,
    config.walkerProgressUpdateMs,
    getAdaptiveAnimationDuration,
    getPointAlongPath,
    isPresentationMode,
    isRouteRevealComplete,
    routeDistanceMeters,
    routeLatLngPoints,
    setWalkerPosition,
    setWalkerProgress,
    walkerTimerRef,
  ]);

  useEffect(() => {
    if (!selectedDestinationId) return;
    const destination = pois.find((poi) => poi.id === selectedDestinationId);
    if (destination) setDestinationQuery(destination.nome);
  }, [pois, selectedDestinationId, setDestinationQuery]);

  useEffect(() => {
    if (!selectedDestinationId) return;
    const missingDestination = !pois.some((poi) => poi.id === selectedDestinationId);
    if (missingDestination) {
      clearRoute();
    }
  }, [clearRoute, pois, selectedDestinationId]);

  useEffect(() => {
    if (!selectedOriginId) return;
    const missingOrigin = !pois.some((poi) => poi.id === selectedOriginId);
    if (missingOrigin) {
      clearManualRouteOrigin();
    }
  }, [clearManualRouteOrigin, pois, selectedOriginId]);

  useEffect(() => {
    if (!selectedOriginId || !selectedDestinationId) return;
    buildRouteBetweenPois(selectedOriginId, selectedDestinationId);
  }, [buildRouteBetweenPois, selectedDestinationId, selectedOriginId]);

  return {
    clearManualRouteOrigin,
    clearRoute,
    selectDestinationPoi,
    selectOriginPoi,
    selectManualMapOrigin,
    buildRouteBetweenPois,
    buildRouteFromManualMapOrigin,
    buildRouteFromLiveLocation,
    navigateToPoi,
  };
};
