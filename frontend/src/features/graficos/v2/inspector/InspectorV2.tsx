import { useMemo } from "react";
import { ChevronDown, LayoutPanelTop, FileText, Database, Palette, Filter as FilterIcon } from "lucide-react";
import { ArgGrupo, ArgMetadata, GraficadorRef } from "../../../../api/client";
import { useSession } from "../../../../lib/SessionContext";
import { usePlanStore, SLIDE_LABELS, InspectorTab } from "../../store";
import { useGraficosRegistry } from "../../useGraficosRegistry";
import { useVariables } from "../../useVariables";
import { ArgGroup, ARG_GROUP_ORDER, normalizeArgGroup } from "../../ArgGroup";
import GraficadorSlot, { getSlotLabel } from "../../GraficadorSlot";
import { SlidePreview } from "../../SlidePreview";
import { LoadingBlock, EmptyState } from "../../../../components/States";
import { usePlanValidator } from "../../usePlanValidator";
import { StylePanel } from "./StylePanel";
import { FiltersPanel } from "./FiltersPanel";
import { inferSlideVariableTitle } from "../../slideAutoTitle";
import { SlideTypeIcon } from "../../SlideTypeIcon";

// Inspector V3: tabs Contenido | Datos | Estilo | Filtros (sin Avanzado,
// sin editor JSON crudo).
//
// Distribución de args por tab:
//   * Contenido = grupo `lectura` / `textos`
//   * Datos     = grupo `datos` + slots de graficador
//   * Estilo    = lectura, leyenda, espacio y diagnóstico visual.
//   * Filtros   = motor de filtros sobre la base del slide.
//
// Los grupos legacy se normalizan para que planes antiguos sigan abriendo.

const TABS: { key: InspectorTab; label: string; Icon: typeof FileText; grupos: ArgGrupo[] }[] = [
  { key: "content", label: "Contenido", Icon: FileText,   grupos: ["lectura", "textos"] },
  { key: "data",    label: "Datos",     Icon: Database,   grupos: ["datos"] },
  { key: "style",   label: "Estilo",    Icon: Palette,    grupos: ["lectura", "leyenda", "espacio", "diagnostico", "textos", "estilo", "canvas", "avanzado"] },
  { key: "filters", label: "Filtros",   Icon: FilterIcon, grupos: [] },
];

export function InspectorV2() {
  const { state } = useSession();
  const selectedSlideId = usePlanStore((s) => s.selectedSlideId);
  const slide = usePlanStore((s) => s.plan.slides.find((x) => x.id === selectedSlideId));
  const updatePayload = usePlanStore((s) => s.updateSlidePayload);
  const inspectorTab = usePlanStore((s) => s.inspectorTab);
  const setInspectorTab = usePlanStore((s) => s.setInspectorTab);

  const { slidesById, graficadoresById, loading } = useGraficosRegistry();
  const { variables } = useVariables();
  const { issues } = usePlanValidator();
  const prepOk = !!state?.analitica_prep_ok;

  const slideMeta = slide ? slidesById[slide.tipo] : undefined;
  const slotNames = slide ? (slideMeta?.slots.filter((s: string) => s !== "icono") ?? []) : [];

  // Distribución de args por tab. Args que son slots se manejan en
  // GraficadorSlot dentro del tab Datos.
  const argsByTab = useMemo<Record<InspectorTab, ArgMetadata[]>>(() => {
    const result: Record<InspectorTab, ArgMetadata[]> = {
      content: [], data: [], style: [], filters: [],
    };
    if (!slideMeta) return result;
    const slotSet = new Set(slotNames);
    for (const arg of slideMeta.args) {
      if (slotSet.has(arg.name)) continue;
      if (arg.name === "icono" || arg.tipo_input === "icono") {
        result.content.push(arg);
        continue;
      }
      const grupo = normalizeArgGroup((arg.grupo as ArgGrupo) ?? "estilo");
      const tab = TABS.find((t) => t.grupos.map(normalizeArgGroup).includes(grupo));
      if (tab) result[tab.key].push(arg);
      else result.style.push(arg); // fallback razonable
    }
    return result;
  }, [slideMeta, slotNames]);

  const issuesForSlide = useMemo(() => {
    if (!slide) return [];
    return issues.filter((i) => i.slideId === slide.id);
  }, [issues, slide]);

  if (!slide) {
    return (
      <div className="pulso-gv2-inspector">
        <div className="pulso-gv2-inspector-empty">
          <EmptyState
            icon={<LayoutPanelTop size={22} />}
            title="Sin slide seleccionado"
            hint="Selecciona uno del timeline o agrégalo desde la sección de abajo."
          />
        </div>
      </div>
    );
  }

  const humanTitle = SLIDE_LABELS[slide.tipo] ?? slide.tipo;

  // Cuenta args por tab para badges
  const tabArgCounts: Record<InspectorTab, number> = {
    content: argsByTab.content?.length ?? 0,
    data: (argsByTab.data?.length ?? 0) + slotNames.length,
    style: argsByTab.style?.length ?? 0,
    filters: argsByTab.filters?.length ?? 0,
  };

  // Cuenta de issues por tab
  const issuesByTab: Record<InspectorTab, number> = {
    content: 0,
    data: issuesForSlide.filter((i) => i.code === "slot-empty" || i.code === "var-unknown" || i.code === "icon-unknown").length,
    style: 0,
    filters: 0,
  };

  const activeTab = TABS.find((t) => t.key === inspectorTab) ?? TABS[0];
  const argsInActiveTab = argsByTab[activeTab.key] ?? [];
  const autoTitle = inferSlideVariableTitle(slide, variables).title;

  return (
    <div className="pulso-gv2-inspector">
      <div className="pulso-gv2-inspector-head">
        <div className="pulso-gv2-inspector-head-main">
          <div className="pulso-gv2-inspector-head-copy">
            <div className="pulso-gv2-inspector-title-row">
              <div className="pulso-gv2-inspector-title-cluster">
                <span className="pulso-gv2-inspector-icon">
                  <SlideTypeIcon tipo={slide.tipo} iconoUi={slideMeta?.icono_ui} size={16} />
                </span>
                <div className="pulso-gv2-inspector-title-copy">
                  <h2 className="pulso-gv2-inspector-title">{humanTitle}</h2>
                  <code className="pulso-gv2-inspector-code">
                    {slide.tipo}
                  </code>
                </div>
              </div>
            </div>

            {slideMeta?.descripcion && (
              <div className="pulso-gv2-inspector-description">
                {slideMeta.descripcion}
              </div>
            )}
          </div>

          <SlidePreview slide={slide} prepOk={prepOk} compact />
        </div>

        <div className="pulso-gv2-inspector-tabs" role="tablist" aria-label="Configuración del slide">
          {TABS.map(({ key, label, Icon }) => {
            const count = tabArgCounts[key];
            const issueN = issuesByTab[key];
            // Estilo y Filtros siempre se muestran si el slide tiene
            // slots — aunque el slide en sí no tenga args propios, los
            // args de cada graficador se exponen en sub-cards.
            const isAlwaysVisible =
              (key === "filters" && slotNames.length > 0) ||
              (key === "style" && slotNames.length > 0);
            const disabled = count === 0 && !isAlwaysVisible;
            return (
              <button
                key={key}
                role="tab"
                type="button"
                aria-selected={inspectorTab === key}
                disabled={disabled}
                onClick={() => setInspectorTab(key)}
                className={`pulso-gv2-inspector-tab ${inspectorTab === key ? "is-active" : ""}`}
                aria-label={
                  disabled
                    ? `Sin opciones en "${label}" para este tipo de slide`
                    : `${label}${issueN > 0 ? ` · ${issueN} incidencia${issueN === 1 ? "" : "s"}` : ""}`
                }
                style={disabled ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
              >
                <Icon size={13} />
                {label}
                {count > 0 && (
                  <span className="pulso-gv2-inspector-tab-badge">
                    {count}
                  </span>
                )}
                {issueN > 0 && (
                  <span
                    style={{
                      width: 6, height: 6, borderRadius: 999,
                      background: "var(--pulso-danger-fg)",
                      display: "inline-block",
                    }}
                    aria-label={`${issueN} issues`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="pulso-gv2-inspector-body">
        {loading && <LoadingBlock variant="inline" label="Cargando opciones del slide…" />}

        {/* Tab Contenido: solo args de textos */}
        {activeTab.key === "content" && (
          <ContentTabBody slide={slide} args={argsInActiveTab} updatePayload={updatePayload} variables={variables} autoTitle={autoTitle} />
        )}

        {/* Tab Datos: args de datos + slots de graficador */}
        {activeTab.key === "data" && (
          <DataTabBody
            slide={slide}
            args={argsInActiveTab}
            updatePayload={updatePayload}
            variables={variables}
            slotNames={slotNames}
            graficadoresById={graficadoresById}
          />
        )}

        {/* Tab Estilo: panel especializado con preset + overrides */}
        {activeTab.key === "style" && (
          <StylePanel
            slide={slide}
            args={argsInActiveTab}
            variables={variables}
          />
        )}

        {/* Tab Filtros: motor de filtros */}
        {activeTab.key === "filters" && (
          <FiltersPanel
            slide={slide}
            variables={variables}
            slotNames={slotNames}
          />
        )}
      </div>
    </div>
  );
}

function groupArgs(args: ArgMetadata[]): { grupo: ArgGrupo; args: ArgMetadata[] }[] {
  const map: Partial<Record<ArgGrupo, ArgMetadata[]>> = {};
  for (const a of args) {
    const g = normalizeArgGroup((a.grupo as ArgGrupo) ?? "avanzado");
    (map[g] ??= []).push(a);
  }
  return ARG_GROUP_ORDER
    .filter((g) => map[g] && map[g]!.length > 0)
    .map((g) => ({ grupo: g, args: map[g]! }));
}

// --- Sub-componentes de tabs simples (Contenido + Datos) -------------------

function ContentTabBody({ slide, args, updatePayload, variables, autoTitle }: {
  slide: { id: string; payload: Record<string, unknown> };
  args: ArgMetadata[];
  updatePayload: (id: string, patch: Record<string, unknown>) => void;
  variables: import("../../../../api/client").VarInfo[];
  autoTitle?: string;
}) {
  if (args.length === 0) {
    return (
      <EmptyState
        variant="inline"
        icon={<FileText size={18} />}
        title="Este slide no tiene textos editables"
        hint="Algunos slides como índice o gráficos puros no requieren textos manuales."
      />
    );
  }
  return (
    <section className="pulso-gv2-config-section">
      {groupArgs(args).map(({ grupo, args: gargs }) => (
        <ArgGroup
          key={grupo}
          grupo={grupo}
          args={gargs}
          values={slide.payload}
          placeholders={autoTitle ? { titulo: autoTitle } : undefined}
          onChangeArg={(name, value) => updatePayload(slide.id, { [name]: value })}
          variables={variables}
        />
      ))}
    </section>
  );
}

function DataTabBody({ slide, args, updatePayload, variables, slotNames, graficadoresById }: {
  slide: { id: string; payload: Record<string, unknown> };
  args: ArgMetadata[];
  updatePayload: (id: string, patch: Record<string, unknown>) => void;
  variables: import("../../../../api/client").VarInfo[];
  slotNames: string[];
  graficadoresById: ReturnType<typeof useGraficosRegistry>["graficadoresById"];
}) {
  return (
    <>
      {/* Slots de gráfico (si aplica) — modo data: solo args de datos
          (var, cruces, etc.). Sin wand de override (eso vive en Estilo). */}
      {slotNames.length > 0 && (
        <section className="pulso-gv2-data-slots-section">
          <div className="pulso-gv2-section-caption">
            Gráficos del slide
          </div>
          <div className="pulso-gv2-slot-stack">
            {slotNames.map((slotName) => {
              const slotValue = (slide.payload as Record<string, unknown>)[slotName] as GraficadorRef | undefined;
              const slotLabel = getSlotLabel(slotName);
              const technicalName = slotValue?.graficador ?? "";
              const humanName = technicalName ? (graficadoresById[technicalName]?.titulo_humano ?? technicalName) : "";
              return (
                <details className="pulso-gv2-slot-accordion" key={slotName} open>
                  <summary className="pulso-gv2-slot-accordion-summary">
                    <span>
                      <strong>{slotLabel}</strong>
                      {technicalName ? ` · ${humanName}` : " · Sin gráfico"}
                    </span>
                    <ChevronDown size={13} />
                  </summary>
                  <div className="pulso-gv2-slot-accordion-body">
                    <GraficadorSlot
                      slideId={slide.id}
                      slotName={slotName}
                      value={slotValue as never}
                      mode="data"
                    />
                  </div>
                </details>
              );
            })}
          </div>
        </section>
      )}

      {/* Otros args de datos no-slot */}
      {args.length > 0 && (
        <section className="pulso-gv2-config-section">
          {groupArgs(args).map(({ grupo, args: gargs }) => (
            <ArgGroup
              key={grupo}
              grupo={grupo}
              args={gargs}
              values={slide.payload}
              onChangeArg={(name, value) => updatePayload(slide.id, { [name]: value })}
              variables={variables}
            />
          ))}
        </section>
      )}

      {slotNames.length === 0 && args.length === 0 && (
        <EmptyState
          variant="inline"
          icon={<Database size={18} />}
          title="Este slide no tiene datos editables"
          hint="Slides como portada o tabla técnica solo configuran textos."
        />
      )}
    </>
  );
}

// Re-export utilitario para que StylePanel/FiltersPanel agrupen también
export { groupArgs };
