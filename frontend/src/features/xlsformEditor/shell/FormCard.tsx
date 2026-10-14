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
  Layers,
  ChevronDown,
  Circle,
  Info,
  Lightbulb,
} from "../../../vendor/lucide-react";
import type { XlsformFormPublication } from "../../../api/client";
import { campanasDeFuente } from "../../../api/xlsformCampanas";
import type { LibraryEntry } from "../state/persistence";
import { admiteCampana } from "./campanaComplementariaModel";
import { CampanasDeclaradas } from "./CampanasDeclaradas";
import type { InstrumentActorOption } from "./actorAssignmentModel";
import { FormPublicationStatus } from "./InstrumentRevisionStatus";
import {
  formatRelativeSavedAt,
  normalizeOrigin,
  originLabel,
  type FormCardMetrics,
  type FormOrigin,
} from "./formCardMetrics";
import { getFormWorkflowView, instrumentActorLabel, suggestAudienceFromTitle } from "./formWorkflowView";

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
  /** Abre «Agregar campaña complementaria» (sólo formularios de SurveyMonkey). */
  onAddCampaign?: (id: string) => void;
  /** Se declaró o quitó una campaña: la biblioteca debe releer el índice. */
  onCampaignsChanged?: (id: string) => void;
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
  onAddCampaign,
  onCampaignsChanged,
}: FormCardProps) {
  const origin = normalizeOrigin(entry.source?.kind ?? null);
  const accent = ORIGIN_ACCENT[origin];
  const campanas = campanasDeFuente(entry.source);
  const puedeAgregarCampana = Boolean(onAddCampaign) && admiteCampana(entry.source);

  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [draftName, setDraftName] = useState(entry.name);
  const wrapperRef = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const headingId = `pulso-xf-form-${entry.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const selectedActor = actorOptions.find((option) => option.actor_key === entry.source?.actor_key);
  // El público nunca es obligatorio (decisión del usuario, 2026-10-14). Sólo
  // se ofrece en un estudio que trabaja con públicos (acreditación); fuera de
  // él no hay etapa ni campo.
  const audienceApplies = Boolean(
    actorOptions.length
    || entry.source?.schema === "acreditacion_actor_instrument_draft/v1",
  );
  const workflow = publication
    ? getFormWorkflowView(
        publication,
        actorOptions,
        entry.source?.actor_key,
        audienceApplies,
      )
    : null;
  // Sugerencia desde el título: un clic la acepta; nunca se asigna sola.
  const suggestedActor = audienceApplies && !selectedActor && actorCatalogStatus === "ready"
    ? suggestAudienceFromTitle(`${entry.name} ${entry.source?.survey_title ?? ""}`, actorOptions)
    : null;
  const warnings = publication?.warnings ?? [];
  const actorDisabled = isPublishing
    || isConfirmingLogic
    || isAssigningActor
    || actorCatalogStatus !== "ready";
  const actorHelp = isAssigningActor
    ? "Guardando el público en el proyecto…"
    : actorCatalogStatus === "loading"
      ? "Consultando los públicos disponibles…"
      : actorCatalogStatus === "error"
        ? "No pudimos consultar los públicos. Vuelve a abrir el proyecto para intentarlo otra vez."
        : actorCatalogStatus === "empty"
          ? "Este proyecto todavía no tiene públicos configurados."
          : !selectedActor && entry.source?.actor_key
            ? workflow?.audience?.detail ?? null
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
      data-qa-geometry-member
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
          {/* Origen y «Activo» en una sola línea: la cabecera mide lo mismo en
              todas las tarjetas y las etapas quedan alineadas en la fila. */}
          <span className="pulso-xf-home-card-origin">
            {originLabel(origin)}
            {isActive && (
              <span className="pulso-xf-home-card-active-badge">Activo</span>
            )}
          </span>
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
              {puedeAgregarCampana && (
                <button
                  type="button"
                  role="menuitem"
                  className="pulso-xf-home-card-menu-item"
                  onClick={() => {
                    setMenuOpen(false);
                    onAddCampaign?.(entry.id);
                  }}
                >
                  <Layers size={15} /> Agregar campaña complementaria…
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
                {metrics.questions === 1 ? "campo" : "campos"}
              </span>
            </span>
            <span className="pulso-xf-home-card-metric">
              <span className="pulso-xf-home-card-metric-value">{metrics.sections}</span>
              <span className="pulso-xf-home-card-metric-label">
                {metrics.sections === 1 ? "sección" : "secciones"}
              </span>
            </span>
            <CampanasDeclaradas
              formId={entry.id}
              formName={entry.name}
              campanas={campanas}
              onCambio={onCampaignsChanged}
            />
          </div>
          {workflow ? (
            <div
              className="pulso-xf-home-card-workflow"
              aria-label={`Flujo de ${entry.name}`}
              data-qa-geometry-group="xlsform-home-etapas"
              data-qa-geometry-contract="equal"
            >
              {([
                ["Lógica", workflow.logic],
                ["Procesamiento", workflow.processing],
              ] as const).map(([title, stage]) => (
                // La explicación larga va al tooltip: repetida en seis
                // tarjetas era un muro. La guía del pie la da una sola vez.
                <div key={title} className={`pulso-xf-home-card-stage is-${stage.tone}`} title={stage.detail}>
                  <span className="pulso-xf-home-card-stage-title">{title}</span>
                  <strong>{stage.label}</strong>
                  <span className="pulso-sr-only">{stage.detail}</span>
                </div>
              ))}
            </div>
          ) : null}
          {audienceApplies ? (
            <div className="pulso-xf-home-card-actor">
              <label className="pulso-xf-home-card-actor-fila">
                <span className="pulso-xf-home-card-actor-rotulo">
                  Público <small>opcional</small>
                </span>
                <span className="pulso-xf-home-card-select">
                  <select
                    value={selectedActor?.actor_key ?? ""}
                    onChange={(event) => onActorChange(entry.id, event.target.value)}
                    disabled={actorDisabled}
                    aria-label={`Público del instrumento ${entry.name} (opcional)`}
                    aria-busy={isAssigningActor || actorCatalogStatus === "loading"}
                  >
                    <option value="">Sin asignar</option>
                    {actorOptions.map((option) => (
                      <option key={option.actor_key} value={option.actor_key}>
                        {instrumentActorLabel(option)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} aria-hidden="true" />
                </span>
              </label>
              {suggestedActor ? (
                <button
                  type="button"
                  className="pulso-xf-home-card-sugerencia"
                  disabled={actorDisabled}
                  onClick={() => onActorChange(entry.id, suggestedActor.actor_key)}
                  title="Sugerido por el título del formulario"
                >
                  <Lightbulb size={12} aria-hidden="true" />
                  Usar «{instrumentActorLabel(suggestedActor)}»
                  <span className="pulso-xf-home-card-sugerencia-origen">sugerido por el título</span>
                </button>
              ) : null}
              {actorHelp ? <small>{actorHelp}</small> : null}
            </div>
          ) : null}
          {warnings.length > 0 ? (
            <details className="pulso-xf-home-card-avisos">
              <summary>
                <Info size={12} aria-hidden="true" />
                {warnings.length === 1 ? "1 aviso" : `${warnings.length} avisos`}
                <span>· no impide publicar</span>
              </summary>
              <ul>
                {warnings.map((warning) => (
                  <li key={warning.id}>
                    <strong>{warning.title}</strong>
                    {warning.detail ? <span>{warning.detail}</span> : null}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          {/* Estado de publicación y pie van juntos al fondo: con la grilla
              pareja (C2), el espacio libre queda entre la información y las
              acciones, dentro de la tarjeta, y los pies se alinean. */}
          {/* Un borrador vacío no es un error (C3): su vacío ocupa el espacio
              libre de la tarjeta, contenido y con nombre, en vez de dejar un
              hueco y un bloqueo en rojo. */}
          {workflow?.emptyDraft ? (
            <div className="pulso-xf-home-card-vacio" data-qa-geometry-capacity="owned">
              <Circle size={14} aria-hidden="true" />
              <strong>Borrador vacío</strong>
              <span>Agrega preguntas para publicar.</span>
            </div>
          ) : null}
          <div className="pulso-xf-home-card-cierre">
            {workflow?.emptyDraft ? null : (
              <FormPublicationStatus
                formId={entry.id}
                publication={publication}
                isPublishing={isPublishing}
                isConfirmingLogic={isConfirmingLogic}
                error={publicationError}
                onPublish={() => onPublish(entry.id)}
                onConfirmLogic={() => onConfirmLogic(entry.id)}
                primaryAction={workflow?.primaryAction}
                onOpen={() => onOpen(entry.id)}
              />
            )}
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
          </div>
        </>
      )}
    </article>
  );
}
