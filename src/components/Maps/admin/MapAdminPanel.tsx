import { useState, type ChangeEvent, type CSSProperties, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { EditingPoi, PointData, PoiType } from '../types';
import {
  findPoiPhotoOption,
  getStoredPoiPhotoReference,
  getSuggestedPoiPhotoOption,
  poiPhotoLibrary,
  resolvePoiPhotoUrl,
} from '../map/poiPhotos';

type SourceMeta = {
  label: string;
  tint: string;
  tone: string;
};

type AdminAgendaPoiLinkItem = {
  sessionId: string;
  title: string;
  venue: string;
  overridePoiId: string | null;
  resolvedPoiName: string | null;
};

type AdminAgendaPoiLinkOption = {
  id: string;
  nome: string;
  isPubliclyHidden: boolean;
};

type AdminPoiSummaryItem = {
  id: string;
  linhaCompleta: string;
};

type MapAdminPanelProps = {
  adminImportInputRef: RefObject<HTMLInputElement | null>;
  onImportFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  isPinsSummaryOpen: boolean;
  onClosePinsSummary: () => void;
  freeWalkNavigationEnabled: boolean;
  currentSourceMeta: SourceMeta;
  currentMapBuildLabel: string;
  backendSyncLabel: string;
  poisCount: number;
  draftPoiCount: number;
  syncedPoiCount: number;
  disconnectedPoiCount: number;
  onStartNewPoiDraft: () => void;
  onRefreshServer: () => void;
  onOpenJsonImporter: () => void;
  onPublishDrafts: () => void;
  adminDenseButtonStyle: CSSProperties;
  adminDenseInputStyle: CSSProperties;
  adminSearchTerm: string;
  onAdminSearchTermChange: (value: string) => void;
  adminTypeFilter: 'todos' | PoiType;
  onAdminTypeFilterChange: (value: 'todos' | PoiType) => void;
  adminStatusMessage: string | null;
  adminAgendaPoiLinks: AdminAgendaPoiLinkItem[];
  adminAgendaPoiLinkOptions: AdminAgendaPoiLinkOption[];
  onSetAgendaPoiLink: (sessionId: string, poiId: string | null) => void;
  onResetAgendaPoiLinks: () => void;
  allAdminPois: PointData[];
  filteredAdminPois: PointData[];
  draftPoiIdSet: Set<string>;
  editingPoiId?: string | null;
  getPoiAccentColor: (poi: PointData) => string;
  getPoiBadgeText: (poi: PointData) => string;
  onSelectPoi: (poi: PointData) => void;
  onRestorePrimarySource: () => void;
  onDownloadJson: () => void;
  onDownloadLog: () => void;
  onCopyLog: () => void;
  onExitAdmin: () => void;
};

type MapAdminEditorProps = {
  isOpen: boolean;
  editingPoi: EditingPoi | null;
  editingPoiIsDraft: boolean;
  editingPoiExistsOnBackend: boolean;
  freeWalkNavigationEnabled: boolean;
  brandColors: {
    ink: string;
    primaryStrong: string;
    textMuted: string;
    primary: string;
  };
  editingAccentColorPreview: string;
  editingBadgePreview: string;
  hasInvalidEditingAccentColor: boolean;
  setEditingPoi: Dispatch<SetStateAction<EditingPoi | null>>;
  mapWidth: number;
  mapHeight: number;
  adminDenseInputStyle: CSSProperties;
  adminDenseButtonStyle: CSSProperties;
  onPositionInputChange: (x: number, y: number) => void;
  onSaveLocation: () => void;
  onSaveDraft: () => void;
  onPublishNow: () => void;
  onRemoveLocal: (id: string) => void;
  onDeleteFromServer: (id: string) => void;
  onClose: () => void;
};

export const MapAdminPanel = ({
  adminImportInputRef,
  onImportFileChange,
  isPinsSummaryOpen,
  onClosePinsSummary,
  freeWalkNavigationEnabled,
  currentSourceMeta,
  currentMapBuildLabel,
  backendSyncLabel,
  poisCount,
  draftPoiCount,
  syncedPoiCount,
  disconnectedPoiCount,
  onStartNewPoiDraft,
  onRefreshServer,
  onOpenJsonImporter,
  onPublishDrafts,
  adminDenseButtonStyle,
  adminDenseInputStyle,
  adminSearchTerm,
  onAdminSearchTermChange,
  adminTypeFilter,
  onAdminTypeFilterChange,
  adminStatusMessage,
  adminAgendaPoiLinks,
  adminAgendaPoiLinkOptions,
  onSetAgendaPoiLink,
  onResetAgendaPoiLinks,
  allAdminPois,
  filteredAdminPois,
  draftPoiIdSet,
  editingPoiId,
  getPoiAccentColor,
  getPoiBadgeText,
  onSelectPoi,
  onRestorePrimarySource,
  onDownloadJson,
  onDownloadLog,
  onCopyLog,
  onExitAdmin,
}: MapAdminPanelProps) => {
  const adminPoiSummaryRows: AdminPoiSummaryItem[] = [...allAdminPois]
    .sort((left, right) => left.nome.localeCompare(right.nome, 'pt-BR'))
    .map((poi) => {
      const resolvedPhotoOption = findPoiPhotoOption(poi.imagemUrl) ?? getSuggestedPoiPhotoOption(poi.id, poi.nome);
      const localizacao = `x: ${Math.round(poi.x)} | y: ${Math.round(poi.y)}`;
      const fotoAssociada = resolvedPhotoOption?.fileName ?? 'SEM FOTO NA PASTA';
      return {
        id: poi.id,
        linhaCompleta: `${poi.nome}/${localizacao}/${fotoAssociada}`,
      };
    });

  return (
    <>
    <input
      ref={adminImportInputRef}
      type='file'
      accept='.json,application/json'
      onChange={onImportFileChange}
      style={{ display: 'none' }}
    />

    <div
      style={{
        padding: '14px',
        background: 'linear-gradient(180deg, var(--color-ink-soft), var(--color-ink))',
        color: 'var(--color-text-inverse)',
        display: 'grid',
        gap: 8,
      }}
    >
      <div>
        <h2 style={{ margin: 0, fontSize: '16px' }}>Painel administrativo</h2>
        <p style={{ margin: '4px 0 0 0', fontSize: '11px', opacity: 0.82 }}>
          {freeWalkNavigationEnabled
            ? 'Gestao de pontos com navegacao livre ativa. As rotas nao dependem mais do grafo da logica_nova.'
            : 'Gestao de pontos com base local de seguranca. A malha de rotas continua vindo do grafo local da logica_nova.'}
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gap: 6,
          padding: 8,
          borderRadius: 12,
          background: 'rgba(255,255,255,0.18)',
          border: '1px solid rgba(255,255,255,0.18)',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            width: 'fit-content',
            padding: '5px 8px',
            borderRadius: 999,
            background: currentSourceMeta.tint,
            color: currentSourceMeta.tone,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          {currentSourceMeta.label}
        </div>
        <div style={{ fontSize: 11, opacity: 0.88 }}>{backendSyncLabel}</div>
        <div style={{ fontSize: 10, opacity: 0.72 }}>Build atual: {currentMapBuildLabel}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
          {[
            ['Pontos', poisCount],
            ['Rascunhos', draftPoiCount],
            ['Publicados', syncedPoiCount],
            [freeWalkNavigationEnabled ? 'Rota livre' : 'Sem rota', disconnectedPoiCount],
          ].map(([label, value]) => (
            <div
              key={label}
              style={{
                padding: '7px 8px',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.18)',
              }}
            >
              <div style={{ fontSize: 10, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {label}
              </div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>

    <div style={{ padding: '8px', display: 'grid', gap: 6, borderBottom: '1px solid var(--color-border)' }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onStartNewPoiDraft} className='btn btn-primary' style={adminDenseButtonStyle}>
          Novo ponto
        </button>
        <button onClick={onRefreshServer} className='btn btn-neutral' style={adminDenseButtonStyle}>
          Atualizar servidor
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onOpenJsonImporter} className='btn btn-neutral' style={adminDenseButtonStyle}>
          Carregar arquivo (.json)
        </button>
        <button onClick={onPublishDrafts} className='btn btn-success' style={adminDenseButtonStyle}>
          Publicar rascunhos
        </button>
      </div>

      <input
        value={adminSearchTerm}
        onChange={(event) => onAdminSearchTermChange(event.target.value)}
        style={{ ...adminDenseInputStyle, margin: 0 }}
        placeholder='Buscar por nome, selo ou id'
      />

      <select
        value={adminTypeFilter}
        onChange={(event) => onAdminTypeFilterChange(event.target.value as 'todos' | PoiType)}
        style={{ ...adminDenseInputStyle, margin: 0 }}
      >
        <option value='todos'>Todos os tipos</option>
        <option value='atividade'>Atividades</option>
        <option value='servico'>Servicos</option>
        <option value='banheiro'>Banheiros</option>
        <option value='entrada'>Entradas</option>
      </select>

      {adminStatusMessage && (
        <div
          style={{
            padding: '8px 10px',
            borderRadius: 10,
            background: 'rgba(245, 248, 252, 0.95)',
            border: '1px solid rgba(203, 213, 225, 0.8)',
            color: 'var(--color-text-muted)',
            fontSize: 11,
            lineHeight: 1.45,
          }}
        >
          {adminStatusMessage}
        </div>
      )}
    </div>

    <div style={{ flex: 1, overflowY: 'auto', padding: '8px', display: 'grid', gap: 10 }}>
      <section
        style={{
          padding: '10px',
          borderRadius: 12,
          border: '1px solid #edf1f4',
          background: '#f8f7fc',
          display: 'grid',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--color-primary-strong)' }}>Vinculos do cronograma</div>
            <div style={{ fontSize: 11, color: '#6f677f', lineHeight: 1.4 }}>
              Associe manualmente cada sessao a um pin. No modo normal, o publico so consome esse vinculo.
            </div>
          </div>
          <button onClick={onResetAgendaPoiLinks} className='btn btn-neutral' style={adminDenseButtonStyle}>
            Vinculo padrao
          </button>
        </div>

        <div style={{ display: 'grid', gap: 8, maxHeight: 280, overflowY: 'auto', paddingRight: 2 }}>
          {adminAgendaPoiLinks.map((item) => (
            <article
              key={item.sessionId}
              style={{
                padding: '8px 9px',
                borderRadius: 10,
                border: '1px solid #e8e4f1',
                background: '#ffffff',
                display: 'grid',
                gap: 6,
              }}
            >
              <div style={{ display: 'grid', gap: 3 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#261a3f', lineHeight: 1.35 }}>{item.title}</div>
                <div style={{ fontSize: 10, color: '#7b8794' }}>{item.venue}</div>
                {item.resolvedPoiName && (
                  <div style={{ fontSize: 10, color: 'var(--color-primary-strong)' }}>{`Atual: ${item.resolvedPoiName}`}</div>
                )}
              </div>
              <select
                value={item.overridePoiId ?? ''}
                onChange={(event) => onSetAgendaPoiLink(item.sessionId, event.target.value || null)}
                style={{ ...adminDenseInputStyle, margin: 0 }}
              >
                <option value=''>Usar vinculo automatico</option>
                {adminAgendaPoiLinkOptions.map((poi) => (
                  <option key={`${item.sessionId}_${poi.id}`} value={poi.id}>
                    {poi.isPubliclyHidden ? `${poi.nome} (oculto no publico)` : poi.nome}
                  </option>
                ))}
              </select>
            </article>
          ))}
        </div>
      </section>

      <div>
      {filteredAdminPois.map((poi) => {
        const isDraft = draftPoiIdSet.has(poi.id);
        return (
          <button
            key={poi.id}
            onClick={() => onSelectPoi(poi)}
            style={{
              width: '100%',
              border: '1px solid #edf1f4',
              borderRadius: '10px',
              background: editingPoiId === poi.id ? 'var(--color-primary-soft)' : 'white',
              marginBottom: '6px',
              textAlign: 'left',
              padding: '9px',
              cursor: 'pointer',
              boxShadow: editingPoiId === poi.id ? '0 7px 16px rgba(37, 99, 235, 0.07)' : 'none',
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
                  fontSize: '13px',
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
              {poi.tipo.toUpperCase()} {freeWalkNavigationEnabled ? '| rota livre' : poi.nodeId ? '| conectado' : '| sem rota'}
            </div>
            <div style={{ fontSize: '10px', color: '#7b8794', marginTop: '3px' }}>
              x: {Math.round(poi.x)} | y: {Math.round(poi.y)} | id: {poi.id}
            </div>
          </button>
        );
      })}

      {filteredAdminPois.length === 0 && (
        <div
          style={{
            padding: '12px',
            borderRadius: 12,
            border: '1px dashed var(--color-border-strong)',
            color: 'var(--color-text-soft)',
            fontSize: 11,
          }}
        >
          Nenhum ponto encontrado com o filtro atual.
        </div>
      )}
      </div>
    </div>

    <div
      style={{
        padding: '10px',
        borderTop: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <button onClick={onRestorePrimarySource} className='btn btn-neutral' style={adminDenseButtonStyle}>
        Descartar workspace
      </button>
      <button onClick={onOpenJsonImporter} className='btn btn-neutral' style={adminDenseButtonStyle}>
        Carregar arquivo
      </button>
      <button onClick={onCopyLog} className='btn btn-neutral' style={adminDenseButtonStyle}>
        Copiar log
      </button>
      <button onClick={onDownloadLog} className='btn btn-neutral' style={adminDenseButtonStyle}>
        Baixar log
      </button>
      <button onClick={onDownloadJson} className='btn btn-success' style={adminDenseButtonStyle}>
        Baixar JSON
      </button>
      <button onClick={onExitAdmin} className='btn btn-danger'>
        Sair do modo admin
      </button>
    </div>

    {isPinsSummaryOpen && (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 3500,
          background: 'rgba(19, 17, 25, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
        }}
        onClick={onClosePinsSummary}
      >
        <div
          style={{
            width: 'min(1040px, 100%)',
            maxHeight: '86vh',
            background: '#ffffff',
            borderRadius: 18,
            boxShadow: '0 30px 80px rgba(11, 15, 25, 0.28)',
            border: '1px solid rgba(214, 222, 235, 0.9)',
            display: 'grid',
            gridTemplateRows: 'auto minmax(0, 1fr)',
            overflow: 'hidden',
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <div
            style={{
              padding: '16px 18px 12px',
              borderBottom: '1px solid #edf1f4',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div style={{ display: 'grid', gap: 4 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#1f1a33' }}>Lista completa dos pins</div>
              <div style={{ fontSize: 12, color: '#687385' }}>
                {adminPoiSummaryRows.length} linha(s) com nome, foto associada e localizacao x/y.
              </div>
            </div>
            <button
              type='button'
              onClick={onClosePinsSummary}
              style={{ ...adminDenseButtonStyle, minWidth: 92 }}
              className='btn btn-neutral'
            >
              Fechar
            </button>
          </div>

          <div style={{ padding: '16px 18px 18px', overflowY: 'auto' }}>
            <div style={{ display: 'grid', gap: 8 }}>
              {adminPoiSummaryRows.map((row) => (
                <div
                  key={row.id}
                  style={{
                    padding: '10px',
                    borderRadius: 12,
                    border: '1px solid #e7eaf0',
                    background: '#fbfcfe',
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      color: '#23193a',
                      lineHeight: 1.5,
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {row.linhaCompleta}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )}
  </>
  );
};

export const MapAdminEditor = ({
  isOpen,
  editingPoi,
  editingPoiIsDraft,
  editingPoiExistsOnBackend,
  freeWalkNavigationEnabled,
  brandColors,
  editingAccentColorPreview,
  editingBadgePreview,
  hasInvalidEditingAccentColor,
  setEditingPoi,
  mapWidth,
  mapHeight,
  adminDenseInputStyle,
  adminDenseButtonStyle,
  onPositionInputChange,
  onSaveLocation,
  onSaveDraft,
  onPublishNow,
  onRemoveLocal,
  onDeleteFromServer,
  onClose,
}: MapAdminEditorProps) => {
  const [isPhotoLibraryOpen, setIsPhotoLibraryOpen] = useState(false);
  const selectedPhotoOption = findPoiPhotoOption(editingPoi?.imagemUrl);
  const selectedPhotoPreviewUrl = resolvePoiPhotoUrl(editingPoi?.imagemUrl);
  const hasSelectedPhoto = Boolean(editingPoi?.imagemUrl && editingPoi.imagemUrl.trim().length > 0);
  const suggestedPhotoOption = getSuggestedPoiPhotoOption(editingPoi?.id, editingPoi?.nome);
  const suggestedPhotoReference = suggestedPhotoOption ? getStoredPoiPhotoReference(suggestedPhotoOption) : null;
  const canApplySuggestedPhoto = Boolean(suggestedPhotoReference && suggestedPhotoReference !== (editingPoi?.imagemUrl?.trim() ?? ''));

  if (!isOpen || !editingPoi) return null;

  return (
    <>
      <div
        style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          width: '300px',
          maxHeight: '84vh',
          overflowY: 'auto',
          background: 'var(--color-surface)',
          padding: '14px',
          borderRadius: '10px',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-float)',
          zIndex: 3000,
        }}
        className='map-floating-panel'
      >
        <h3 style={{ marginTop: 0, marginBottom: '10px', fontSize: '16px' }}>{editingPoi.id ? 'Editar ponto' : 'Novo ponto'}</h3>

        <div
          style={{
            display: 'grid',
            gap: 8,
            marginBottom: 10,
            padding: '8px 10px',
            borderRadius: 10,
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
                color: editingPoiIsDraft ? brandColors.ink : brandColors.primaryStrong,
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
                color: editingPoiExistsOnBackend ? brandColors.primaryStrong : brandColors.textMuted,
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              {editingPoiExistsOnBackend ? 'Ja esta no servidor' : 'Ainda nao publicado'}
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            x: {typeof editingPoi.x === 'number' ? Math.round(editingPoi.x) : '-'} | y:{' '}
            {typeof editingPoi.y === 'number' ? Math.round(editingPoi.y) : '-'} | node:{' '}
            {freeWalkNavigationEnabled ? 'livre' : editingPoi.nodeId || 'sem conexao'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-soft)' }}>
            Clique no mapa, arraste o pin ou ajuste x/y abaixo para acertar a posicao final.
          </div>
        </div>

        <label className='map-input-label'>Nome</label>
        <input
          value={editingPoi.nome || ''}
          onChange={(event) => setEditingPoi((current) => ({ ...(current ?? {}), nome: event.target.value }))}
          style={adminDenseInputStyle}
          placeholder='Ex: Palco Principal'
        />

        <label className='map-input-label'>Tipo</label>
        <select
          value={editingPoi.tipo || 'atividade'}
          onChange={(event) => setEditingPoi((current) => ({ ...(current ?? {}), tipo: event.target.value as PoiType }))}
          style={adminDenseInputStyle}
        >
          <option value='atividade'>Atividade</option>
          <option value='servico'>Servico</option>
          <option value='banheiro'>Banheiro</option>
          <option value='entrada'>Entrada</option>
        </select>

        <label className='map-input-label'>Descricao</label>
        <input
          value={editingPoi.descricao || ''}
          onChange={(event) => setEditingPoi((current) => ({ ...(current ?? {}), descricao: event.target.value }))}
          style={adminDenseInputStyle}
          placeholder='Informacao curta sobre o ponto'
        />

        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          <div>
            <label className='map-input-label'>X</label>
            <input
              type='number'
              min={0}
              max={mapWidth}
              step={1}
              value={typeof editingPoi.x === 'number' ? Math.round(editingPoi.x) : ''}
              onChange={(event) => {
                const nextX = Number(event.target.value);
                if (!Number.isFinite(nextX) || typeof editingPoi.y !== 'number') return;
                onPositionInputChange(nextX, editingPoi.y);
              }}
              style={adminDenseInputStyle}
              placeholder='0'
            />
          </div>
          <div>
            <label className='map-input-label'>Y</label>
            <input
              type='number'
              min={0}
              max={mapHeight}
              step={1}
              value={typeof editingPoi.y === 'number' ? Math.round(editingPoi.y) : ''}
              onChange={(event) => {
                const nextY = Number(event.target.value);
                if (!Number.isFinite(nextY) || typeof editingPoi.x !== 'number') return;
                onPositionInputChange(editingPoi.x, nextY);
              }}
              style={adminDenseInputStyle}
              placeholder='0'
            />
          </div>
        </div>

        <button onClick={onSaveLocation} style={{ ...adminDenseButtonStyle, width: '100%' }} className='btn btn-neutral'>
          Salvar localizacao
        </button>

        <label className='map-input-label'>Foto do pin</label>
        <div style={{ display: 'grid', gap: 8 }}>
          <div
            style={{
              padding: '10px',
              borderRadius: 12,
              border: '1px solid #e6e9ef',
              background: '#f8f7fc',
              display: 'grid',
              gap: 8,
            }}
          >
            {hasSelectedPhoto ? (
              <div
                style={{
                  display: 'grid',
                  gap: 8,
                  padding: '8px',
                  borderRadius: 10,
                  background: '#ffffff',
                  border: '1px solid #ebe7f6',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    aspectRatio: '16 / 9',
                    borderRadius: 10,
                    overflow: 'hidden',
                    background: '#efeaf9',
                    border: '1px solid #e1dbef',
                  }}
                >
                  <img
                    src={selectedPhotoPreviewUrl ?? editingPoi.imagemUrl}
                    alt={selectedPhotoOption?.label || editingPoi.nome || 'Preview da foto do pin'}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                </div>
                <div style={{ fontSize: 11, color: '#5f6c7a', lineHeight: 1.45 }}>
                  {selectedPhotoOption
                    ? `Selecionada da fotopins: ${selectedPhotoOption.label}`
                    : 'Imagem externa selecionada manualmente.'}
                </div>
              </div>
            ) : (
              <div
                style={{
                  padding: '10px',
                  borderRadius: 10,
                  border: '1px dashed #d7dce6',
                  color: '#6d7485',
                  fontSize: 11,
                  background: '#ffffff',
                }}
              >
                Nenhuma foto vinculada ainda.
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {canApplySuggestedPhoto && suggestedPhotoOption && (
                <button
                  type='button'
                  onClick={() => setEditingPoi((current) => ({ ...(current ?? {}), imagemUrl: suggestedPhotoReference ?? '' }))}
                  style={adminDenseButtonStyle}
                  className='btn btn-success'
                >
                  Usar foto sugerida
                </button>
              )}
              <button
                type='button'
                onClick={() => setIsPhotoLibraryOpen(true)}
                style={adminDenseButtonStyle}
                className='btn btn-primary'
              >
                Escolher da fotopins
              </button>
              {hasSelectedPhoto && (
                <button
                  type='button'
                  onClick={() => setEditingPoi((current) => ({ ...(current ?? {}), imagemUrl: '' }))}
                  style={adminDenseButtonStyle}
                  className='btn btn-neutral'
                >
                  Remover foto
                </button>
              )}
            </div>

            {suggestedPhotoOption && (
              <div style={{ fontSize: 10, color: '#5f6c7a', lineHeight: 1.45 }}>
                Sugestao automatica pelo nome do pin: {suggestedPhotoOption.fileName}
              </div>
            )}

            <div style={{ fontSize: 10, color: '#6b7280', lineHeight: 1.45 }}>
              A galeria abaixo usa automaticamente todos os arquivos de `src/assets/fotopins` e salva uma referencia estavel do arquivo no JSON.
            </div>
            <div style={{ fontSize: 10, color: '#6b7280', lineHeight: 1.45 }}>
              Fotopins disponiveis nesta build: {poiPhotoLibrary.length} arquivo(s).
            </div>
          </div>

          <input
            value={editingPoi.imagemUrl || ''}
            onChange={(event) => setEditingPoi((current) => ({ ...(current ?? {}), imagemUrl: event.target.value }))}
            style={adminDenseInputStyle}
            placeholder='Selecione na galeria ou cole uma URL externa'
          />
        </div>

        <label className='map-input-label'>Contato (opcional)</label>
        <input
          value={editingPoi.contato || ''}
          onChange={(event) => setEditingPoi((current) => ({ ...(current ?? {}), contato: event.target.value }))}
          style={adminDenseInputStyle}
          placeholder='Telefone, e-mail ou URL'
        />

        <label className='map-input-label'>Cor de destaque (opcional)</label>
        <input
          value={editingPoi.corDestaque || ''}
          onChange={(event) => setEditingPoi((current) => ({ ...(current ?? {}), corDestaque: event.target.value }))}
          style={adminDenseInputStyle}
          placeholder={brandColors.primary}
        />
        {hasInvalidEditingAccentColor && (
          <div style={{ marginTop: '-6px', marginBottom: 7, fontSize: 10, color: 'var(--color-primary-strong)' }}>
            Use apenas cores da paleta: `#6a38d0`, `#4b229f`, `#8d6fe7` ou `#d9c8ff`.
          </div>
        )}

        <label className='map-input-label'>Selo do ponto (opcional)</label>
        <input
          value={editingPoi.selo || ''}
          onChange={(event) => setEditingPoi((current) => ({ ...(current ?? {}), selo: event.target.value }))}
          style={adminDenseInputStyle}
          placeholder='Ex: PAL, WC, VIP'
        />

        <div
          style={{
            marginTop: '-2px',
            marginBottom: 7,
            padding: '6px 8px',
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
          <span style={{ fontSize: 11, color: '#4f647d' }}>Previa do destaque visual deste ponto.</span>
        </div>

        <div style={{ display: 'grid', gap: 10, marginTop: '12px' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onSaveDraft} style={adminDenseButtonStyle} className='btn btn-neutral'>
              Salvar rascunho
            </button>
            <button onClick={onPublishNow} style={adminDenseButtonStyle} className='btn btn-primary'>
              Publicar agora
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {editingPoi.id && (
              <button onClick={() => onRemoveLocal(editingPoi.id!)} style={adminDenseButtonStyle} className='btn btn-neutral'>
                Remover local
              </button>
            )}
            {editingPoi.id && editingPoiExistsOnBackend && (
              <button onClick={() => onDeleteFromServer(editingPoi.id!)} style={adminDenseButtonStyle} className='btn btn-danger'>
                Excluir do servidor
              </button>
            )}
          </div>

          <button onClick={onClose} style={{ ...adminDenseButtonStyle, width: '100%' }} className='btn btn-neutral'>
            Fechar
          </button>
        </div>
      </div>

      {isPhotoLibraryOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 3400,
            background: 'rgba(19, 17, 25, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setIsPhotoLibraryOpen(false)}
        >
          <div
            style={{
              width: 'min(960px, 100%)',
              maxHeight: '86vh',
              background: '#ffffff',
              borderRadius: 18,
              boxShadow: '0 30px 80px rgba(11, 15, 25, 0.28)',
              border: '1px solid rgba(214, 222, 235, 0.9)',
              display: 'grid',
              gridTemplateRows: 'auto minmax(0, 1fr)',
              overflow: 'hidden',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div
              style={{
                padding: '16px 18px 12px',
                borderBottom: '1px solid #edf1f4',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div style={{ display: 'grid', gap: 4 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#1f1a33' }}>Selecionar foto do pin</div>
                <div style={{ fontSize: 12, color: '#687385' }}>
                  Todos os arquivos encontrados em `src/assets/fotopins` aparecem aqui automaticamente.
                </div>
              </div>
              <button
                type='button'
                onClick={() => setIsPhotoLibraryOpen(false)}
                style={{ ...adminDenseButtonStyle, minWidth: 92 }}
                className='btn btn-neutral'
              >
                Fechar
              </button>
            </div>

            <div style={{ padding: '16px 18px 18px', overflowY: 'auto' }}>
              {poiPhotoLibrary.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                  {poiPhotoLibrary.map((photo) => {
                    const isSelected = selectedPhotoOption?.id === photo.id;

                    return (
                      <button
                        key={photo.id}
                        type='button'
                        onClick={() => {
                          setEditingPoi((current) => ({ ...(current ?? {}), imagemUrl: getStoredPoiPhotoReference(photo) }));
                          setIsPhotoLibraryOpen(false);
                        }}
                        style={{
                          border: isSelected ? '2px solid var(--color-primary)' : '1px solid #e7eaf0',
                          borderRadius: 14,
                          background: isSelected ? 'rgba(106, 56, 208, 0.06)' : '#ffffff',
                          padding: 10,
                          textAlign: 'left',
                          cursor: 'pointer',
                          display: 'grid',
                          gap: 8,
                          boxShadow: isSelected ? '0 14px 30px rgba(106, 56, 208, 0.12)' : 'none',
                        }}
                      >
                        <div
                          style={{
                            width: '100%',
                            aspectRatio: '1 / 1',
                            borderRadius: 10,
                            overflow: 'hidden',
                            background: '#f4f3f8',
                            border: '1px solid #ebe7f6',
                          }}
                        >
                          <img
                            src={photo.url}
                            alt={photo.label}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          />
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#23193a', lineHeight: 1.35 }}>{photo.label}</div>
                        <div style={{ fontSize: 10, color: '#758195', lineHeight: 1.35 }}>{photo.fileName}</div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div
                  style={{
                    padding: '18px',
                    borderRadius: 14,
                    border: '1px dashed #cfd7e3',
                    color: '#6b7280',
                    background: '#fafbfc',
                    fontSize: 12,
                  }}
                >
                  Nenhuma imagem foi encontrada na pasta `src/assets/fotopins`.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
