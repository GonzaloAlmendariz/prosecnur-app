import * as Dialog from "@radix-ui/react-dialog";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from "react";
import type {
  SlideCategoria,
  SlideMetadata,
  SlideType,
} from "../../../../api/client";
import { PulsoButton } from "../../../../components/PulsoButton";
import type { ControlPanel } from "../../../../lib/navegacion/paneles";
import {
  ArrowRight,
  BarChart3,
  Check,
  Columns3,
  CornerDownLeft,
  Eye,
  FilePlus2,
  Grid3X3,
  Layers3,
  LayoutGrid,
  LayoutPanelTop,
  MousePointer2,
  Plus,
  Search,
  UsersRound,
  X,
  type LucideIcon,
} from "../../../../vendor/lucide-react";
import { SLIDE_LABELS, usePlanStore } from "../../store";
import { useGraficosRegistry } from "../../useGraficosRegistry";
import {
  resolveSlidePickerBlueprint,
  SlidePickerBlueprint,
} from "./SlidePickerBlueprint";
import { useLibraryDialogA11y } from "../../useLibraryDialogA11y";
import "./slidePicker.css";

type SlideLibraryCategory = "estructural" | "1g" | "2g" | "grid" | "poblacion" | "otro";

type SlideLibraryFilter = "all" | SlideLibraryCategory;

export type SlideLibraryStateName =
  | "ready"
  | "loading"
  | "error"
  | "empty"
  | "no-results";

const FILTER_ORDER: readonly SlideLibraryFilter[] = [
  "all",
  "estructural",
  "1g",
  "2g",
  "grid",
  "poblacion",
  "otro",
];

const FILTER_LABELS: Record<SlideLibraryFilter, string> = {
  all: "Todos",
  estructural: "Estructural",
  "1g": "1 gráfico",
  "2g": "2 gráficos",
  grid: "Grid 4",
  poblacion: "Población",
  otro: "Otros",
};

const FILTER_META: Record<SlideLibraryFilter, { Icon: LucideIcon; hint: string }> = {
  all: { Icon: LayoutGrid, hint: "Catálogo completo" },
  estructural: { Icon: LayoutPanelTop, hint: "Contenido y transición" },
  "1g": { Icon: BarChart3, hint: "Lectura focal" },
  "2g": { Icon: Columns3, hint: "Comparación" },
  grid: { Icon: Grid3X3, hint: "Panorama 2 × 2" },
  poblacion: { Icon: UsersRound, hint: "Perfil poblacional" },
  otro: { Icon: Layers3, hint: "Modelos compatibles" },
};

const CATEGORY_BY_REGISTRY: Record<SlideCategoria, SlideLibraryCategory> = {
  estructural: "estructural",
  "1grafico": "1g",
  "2graficos": "2g",
  "4graficos": "grid",
  poblacion: "poblacion",
  otro: "otro",
};

const EDITABLE_FIELD_LIMIT = 6;

export type SlidePickerProps = {
  open: boolean;
  onClose: () => void;
  panel: ControlPanel;
  returnFocusRef: RefObject<HTMLButtonElement>;
  fallbackFocusRef: RefObject<HTMLElement>;
};

export function SlidePicker({
  open,
  onClose,
  panel,
  returnFocusRef,
  fallbackFocusRef,
}: SlidePickerProps) {
  const addSlide = usePlanStore((state) => state.addSlide);
  const { registry, loading, error } = useGraficosRegistry();
  const [filter, setFilter] = useState<SlideLibraryFilter>("all");
  const [query, setQuery] = useState("");
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [insertAndContinue, setInsertAndContinue] = useState(true);
  const [feedback, setFeedback] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLUListElement>(null);
  const cardRefs = useRef(new Map<string, HTMLButtonElement>());
  const insertionCountRef = useRef(0);
  const dialogA11y = useLibraryDialogA11y({
    searchRef,
    returnFocusRef,
    fallbackFocusRef,
  });

  const inventory = registry?.slides;
  const models = useMemo(
    () => (inventory ?? []).map(buildSlideLibraryModel),
    [inventory],
  );

  useEffect(() => {
    if (models.length === 0) {
      if (selectedName !== null) setSelectedName(null);
      return;
    }
    if (selectedName !== null && models.some((model) => model.metadata.name === selectedName)) return;
    setSelectedName(models[0].metadata.name);
  }, [models, selectedName]);

  const filteredModels = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es");
    return models.filter((model) => {
      if (filter !== "all" && model.category !== filter) return false;
      if (!normalizedQuery) return true;

      const searchable = [
        model.title,
        model.description,
        model.metadata.args.map((arg) => arg.label).join(" "),
        model.metadata.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("es");
      return searchable.includes(normalizedQuery);
    });
  }, [filter, models, query]);

  const selectedModel = filteredModels.find((model) => model.metadata.name === selectedName)
    ?? filteredModels[0]
    ?? null;
  const libraryState = deriveSlideLibraryState(
    loading,
    error,
    inventory?.length ?? 0,
    filteredModels.length,
  );

  const categoryCounts = useMemo(() => {
    const counts = Object.fromEntries(
      FILTER_ORDER.map((category) => [category, 0]),
    ) as Record<SlideLibraryFilter, number>;
    counts.all = inventory?.length ?? 0;
    for (const model of models) {
      counts[model.category] += 1;
    }
    return counts;
  }, [inventory?.length, models]);
  const visibleFilters = useMemo(
    () => FILTER_ORDER.filter((category) => category !== "otro" || categoryCounts.otro > 0),
    [categoryCounts],
  );

  const activeFilterMeta = FILTER_META[filter];
  const ActiveFilterIcon = activeFilterMeta.Icon;
  function insertSlide(model: SlideLibraryModel) {
    if (!model.insertableType) {
      setFeedback(model.compatibilityReason);
      return;
    }
    addSlide(model.insertableType);
    insertionCountRef.current += 1;
    const title = model.title;
    setFeedback(
      insertAndContinue
        ? `${title} insertado. La biblioteca sigue abierta. Inserción ${insertionCountRef.current}.`
        : `${title} insertado.`,
    );
    if (!insertAndContinue) onClose();
  }

  function selectModel(name: string) {
    setSelectedName(name);
    setFeedback("");
  }

  function focusCard(name: string) {
    requestAnimationFrame(() => {
      const card = cardRefs.current.get(name);
      card?.focus({ preventScroll: true });
      card?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  }

  function handleCardKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    index: number,
    model: SlideLibraryModel,
  ) {
    if (event.key === "Enter") {
      event.preventDefault();
      selectModel(model.metadata.name);
      insertSlide(model);
      return;
    }

    if (event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      selectModel(model.metadata.name);
      return;
    }

    const columnCount = renderedColumnCount(gridRef.current);
    let nextIndex: number | null = null;
    switch (event.key) {
      case "ArrowRight":
        nextIndex = Math.min(filteredModels.length - 1, index + 1);
        break;
      case "ArrowLeft":
        nextIndex = Math.max(0, index - 1);
        break;
      case "ArrowDown":
        nextIndex = Math.min(filteredModels.length - 1, index + columnCount);
        break;
      case "ArrowUp":
        nextIndex = Math.max(0, index - columnCount);
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = filteredModels.length - 1;
        break;
      default:
        return;
    }

    const nextModel = filteredModels[nextIndex];
    if (!nextModel) return;
    event.preventDefault();
    selectModel(nextModel.metadata.name);
    focusCard(nextModel.metadata.name);
  }

  return (
    <Dialog.Root
      modal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="pulso-slide-library-overlay" />
        <Dialog.Content
          {...panel.props}
          className="pulso-slide-library-dialog"
          data-audit-ready="slide-picker"
          aria-modal="true"
          {...dialogA11y}
          onKeyDown={(event) => {
            if (
              event.defaultPrevented
              || event.key !== "Enter"
              || event.nativeEvent.isComposing
              || selectedModel === null
            ) return;
            const target = event.target;
            if (
              target instanceof HTMLButtonElement
              || (target instanceof HTMLInputElement && target.type === "checkbox")
            ) return;
            event.preventDefault();
            insertSlide(selectedModel);
          }}
        >
          <header className="pulso-slide-library-header">
            <div className="pulso-slide-library-heading">
              <span className="pulso-slide-library-heading-icon" aria-hidden="true">
                <Layers3 size={18} />
              </span>
              <div>
                <span className="pulso-slide-library-eyebrow">Biblioteca de modelos</span>
                <Dialog.Title className="pulso-slide-library-title">
                  Elige la composición del slide
                </Dialog.Title>
                <Dialog.Description className="pulso-slide-library-description">
                  {slideCatalogDescription(inventory?.length ?? 0, loading, error)}
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <PulsoButton
                variant="icon"
                size="lg"
                className="pulso-slide-library-close"
                aria-label="Cerrar biblioteca de slides"
              >
                <X size={17} aria-hidden="true" />
              </PulsoButton>
            </Dialog.Close>
          </header>

          <div className="pulso-slide-library-stage">
            <aside className="pulso-slide-library-rail" aria-label="Familias de modelos">
              <span className="pulso-slide-library-rail-label">Familias</span>
              <div className="pulso-slide-library-filters">
                {visibleFilters.map((category) => {
                  const { Icon, hint } = FILTER_META[category];
                  const active = filter === category;
                  return (
                    <button
                      key={category}
                      type="button"
                      className="pulso-slide-library-filter"
                      data-family={category}
                      aria-pressed={active}
                      aria-controls="pulso-slide-library-models"
                      onClick={() => setFilter(category)}
                    >
                      <span className="pulso-slide-library-filter-icon" aria-hidden="true">
                        <Icon size={15} />
                      </span>
                      <span className="pulso-slide-library-filter-copy">
                        <strong>{FILTER_LABELS[category]}</strong>
                        <small>{hint}</small>
                      </span>
                      <span className="pulso-slide-library-filter-count">
                        {categoryCounts[category]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>

            <section
              className="pulso-slide-library-gallery"
              data-family={filter}
              aria-labelledby="pulso-slide-library-gallery-title"
            >
              <div className="pulso-slide-library-gallery-header">
                <div className="pulso-slide-library-gallery-heading">
                  <span aria-hidden="true">
                    <ActiveFilterIcon size={15} />
                  </span>
                  <div>
                    <h3 id="pulso-slide-library-gallery-title">{FILTER_LABELS[filter]}</h3>
                    <p>{activeFilterMeta.hint}</p>
                  </div>
                </div>
                <span
                  className="pulso-slide-library-visible-count"
                  aria-live={libraryState === "ready" ? "polite" : undefined}
                  aria-atomic={libraryState === "ready" ? "true" : undefined}
                >
                  {filteredModels.length} {filteredModels.length === 1 ? "modelo visible" : "modelos visibles"}
                </span>
              </div>

              <label className="pulso-slide-library-search">
                <Search size={15} aria-hidden="true" />
                <span className="pulso-slide-library-visually-hidden">Buscar modelo</span>
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" || event.nativeEvent.isComposing || selectedModel === null) return;
                    event.preventDefault();
                    insertSlide(selectedModel);
                  }}
                  placeholder="Buscar por nombre, uso o contenido…"
                  aria-label="Buscar modelo de slide"
                />
                {selectedModel && (
                  <span className="pulso-slide-library-search-key" aria-hidden="true">
                    {selectedModel.insertableType
                      ? <><CornerDownLeft size={12} /> insertar</>
                      : <><Eye size={12} /> solo revisión</>}
                  </span>
                )}
              </label>

              <ul
                ref={gridRef}
                id="pulso-slide-library-models"
                className="pulso-slide-library-grid"
                aria-label="Modelos disponibles"
                data-qa-geometry-group="slide-library-models"
                data-qa-geometry-contract="equal"
              >
                {libraryState !== "ready" && (
                  <SlideLibraryState
                    state={libraryState}
                    title={slideGalleryStateTitle(libraryState)}
                    detail={slideGalleryStateDetail(libraryState, error)}
                  />
                )}
                {filteredModels.map((model, index) => {
                  const { metadata, blueprint, category, title } = model;
                  const selected = selectedModel?.metadata.name === metadata.name;
                  return (
                    <li
                      key={metadata.name}
                      className="pulso-slide-library-card-frame"
                      data-model-type={metadata.name}
                    >
                      <button
                        ref={(node) => {
                          if (node) cardRefs.current.set(metadata.name, node);
                          else cardRefs.current.delete(metadata.name);
                        }}
                        type="button"
                        className="pulso-slide-library-card"
                        data-slide-library-card
                        data-family={category}
                        data-can-insert={model.insertableType ? "true" : "false"}
                        data-qa-geometry-member
                        data-qa-geometry-capacity="owned"
                        aria-pressed={selected}
                        aria-label={model.insertableType
                          ? `${title}. ${blueprint.structureLabel}. Enter o doble clic para insertar; Espacio para seleccionar.`
                          : `${title}. ${blueprint.structureLabel}. Modelo de una versión futura; Espacio para seleccionar y revisar.`}
                        tabIndex={selected ? 0 : -1}
                        onClick={() => selectModel(metadata.name)}
                        onDoubleClick={(event) => {
                          event.preventDefault();
                          selectModel(metadata.name);
                          insertSlide(model);
                        }}
                        onKeyDown={(event) => handleCardKeyDown(event, index, model)}
                      >
                        <span className="pulso-slide-library-card-meta">
                          <span>{FILTER_LABELS[category]}</span>
                          <span>{blueprint.structureLabel}</span>
                        </span>
                        <SlidePickerBlueprint
                          blueprint={blueprint}
                          iconoUi={metadata.icono_ui}
                          size="card"
                        />
                        <span className="pulso-slide-library-card-copy">
                          <strong>{title}</strong>
                          <span>{model.description}</span>
                        </span>
                        <span className="pulso-slide-library-card-affordance">
                          <span>
                            <MousePointer2 size={13} aria-hidden="true" />
                            {model.insertableType
                              ? "Doble clic para insertar"
                              : "Requiere una versión más reciente"}
                          </span>
                          {selected && (
                            <span className="pulso-slide-library-card-selected">
                              <Check size={13} aria-hidden="true" /> Seleccionado
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>

            <aside
              className="pulso-slide-library-inspector"
              data-family={selectedModel?.category ?? "all"}
              data-state={libraryState}
              aria-label={selectedModel ? "Detalle del modelo seleccionado" : undefined}
              aria-labelledby={selectedModel ? undefined : "pulso-slide-library-inspector-state-title"}
            >
              {selectedModel === null ? (
                <div
                  className="pulso-slide-library-inspector-stack"
                  data-qa-geometry-group="slide-library-inspector"
                  data-qa-geometry-contract="intrinsic"
                >
                  <div
                    className="pulso-slide-library-inspector-empty"
                    data-state={libraryState}
                    data-qa-geometry-member
                    data-qa-geometry-capacity="owned"
                  >
                    <Search size={20} aria-hidden="true" />
                    <strong id="pulso-slide-library-inspector-state-title">
                      {slideInspectorStateTitle(libraryState)}
                    </strong>
                    <span>{slideInspectorStateDetail(libraryState)}</span>
                  </div>
                  <div className="pulso-slide-library-insert-panel" data-qa-geometry-member>
                    <PulsoButton
                      variant="primary"
                      size="lg"
                      className="pulso-slide-library-insert"
                      disabled
                    >
                      <FilePlus2 size={16} aria-hidden="true" />
                      Insertar modelo
                    </PulsoButton>
                    <span className="pulso-slide-library-insert-hint">
                      {slideInspectorDisabledReason(libraryState)}
                    </span>
                  </div>
                </div>
              ) : (
                <div
                  className="pulso-slide-library-inspector-stack"
                  data-qa-geometry-group="slide-library-inspector"
                  data-qa-geometry-contract="intrinsic"
                >
                  <div className="pulso-slide-library-inspector-heading" data-qa-geometry-member>
                    <span aria-hidden="true">
                      <Eye size={16} />
                    </span>
                    <div>
                      <small>Vista previa de composición</small>
                      <strong>{selectedModel.blueprint.structureLabel}</strong>
                    </div>
                  </div>

                  <div className="pulso-slide-library-inspector-preview" data-qa-geometry-member>
                    <SlidePickerBlueprint
                      blueprint={selectedModel.blueprint}
                      iconoUi={selectedModel.metadata.icono_ui}
                      size="hero"
                    />
                  </div>

                  <section className="pulso-slide-library-inspector-copy" data-qa-geometry-member>
                    <span>{FILTER_LABELS[selectedModel.category]}</span>
                    <h3>{selectedModel.title}</h3>
                    <p>{selectedModel.description}</p>
                  </section>

                  <section className="pulso-slide-library-inspector-section" data-qa-geometry-member>
                    <h4>Zonas del modelo</h4>
                    {selectedModel.blueprint.graphSlots.length > 0 ? (
                      <ol className="pulso-slide-library-zone-list">
                        {selectedModel.blueprint.graphSlots.map((slot) => (
                          <li key={slot.name}>{slot.label}</li>
                        ))}
                      </ol>
                    ) : (
                      <p>Sin zonas de gráfico: la composición es editorial.</p>
                    )}
                  </section>

                  <section className="pulso-slide-library-inspector-section" data-qa-geometry-member>
                    <h4>Contenido editable</h4>
                    {selectedModel.editableFields.length > 0 ? (
                      <>
                        <ul className="pulso-slide-library-field-list">
                          {selectedModel.editableFields
                            .slice(0, EDITABLE_FIELD_LIMIT)
                            .map((field) => <li key={field}>{field}</li>)}
                        </ul>
                        {selectedModel.editableFields.length > EDITABLE_FIELD_LIMIT && (
                          <p>
                            Y {selectedModel.editableFields.length - EDITABLE_FIELD_LIMIT} opciones más en el inspector.
                          </p>
                        )}
                      </>
                    ) : (
                      <p>El catálogo no declara campos editables para este modelo.</p>
                    )}
                  </section>

                  <section className="pulso-slide-library-next-step" data-qa-geometry-member>
                    <ArrowRight size={15} aria-hidden="true" />
                    <div>
                      <h4>Después de insertar</h4>
                      <p>{selectedModel.nextStep}</p>
                    </div>
                  </section>

                  <div className="pulso-slide-library-insert-panel" data-qa-geometry-member>
                    <label className="pulso-slide-library-continue">
                      <input
                        type="checkbox"
                        checked={insertAndContinue}
                        onChange={(event) => setInsertAndContinue(event.target.checked)}
                      />
                      <span>
                        <strong>Insertar y seguir</strong>
                        <small>Mantiene esta biblioteca abierta.</small>
                      </span>
                    </label>
                    <PulsoButton
                      variant="primary"
                      size="lg"
                      className="pulso-slide-library-insert"
                      disabled={!selectedModel.insertableType}
                      onClick={() => insertSlide(selectedModel)}
                    >
                      <FilePlus2 size={16} aria-hidden="true" />
                      Insertar modelo
                    </PulsoButton>
                    <div
                      className="pulso-slide-library-feedback"
                      role="status"
                      aria-live="polite"
                      aria-atomic="true"
                    >
                      {feedback || selectedModel.compatibilityReason}
                    </div>
                  </div>
                </div>
              )}
            </aside>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SlideLibraryState({
  state,
  title,
  detail,
}: {
  state: Exclude<SlideLibraryStateName, "ready">;
  title: string;
  detail: string;
}) {
  return (
    <li
      className="pulso-slide-library-empty"
      data-state={state}
      data-qa-geometry-capacity="owned"
    >
      <div
        className="pulso-slide-library-state-region"
        {...slideLibraryStateA11y(state)}
      >
        <Search size={20} aria-hidden="true" />
        <strong>{title}</strong>
        <span>{detail}</span>
      </div>
    </li>
  );
}

export function deriveSlideLibraryState(
  loading: boolean,
  error: string,
  inventoryCount: number,
  filteredCount: number,
): SlideLibraryStateName {
  if (loading && inventoryCount === 0) return "loading";
  if (error && inventoryCount === 0) return "error";
  if (inventoryCount === 0) return "empty";
  if (filteredCount === 0) return "no-results";
  return "ready";
}

function slideGalleryStateTitle(
  state: Exclude<SlideLibraryStateName, "ready">,
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

function slideGalleryStateDetail(
  state: Exclude<SlideLibraryStateName, "ready">,
  error: string,
): string {
  switch (state) {
    case "loading":
      return "Estamos consultando los modelos del proyecto.";
    case "error":
      return error;
    case "empty":
      return "El catálogo no devolvió modelos de slide.";
    case "no-results":
      return "Ajusta la búsqueda o elige otra familia.";
  }
}

function slideLibraryStateA11y(state: SlideLibraryStateName): {
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

function slideInspectorStateTitle(state: SlideLibraryStateName): string {
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

function slideInspectorStateDetail(state: SlideLibraryStateName): string {
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
      return "Revisa su forma y contenido antes de insertarlo.";
  }
}

function slideInspectorDisabledReason(state: SlideLibraryStateName): string {
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

function modelTitle(metadata: SlideMetadata): string {
  const registryTitle = metadata.titulo_humano.trim();
  if (registryTitle) return registryTitle;
  return humanizeIdentifier(metadata.name);
}

function humanizeIdentifier(value: string): string {
  const words = value
    .split("_")
    .filter(Boolean)
    .join(" ");
  return words ? `${words.charAt(0).toLocaleUpperCase("es")}${words.slice(1)}` : "Modelo de slide";
}

function editableFields(metadata: SlideMetadata): string[] {
  return Array.from(new Set(
    metadata.args
      .filter((arg) => arg.tipo_input !== "meta" && arg.grupo !== "diagnostico")
      .map((arg) => arg.label.trim())
      .filter(Boolean),
  ));
}

export function isInsertableSlideType(name: string): name is SlideType {
  return Object.prototype.hasOwnProperty.call(SLIDE_LABELS, name);
}

export type SlideLibraryModel = {
  metadata: SlideMetadata;
  blueprint: ReturnType<typeof resolveSlidePickerBlueprint>;
  category: SlideLibraryCategory;
  title: string;
  description: string;
  editableFields: string[];
  nextStep: string;
  insertableType: SlideType | null;
  compatibilityReason: string;
};

export function buildSlideLibraryModel(metadata: SlideMetadata): SlideLibraryModel {
  const blueprint = resolveSlidePickerBlueprint(metadata);
  const graphZoneCount = blueprint.graphSlots.length;
  const insertableType = isInsertableSlideType(metadata.name) ? metadata.name : null;
  return {
    metadata,
    blueprint,
    category: CATEGORY_BY_REGISTRY[metadata.categoria],
    title: modelTitle(metadata),
    description: metadata.descripcion
      || "Modelo listo para completar desde el inspector del slide.",
    editableFields: editableFields(metadata),
    nextStep: graphZoneCount > 0
      ? `Asigna ${graphZoneCount === 1 ? "un gráfico" : `un gráfico a cada una de las ${graphZoneCount} zonas`} y ajusta sus textos desde el inspector.`
      : "Completa el contenido editorial desde la pestaña Contenido del inspector.",
    insertableType,
    compatibilityReason: insertableType
      ? ""
      : "Este modelo se puede revisar, pero requiere una versión más reciente de Prosecnur para insertarse.",
  };
}

function slideCatalogDescription(count: number, loading: boolean, error: string): string {
  if (loading && count === 0) return "Cargando el inventario del proyecto.";
  if (error && count === 0) return "No se pudo consultar el inventario del proyecto.";
  if (count === 0) return "El catálogo no devolvió modelos de slide.";
  return `${count} ${count === 1 ? "modelo disponible" : "modelos disponibles"}. Compara la composición antes de insertarla.`;
}

function renderedColumnCount(grid: HTMLUListElement | null): number {
  if (!grid) return 1;
  const cards = Array.from(
    grid.querySelectorAll<HTMLButtonElement>("[data-slide-library-card]"),
  );
  if (cards.length < 2) return 1;

  const firstRect = cards[0].getBoundingClientRect();
  if (firstRect.width > 0) {
    let columns = 0;
    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      if (Math.abs(rect.top - firstRect.top) > 2) break;
      columns += 1;
    }
    if (columns > 0) return columns;
  }

  const computedTracks = window.getComputedStyle(grid).gridTemplateColumns.trim();
  if (!computedTracks || computedTracks === "none") return 1;
  return Math.max(1, computedTracks.split(/\s+/).length);
}

export function SlidePickerTrigger({
  onOpen,
  triggerRef,
}: {
  onOpen: () => void;
  triggerRef: RefObject<HTMLButtonElement>;
}) {
  return (
    <PulsoButton
      ref={triggerRef}
      variant="secondary"
      size="sm"
      className="pulso-slide-library-trigger"
      data-slide-library-trigger="persistent"
      onClick={onOpen}
    >
      <Plus size={14} aria-hidden="true" />
      <span>Agregar slide</span>
    </PulsoButton>
  );
}
