import {
  useCallback,
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import { fetchLocationContext, type LocationContextResponse } from '../../../services/locationApi';
import type {
  ImagePoint,
  LiveLocationContextState,
  LiveLocationSource,
  LiveLocationState,
  LiveTrackingState,
  PointData,
} from '../types';

type UseLiveLocationOptions = {
  restoredLiveLocation: LiveLocationState | null;
  pois: PointData[];
  liveTrackingState: LiveTrackingState;
  setLiveTrackingState: Dispatch<SetStateAction<LiveTrackingState>>;
  liveLocation: LiveLocationState | null;
  setLiveLocation: Dispatch<SetStateAction<LiveLocationState | null>>;
  setLiveLocationMessage: Dispatch<SetStateAction<string | null>>;
  setLiveLocationSource: Dispatch<SetStateAction<LiveLocationSource | null>>;
  setLiveLocationContext: Dispatch<SetStateAction<LocationContextResponse | null>>;
  setLiveLocationContextState: Dispatch<SetStateAction<LiveLocationContextState>>;
  setLiveLocationContextMessage: Dispatch<SetStateAction<string | null>>;
  liveLocationWatchIdRef: MutableRefObject<number | null>;
  liveLocationPollIntervalRef: MutableRefObject<number | null>;
  liveLocationLastSampleAtRef: MutableRefObject<number>;
  liveLocationRef: MutableRefObject<LiveLocationState | null>;
  liveLocationContextRequestIdRef: MutableRefObject<number>;
  liveLocationContextLastRequestRef: MutableRefObject<{ lat: number; lng: number; requestedAt: number } | null>;
  geolocationPermissionStatusRef: MutableRefObject<PermissionStatus | null>;
  latLngToImageRaw: (lat: number, lng: number) => ImagePoint;
  eventBoundaryImagePoints: ImagePoint[];
  metersToImagePixels: (meters: number) => number;
  getLiveLocationBoundaryGraceMeters: (accuracyMeters: number) => number;
  isPointInsidePolygon: (point: ImagePoint, polygon: ImagePoint[]) => boolean;
  getDistanceToPolygonEdges: (point: ImagePoint, polygon: ImagePoint[]) => number;
  getClosestPointOnPolygonEdges: (point: ImagePoint, polygon: ImagePoint[]) => ImagePoint | null;
  findNearestNodeFn: (x: number, y: number, maxDistance: number) => string | null;
  getImagePointDistance: (from: ImagePoint, to: ImagePoint) => number;
  isLiveLocationAccuracyReliable: (accuracyMeters: number) => boolean;
  formatDistanceLabel: (meters: number) => string;
  getLatLngDistanceMeters: (from: [number, number], to: [number, number]) => number;
  persistLiveLocationSnapshot: (value: LiveLocationState | null) => void;
  isGeolocationSecureContext: () => boolean;
  getGeolocationSecureContextMessage: () => string;
  mapGeolocationErrorMessage: (error: GeolocationPositionError) => string;
  freeWalkNavigationEnabled: boolean;
  config: {
    liveLocationNearestPoiMaxDistance: number;
    liveLocationWarningAccuracyMeters: number;
    liveLocationBoundaryGraceMaxMeters: number;
    liveLocationNodeMaxDistance: number;
    liveLocationRefreshIntervalMs: number;
    liveLocationWatchOptions: PositionOptions;
    liveLocationRefreshOptions: PositionOptions;
    liveLocationStaleRestartAfterMs: number;
    liveLocationContextRefreshIntervalMs: number;
    liveLocationContextMinMoveMeters: number;
  };
};

export const useLiveLocation = ({
  restoredLiveLocation,
  pois,
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
  eventBoundaryImagePoints,
  metersToImagePixels,
  getLiveLocationBoundaryGraceMeters,
  isPointInsidePolygon,
  getDistanceToPolygonEdges,
  getClosestPointOnPolygonEdges,
  findNearestNodeFn,
  getImagePointDistance,
  isLiveLocationAccuracyReliable,
  formatDistanceLabel,
  getLatLngDistanceMeters,
  persistLiveLocationSnapshot,
  isGeolocationSecureContext,
  getGeolocationSecureContextMessage,
  mapGeolocationErrorMessage,
  freeWalkNavigationEnabled,
  config,
}: UseLiveLocationOptions) => {
  const stopLiveLocationTracking = useCallback(
    (options?: { clearLocation?: boolean; keepMessage?: boolean }) => {
      if (typeof window !== 'undefined' && liveLocationWatchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(liveLocationWatchIdRef.current);
      }

      if (typeof window !== 'undefined' && liveLocationPollIntervalRef.current !== null) {
        window.clearInterval(liveLocationPollIntervalRef.current);
      }

      liveLocationWatchIdRef.current = null;
      liveLocationPollIntervalRef.current = null;
      liveLocationLastSampleAtRef.current = 0;
      setLiveLocationSource(null);
      setLiveTrackingState('idle');

      if (options?.clearLocation !== false) {
        setLiveLocation(null);
        persistLiveLocationSnapshot(null);
      }

      if (!options?.keepMessage) {
        setLiveLocationMessage(null);
      }
    },
    [
      liveLocationLastSampleAtRef,
      liveLocationPollIntervalRef,
      liveLocationWatchIdRef,
      persistLiveLocationSnapshot,
      setLiveLocation,
      setLiveLocationMessage,
      setLiveLocationSource,
      setLiveTrackingState,
    ],
  );

  const findNearestPoiForLiveLocation = useCallback(
    (point: ImagePoint) => {
      let nearestPoiId: string | null = null;
      let nearestDistance = Infinity;

      for (const poi of pois) {
        const distance = getImagePointDistance(point, { x: poi.x, y: poi.y });
        if (distance < nearestDistance && distance <= config.liveLocationNearestPoiMaxDistance) {
          nearestDistance = distance;
          nearestPoiId = poi.id;
        }
      }

      return nearestPoiId;
    },
    [config.liveLocationNearestPoiMaxDistance, getImagePointDistance, pois],
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
      const previousLiveLocation = liveLocationRef.current;
      const normalizedAccuracyMeters =
        Number.isFinite(sample.accuracyMeters) && sample.accuracyMeters > 0
          ? sample.accuracyMeters
          : config.liveLocationWarningAccuracyMeters;
      const normalizedCapturedAt =
        Number.isFinite(sample.capturedAt) && sample.capturedAt > 0 ? sample.capturedAt : Date.now();
      const accuracyLabel = formatDistanceLabel(normalizedAccuracyMeters);

      liveLocationLastSampleAtRef.current = normalizedCapturedAt;

      if (!isLiveLocationAccuracyReliable(normalizedAccuracyMeters)) {
        setLiveLocationSource(source);

        if (previousLiveLocation && isLiveLocationAccuracyReliable(previousLiveLocation.accuracyMeters)) {
          setLiveTrackingState('active');
          setLiveLocationMessage(
            `O GPS ficou instavel (${accuracyLabel}). Mantendo sua ultima posicao confiavel enquanto o sinal melhora.`,
          );
          return;
        }

        setLiveLocation(null);
        persistLiveLocationSnapshot(null);
        setLiveTrackingState('requesting');
        setLiveLocationMessage(
          `O GPS respondeu com precisao de ${accuracyLabel}, ainda insuficiente para posicionar voce com seguranca no mapa do evento.`,
        );
        return;
      }

      const rawPoint = latLngToImageRaw(sample.lat, sample.lng);
      const boundaryGraceMeters = getLiveLocationBoundaryGraceMeters(normalizedAccuracyMeters);
      const boundaryGracePixels = metersToImagePixels(boundaryGraceMeters);
      const isStrictlyInsideEvent = isPointInsidePolygon(rawPoint, eventBoundaryImagePoints);
      const usedBoundaryGrace =
        !isStrictlyInsideEvent && getDistanceToPolygonEdges(rawPoint, eventBoundaryImagePoints) <= boundaryGracePixels;
      const isInsideEvent = isStrictlyInsideEvent || usedBoundaryGrace;
      const resolvedPoint =
        !isStrictlyInsideEvent && usedBoundaryGrace
          ? getClosestPointOnPolygonEdges(rawPoint, eventBoundaryImagePoints) ?? rawPoint
          : rawPoint;
      const nodeSnapMaxDistance =
        config.liveLocationNodeMaxDistance +
        metersToImagePixels(Math.min(normalizedAccuracyMeters, config.liveLocationBoundaryGraceMaxMeters));
      const primarySnappedNodeId =
        !freeWalkNavigationEnabled && isInsideEvent
          ? findNearestNodeFn(Math.round(resolvedPoint.x), Math.round(resolvedPoint.y), nodeSnapMaxDistance)
          : null;
      const snappedNodeId = freeWalkNavigationEnabled
        ? (isInsideEvent ? '__free_walk__' : null)
        : primarySnappedNodeId ??
          (isInsideEvent
            ? findNearestNodeFn(Math.round(resolvedPoint.x), Math.round(resolvedPoint.y), nodeSnapMaxDistance * 2.2)
            : null);
      const nearestPoiId = isInsideEvent ? findNearestPoiForLiveLocation(resolvedPoint) : null;

      const nextLiveLocation: LiveLocationState = {
        lat: sample.lat,
        lng: sample.lng,
        x: resolvedPoint.x,
        y: resolvedPoint.y,
        accuracyMeters: normalizedAccuracyMeters,
        capturedAt: normalizedCapturedAt,
        isInsideEvent,
        usedBoundaryGrace,
        snappedNodeId,
        nearestPoiId,
      };

      setLiveLocation(nextLiveLocation);
      setLiveLocationSource(source);
      setLiveTrackingState('active');

      if (isInsideEvent && snappedNodeId) {
        persistLiveLocationSnapshot(nextLiveLocation);
      }

      if (!isInsideEvent) {
        setLiveLocationMessage('Sua localizacao foi encontrada, mas esta fora da area delimitada do evento.');
        return;
      }

      if (!snappedNodeId) {
        setLiveLocationMessage(
          freeWalkNavigationEnabled
            ? 'Sua localizacao foi encontrada dentro do evento.'
            : 'Sua localizacao foi encontrada dentro do evento, mas ainda nao encaixou na malha de rotas.',
        );
        return;
      }

      setLiveLocationMessage(
        usedBoundaryGrace
          ? `Sua posicao esta sendo atualizada automaticamente. O sinal esta oscilando perto da area operacional; precisao aproximada: ${accuracyLabel}.`
          : `Sua posicao esta sendo atualizada automaticamente. Precisao aproximada: ${accuracyLabel}.`,
      );
    },
    [
      config.liveLocationBoundaryGraceMaxMeters,
      config.liveLocationNodeMaxDistance,
      config.liveLocationWarningAccuracyMeters,
      eventBoundaryImagePoints,
      findNearestNodeFn,
      findNearestPoiForLiveLocation,
      formatDistanceLabel,
      freeWalkNavigationEnabled,
      getClosestPointOnPolygonEdges,
      getDistanceToPolygonEdges,
      getLiveLocationBoundaryGraceMeters,
      isLiveLocationAccuracyReliable,
      isPointInsidePolygon,
      latLngToImageRaw,
      liveLocationLastSampleAtRef,
      liveLocationRef,
      metersToImagePixels,
      persistLiveLocationSnapshot,
      setLiveLocation,
      setLiveLocationMessage,
      setLiveLocationSource,
      setLiveTrackingState,
    ],
  );

  const requestLiveLocationRefresh = useCallback(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) return;
    if (!isGeolocationSecureContext()) return;

    navigator.geolocation.getCurrentPosition(
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
      () => {
        // Mantem o watch principal como fonte principal; esse refresh e apenas um reforco.
      },
      config.liveLocationRefreshOptions,
    );
  }, [applyLiveLocationSample, config.liveLocationRefreshOptions, isGeolocationSecureContext]);

  const ensureGeolocationPermissionState = useCallback(async () => {
    if (typeof navigator === 'undefined' || !('permissions' in navigator) || !navigator.permissions?.query) {
      return null;
    }

    try {
      const permissionStatus = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      geolocationPermissionStatusRef.current = permissionStatus;
      return permissionStatus.state;
    } catch {
      return null;
    }
  }, [geolocationPermissionStatusRef]);

  const startLiveLocationTracking = useCallback(async () => {
    if (typeof window === 'undefined') return;

    if (!isGeolocationSecureContext()) {
      setLiveTrackingState('unsupported');
      setLiveLocationMessage(getGeolocationSecureContextMessage());
      return;
    }

    if (!('geolocation' in navigator)) {
      setLiveTrackingState('unsupported');
      setLiveLocationMessage('Este navegador nao oferece geolocalizacao em tempo real.');
      return;
    }

    const permissionState = await ensureGeolocationPermissionState();
    if (permissionState === 'denied') {
      stopLiveLocationTracking({ keepMessage: true });
      setLiveTrackingState('blocked');
      setLiveLocation(null);
      setLiveLocationSource(null);
      persistLiveLocationSnapshot(null);
      setLiveLocationMessage('A permissao de localizacao foi negada. Libere o GPS no navegador para usar a origem automatica.');
      return;
    }

    stopLiveLocationTracking({ clearLocation: false, keepMessage: true });
    setLiveTrackingState('requesting');
    setLiveLocationMessage('Estamos buscando sua posicao para preencher a origem automaticamente...');

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
          persistLiveLocationSnapshot(null);
        }
      },
      config.liveLocationWatchOptions,
    );

    requestLiveLocationRefresh();
    liveLocationPollIntervalRef.current = window.setInterval(
      requestLiveLocationRefresh,
      config.liveLocationRefreshIntervalMs,
    );
  }, [
    applyLiveLocationSample,
    config.liveLocationRefreshIntervalMs,
    config.liveLocationWatchOptions,
    ensureGeolocationPermissionState,
    getGeolocationSecureContextMessage,
    isGeolocationSecureContext,
    liveLocationPollIntervalRef,
    liveLocationWatchIdRef,
    mapGeolocationErrorMessage,
    persistLiveLocationSnapshot,
    requestLiveLocationRefresh,
    setLiveLocation,
    setLiveLocationMessage,
    setLiveLocationSource,
    setLiveTrackingState,
    stopLiveLocationTracking,
  ]);

  useEffect(() => {
    liveLocationRef.current = liveLocation;
  }, [liveLocation, liveLocationRef]);

  useEffect(() => {
    let isCancelled = false;

    const hydrateLiveLocationSession = async () => {
      if (!isGeolocationSecureContext()) return;

      const permissionState = await ensureGeolocationPermissionState();
      if (isCancelled || permissionState === 'denied') return;

      if (permissionState === 'granted' || restoredLiveLocation) {
        void startLiveLocationTracking();
      }
    };

    void hydrateLiveLocationSession();

    return () => {
      isCancelled = true;
    };
  }, [ensureGeolocationPermissionState, isGeolocationSecureContext, restoredLiveLocation, startLiveLocationTracking]);

  useEffect(() => {
    const permissionStatus = geolocationPermissionStatusRef.current;
    if (!permissionStatus) return;

    const handlePermissionChange = () => {
      if (permissionStatus.state === 'denied') {
        stopLiveLocationTracking({ keepMessage: true });
        setLiveTrackingState('blocked');
        persistLiveLocationSnapshot(null);
        setLiveLocationMessage('A permissao de localizacao foi negada. Libere o GPS no navegador para usar a origem automatica.');
        return;
      }

      if (permissionStatus.state === 'granted' && liveTrackingState !== 'idle' && liveTrackingState !== 'unsupported') {
        void startLiveLocationTracking();
      }
    };

    permissionStatus.onchange = handlePermissionChange;
    return () => {
      if (permissionStatus.onchange === handlePermissionChange) {
        permissionStatus.onchange = null;
      }
    };
  }, [
    geolocationPermissionStatusRef,
    liveTrackingState,
    persistLiveLocationSnapshot,
    setLiveLocationMessage,
    setLiveTrackingState,
    startLiveLocationTracking,
    stopLiveLocationTracking,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const resumeLiveLocation = () => {
      if (liveTrackingState === 'idle' || liveTrackingState === 'blocked' || liveTrackingState === 'unsupported') {
        return;
      }

      const sampleAge =
        liveLocationLastSampleAtRef.current > 0 ? Date.now() - liveLocationLastSampleAtRef.current : Infinity;
      if (liveLocationWatchIdRef.current === null || sampleAge > config.liveLocationStaleRestartAfterMs) {
        void startLiveLocationTracking();
        return;
      }

      requestLiveLocationRefresh();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        resumeLiveLocation();
      }
    };

    window.addEventListener('focus', resumeLiveLocation);
    window.addEventListener('pageshow', resumeLiveLocation);
    window.addEventListener('online', resumeLiveLocation);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', resumeLiveLocation);
      window.removeEventListener('pageshow', resumeLiveLocation);
      window.removeEventListener('online', resumeLiveLocation);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [
    config.liveLocationStaleRestartAfterMs,
    liveLocationLastSampleAtRef,
    liveLocationWatchIdRef,
    liveTrackingState,
    requestLiveLocationRefresh,
    startLiveLocationTracking,
  ]);

  useEffect(() => {
    if (!liveLocation) {
      setLiveLocationContext(null);
      setLiveLocationContextState('idle');
      setLiveLocationContextMessage(null);
      liveLocationContextLastRequestRef.current = null;
      return;
    }

    const now = Date.now();
    const lastRequest = liveLocationContextLastRequestRef.current;
    const movedDistance =
      lastRequest == null
        ? Infinity
        : getLatLngDistanceMeters([lastRequest.lat, lastRequest.lng], [liveLocation.lat, liveLocation.lng]);
    const shouldReuseRecentContext =
      lastRequest != null &&
      now - lastRequest.requestedAt < config.liveLocationContextRefreshIntervalMs &&
      movedDistance < config.liveLocationContextMinMoveMeters;

    if (shouldReuseRecentContext) {
      return;
    }

    let isCancelled = false;
    const requestId = liveLocationContextRequestIdRef.current + 1;
    liveLocationContextRequestIdRef.current = requestId;
    liveLocationContextLastRequestRef.current = {
      lat: liveLocation.lat,
      lng: liveLocation.lng,
      requestedAt: now,
    };

    setLiveLocationContextState((current) => (current === 'idle' ? 'loading' : current));
    setLiveLocationContextMessage(null);

    void fetchLocationContext({
      lat: liveLocation.lat,
      lng: liveLocation.lng,
      accuracyMeters: liveLocation.accuracyMeters,
    })
      .then((context) => {
        if (isCancelled || liveLocationContextRequestIdRef.current !== requestId) return;
        setLiveLocationContext(context);
        setLiveLocationContextState('ready');
        setLiveLocationContextMessage(null);
      })
      .catch((error) => {
        if (isCancelled || liveLocationContextRequestIdRef.current !== requestId) return;
        setLiveLocationContextState('error');
        setLiveLocationContextMessage(
          error instanceof Error ? error.message : 'Nao foi possivel validar a localizacao no backend.',
        );
      });

    return () => {
      isCancelled = true;
    };
  }, [
    config.liveLocationContextMinMoveMeters,
    config.liveLocationContextRefreshIntervalMs,
    getLatLngDistanceMeters,
    liveLocation,
    liveLocationContextLastRequestRef,
    liveLocationContextRequestIdRef,
    setLiveLocationContext,
    setLiveLocationContextMessage,
    setLiveLocationContextState,
  ]);

  useEffect(
    () => () => {
      if (liveLocationWatchIdRef.current !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(liveLocationWatchIdRef.current);
        liveLocationWatchIdRef.current = null;
      }

      if (liveLocationPollIntervalRef.current !== null) {
        window.clearInterval(liveLocationPollIntervalRef.current);
        liveLocationPollIntervalRef.current = null;
      }
    },
    [liveLocationPollIntervalRef, liveLocationWatchIdRef],
  );

  return {
    stopLiveLocationTracking,
    startLiveLocationTracking,
    ensureGeolocationPermissionState,
    requestLiveLocationRefresh,
  };
};
