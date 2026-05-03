import { useMemo } from "react";
import * as Lucide from "lucide-react";
import { LayoutPanelTop, FileText, Database, Palette, Filter as FilterIcon } from "lucide-react";
import { ArgGrupo, ArgMetadata } from "../../../../api/client";
import { usePlanStore, SLIDE_LABELS, InspectorTab } from "../../store";
import { useGraficosRegistry } from "../../useGraficosRegistry";
import { useVariables } from "../../useVariables";
import { ArgGroup, ARG_GROUP_ORDER, normalizeArgGroup } from "../../ArgGroup";
import GraficadorSlot from "../../GraficadorSlot";
import { LoadingBlock, EmptyState } from "../../../../components/States";
import { usePlanValidator } from "../../usePlanValidator";
import { StylePanel } from "./StylePanel";
import { FiltersPanel } from "./FiltersPanel";

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
  const selectedSlideId = usePlanStore((s) => s.selectedSlideId);
  const slide = usePlanStore((s) => s.plan.slides.find((x) => x.id === selectedSlideId));
  const updatePayload = usePlanStore((s) => s.updateSlidePayload);
  const inspectorTab = usePlanStore((s) => s.inspectorTab);
  const setInspectorTab = usePlanStore((s) => s.setInspectorTab);

  const { slidesById, loading } = useGraficosRegistry();
  const { variables } = useVariables();
  const { issues } = usePlanValidator();

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
        <div style={{ padding: "18px 22px", flex: 1 }}>
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
  const SlideIcon = slideMeta ? resolveLucide(slideMeta.icono_ui) : Lucide.FileText;

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

  return (
    <div className="pulso-gv2-inspector">
      <div className="pulso-gv2-inspector-head">
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
            <span style={{
              width: 32, height: 32, borderRadius: 8,
              background: "var(--pulso-primary-soft)",
              color: "var(--pulso-primary)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <SlideIcon size={16} />
            </span>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: 16, lineHeight: 1.2 }}>{humanTitle}</h2>
              <code style={{ fontSize: 10, color: "var(--pulso-text-soft)", fontFamily: "ui-monospace, monospace" }}>
                {slide.tipo}
              </code>
            </div>
          </div>

        </div>

        {slideMeta?.descripcion && (
          <div style={{
            fontSize: 11, color: "var(--pulso-text-soft)", marginTop: 6,
            lineHeight: 1.5, maxWidth: 600,
          }}>
            {slideMeta.descripcion}
          </div>
        )}

        <div className="pulso-gv2-inspector-tabs" role="tablist">
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
                title={
                  disabled
                    ? `Sin opciones en "${label}" para este tipo de slide`
                    : `${label}${issueN > 0 ? ` · ${issueN} issue(s)` : ""}`
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
          <ContentTabBody slide={slide} args={argsInActiveTab} updatePayload={updatePayload} variables={variables} />
        )}

        {/* Tab Datos: args de datos + slots de graficador */}
        {activeTab.key === "data" && (
          <DataTabBody
            slide={slide}
            args={argsInActiveTab}
            updatePayload={updatePayload}
            variables={variables}
            slotNames={slotNames}
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

type LucideIcon = (props: { size?: number }) => JSX.Element;
function resolveLucide(name: string): LucideIcon {
  const reg = Lucide as unknown as Record<string, LucideIcon>;
  return reg[name] ?? reg["FileText"] ?? reg["Square"];
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

function ContentTabBody({ slide, args, updatePayload, variables }: {
  slide: { id: string; payload: Record<string, unknown> };
  args: ArgMetadata[];
  updatePayload: (id: string, patch: Record<string, unknown>) => void;
  variables: import("../../../../api/client").VarInfo[];
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
    <section style={{ maxWidth: 640 }}>
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
  );
}

function DataTabBody({ slide, args, updatePayload, variables, slotNames }: {
  slide: { id: string; payload: Record<string, unknown> };
  args: ArgMetadata[];
  updatePayload: (id: string, patch: Record<string, unknown>) => void;
  variables: import("../../../../api/client").VarInfo[];
  slotNames: string[];
}) {
  return (
    <>
      {/* Slots de gráfico (si aplica) — modo data: solo args de datos
          (var, cruces, etc.). Sin wand de override (eso vive en Estilo). */}
      {slotNames.length > 0 && (
        <section style={{ marginBottom: 18 }}>
          <div className="pulso-section-eyebrow" style={{ marginBottom: 10 }}>
            Gráficos del slide · {slotNames.length} slot{slotNames.length === 1 ? "" : "s"}
          </div>
          {slotNames.map((slotName) => (
            <GraficadorSlot
              key={slotName}
              slideId={slide.id}
              slotName={slotName}
              value={(slide.payload as Record<string, unknown>)[slotName] as never}
              mode="data"
            />
          ))}
        </section>
      )}

      {/* Otros args de datos no-slot */}
      {args.length > 0 && (
        <section style={{ maxWidth: 640 }}>
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
