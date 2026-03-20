import type {
  ChangeEvent,
  CSSProperties,
  Dispatch,
  RefObject,
  SetStateAction,
} from 'react';
import type { EditingPoi, PointData, PoiType } from '../types';

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

type MapAdminPanelProps = {
  adminImportInputRef: RefObject<HTMLInputElement | null>;
  onImportFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  freeWalkNavigationEnabled: boolean;
  currentSourceMeta: SourceMeta;
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
  filteredAdminPois: PointData[];
  draftPoiIdSet: Set<string>;
  editingPoiId?: string | null;
  getPoiAccentColor: (poi: PointData) => string;
  getPoiBadgeText: (poi: PointData) => string;
  onSelectPoi: (poi: PointData) => void;
  onRestorePrimarySource: () => void;
  onDownloadJson: () => void;
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
  adminDenseInputStyle: CSSProperties;
  adminDenseButtonStyle: CSSProperties;
  onSaveDraft: () => void;
  onPublishNow: () => void;
  onRemoveLocal: (id: string) => void;
  onDeleteFromServer: (id: string) => void;
  onClose: () => void;
};

export const MapAdminPanel = ({
  adminImportInputRef,
  onImportFileChange,
  freeWalkNavigationEnabled,
  currentSourceMeta,
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
  filteredAdminPois,
  draftPoiIdSet,
  editingPoiId,
  getPoiAccentColor,
  getPoiBadgeText,
  onSelectPoi,
  onRestorePrimarySource,
  onDownloadJson,
  onExitAdmin,
}: MapAdminPanelProps) => (
  <>
    <input
      ref={adminImportInputRef}
      type='file'
      accept='application/json'
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
            ? 'Gestao de pontos com navegacao livre ativa. As rotas nao dependem mais do grafo do mapa-logica.'
            : 'Gestao de pontos com base local de seguranca. A malha de rotas continua vindo do grafo local do aplicativo.'}
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
          Importar JSON
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
      <button onClick={onDownloadJson} className='btn btn-success' style={adminDenseButtonStyle}>
        Baixar JSON
      </button>
      <button onClick={onExitAdmin} className='btn btn-danger'>
        Sair do modo admin
      </button>
    </div>
  </>
);

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
  adminDenseInputStyle,
  adminDenseButtonStyle,
  onSaveDraft,
  onPublishNow,
  onRemoveLocal,
  onDeleteFromServer,
  onClose,
}: MapAdminEditorProps) => {
  if (!isOpen || !editingPoi) return null;

  return (
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

      <label className='map-input-label'>URL da foto</label>
      <input
        value={editingPoi.imagemUrl || ''}
        onChange={(event) => setEditingPoi((current) => ({ ...(current ?? {}), imagemUrl: event.target.value }))}
        style={adminDenseInputStyle}
        placeholder='https://...'
      />

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
  );
};
