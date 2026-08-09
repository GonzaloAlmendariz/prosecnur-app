import * as Dialog from "@radix-ui/react-dialog";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from "react";
import { Link } from "react-router-dom";
import type { GraficadorMetadata } from "../../api/client";
import { PulsoButton } from "../../components/PulsoButton";
import type { ControlPanel } from "../../lib/navegacion/paneles";
import { useSession } from "../../lib/SessionContext";
import {
  ArrowRight,
  BarChart3,
  CornerDownLeft,
  Hash,
  Layers3,
  LayoutGrid,
  Lock,
  Map as MapIcon,
  MessageSquare,
  Radar,
  Search,
  SearchX,
  Table2,
  X,
  type LucideIcon,
} from "../../vendor/lucide-react";
import { GraficadorBlueprint } from "./GraficadorBlueprint";
import { resolveGraficadorContract } from "./slidePreviewModel";
import { useGraficosRegistry } from "./useGraficosRegistry";
import { useLibraryDialogA11y } from "./useLibraryDialogA11y";
import "./graficadorPicker.css";

type GraficadorFamily =
  | "all"
  | "distribution"
  | "numeric"
  | "comparison"
  | "text"
  | "dimensions"
  | "territory"
  | "other";

export type GraficadorLibraryState =
  | "ready"
  | "loading"
  | "error"
  | "empty"
  | "no-results";

const FAMILY_ORDER: readonly GraficadorFamily[] = [
  "all",
  "distribution",
  "numeric",
  "comparison",
  "text",
  "dimensions",
  "territory",
  "other",
];

const FAMILY_META: Record<
  GraficadorFamily,
  { label: string; hint: string; Icon: LucideIcon }
> = {
  all: { label: "Todos", hint: "Catálogo completo", Icon: LayoutGrid },
  distribution: { label: "Distribución", hint: "Categorías y proporciones", Icon: BarChart3 },
  numeric: { label: "Resumen numérico", hint: "Indicadores y rangos", Icon: Hash },
  comparison: { label: "Comparación", hint: "Grupos, series y tablas", Icon: Radar },
  text: { label: "Texto abierto", hint: "Términos frecuentes", Icon: MessageSquare },
  dimensions: { label: "Dimensiones", hint: "Índices calculados", Icon: Layers3 },
  territory: { label: "Territorio", hint: "Cobertura de campo", Icon: MapIcon },
  other: { label: "Otros", hint: "Modelos futuros", Icon: Table2 },
};

const TERRITORIAL_FALLBACK_REASON =
  "Disponible cuando el proyecto tenga Hojas de Ruta y Monitoreo territorial.";

const CONSULTATION_REASON =
  "Para insertar un modelo, abre esta biblioteca desde «Elegir gráfico» o «Cambiar» en un espacio del slide.";

const GENERATED_PLAN_REQUIRED_LABEL = "Requiere plan compatible";
const GENERATED_PLAN_REQUIRED_DETAIL =
  "Este modelo requiere un plan compatible preexistente que ya declare equivalencias nombradas. Esta biblioteca todavía no puede crearlo.";
const GENERATED_INSERTION_UNAVAILABLE = "Inserción no disponible aquí.";

export default function GraficadorPicker({
  open,
  onPick,
  onCancel,
  panel,
  returnFocusRef,
  fallbackFocusRef,
}: {
  open: boolean;
  onPick?: (meta: GraficadorMetadata) => void;
  onCancel: () => void;
  panel: ControlPanel;
  returnFocusRef?: RefObject<HTMLButtonElement>;
  fallbackFocusRef: RefObject<HTMLElement>;
}) {
  const { registry, loading, error } = useGraficosRegistry();
  const { state, sessionId } = useSession();
  const dimOk = graficadorDimensionsReady(
    state?.session_id,
    sessionId,
    state?.analitica_dim_ok,
  );
  const [family, setFamily] = useState<GraficadorFamily>("all");
  const [query, setQuery] = useState("");
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLUListElement>(null);
  const cardRefs = useRef(new Map<string, HTMLButtonElement>());
  const dialogA11y = useLibraryDialogA11y({
    searchRef,
    returnFocusRef,
    fallbackFocusRef,
  });

  const inventory = registry?.graficadores ?? [];

  const familyCounts = useMemo(() => {
    const counts = Object.fromEntries(
      FAMILY_ORDER.map((familyName) => [familyName, 0]),
    ) as Record<GraficadorFamily, number>;
    counts.all = inventory.length;
    for (const graf of inventory) counts[graficadorCategory(graf)] += 1;
    return counts;
  }, [inventory]);

  const visibleFamilies = useMemo(
    () => FAMILY_ORDER.filter((familyName) => familyName !== "other" || familyCounts.other > 0),
    [familyCounts],
  );

  const filteredGraficadores = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es");
    return inventory.filter((graf) => {
      if (family !== "all" && graficadorCategory(graf) !== family) return false;
      if (!normalizedQuery) return true;
      const searchable = [
        graf.name,
        graf.titulo_humano,
        graf.descripcion,
        ...graf.args.map((arg) => `${arg.label} ${arg.descripcion ?? ""}`),
      ]
        .join(" ")
        .toLocaleLowerCase("es");
      return searchable.includes(normalizedQuery);
    });
  }, [family, inventory, query]);

  const selectedGraf = filteredGraficadores.find((graf) => graf.name === selectedName)
    ?? filteredGraficadores[0]
    ?? null;
  const libraryState = deriveGraficadorLibraryState(
    loading,
    error,
    inventory.length,
    filteredGraficadores.length,
  );
  const selectedCanInsert = onPick !== undefined
    && selectedGraf !== null
    && canInsertGraficador(selectedGraf, dimOk);
  const activeFamilyMeta = FAMILY_META[family];
  const ActiveFamilyIcon = activeFamilyMeta.Icon;

  useEffect(() => {
    if (!open) return;
    setFamily("all");
    setQuery("");
    setSelectedName(null);
  }, [open]);

  function chooseFamily(nextFamily: GraficadorFamily) {
    setFamily(nextFamily);
    const firstInFamily = inventory.find(
      (graf) => nextFamily === "all" || graficadorCategory(graf) === nextFamily,
    );
    if (firstInFamily) setSelectedName(firstInFamily.name);
  }

  function focusCard(name: string) {
    requestAnimationFrame(() => {
      const card = cardRefs.current.get(name);
      card?.focus({ preventScroll: true });
      card?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  }

  function insertGraf(graf: GraficadorMetadata) {
    if (onPick && canInsertGraficador(graf, dimOk)) onPick(graf);
  }

  function handleCardKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    index: number,
    graf: GraficadorMetadata,
  ) {
    if (event.key === "Enter") {
      event.preventDefault();
      setSelectedName(graf.name);
      insertGraf(graf);
      return;
    }

    if (event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      setSelectedName(graf.name);
      return;
    }

    const columnCount = renderedColumnCount(gridRef.current);
    let nextIndex: number | null = null;
    switch (event.key) {
      case "ArrowRight":
        nextIndex = Math.min(filteredGraficadores.length - 1, index + 1);
        break;
      case "ArrowLeft":
        nextIndex = Math.max(0, index - 1);
        break;
      case "ArrowDown":
        nextIndex = Math.min(filteredGraficadores.length - 1, index + columnCount);
        break;
      case "ArrowUp":
        nextIndex = Math.max(0, index - columnCount);
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = filteredGraficadores.length - 1;
        break;
      default:
        return;
    }

    const nextGraf = filteredGraficadores[nextIndex];
    if (!nextGraf) return;
    event.preventDefault();
    setSelectedName(nextGraf.name);
    focusCard(nextGraf.name);
  }

  if (typeof document === "undefined") return null;

  return (
    <Dialog.Root
      modal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && open) onCancel();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="pulso-graficador-library-overlay" />
        <Dialog.Content
          {...panel.props}
          className="pulso-graficador-library-dialog"
          data-audit-ready="graficador-picker"
          aria-modal="true"
          {...dialogA11y}
          onKeyDown={(event) => {
            if (
              event.defaultPrevented
              || event.key !== "Enter"
              || event.nativeEvent.isComposing
              || selectedGraf === null
              || !selectedCanInsert
            ) return;
            const target = event.target;
            if (
              target instanceof Element
              && target.closest("button, a, input, select, textarea, [contenteditable='true']")
            ) return;
            event.preventDefault();
            insertGraf(selectedGraf);
          }}
        >
          <header className="pulso-graficador-library-header">
            <div className="pulso-graficador-library-heading">
              <span className="pulso-graficador-library-heading-icon" aria-hidden="true">
                <BarChart3 size={18} />
              </span>
              <div>
                <span className="pulso-graficador-library-eyebrow">
                  Biblioteca de graficadores
                </span>
                <Dialog.Title className="pulso-graficador-library-title">
                  Elige el tipo de gráfico
                </Dialog.Title>
                <Dialog.Description className="pulso-graficador-library-description">
                  {onPick
                    ? catalogDescription(inventory.length, loading, error)
                    : CONSULTATION_REASON}
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <PulsoButton
                variant="icon"
                size="lg"
                className="pulso-graficador-library-close"
                aria-label="Cerrar biblioteca de graficadores"
              >
                <X size={17} aria-hidden="true" />
              </PulsoButton>
            </Dialog.Close>
          </header>

          <div className="pulso-graficador-library-stage">
            <aside className="pulso-graficador-library-rail" aria-label="Familias de graficadores">
              <span className="pulso-graficador-library-rail-label">Familias</span>
              <div className="pulso-graficador-library-filters">
                {visibleFamilies.map((familyName) => {
                  const { Icon, hint, label } = FAMILY_META[familyName];
                  return (
                    <button
                      key={familyName}
                      type="button"
                      className="pulso-graficador-library-filter"
                      data-family={familyName}
                      aria-pressed={family === familyName}
                      aria-controls="pulso-graficador-library-models"
                      onClick={() => chooseFamily(familyName)}
                    >
                      <span className="pulso-graficador-library-filter-icon" aria-hidden="true">
                        <Icon size={15} />
                      </span>
                      <span className="pulso-graficador-library-filter-copy">
                        <strong>{label}</strong>
                        <small>{hint}</small>
                      </span>
                      <span className="pulso-graficador-library-filter-count">
                        {familyCounts[familyName]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>

            <section
              className="pulso-graficador-library-gallery"
              data-family={family}
              aria-labelledby="pulso-graficador-library-gallery-title"
            >
              <div className="pulso-graficador-library-gallery-header">
                <div className="pulso-graficador-library-gallery-heading">
                  <span aria-hidden="true">
                    <ActiveFamilyIcon size={15} />
                  </span>
                  <div>
                    <h3 id="pulso-graficador-library-gallery-title">
                      {activeFamilyMeta.label}
                    </h3>
                    <p>{activeFamilyMeta.hint}</p>
                  </div>
                </div>
                <span
                  className="pulso-graficador-library-visible-count"
                  aria-live={libraryState === "ready" ? "polite" : undefined}
                  aria-atomic={libraryState === "ready" ? "true" : undefined}
                >
                  {filteredGraficadores.length}{" "}
                  {filteredGraficadores.length === 1 ? "modelo visible" : "modelos visibles"}
                </span>
              </div>

              <label className="pulso-graficador-library-search">
                <Search size={15} aria-hidden="true" />
                <span className="pulso-graficador-library-visually-hidden">
                  Buscar graficador
                </span>
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key !== "Enter"
                      || event.nativeEvent.isComposing
                      || selectedGraf === null
                      || !selectedCanInsert
                    ) return;
                    event.preventDefault();
                    insertGraf(selectedGraf);
                  }}
                  placeholder="Buscar por nombre, uso o requisito…"
                  aria-label="Buscar graficador"
                />
                {selectedGraf && (
                  <span className="pulso-graficador-library-search-key" aria-hidden="true">
                    {!onPick ? (
                      <><Lock size={12} /> solo consulta</>
                    ) : selectedCanInsert ? (
                      <><CornerDownLeft size={12} /> insertar</>
                    ) : (
                      <><Lock size={12} /> revisar requisito</>
                    )}
                  </span>
                )}
              </label>

              <ul
                ref={gridRef}
                id="pulso-graficador-library-models"
                className="pulso-graficador-library-grid"
                aria-label="Modelos de graficador"
                data-qa-geometry-group="graficador-library-models"
                data-qa-geometry-contract="equal"
              >
                {libraryState !== "ready" && (
                  <LibraryState
                    state={libraryState}
                    title={graficadorGalleryStateTitle(libraryState)}
                    detail={graficadorGalleryStateDetail(libraryState, error)}
                  />
                )}
                {filteredGraficadores.map((graf, index) => {
                  const grafFamily = graficadorCategory(graf);
                  const selected = selectedGraf?.name === graf.name;
                  const canInsert = canInsertGraficador(graf, dimOk);
                  const canCommit = onPick !== undefined && canInsert;
                  const generated = resolveGraficadorContract(graf).authoringMode === "generated";
                  return (
                    <li
                      key={graf.name}
                      className="pulso-graficador-library-card-frame"
                      data-model-type={graf.name}
                    >
                      <button
                        ref={(node) => {
                          if (node) cardRefs.current.set(graf.name, node);
                          else cardRefs.current.delete(graf.name);
                        }}
                        type="button"
                        className="pulso-graficador-library-card"
                        data-graficador-library-card
                        data-family={grafFamily}
                        data-can-insert={canCommit ? "true" : "false"}
                        data-qa-geometry-member
                        data-qa-geometry-capacity="owned"
                        aria-pressed={selected}
                        tabIndex={selected ? 0 : -1}
                        onClick={() => setSelectedName(graf.name)}
                        onDoubleClick={() => insertGraf(graf)}
                        onKeyDown={(event) => handleCardKeyDown(event, index, graf)}
                      >
                        <span className="pulso-graficador-library-card-meta">
                          <span>{FAMILY_META[grafFamily].label}</span>
                          <span>{graficadorAvailabilityLabel(graf, dimOk, !onPick)}</span>
                        </span>
                        <GraficadorBlueprint
                          blueprint={graf.blueprint}
                          iconoUi={graf.icono_ui}
                          variant="card"
                        />
                        <span className="pulso-graficador-library-card-copy">
                          <strong>{graf.titulo_humano}</strong>
                          <span>{graf.descripcion}</span>
                        </span>
                        <span className="pulso-graficador-library-card-affordance">
                          <span>
                            {generated
                              ? GENERATED_INSERTION_UNAVAILABLE
                              : !onPick
                                ? "Abre un espacio para insertar"
                                : canInsert
                                  ? "Doble clic para insertar"
                                  : "Revisa el requisito"}
                          </span>
                          {selected && (
                            <span className="pulso-graficador-library-card-selected">
                              Seleccionado
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>

            <GraficadorInspector
              graf={selectedGraf}
              dimOk={dimOk}
              onInsert={onPick ? insertGraf : undefined}
              onCancel={onCancel}
              consultationReason={onPick ? "" : CONSULTATION_REASON}
              state={libraryState}
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function GraficadorInspector({
  graf,
  dimOk,
  onInsert,
  onCancel,
  consultationReason,
  state,
}: {
  graf: GraficadorMetadata | null;
  dimOk: boolean;
  onInsert?: (graf: GraficadorMetadata) => void;
  onCancel: () => void;
  consultationReason: string;
  state: GraficadorLibraryState;
}) {
  if (!graf) {
    return (
      <aside
        className="pulso-graficador-library-inspector"
        data-state={state}
        aria-labelledby="pulso-graficador-library-inspector-state-title"
      >
        <div
          className="pulso-graficador-library-inspector-stack"
          data-qa-geometry-group="graficador-library-inspector"
          data-qa-geometry-contract="intrinsic"
        >
          <div
            className="pulso-graficador-library-inspector-empty"
            data-state={state}
            data-qa-geometry-member
            data-qa-geometry-capacity="owned"
          >
            <SearchX size={22} aria-hidden="true" />
            <strong id="pulso-graficador-library-inspector-state-title">
              {inspectorEmptyTitle(state)}
            </strong>
            <span>{inspectorEmptyDetail(state)}</span>
          </div>
          <div className="pulso-graficador-library-insert-panel" data-qa-geometry-member>
            <PulsoButton
              variant="primary"
              size="lg"
              className="pulso-graficador-library-insert"
              disabled
            >
              Insertar modelo
            </PulsoButton>
            <span className="pulso-graficador-library-insert-hint">
              {graficadorInspectorDisabledReason(state, consultationReason)}
            </span>
          </div>
        </div>
      </aside>
    );
  }

  const family = graficadorCategory(graf);
  const FamilyIcon = FAMILY_META[family].Icon;
  const canInsert = onInsert !== undefined && canInsertGraficador(graf, dimOk);
  const contract = resolveGraficadorContract(graf);
  const usefulArgs = graf.args.filter((arg) => arg.label.trim().length > 0).slice(0, 4);
  const dimensionMissing = contract.capabilityKey === "dimensions" && !dimOk;
  const unavailable = graf.available === false;
  const generated = contract.authoringMode === "generated";
  const incompatible = contract.authoringMode === "unknown"
    || contract.dataRequirement === "unknown"
    || contract.capabilityKey === "unknown";
  const availabilityReason = unavailable
    ? graf.disabled_reason?.trim()
      || (isTerritorial(graf)
        ? TERRITORIAL_FALLBACK_REASON
        : "Este modelo no está disponible en el proyecto actual.")
    : "";
  const contractReason = contract.requirementLabel
    || (generated
      ? GENERATED_PLAN_REQUIRED_DETAIL
      : "La capacidad declarada requiere una versión más reciente de Prosecnur.");

  return (
    <aside
      className="pulso-graficador-library-inspector"
      aria-labelledby="pulso-graficador-library-inspector-title"
    >
      <div
        className="pulso-graficador-library-inspector-stack"
        data-qa-geometry-group="graficador-library-inspector"
        data-qa-geometry-contract="intrinsic"
      >
        <div className="pulso-graficador-library-inspector-heading" data-qa-geometry-member>
          <span aria-hidden="true"><FamilyIcon size={16} /></span>
          <div>
            <small>Modelo seleccionado</small>
            <strong>{graficadorAvailabilityLabel(graf, dimOk, Boolean(consultationReason))}</strong>
          </div>
        </div>

        <div
          className="pulso-graficador-library-inspector-preview"
          data-qa-geometry-member
          data-qa-geometry-capacity="owned"
        >
          <GraficadorBlueprint
            blueprint={graf.blueprint}
            iconoUi={graf.icono_ui}
            variant="hero"
            label={`Vista previa de ${graf.titulo_humano}`}
          />
        </div>

        <section className="pulso-graficador-library-inspector-copy" data-qa-geometry-member>
          <span>{FAMILY_META[family].label}</span>
          <h3 id="pulso-graficador-library-inspector-title">{graf.titulo_humano}</h3>
          <p>{graf.descripcion}</p>
        </section>

        <section className="pulso-graficador-library-inspector-section" data-qa-geometry-member>
          <h4>Requisito y disponibilidad</h4>
          <dl className="pulso-graficador-library-facts">
            <div>
              <dt>Familia</dt>
              <dd>{FAMILY_META[family].label}</dd>
            </div>
            <div>
              <dt>Estado</dt>
              <dd>{graficadorAvailabilityLabel(graf, dimOk, Boolean(consultationReason))}</dd>
            </div>
          </dl>
        </section>

        {dimensionMissing && (
          <section
            className="pulso-graficador-library-requirement"
            data-qa-geometry-member
          >
            <Lock size={15} aria-hidden="true" />
            <div>
              <h4>Prepara las dimensiones</h4>
              <p>
                Este modelo necesita índices o dimensiones calculadas antes de insertarse.
              </p>
              <Link to="/analitica" onClick={onCancel}>
                Ir a Analítica <ArrowRight size={13} aria-hidden="true" />
              </Link>
            </div>
          </section>
        )}

        {unavailable && (
          <section
            className="pulso-graficador-library-requirement"
            data-qa-geometry-member
          >
            <Lock size={15} aria-hidden="true" />
            <div>
              <h4>Modelo no disponible</h4>
              <p>{availabilityReason}</p>
            </div>
          </section>
        )}

        {(generated || incompatible) && !unavailable && (
          <section
            className="pulso-graficador-library-requirement"
            data-qa-geometry-member
          >
            <Lock size={15} aria-hidden="true" />
            <div>
              <h4>{generated ? GENERATED_PLAN_REQUIRED_LABEL : "Requisito no compatible"}</h4>
              <p>{contractReason}</p>
            </div>
          </section>
        )}

        {consultationReason && !generated && (
          <section
            className="pulso-graficador-library-requirement"
            data-qa-geometry-member
          >
            <Lock size={15} aria-hidden="true" />
            <div>
              <h4>Catálogo en modo consulta</h4>
              <p>{contractReason}</p>
              <p>{consultationReason}</p>
            </div>
          </section>
        )}

        <section className="pulso-graficador-library-inspector-section" data-qa-geometry-member>
          <h4>Decisiones principales</h4>
          {usefulArgs.length > 0 ? (
            <ul className="pulso-graficador-library-arg-list">
              {usefulArgs.map((arg) => (
                <li key={arg.name}>
                  <strong>{arg.label}</strong>
                  <span>{arg.descripcion?.trim() || argGroupLabel(arg.grupo)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>Este modelo no exige decisiones adicionales en el catálogo.</p>
          )}
        </section>

        <section className="pulso-graficador-library-next-step" data-qa-geometry-member>
          <ArrowRight size={15} aria-hidden="true" />
          <div>
            <h4>{generated ? "Disponibilidad" : "Próximo paso"}</h4>
            <p>
              {generated
                ? `${GENERATED_INSERTION_UNAVAILABLE} El catálogo conserva este modelo para consulta.`
                : "Después de insertar, elige las variables y ajusta los datos en este espacio."}
            </p>
          </div>
        </section>

        <div className="pulso-graficador-library-insert-panel" data-qa-geometry-member>
          <PulsoButton
            variant="primary"
            size="lg"
            className="pulso-graficador-library-insert"
            disabled={!canInsert}
            onClick={() => onInsert?.(graf)}
          >
            Insertar modelo
          </PulsoButton>
          {!canInsert && (
            <span className="pulso-graficador-library-insert-hint">
              {generated
                ? GENERATED_INSERTION_UNAVAILABLE
                : consultationReason
                  || "Resuelve el requisito indicado para habilitar la inserción."}
            </span>
          )}
        </div>
      </div>
    </aside>
  );
}

function LibraryState({
  state,
  title,
  detail,
}: {
  state: Exclude<GraficadorLibraryState, "ready">;
  title: string;
  detail: string;
}) {
  return (
    <li
      className="pulso-graficador-library-state"
      data-state={state}
      data-qa-geometry-capacity="owned"
    >
      <div
        className="pulso-graficador-library-state-region"
        {...graficadorLibraryStateA11y(state)}
      >
        {state === "loading" ? <Layers3 size={22} aria-hidden="true" /> : <SearchX size={22} aria-hidden="true" />}
        <strong>{title}</strong>
        <span>{detail}</span>
      </div>
    </li>
  );
}

function graficadorCategory(graf: GraficadorMetadata): Exclude<GraficadorFamily, "all"> {
  return graf.categoria ?? "other";
}

export function canInsertGraficador(graf: GraficadorMetadata, dimOk: boolean): boolean {
  if (graf.available === false) return false;
  const contract = resolveGraficadorContract(graf);
  if (contract.authoringMode !== "direct" || contract.dataRequirement === "unknown") return false;
  switch (contract.capabilityKey) {
    case "":
    case "territorial_coverage":
      return true;
    case "dimensions":
      return dimOk;
    case "equivalences_exactly_two":
    case "equivalences_temporal":
    case "unknown":
      return false;
  }
}

export function graficadorDimensionsReady(
  stateSessionId: string | undefined,
  sessionId: string,
  analiticaDimOk: unknown,
): boolean {
  return stateSessionId === sessionId && Boolean(analiticaDimOk);
}

function isTerritorial(graf: GraficadorMetadata): boolean {
  return resolveGraficadorContract(graf).capabilityKey === "territorial_coverage";
}

export function graficadorAvailabilityLabel(
  graf: GraficadorMetadata,
  dimOk: boolean,
  consultationMode = false,
): string {
  if (graf.available === false) return "No disponible";
  const contract = resolveGraficadorContract(graf);
  if (contract.authoringMode === "generated") return GENERATED_PLAN_REQUIRED_LABEL;
  if (
    contract.authoringMode === "unknown"
    || contract.dataRequirement === "unknown"
    || contract.capabilityKey === "unknown"
  ) return "Requisito no compatible";
  if (contract.capabilityKey === "dimensions" && !dimOk) return "Requiere dimensiones";
  if (consultationMode) return "Listo para revisar";
  if (contract.capabilityKey === "dimensions") return "Dimensiones listas";
  return "Listo para insertar";
}

function catalogDescription(count: number, loading: boolean, error: string): string {
  if (loading && count === 0) return "Cargando el inventario del proyecto.";
  if (error && count === 0) return "No se pudo consultar el inventario del proyecto.";
  return `${count} ${count === 1 ? "modelo en el catálogo" : "modelos en el catálogo"}. Compara su forma antes de insertar.`;
}

export function deriveGraficadorLibraryState(
  loading: boolean,
  error: string,
  inventoryCount: number,
  filteredCount: number,
): GraficadorLibraryState {
  if (loading && inventoryCount === 0) return "loading";
  if (error && inventoryCount === 0) return "error";
  if (inventoryCount === 0) return "empty";
  if (filteredCount === 0) return "no-results";
  return "ready";
}

function graficadorGalleryStateTitle(
  state: Exclude<GraficadorLibraryState, "ready">,
): string {
  switch (state) {
    case "loading":
      return "Cargando catálogo";
    case "error":
      return "No se pudo cargar el catálogo";
    case "empty":
      return "Catálogo vacío";
    case "no-results":
      return "Sin coincidencias";
  }
}

function graficadorGalleryStateDetail(
  state: Exclude<GraficadorLibraryState, "ready">,
  error: string,
): string {
  switch (state) {
    case "loading":
      return "Estamos consultando los modelos del proyecto.";
    case "error":
      return error;
    case "empty":
      return "El catálogo no devolvió modelos de graficador.";
    case "no-results":
      return "Prueba otra búsqueda o vuelve a Todos.";
  }
}

function graficadorLibraryStateA11y(state: GraficadorLibraryState): {
  role: "alert" | "status";
  "aria-live": "assertive" | "polite";
  "aria-atomic": "true";
  "aria-busy": "true" | undefined;
} {
  return {
    role: state === "error" ? "alert" : "status",
    "aria-live": state === "error" ? "assertive" : "polite",
    "aria-atomic": "true",
    "aria-busy": state === "loading" ? "true" : undefined,
  };
}

function inspectorEmptyTitle(state: GraficadorLibraryState): string {
  switch (state) {
    case "loading":
      return "Preparando el inspector";
    case "error":
      return "Inspector no disponible";
    case "empty":
      return "No hay modelos para revisar";
    case "no-results":
      return "No hay una selección visible";
    default:
      return "Selecciona un modelo";
  }
}

function inspectorEmptyDetail(state: GraficadorLibraryState): string {
  switch (state) {
    case "loading":
      return "La vista previa aparecerá cuando termine la carga.";
    case "error":
      return "Revisa la conexión y recarga la aplicación para reintentar.";
    case "empty":
      return "El marco se mantiene listo para cuando exista inventario.";
    case "no-results":
      return "Cambia la búsqueda o la familia para volver a comparar.";
    default:
      return "Revisa su forma y requisitos antes de insertarlo.";
  }
}

export function graficadorInspectorDisabledReason(
  state: GraficadorLibraryState,
  consultationReason: string,
): string {
  if (consultationReason) return consultationReason;
  switch (state) {
    case "loading":
      return "La inserción se habilitará cuando termine la carga.";
    case "error":
      return "Revisa la conexión y recarga la aplicación para reintentar.";
    case "empty":
      return "No hay modelos disponibles para insertar.";
    case "no-results":
      return "Cambia la búsqueda o la familia para elegir un modelo.";
    default:
      return "Selecciona un modelo para habilitar la inserción.";
  }
}

function argGroupLabel(group: string): string {
  const labels: Record<string, string> = {
    datos: "Dato que completarás después de insertar.",
    lectura: "Decisión de lectura del gráfico.",
    valores: "Presentación de valores.",
    filtro: "Regla para acotar los datos.",
    estilo: "Ajuste de presentación.",
    textos: "Texto visible del gráfico.",
  };
  return labels[group] ?? "Ajuste disponible en la configuración del modelo.";
}

function renderedColumnCount(grid: HTMLUListElement | null): number {
  if (!grid || typeof window === "undefined") return 1;
  const columns = window.getComputedStyle(grid).gridTemplateColumns;
  if (!columns || columns === "none") return 1;
  return Math.max(1, columns.split(" ").filter(Boolean).length);
}
