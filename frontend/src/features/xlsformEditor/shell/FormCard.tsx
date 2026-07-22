// =============================================================================
// shell/FormCard.tsx — tarjeta de un formulario en la biblioteca del hub
// =============================================================================
// Muestra nombre (con rename inline), métricas (preguntas / secciones),
// origen con su ícono, última edición relativa, y un menú de acciones
// (Abrir, Renombrar, Duplicar, Eliminar con confirmación). El formulario
// activo se resalta. Las métricas se calculan con `formCardMetrics` (lógica
// pura y testeada); este .tsx solo presenta.
// =============================================================================

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
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
import type { InstrumentActorOption } from "./actorAssignmentModel";
import { FormPublicationStatus } from "./InstrumentRevisionStatus";
import {
  formatRelativeSavedAt,
  normalizeOrigin,
  originLabel,
  type FormCardMetrics,
  type FormOrigin,
} from "./formCardMetrics";
import { getFormWorkflowView, instrumentActorLabel } from "./formWorkflowView";

export type ActorCatalogStatus = "loading" | "ready" | "empty" | "error";

export type FormCardProps = {
  entry: LibraryEntry;
  metrics: FormCardMetrics;
  isActive: boolean;
  onOpen: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onDuplicate?: (id: string) => void;
  publication: XlsformFormPublication | null;
  isPublishing: boolean;
  isConfirmingLogic: boolean;
  publicationError?: string;
  onPublish: (id: string) => void;
  onConfirmLogic: (id: string) => void;
  actorOptions: InstrumentActorOption[];
  onActorChange: (id: string, actorKey: string) => void;
  actorCatalogStatus?: ActorCatalogStatus;
  isAssigningActor?: boolean;
};

const ORIGIN_ACCENT: Record<FormOrigin, { accent: string; soft: string }> = {
  blank: { accent: "var(--pulso-module-editor)", soft: "var(--pulso-module-editor-soft)" },
  xlsform: { accent: "var(--pulso-module-editor)", soft: "var(--pulso-module-editor-soft)" },
  surveymonkey: { accent: "var(--pulso-module-editor)", soft: "var(--pulso-module-editor-soft)" },
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
  actorOptions,
  onActorChange,
  actorCatalogStatus = "ready",
  isAssigningActor = false,
}: FormCardProps) {
  const origin = normalizeOrigin(entry.source?.kind ?? null);
  const accent = ORIGIN_ACCENT[origin];

  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [draftName, setDraftName] = useState(entry.name);
  const wrapperRef = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const actorSelectRef = useRef<HTMLSelectElement | null>(null);
  const headingId = `pulso-xf-form-${entry.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const selectedActor = actorOptions.find((option) => option.actor_key === entry.source?.actor_key);
  const audienceRequired = Boolean(
    actorOptions.length
    || entry.source?.schema === "acreditacion_actor_instrument_draft/v1"
    || publication?.blockers.some((blocker) => (
      blocker.id === "actor_required" || blocker.id === "actor_not_in_catalog"
    )),
  );
  const workflow = publication
    ? getFormWorkflowView(
        publication,
        actorOptions,
        entry.source?.actor_key,
        audienceRequired,
      )
    : null;

  useEffect(() => {
    if (renaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [renaming]);

  useEffect(() => {
    if (!menuOpen) return;
    menuRef.current?.querySelector<HTMLButtonElement>("[role='menuitem']:not(:disabled)")?.focus();
    function onDocClick(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  function closeMenuAndRestoreFocus() {
    setMenuOpen(false);
    requestAnimationFrame(() => menuTriggerRef.current?.focus());
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>("[role='menuitem']:not(:disabled)") ?? [],
    );
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenuAndRestoreFocus();
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) || items.length === 0) return;
    event.preventDefault();
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "Home"
      ? 0
      : event.key === "End"
        ? items.length - 1
        : event.key === "ArrowDown"
          ? (current + 1 + items.length) % items.length
          : (current - 1 + items.length) % items.length;
    items[next]?.focus();
  }

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
    <article
      ref={wrapperRef}
      className={`pulso-xf-home-card${isActive ? " is-active" : ""}`}
      style={cardStyle}
      data-form-id={entry.id}
      aria-labelledby={headingId}
    >
      <div className="pulso-xf-home-card-top">
        <span className="pulso-xf-home-card-icon" aria-hidden="true">
          <OriginIcon origin={origin} />
        </span>
        <div className="pulso-xf-home-card-heading">
          {renaming ? (
            <input
              id={headingId}
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
            <h3 id={headingId} className="pulso-xf-home-card-name" title={entry.name} onDoubleClick={startRename}>
              {entry.name}
            </h3>
          )}
          <span className="pulso-xf-home-card-origin">{originLabel(origin)}</span>
          {isActive && (
            <span className="pulso-xf-home-card-active-badge">Activo</span>
          )}
        </div>
        <div className="pulso-xf-home-card-menu">
          <button
            ref={menuTriggerRef}
            type="button"
            className="pulso-xf-home-card-menu-trigger"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={`Acciones de ${entry.name}`}
            onClick={() => {
              setMenuOpen((v) => !v);
              setConfirmDelete(false);
            }}
          >
            <MoreHorizontal size={16} />
          </button>
          {menuOpen && (
            <div
              ref={menuRef}
              className="pulso-xf-home-card-menu-pop"
              role="menu"
              aria-label={`Acciones de ${entry.name}`}
              onKeyDown={onMenuKeyDown}
            >
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
                disabled={!publication?.can_delete}
                title={publication?.can_delete
                  ? "Eliminar formulario"
                  : "Las revisiones publicadas son inmutables y no se pueden eliminar"}
                onClick={() => {
                  if (!publication?.can_delete) return;
                  setMenuOpen(false);
                  setConfirmDelete(true);
                }}
              >
                {publication?.can_delete ? <Trash2 size={15} /> : <Lock size={15} />}
                {publication?.can_delete ? "Eliminar" : "No se puede eliminar"}
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
          {workflow ? (
            <div className="pulso-xf-home-card-workflow" aria-label={`Flujo de ${entry.name}`}>
              {([
                ["Lógica", workflow.logic],
                ["Público", workflow.audience],
                ["Procesamiento", workflow.processing],
              ] as const).map(([title, stage]) => (
                <div key={title} className={`pulso-xf-home-card-stage is-${stage.tone}`}>
                  <span className="pulso-xf-home-card-stage-title">{title}</span>
                  <strong>{stage.label}</strong>
                  <small>{stage.detail}</small>
                </div>
              ))}
            </div>
          ) : null}
          {audienceRequired ? <label className="pulso-xf-home-card-actor">
            <span>Público del instrumento</span>
            <select
              ref={actorSelectRef}
              value={selectedActor?.actor_key ?? ""}
              onChange={(event) => onActorChange(entry.id, event.target.value)}
              disabled={
                isPublishing
                || isConfirmingLogic
                || isAssigningActor
                || actorCatalogStatus !== "ready"
              }
              aria-label={`Público del instrumento ${entry.name}`}
              aria-busy={isAssigningActor || actorCatalogStatus === "loading"}
            >
              <option value="">Elige un público</option>
              {actorOptions.map((option) => (
                <option key={option.actor_key} value={option.actor_key}>
                  {instrumentActorLabel(option)}
                </option>
              ))}
            </select>
            <small>
              {isAssigningActor
                ? "Guardando el público en el proyecto…"
                : actorCatalogStatus === "loading"
                  ? "Consultando los públicos disponibles…"
                  : actorCatalogStatus === "error"
                    ? "No pudimos consultar los públicos. Vuelve a abrir el proyecto para intentarlo otra vez."
                    : actorCatalogStatus === "empty"
                      ? "Este proyecto todavía no tiene públicos configurados para Procesamiento."
                      : !selectedActor && entry.source?.actor_key
                        ? "La asignación anterior ya no existe. Elige un público disponible."
                        : publication?.latest_revision
                          ? "La revisión publicada seguirá disponible hasta que publiques este cambio."
                          : "Asigna a quién responde el instrumento antes de publicarlo."}
            </small>
          </label> : null}
          <FormPublicationStatus
            formId={entry.id}
            publication={publication}
            isPublishing={isPublishing}
            isConfirmingLogic={isConfirmingLogic}
            error={publicationError}
            onPublish={() => onPublish(entry.id)}
            onConfirmLogic={() => onConfirmLogic(entry.id)}
            primaryAction={
              workflow?.primaryAction === "assign_audience"
                && actorCatalogStatus !== "ready"
                ? "open"
                : workflow?.primaryAction
            }
            onAssignAudience={() => actorSelectRef.current?.focus()}
          />
          <div className="pulso-xf-home-card-foot">
            <span className="pulso-xf-home-card-saved">
              <Clock size={12} /> {formatRelativeSavedAt(entry.savedAt)}
            </span>
            <button
              type="button"
              className="pulso-xf-home-card-open"
              onClick={() => onOpen(entry.id)}
              aria-label={`Abrir ${entry.name}`}
            >
              <FolderOpen size={13} /> Abrir
            </button>
          </div>
        </>
      )}
    </article>
  );
}
