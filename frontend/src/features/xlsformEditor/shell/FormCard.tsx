// =============================================================================
// shell/FormCard.tsx — tarjeta de un formulario en la biblioteca del hub
// =============================================================================
// Muestra nombre (con rename inline), métricas (preguntas / secciones),
// origen con su ícono, última edición relativa, y un menú de acciones
// (Abrir, Renombrar, Duplicar, Eliminar con confirmación). El formulario
// activo se resalta. Las métricas se calculan con `formCardMetrics` (lógica
// pura y testeada); este .tsx solo presenta.
// =============================================================================

import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  Cloud,
  Copy,
  FilePlus2,
  FileSpreadsheet,
  MoreHorizontal,
  Pencil,
  Trash2,
  Clock,
  FolderOpen,
  Lock,
} from "../../../vendor/lucide-react";
import type { XlsformFormPublication } from "../../../api/client";
import type { LibraryEntry } from "../state/persistence";
import { FormPublicationStatus } from "./InstrumentRevisionStatus";
import {
  formatRelativeSavedAt,
  normalizeOrigin,
  originLabel,
  type FormCardMetrics,
  type FormOrigin,
} from "./formCardMetrics";

export type FormCardProps = {
  entry: LibraryEntry;
  metrics: FormCardMetrics;
  isActive: boolean;
  onOpen: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onDuplicate?: (id: string) => void;
  publication: XlsformFormPublication;
  isPublishing: boolean;
  isConfirmingLogic: boolean;
  publicationError?: string;
  onPublish: (id: string) => void;
  onConfirmLogic: (id: string) => void;
};

const ORIGIN_ACCENT: Record<FormOrigin, { accent: string; soft: string }> = {
  blank: { accent: "var(--pulso-module-editor)", soft: "var(--pulso-module-editor-soft)" },
  xlsform: { accent: "var(--pulso-module-processing)", soft: "var(--pulso-module-processing-soft)" },
  surveymonkey: { accent: "var(--pulso-module-sample)", soft: "var(--pulso-module-sample-soft)" },
};

function OriginIcon({ origin }: { origin: FormOrigin }) {
  if (origin === "xlsform") return <FileSpreadsheet size={19} />;
  if (origin === "surveymonkey") return <Cloud size={19} />;
  return <FilePlus2 size={19} />;
}

export function FormCard({
  entry,
  metrics,
  isActive,
  onOpen,
  onRename,
  onDelete,
  onDuplicate,
  publication,
  isPublishing,
  isConfirmingLogic,
  publicationError,
  onPublish,
  onConfirmLogic,
}: FormCardProps) {
  const origin = normalizeOrigin(entry.source?.kind ?? null);
  const accent = ORIGIN_ACCENT[origin];

  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [draftName, setDraftName] = useState(entry.name);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (renaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [renaming]);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  function startRename() {
    setDraftName(entry.name);
    setRenaming(true);
    setMenuOpen(false);
  }

  function commitRename() {
    const next = draftName.trim();
    setRenaming(false);
    if (next && next !== entry.name) onRename(entry.id, next);
  }

  const cardStyle = {
    "--xf-card-accent": accent.accent,
    "--xf-card-accent-soft": accent.soft,
  } as CSSProperties;

  return (
    <div
      ref={wrapperRef}
      className={`pulso-xf-home-card${isActive ? " is-active" : ""}`}
      style={cardStyle}
      data-form-id={entry.id}
    >
      <div className="pulso-xf-home-card-top">
        <span className="pulso-xf-home-card-icon" aria-hidden="true">
          <OriginIcon origin={origin} />
        </span>
        <div className="pulso-xf-home-card-heading">
          {renaming ? (
            <input
              ref={inputRef}
              className="pulso-xf-home-card-name-input"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") setRenaming(false);
              }}
              aria-label="Nombre del formulario"
            />
          ) : (
            <span
              className="pulso-xf-home-card-name"
              title={entry.name}
              onDoubleClick={startRename}
            >
              {entry.name}
            </span>
          )}
          <span className="pulso-xf-home-card-origin">{originLabel(origin)}</span>
          {isActive && (
            <span className="pulso-xf-home-card-active-badge">Activo</span>
          )}
        </div>
        <div className="pulso-xf-home-card-menu">
          <button
            type="button"
            className="pulso-xf-home-card-menu-trigger"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Acciones del formulario"
            onClick={() => {
              setMenuOpen((v) => !v);
              setConfirmDelete(false);
            }}
          >
            <MoreHorizontal size={16} />
          </button>
          {menuOpen && (
            <div className="pulso-xf-home-card-menu-pop" role="menu">
              <button
                type="button"
                role="menuitem"
                className="pulso-xf-home-card-menu-item"
                onClick={() => {
                  setMenuOpen(false);
                  onOpen(entry.id);
                }}
              >
                <FolderOpen size={15} /> Abrir
              </button>
              <button
                type="button"
                role="menuitem"
                className="pulso-xf-home-card-menu-item"
                onClick={startRename}
              >
                <Pencil size={15} /> Renombrar
              </button>
              {onDuplicate && (
                <button
                  type="button"
                  role="menuitem"
                  className="pulso-xf-home-card-menu-item"
                  onClick={() => {
                    setMenuOpen(false);
                    onDuplicate(entry.id);
                  }}
                >
                  <Copy size={15} /> Duplicar
                </button>
              )}
              <span className="pulso-xf-home-card-menu-divider" aria-hidden="true" />
              <button
                type="button"
                role="menuitem"
                className="pulso-xf-home-card-menu-item is-danger"
                disabled={!publication.can_delete}
                title={publication.can_delete
                  ? "Eliminar formulario"
                  : "Las revisiones publicadas son inmutables y no se pueden eliminar"}
                onClick={() => {
                  if (!publication.can_delete) return;
                  setMenuOpen(false);
                  setConfirmDelete(true);
                }}
              >
                {publication.can_delete ? <Trash2 size={15} /> : <Lock size={15} />}
                {publication.can_delete ? "Eliminar" : "Publicado: no eliminable"}
              </button>
            </div>
          )}
        </div>
      </div>

      {confirmDelete ? (
        <div className="pulso-xf-home-card-confirm" role="alertdialog" aria-label="Confirmar eliminación">
          <span className="pulso-xf-home-card-confirm-text">
            ¿Eliminar «{entry.name}»? Esta acción no se puede deshacer.
          </span>
          <div className="pulso-xf-home-card-confirm-actions">
            <button
              type="button"
              className="pulso-xf-home-card-confirm-btn"
              onClick={() => setConfirmDelete(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="pulso-xf-home-card-confirm-btn is-danger"
              onClick={() => {
                setConfirmDelete(false);
                onDelete(entry.id);
              }}
            >
              Eliminar
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="pulso-xf-home-card-metrics">
            <span className="pulso-xf-home-card-metric">
              <span className="pulso-xf-home-card-metric-value">{metrics.questions}</span>
              <span className="pulso-xf-home-card-metric-label">
                {metrics.questions === 1 ? "pregunta" : "preguntas"}
              </span>
            </span>
            <span className="pulso-xf-home-card-metric">
              <span className="pulso-xf-home-card-metric-value">{metrics.sections}</span>
              <span className="pulso-xf-home-card-metric-label">
                {metrics.sections === 1 ? "sección" : "secciones"}
              </span>
            </span>
          </div>
          <FormPublicationStatus
            formId={entry.id}
            publication={publication}
            isPublishing={isPublishing}
            isConfirmingLogic={isConfirmingLogic}
            error={publicationError}
            onPublish={() => onPublish(entry.id)}
            onConfirmLogic={() => onConfirmLogic(entry.id)}
          />
          <div className="pulso-xf-home-card-foot">
            <span className="pulso-xf-home-card-saved">
              <Clock size={12} /> {formatRelativeSavedAt(entry.savedAt)}
            </span>
            <button
              type="button"
              className="pulso-xf-home-card-open"
              onClick={() => onOpen(entry.id)}
            >
              <FolderOpen size={13} /> Abrir
            </button>
          </div>
        </>
      )}
    </div>
  );
}
