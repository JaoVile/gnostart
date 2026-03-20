import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { DockPanel, DockPanelKey } from '../types';

type UseMapDockOptions = {
  defaultDockPanelHeights: Record<DockPanelKey, number>;
  minDockPanelHeights: Record<DockPanelKey, number>;
  mobileMediaQuery: string;
  compactMediaQuery: string;
  onOpenPanel?: () => void;
};

const clampNumber = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const useMapDock = ({
  defaultDockPanelHeights,
  minDockPanelHeights,
  mobileMediaQuery,
  compactMediaQuery,
  onOpenPanel,
}: UseMapDockOptions) => {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(mobileMediaQuery).matches : false,
  );
  const [isCompactViewport, setIsCompactViewport] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(compactMediaQuery).matches : false,
  );
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false,
  );
  const [viewportHeight, setViewportHeight] = useState(() =>
    typeof window !== 'undefined' ? window.visualViewport?.height ?? window.innerHeight : 0,
  );
  const [isPinsPanelOpen, setIsPinsPanelOpen] = useState(false);
  const [isRoutePanelOpen, setIsRoutePanelOpen] = useState(false);
  const [isAgendaPanelOpen, setIsAgendaPanelOpen] = useState(false);
  const [isPartnersPanelOpen, setIsPartnersPanelOpen] = useState(false);
  const [dockPanelHeights, setDockPanelHeights] =
    useState<Record<DockPanelKey, number>>(defaultDockPanelHeights);
  const [isDockSheetDragging, setIsDockSheetDragging] = useState(false);

  const dockPanelHeightsRef = useRef<Record<DockPanelKey, number>>(defaultDockPanelHeights);
  const dockSheetBodyRef = useRef<HTMLDivElement | null>(null);
  const dockSheetDragFrameRef = useRef<number | null>(null);
  const dockSheetDragStateRef = useRef<{
    panel: DockPanelKey;
    pointerId: number;
    startY: number;
    startHeightPx: number;
    currentHeightPx: number;
  } | null>(null);

  const activeDockPanel: DockPanel = isPinsPanelOpen
    ? 'pins'
    : isRoutePanelOpen
      ? 'route'
      : isAgendaPanelOpen
        ? 'agenda'
        : isPartnersPanelOpen
          ? 'partners'
          : null;
  const isDockPanelOpen = activeDockPanel !== null;

  const closeDockPanel = useCallback(() => {
    setIsPinsPanelOpen(false);
    setIsRoutePanelOpen(false);
    setIsAgendaPanelOpen(false);
    setIsPartnersPanelOpen(false);
  }, []);

  const openDockPanel = useCallback(
    (panel: DockPanelKey) => {
      setIsPinsPanelOpen(panel === 'pins');
      setIsRoutePanelOpen(panel === 'route');
      setIsAgendaPanelOpen(panel === 'agenda');
      setIsPartnersPanelOpen(panel === 'partners');
      if (panel === 'agenda' || panel === 'partners') {
        setDockPanelHeights((current) => ({
          ...current,
          [panel]: defaultDockPanelHeights[panel],
        }));
      }
      onOpenPanel?.();
    },
    [defaultDockPanelHeights, onOpenPanel],
  );

  const toggleDockPanel = useCallback(
    (panel: DockPanelKey) => {
      if (activeDockPanel === panel) {
        closeDockPanel();
        return;
      }
      openDockPanel(panel);
    },
    [activeDockPanel, closeDockPanel, openDockPanel],
  );

  const applyDockSheetHeight = useCallback((heightPx: number) => {
    const sheetBody = dockSheetBodyRef.current;
    if (!sheetBody) return;
    sheetBody.style.setProperty('--sheet-height', `${Math.round(heightPx)}px`);
  }, []);

  const stopDockSheetDrag = useCallback(
    (nextHeightPx?: number) => {
      const dragState = dockSheetDragStateRef.current;
      if (!dragState) return;

      const resolvedHeightPx = nextHeightPx ?? dragState.currentHeightPx;
      const nextHeightRatio =
        viewportHeight > 0
          ? clampNumber(resolvedHeightPx / viewportHeight, minDockPanelHeights[dragState.panel], 0.9)
          : dockPanelHeightsRef.current[dragState.panel];

      setDockPanelHeights((current) => ({
        ...current,
        [dragState.panel]: nextHeightRatio,
      }));
      setIsDockSheetDragging(false);

      if (dockSheetBodyRef.current) {
        dockSheetBodyRef.current.classList.remove('dragging');
      }

      dockSheetDragStateRef.current = null;
    },
    [minDockPanelHeights, viewportHeight],
  );

  const handleDockSheetDragPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!activeDockPanel || viewportHeight <= 0) return;

      const startingHeightRatio = dockPanelHeightsRef.current[activeDockPanel];
      const startingHeightPx = viewportHeight * startingHeightRatio;

      dockSheetDragStateRef.current = {
        panel: activeDockPanel,
        pointerId: event.pointerId,
        startY: event.clientY,
        startHeightPx: startingHeightPx,
        currentHeightPx: startingHeightPx,
      };

      setIsDockSheetDragging(true);
      applyDockSheetHeight(startingHeightPx);
      dockSheetBodyRef.current?.classList.add('dragging');
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
    },
    [activeDockPanel, applyDockSheetHeight, viewportHeight],
  );

  const handleDockSheetDragPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const dragState = dockSheetDragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId || viewportHeight <= 0) return;

      const minHeightPx = viewportHeight * minDockPanelHeights[dragState.panel];
      const maxHeightPx = viewportHeight * 0.9;
      const nextHeightPx = clampNumber(dragState.startHeightPx + (dragState.startY - event.clientY), minHeightPx, maxHeightPx);
      dragState.currentHeightPx = nextHeightPx;

      if (dockSheetDragFrameRef.current !== null) return;
      dockSheetDragFrameRef.current = window.requestAnimationFrame(() => {
        dockSheetDragFrameRef.current = null;
        const currentDragState = dockSheetDragStateRef.current;
        if (!currentDragState) return;
        applyDockSheetHeight(currentDragState.currentHeightPx);
      });
    },
    [applyDockSheetHeight, minDockPanelHeights, viewportHeight],
  );

  const handleDockSheetDragPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const dragState = dockSheetDragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) return;

      event.currentTarget.releasePointerCapture(event.pointerId);
      stopDockSheetDrag(dragState.currentHeightPx);
    },
    [stopDockSheetDrag],
  );

  const handleDockSheetDragPointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const dragState = dockSheetDragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) return;

      event.currentTarget.releasePointerCapture(event.pointerId);
      stopDockSheetDrag(dragState.currentHeightPx);
    },
    [stopDockSheetDrag],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const mobileQuery = window.matchMedia(mobileMediaQuery);
    const compactQuery = window.matchMedia(compactMediaQuery);

    const handleMotionPreferenceChange = () => setPrefersReducedMotion(reducedMotionQuery.matches);
    const handleMobileChange = () => setIsMobile(mobileQuery.matches);
    const handleCompactChange = () => setIsCompactViewport(compactQuery.matches);
    const syncViewportHeight = () => {
      const nextHeight = window.visualViewport?.height ?? window.innerHeight;
      setViewportHeight((current) => (Math.abs(current - nextHeight) < 1 ? current : nextHeight));
    };

    handleMotionPreferenceChange();
    handleMobileChange();
    handleCompactChange();
    syncViewportHeight();

    reducedMotionQuery.addEventListener('change', handleMotionPreferenceChange);
    mobileQuery.addEventListener('change', handleMobileChange);
    compactQuery.addEventListener('change', handleCompactChange);
    window.addEventListener('resize', syncViewportHeight);
    window.visualViewport?.addEventListener('resize', syncViewportHeight);

    return () => {
      reducedMotionQuery.removeEventListener('change', handleMotionPreferenceChange);
      mobileQuery.removeEventListener('change', handleMobileChange);
      compactQuery.removeEventListener('change', handleCompactChange);
      window.removeEventListener('resize', syncViewportHeight);
      window.visualViewport?.removeEventListener('resize', syncViewportHeight);
    };
  }, [compactMediaQuery, mobileMediaQuery]);

  useEffect(() => {
    dockPanelHeightsRef.current = dockPanelHeights;
  }, [dockPanelHeights]);

  useEffect(() => {
    if (!activeDockPanel || isDockSheetDragging) return;
    const nextHeightPx = viewportHeight > 0 ? Math.round(viewportHeight * dockPanelHeights[activeDockPanel]) : 0;
    applyDockSheetHeight(nextHeightPx);
  }, [activeDockPanel, applyDockSheetHeight, dockPanelHeights, isDockSheetDragging, viewportHeight]);

  useEffect(
    () => () => {
      if (dockSheetDragFrameRef.current !== null) {
        window.cancelAnimationFrame(dockSheetDragFrameRef.current);
      }
    },
    [],
  );

  return {
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
    setIsPinsPanelOpen,
    setIsRoutePanelOpen,
    setIsAgendaPanelOpen,
    setIsPartnersPanelOpen,
    setDockPanelHeights,
  } as const;
};
