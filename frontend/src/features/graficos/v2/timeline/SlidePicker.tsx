import * as Dialog from "@radix-ui/react-dialog";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import type { SlideMetadata, SlideType } from "../../../../api/client";
import { PulsoButton } from "../../../../components/PulsoButton";
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
import { CATEGORY_LABEL, categoryOf, type SlideCategory } from "./categoryOf";
import {
  resolveSlidePickerBlueprint,
  SlidePickerBlueprint,
} from "./SlidePickerBlueprint";
import "./slidePicker.css";

const CANONICAL_TYPES: readonly SlideType[] = [
  "p_slide_portada",
  "p_slide_indice",
  "p_slide_seccion",
  "p_slide_objetivo_icono",
  "p_slide_texto",
  "p_slide_tabla_tecnica",
  "p_slide_top_two_box",
  "p_slide_1_grafico",
  "p_slide_1_grafico_narrativo",
  "p_slide_grafico_texto_derecha",
  "p_slide_grafico_texto_izquierda",
  "p_slide_2_graficos",
  "p_slide_2_graficos_narrativo",
  "p_slide_2_graficos_texto_izquierda",
  "p_slide_2_graficos_texto_derecha",
  "p_slide_4_graficos",
  "p_slide_2_graficos_poblacion",
  "p_slide_4_graficos_poblacion",
  "p_slide_5_graficos_poblacion",
  "p_slide_6_graficos_poblacion",
];

type SlideLibraryFilter = "all" | SlideCategory;

const FILTER_ORDER: readonly SlideLibraryFilter[] = [
  "all",
  "estructural",
  "1g",
  "2g",
  "grid",
  "poblacion",
];

const FILTER_LABELS: Record<SlideLibraryFilter, string> = {
  all: "Todos",
  ...CATEGORY_LABEL,
};

const FILTER_META: Record<SlideLibraryFilter, { Icon: LucideIcon; hint: string }> = {
  all: { Icon: LayoutGrid, hint: "Catálogo completo" },
  estructural: { Icon: LayoutPanelTop, hint: "Contenido y transición" },
  "1g": { Icon: BarChart3, hint: "Lectura focal" },
  "2g": { Icon: Columns3, hint: "Comparación" },
  grid: { Icon: Grid3X3, hint: "Panorama 2 × 2" },
  poblacion: { Icon: UsersRound, hint: "Perfil poblacional" },
};

const EDITABLE_FIELD_LIMIT = 6;

export type SlidePickerProps = {
  open: boolean;
  onClose: () => void;
};

export function SlidePicker({ open, onClose }: SlidePickerProps) {
  const addSlide = usePlanStore((state) => state.addSlide);
  const { registry, slidesById } = useGraficosRegistry();
  const [filter, setFilter] = useState<SlideLibraryFilter>("all");
  const [query, setQuery] = useState("");
  const [selectedType, setSelectedType] = useState<SlideType>(CANONICAL_TYPES[0]);
  const [insertAndContinue, setInsertAndContinue] = useState(true);
  const [feedback, setFeedback] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLUListElement>(null);
  const cardRefs = useRef(new Map<SlideType, HTMLButtonElement>());
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const insertionCountRef = useRef(0);

  const availableTypes = useMemo<SlideType[]>(() => {
    const registryTypes = Array.from(new Set(
      (registry?.slides ?? [])
        .map((slide) => slide.name)
        .filter(Boolean),
    ));
    if (registryTypes.length === 0) return [...CANONICAL_TYPES];

    const registrySet = new Set(registryTypes);
    return [
      ...CANONICAL_TYPES.filter((type) => registrySet.has(type)),
      ...registryTypes.filter((type) => !CANONICAL_TYPES.includes(type)),
    ];
  }, [registry]);

  useEffect(() => {
    if (availableTypes.length === 0 || availableTypes.includes(selectedType)) return;
    setSelectedType(availableTypes[0]);
  }, [availableTypes, selectedType]);

  const filteredTypes = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es");
    return availableTypes.filter((type) => {
      const metadata = slidesById[type];
      if (filter !== "all" && modelCategory(type, metadata) !== filter) return false;
      if (!normalizedQuery) return true;

      const searchable = [
        modelTitle(type, metadata),
        metadata?.descripcion,
        metadata?.args.map((arg) => arg.label).join(" "),
        type,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("es");
      return searchable.includes(normalizedQuery);
    });
  }, [availableTypes, filter, query, slidesById]);

  const displayedType = filteredTypes.includes(selectedType)
    ? selectedType
    : filteredTypes[0] ?? null;

  const categoryCounts = useMemo(() => {
    const counts = Object.fromEntries(
      FILTER_ORDER.map((category) => [category, 0]),
    ) as Record<SlideLibraryFilter, number>;
    counts.all = availableTypes.length;
    for (const type of availableTypes) {
      counts[modelCategory(type, slidesById[type])] += 1;
    }
    return counts;
  }, [availableTypes, slidesById]);

  const activeFilterMeta = FILTER_META[filter];
  const ActiveFilterIcon = activeFilterMeta.Icon;
  const selectedModel = displayedType === null
    ? null
    : buildSelectedModel(displayedType, slidesById[displayedType]);

  function insertSlide(type: SlideType) {
    addSlide(type);
    insertionCountRef.current += 1;
    const title = modelTitle(type, slidesById[type]);
    setFeedback(
      insertAndContinue
        ? `${title} insertado. La biblioteca sigue abierta. Inserción ${insertionCountRef.current}.`
        : `${title} insertado.`,
    );
    if (!insertAndContinue) onClose();
  }

  function focusCard(type: SlideType) {
    requestAnimationFrame(() => {
      const card = cardRefs.current.get(type);
      card?.focus({ preventScroll: true });
      card?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  }

  function handleCardKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    index: number,
    type: SlideType,
  ) {
    if (event.key === "Enter") {
      event.preventDefault();
      setSelectedType(type);
      insertSlide(type);
      return;
    }

    if (event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      setSelectedType(type);
      return;
    }

    const columnCount = renderedColumnCount(gridRef.current);
    let nextIndex: number | null = null;
    switch (event.key) {
      case "ArrowRight":
        nextIndex = Math.min(filteredTypes.length - 1, index + 1);
        break;
      case "ArrowLeft":
        nextIndex = Math.max(0, index - 1);
        break;
      case "ArrowDown":
        nextIndex = Math.min(filteredTypes.length - 1, index + columnCount);
        break;
      case "ArrowUp":
        nextIndex = Math.max(0, index - columnCount);
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = filteredTypes.length - 1;
        break;
      default:
        return;
    }

    const nextType = filteredTypes[nextIndex];
    if (!nextType) return;
    event.preventDefault();
    setSelectedType(nextType);
    focusCard(nextType);
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="pulso-slide-library-overlay" />
        <Dialog.Content
          className="pulso-slide-library-dialog"
          data-audit-ready="slide-picker"
          aria-modal="true"
          onOpenAutoFocus={(event) => {
            const activeElement = document.activeElement;
            previousFocusRef.current = activeElement instanceof HTMLElement
              && activeElement !== document.body
              && activeElement !== document.documentElement
              ? activeElement
              : null;
            event.preventDefault();
            requestAnimationFrame(() => searchRef.current?.focus({ preventScroll: true }));
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const previous = previousFocusRef.current;
            const fallback = Array.from(
              document.querySelectorAll<HTMLButtonElement>(
                '[data-slide-library-trigger="persistent"]',
              ),
            ).find((trigger) => trigger.isConnected && !trigger.disabled) ?? null;
            const returnTarget = previous?.isConnected ? previous : fallback;
            previousFocusRef.current = null;
            requestAnimationFrame(() => returnTarget?.focus({ preventScroll: true }));
          }}
          onKeyDown={(event) => {
            if (
              event.defaultPrevented
              || event.key !== "Enter"
              || event.nativeEvent.isComposing
              || displayedType === null
            ) return;
            const target = event.target;
            if (
              target instanceof HTMLButtonElement
              || (target instanceof HTMLInputElement && target.type === "checkbox")
            ) return;
            event.preventDefault();
            insertSlide(displayedType);
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
                  {availableTypes.length} {availableTypes.length === 1 ? "modelo disponible" : "modelos disponibles"}.
                  Compara la composición antes de insertarla.
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
                {FILTER_ORDER.map((category) => {
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
                <span className="pulso-slide-library-visible-count">
                  {filteredTypes.length} {filteredTypes.length === 1 ? "modelo visible" : "modelos visibles"}
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
                    if (event.key !== "Enter" || event.nativeEvent.isComposing || displayedType === null) return;
                    event.preventDefault();
                    insertSlide(displayedType);
                  }}
                  placeholder="Buscar por nombre, uso o contenido…"
                  aria-label="Buscar modelo de slide"
                />
                <span className="pulso-slide-library-search-key" aria-hidden="true">
                  <CornerDownLeft size={12} /> insertar
                </span>
              </label>

              <ul
                ref={gridRef}
                id="pulso-slide-library-models"
                className="pulso-slide-library-grid"
                aria-label="Modelos disponibles"
                data-qa-geometry-group="slide-library-models"
                data-qa-geometry-contract="equal"
              >
                {filteredTypes.map((type, index) => {
                  const metadata = slidesById[type];
                  const category = modelCategory(type, metadata);
                  const blueprint = resolveSlidePickerBlueprint(type, metadata?.slots ?? []);
                  const title = modelTitle(type, metadata);
                  const selected = displayedType === type;
                  return (
                    <li
                      key={type}
                      className="pulso-slide-library-card-frame"
                      data-model-type={type}
                    >
                      <button
                        ref={(node) => {
                          if (node) cardRefs.current.set(type, node);
                          else cardRefs.current.delete(type);
                        }}
                        type="button"
                        className="pulso-slide-library-card"
                        data-slide-library-card
                        data-family={category}
                        data-qa-geometry-member
                        data-qa-geometry-capacity="owned"
                        aria-pressed={selected}
                        aria-label={`${title}. ${blueprint.structureLabel}. Enter o doble clic para insertar; Espacio para seleccionar.`}
                        tabIndex={selected ? 0 : -1}
                        onClick={() => setSelectedType(type)}
                        onDoubleClick={(event) => {
                          event.preventDefault();
                          setSelectedType(type);
                          insertSlide(type);
                        }}
                        onKeyDown={(event) => handleCardKeyDown(event, index, type)}
                      >
                        <span className="pulso-slide-library-card-meta">
                          <span>{FILTER_LABELS[category]}</span>
                          <span>{blueprint.structureLabel}</span>
                        </span>
                        <SlidePickerBlueprint
                          type={type}
                          slots={metadata?.slots ?? []}
                          iconoUi={metadata?.icono_ui}
                          size="card"
                        />
                        <span className="pulso-slide-library-card-copy">
                          <strong>{title}</strong>
                          <span>{metadata?.descripcion ?? "Modelo listo para completar en el inspector."}</span>
                        </span>
                        <span className="pulso-slide-library-card-affordance">
                          <span>
                            <MousePointer2 size={13} aria-hidden="true" />
                            Doble clic para insertar
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
                {filteredTypes.length === 0 && (
                  <li className="pulso-slide-library-empty" data-qa-geometry-capacity="owned">
                    <Search size={20} aria-hidden="true" />
                    <strong>Sin coincidencias</strong>
                    <span>Ajusta la búsqueda o elige otra familia.</span>
                  </li>
                )}
              </ul>
            </section>

            <aside
              className="pulso-slide-library-inspector"
              data-family={selectedModel?.category ?? "all"}
              aria-label="Detalle del modelo seleccionado"
            >
              {selectedModel === null ? (
                <div className="pulso-slide-library-inspector-empty">
                  <Search size={20} aria-hidden="true" />
                  <strong>No hay un modelo visible</strong>
                  <span>Ajusta la búsqueda para volver a la biblioteca.</span>
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
                      type={selectedModel.type}
                      slots={selectedModel.metadata?.slots ?? []}
                      iconoUi={selectedModel.metadata?.icono_ui}
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
                          <li key={slot}>{humanizeZone(slot)}</li>
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
                      onClick={() => insertSlide(selectedModel.type)}
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
                      {feedback}
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

function modelCategory(type: SlideType, metadata?: SlideMetadata): SlideCategory {
  switch (metadata?.categoria) {
    case "estructural":
      return "estructural";
    case "1grafico":
      return "1g";
    case "2graficos":
      return "2g";
    case "4graficos":
      return "grid";
    case "poblacion":
      return "poblacion";
    default:
      return categoryOf(type);
  }
}

function modelTitle(type: SlideType, metadata?: SlideMetadata): string {
  const registryTitle = metadata?.titulo_humano.trim();
  if (registryTitle) return registryTitle;
  return SLIDE_LABELS[type] ?? humanizeIdentifier(type);
}

function humanizeIdentifier(value: string): string {
  const words = value
    .replace(/^p_slide_/, "")
    .split("_")
    .filter(Boolean)
    .join(" ");
  return words ? `${words.charAt(0).toLocaleUpperCase("es")}${words.slice(1)}` : "Modelo de slide";
}

function humanizeZone(slot: string): string {
  const knownZones: Record<string, string> = {
    grafico: "Gráfico principal",
    izquierda: "Izquierda",
    derecha: "Derecha",
    grafico_1: "Gráfico superior",
    grafico_2: "Gráfico inferior",
    superior_izquierda: "Superior izquierda",
    superior_derecha: "Superior derecha",
    inferior_izquierda: "Inferior izquierda",
    inferior_derecha: "Inferior derecha",
    grafico_superior_1: "Superior izquierda",
    grafico_superior_2: "Superior centro",
    grafico_superior_3: "Superior derecha",
    grafico_inferior_1: "Inferior izquierda",
    grafico_inferior_2: "Inferior centro",
    grafico_inferior_3: "Inferior derecha",
  };
  if (knownZones[slot]) return knownZones[slot];
  return humanizeIdentifier(slot);
}

function editableFields(metadata?: SlideMetadata): string[] {
  if (!metadata) return [];
  return Array.from(new Set(
    metadata.args
      .filter((arg) => arg.tipo_input !== "meta" && arg.grupo !== "diagnostico")
      .map((arg) => arg.label.trim())
      .filter(Boolean),
  ));
}

function buildSelectedModel(type: SlideType, metadata?: SlideMetadata) {
  const blueprint = resolveSlidePickerBlueprint(type, metadata?.slots ?? []);
  const graphZoneCount = blueprint.graphSlots.length;
  return {
    type,
    metadata,
    blueprint,
    category: modelCategory(type, metadata),
    title: modelTitle(type, metadata),
    description: metadata?.descripcion
      || "Modelo listo para completar desde el inspector del slide.",
    editableFields: editableFields(metadata),
    nextStep: graphZoneCount > 0
      ? `Asigna ${graphZoneCount === 1 ? "un gráfico" : `un gráfico a cada una de las ${graphZoneCount} zonas`} y ajusta sus textos desde el inspector.`
      : "Completa el contenido editorial desde la pestaña Contenido del inspector.",
  };
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

export function SlidePickerTrigger({ onOpen }: { onOpen: () => void }) {
  return (
    <PulsoButton
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
