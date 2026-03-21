import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { BACKEND_POIS_BOOTSTRAP_ENABLED, fetchMapBootstrap, type MapPoiDto } from '../../../services/mapApi';
import type { AgendaSessionPoiLinkOverrides, PoiDataSource, PointData } from '../types';

type UseMapBootstrapOptions = {
  poiDataSource: PoiDataSource;
  draftPoiIdsLength: number;
  fromApiPoi: (poi: MapPoiDto) => PointData;
  sanitizePoiCollection: (poiList: PointData[]) => PointData[];
  persistPoiRuntimeBackup: (value: PointData[]) => void;
  sanitizeAgendaPoiLinkRecord: (value: unknown) => AgendaSessionPoiLinkOverrides;
  clearAdminWorkspaceSnapshot: () => void;
  setBackendSyncState: Dispatch<SetStateAction<'loading' | 'ready' | 'error'>>;
  setServerPois: Dispatch<SetStateAction<PointData[]>>;
  setAdminAgendaPoiLinks: Dispatch<SetStateAction<AgendaSessionPoiLinkOverrides>>;
  setPois: Dispatch<SetStateAction<PointData[]>>;
  setPoiDataSource: Dispatch<SetStateAction<PoiDataSource>>;
  setDraftPoiIds: Dispatch<SetStateAction<string[]>>;
  setAdminStatusMessage: Dispatch<SetStateAction<string | null>>;
};

export const useMapBootstrap = ({
  poiDataSource,
  draftPoiIdsLength,
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
}: UseMapBootstrapOptions) => {
  const hasLoggedBootstrapFailureRef = useRef(false);

  const syncBootstrap = useCallback(
    async (options?: { forceReplace?: boolean }) => {
      try {
        setBackendSyncState('loading');
        const bootstrap = await fetchMapBootstrap();
        const backendPois = BACKEND_POIS_BOOTSTRAP_ENABLED && Array.isArray(bootstrap.pois)
          ? sanitizePoiCollection(bootstrap.pois.map(fromApiPoi))
          : [];
        const backendAgendaPoiLinks = sanitizeAgendaPoiLinkRecord(bootstrap.agendaPoiLinks);

        setServerPois(backendPois);
        setAdminAgendaPoiLinks(backendAgendaPoiLinks);
        persistPoiRuntimeBackup(backendPois);
        setBackendSyncState('ready');
        hasLoggedBootstrapFailureRef.current = false;

        const shouldPreserveWorkspace =
          !options?.forceReplace && poiDataSource === 'local-workspace' && draftPoiIdsLength > 0;
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
            ? 'Servidor sincronizado em segundo plano. Sua edicao local continua ativa para revisao.'
            : BACKEND_POIS_BOOTSTRAP_ENABLED
              ? 'Dados do servidor carregados com sucesso.'
              : 'Bootstrap do servidor carregado sem importar POIs. A base local continua ativa.',
        );
      } catch (error) {
        if (!hasLoggedBootstrapFailureRef.current) {
          console.warn('Bootstrap do mapa indisponivel no backend. O app vai continuar com a base local.', error);
          hasLoggedBootstrapFailureRef.current = true;
        }
        setBackendSyncState('error');
        setAdminStatusMessage(
          poiDataSource === 'local-workspace'
            ? 'Nao foi possivel atualizar o servidor agora, mas sua edicao local continua disponivel.'
            : 'Servidor indisponivel. O mapa segue usando a base local.',
        );
      }
    },
    [
      clearAdminWorkspaceSnapshot,
      draftPoiIdsLength,
      fromApiPoi,
      sanitizePoiCollection,
      persistPoiRuntimeBackup,
      poiDataSource,
      sanitizeAgendaPoiLinkRecord,
      setAdminAgendaPoiLinks,
      setAdminStatusMessage,
      setBackendSyncState,
      setDraftPoiIds,
      setPoiDataSource,
      setPois,
      setServerPois,
    ],
  );

  useEffect(() => {
    void syncBootstrap();
  }, [syncBootstrap]);

  return {
    syncBootstrap,
  };
};
