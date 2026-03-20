import { useEffect, useRef, type MutableRefObject } from 'react';
import type { LatLngBounds } from 'leaflet';
import { useMap, useMapEvents } from 'react-leaflet';
import type { EditingPoi } from '../types';
import { MAP_VIEW_CENTER, resolveOfficialMapZoomConfig } from '../../../config/mapConfig';

const clampNumber = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const MapController = ({
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

    const routeKey = routeLatLngPoints.map(([lat, lng]) => `${lat.toFixed(6)},${lng.toFixed(6)}`).join('|');

    if (routeKey === lastRouteKeyRef.current) return;

    lastRouteKeyRef.current = routeKey;
    onRouteViewportSettledChange(true);
  }, [onRouteViewportSettledChange, routeLatLngPoints]);

  return null;
};

export const MapSizeSync = () => {
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

export const MapViewportBoundsController = ({
  isMobile,
  mapOverlayBounds,
  mapViewportBounds,
  onZoomLevelChange,
  onZoomRangeChange,
}: {
  isMobile: boolean;
  mapOverlayBounds: LatLngBounds;
  mapViewportBounds: LatLngBounds;
  onZoomLevelChange: (value: number) => void;
  onZoomRangeChange: (minZoom: number, maxZoom: number | null) => void;
}) => {
  const map = useMap();
  const hasCenteredRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncViewport = (forceCenter: boolean) => {
      const fittedZoom = map.getBoundsZoom(mapOverlayBounds, false);
      const { initialZoom, minZoom, maxZoom } = resolveOfficialMapZoomConfig(fittedZoom, isMobile);
      map.setMinZoom(minZoom);
      map.setMaxZoom(maxZoom ?? Number.POSITIVE_INFINITY);
      map.setMaxBounds(mapViewportBounds);
      onZoomRangeChange(minZoom, maxZoom);

      if (forceCenter || !hasCenteredRef.current) {
        map.setView(MAP_VIEW_CENTER, initialZoom, { animate: false });
        hasCenteredRef.current = true;
      } else {
        const currentCenter = map.getCenter();
        const currentZoom = map.getZoom();
        const clampedZoom = maxZoom == null ? Math.max(currentZoom, minZoom) : clampNumber(currentZoom, minZoom, maxZoom);

        if (clampedZoom !== currentZoom) {
          map.setView(currentCenter, clampedZoom, { animate: false });
        } else {
          map.panInsideBounds(mapViewportBounds, { animate: false });
        }
      }

      onZoomLevelChange(map.getZoom());
    };

    const scheduleSync = () => {
      window.requestAnimationFrame(() => syncViewport(false));
    };

    syncViewport(true);
    window.addEventListener('resize', scheduleSync);
    window.visualViewport?.addEventListener('resize', scheduleSync);

    return () => {
      window.removeEventListener('resize', scheduleSync);
      window.visualViewport?.removeEventListener('resize', scheduleSync);
    };
  }, [isMobile, map, mapOverlayBounds, mapViewportBounds, onZoomLevelChange, onZoomRangeChange]);

  return null;
};

export const MapInteractionEvents = ({
  isAdmin,
  suppressAdminMapClickRef,
  latLngToImageOverlay,
  defaultActivityImageUrl,
  onPublicMapClick,
  onAdminDraftClick,
  onZoomLevelChange,
}: {
  isAdmin: boolean;
  suppressAdminMapClickRef: MutableRefObject<boolean>;
  latLngToImageOverlay: (lat: number, lng: number) => { x: number; y: number };
  defaultActivityImageUrl: string;
  onPublicMapClick: (point: { lat: number; lng: number; x: number; y: number }) => void;
  onAdminDraftClick: (draft: EditingPoi) => void;
  onZoomLevelChange: (value: number) => void;
}) => {
  useMapEvents({
    click(event) {
      const mapped = latLngToImageOverlay(event.latlng.lat, event.latlng.lng);
      const x = Math.round(mapped.x);
      const y = Math.round(mapped.y);

      if (!isAdmin) {
        onPublicMapClick({
          lat: event.latlng.lat,
          lng: event.latlng.lng,
          x,
          y,
        });
        return;
      }

      if (suppressAdminMapClickRef.current) {
        return;
      }

      onAdminDraftClick({
        nome: '',
        tipo: 'atividade',
        x,
        y,
        descricao: '',
        imagemUrl: defaultActivityImageUrl,
        contato: '',
        corDestaque: '',
        selo: '',
      });
    },
    zoomend(event) {
      onZoomLevelChange(event.target.getZoom());
    },
  });

  return null;
};
