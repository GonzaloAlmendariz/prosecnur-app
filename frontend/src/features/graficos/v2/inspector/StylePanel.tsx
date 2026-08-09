import { useMemo } from "react";
import { Palette, Sliders, RotateCcw, Info, LayoutPanelTop, ArrowRight, ChevronDown } from "lucide-react";
import { ArgMetadata, GraficadorRef, Slide, VarInfo } from "../../../../api/client";
import { usePlanStore, SLIDE_GRAF_SLOTS } from "../../store";
import { ArgGroup } from "../../ArgGroup";
import { graficadorToPresetType } from "../../graficadorPresetMap";
import { useGraficosRegistry } from "../../useGraficosRegistry";
import { usePresetsMetadata } from "../../usePresetsMetadata";
import GraficadorSlot, { getSlotLabel } from "../../GraficadorSlot";
import { graficadorDisplayName } from "../../graficadorDisplay";
import { collectActiveChartStyleValues, resolveActiveChartLayoutOrigin } from "../../chartLayoutOrigin";
import { groupArgs } from "./InspectorV2";

// Tab de Estilo. Estructura final acordada con el usuario:
//
//   1. Banner del preset principal (si todos los slots heredan del mismo).
//   2. Args de estilo del SLIDE (no del graficador). Ej: layout-level
//      (margenes globales, color de la lámina, etc.).
//   3. Una SUB-CARD por cada slot poblado del slide, en `mode="style"`:
//        - Header: nombre humano + ícono + nombre técnico + botón
//          "Estilo" (override) — el wand vive aquí, no en Datos.
//        - Body: args de los grupos `estilo` y `canvas` del graficador.
//      Esto deja claro que cada gráfico se puede tunear independientemente.
//   4. Botón "Restaurar al preset" para borrar todos los args custom del
//      slide en este tab.
//
// Sin editor JSON crudo. Sin args de datos. Sin args de filtro.

export type StylePanelProps = {
  slide: Slide;
  args: ArgMetadata[];        // args de estilo del slide (no del graficador)
  variables: VarInfo[];
  onRequestDataTab?: () => void;
};

export function StylePanel({ slide, args, onRequestDataTab }: StylePanelProps) {
  const updatePayload = usePlanStore((s) => s.updateSlidePayload);
  const { graficadoresById } = useGraficosRegistry();
  const { presetsByName } = usePresetsMetadata();

  const slotNames = SLIDE_GRAF_SLOTS[slide.tipo] ?? [];

  // Args de estilo del SLIDE con valor custom (difieren del default)
  const customSlideArgKeys = useMemo(() => {
    const set = new Set<string>();
    for (const a of args) {
      const v = (slide.payload as Record<string, unknown>)[a.name];
      if (v !== undefined && v !== null && v !== "") set.add(a.name);
    }
    return set;
  }, [args, slide.payload]);

  const slotStyleInfo = useMemo(() => {
    type SlotState = "empty" | "base" | "manual";
    const bySlot: Record<string, { state: SlotState; label: string }> = {};
    const counts = {
      empty: 0,
      base: 0,
      manual: 0,
      populated: 0,
    };

    for (const slot of slotNames) {
      const value = (slide.payload as Record<string, unknown>)[slot] as GraficadorRef | undefined;
      const graf = value?.graficador;
      if (!graf) {
        counts.empty += 1;
        bySlot[slot] = { state: "empty", label: "Sin gráfico" };
        continue;
      }

      counts.populated += 1;
      const presetType = graficadorToPresetType(
        graf,
        graficadoresById[graf]?.preset_key,
      );
      const visualArgNames = new Set(
        presetType ? (presetsByName[presetType]?.args ?? []).map((arg) => arg.name) : [],
      );
      visualArgNames.add("titulo");
      const styleValues = collectActiveChartStyleValues(
        asRecord(value.args),
        visualArgNames,
      );
      const origin = resolveActiveChartLayoutOrigin(styleValues);

      if (origin.kind === "base_ppt") {
        counts.base += 1;
        bySlot[slot] = { state: "base", label: "Base PPT" };
        continue;
      }

      counts.manual += 1;
      bySlot[slot] = { state: "manual", label: "Ajuste de este gráfico" };
    }

    return {
      bySlot,
      counts,
    };
  }, [graficadoresById, presetsByName, slide.payload, slotNames]);

  const styleFlow = {
    hasPreset: slotStyleInfo.counts.base > 0,
    hasManual: slotStyleInfo.counts.manual > 0,
  };

  function resetSlideStyleArgs() {
    if (!window.confirm("¿Restaurar los ajustes de estilo del slide al estilo base?")) return;
    const patch: Record<string, unknown> = {};
    for (const a of args) patch[a.name] = null;
    updatePayload(slide.id, patch);
  }

  const grouped = groupArgs(args);
  const hasSlideCustom = customSlideArgKeys.size > 0;
  const hasSlideArgs = grouped.length > 0;
  const hasSlots = slotNames.length > 0;

  return (
    <div className="pulso-gv2-style-panel">
      {/* Banner: leyenda visual de estados (más concisa). */}
      {hasSlots ? (
        <div className="pulso-gv2-style-banner">
          <span className="pulso-gv2-style-banner-icon"><Palette size={14} /></span>
          <div className="pulso-gv2-style-banner-body">
            <div className="pulso-gv2-style-banner-title-row">
              <div className="pulso-gv2-style-banner-title">
                Apariencia del gráfico
              </div>
              <div
                className="pulso-gv2-style-origin-strip"
                aria-label={`${slotStyleInfo.counts.base} Base PPT; biblioteca disponible para copia; ${slotStyleInfo.counts.manual} Ajuste de este gráfico`}
              >
                <span><strong>{slotStyleInfo.counts.base}</strong> Base PPT</span>
                <span><strong>→</strong> Biblioteca disponible</span>
                <span><strong>{slotStyleInfo.counts.manual}</strong> Ajuste de este gráfico</span>
              </div>
            </div>
            <div className="pulso-gv2-style-banner-hint">
              <div className="pulso-gv2-style-flow-title">Flujo de copia</div>
              <div className="pulso-gv2-style-flow" aria-label="Base PPT; biblioteca disponible para copia; Ajuste de este gráfico">
                <div className={`pulso-gv2-style-flow-step is-base ${styleFlow.hasPreset ? "is-active" : ""}`} data-state="Base">
                  <div className="pulso-gv2-style-flow-step-icon"><Palette size={12} /></div>
                  <div className="pulso-gv2-style-flow-step-copy">
                    <strong>Base PPT</strong>
                    <span>No marca cambios</span>
                  </div>
                </div>
                <ArrowRight size={13} className="pulso-gv2-style-flow-arrow" />
                <div className="pulso-gv2-style-flow-step is-mode" data-state="Biblioteca disponible">
                  <div className="pulso-gv2-style-flow-step-icon"><Palette size={12} /></div>
                  <div className="pulso-gv2-style-flow-step-copy">
                    <strong>Biblioteca</strong>
                    <span>Se copia, no se vincula</span>
                  </div>
                </div>
                <ArrowRight size={13} className="pulso-gv2-style-flow-arrow" />
                <div className={`pulso-gv2-style-flow-step is-custom ${styleFlow.hasManual ? "is-active" : ""}`} data-state="Ajustes">
                  <div className="pulso-gv2-style-flow-step-icon"><Sliders size={12} /></div>
                  <div className="pulso-gv2-style-flow-step-copy">
                    <strong>Ajuste de este gráfico</strong>
                    <span>Solo este gráfico</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="pulso-gv2-style-banner is-info">
          <span className="pulso-gv2-style-banner-icon"><Info size={14} /></span>
          <div className="pulso-gv2-style-banner-body">
            <div className="pulso-gv2-style-banner-title">Lámina sin gráficos</div>
            <div className="pulso-gv2-style-banner-hint">Los ajustes de estilo aquí aplican al diseño general de la lámina.</div>
          </div>
        </div>
      )}

      {/* Args de estilo del SLIDE (no del graficador) */}
      {hasSlideArgs && (
        <section className="pulso-gv2-style-section">
          <div className="pulso-gv2-style-section-head">
            <Sliders size={13} />
            <span>Diseño de la lámina</span>
            {hasSlideCustom && <span className="pulso-gv2-style-section-meta has-custom">Ajustes personalizados</span>}
            <button
              type="button"
              className="pulso-gv2-style-reset"
              onClick={resetSlideStyleArgs}
              disabled={!hasSlideCustom}
              aria-label="Borrar tus cambios y volver al estilo por defecto"
            >
              <RotateCcw size={11} /> Restaurar
            </button>
          </div>
          <div className="pulso-gv2-style-section-hint">
            Márgenes, fondo, encabezado y pie de la lámina completa.
          </div>
          {grouped.map(({ grupo, args: gargs }) => (
            <ArgGroup
              key={grupo}
              grupo={grupo}
              args={gargs}
              values={slide.payload}
              onChangeArg={(name, value) => updatePayload(slide.id, { [name]: value })}
              variables={[] /* args de estilo no usan variables */}
            />
          ))}
        </section>
      )}

      {/* Sub-cards por slot — args de estilo de cada graficador */}
      {hasSlots && (
        <section className="pulso-gv2-style-slots-section">
          <div className="pulso-gv2-style-section-head pulso-gv2-style-slots-head">
            <LayoutPanelTop size={13} />
            <span>Cada gráfico</span>
          </div>
          <div className="pulso-gv2-style-section-hint">
            Ajusta lectura, espacio, leyenda y valores visibles.
            Elige un <strong>estilo guardado</strong> para copiarlo como ajustes del gráfico;
            la copia no mantiene vínculo con la biblioteca.
          </div>
          <div className="pulso-gv2-slot-stack">
            {slotNames.map((slotName) => {
              const slotValue = (slide.payload as Record<string, unknown>)[slotName] as GraficadorRef | undefined;
              const slotLabel = getSlotLabel(slotName);
              const technicalName = slotValue?.graficador ?? "";
              const humanName = technicalName ? graficadorDisplayName(technicalName, graficadoresById[technicalName]) : "";
              const slotState = slotStyleInfo.bySlot[slotName] ?? { state: "empty", label: "Sin gráfico" };
              return (
                <details className="pulso-gv2-slot-accordion" data-state={slotState.state} key={slotName} open>
                  <summary className="pulso-gv2-slot-accordion-summary">
                    <span className="pulso-gv2-slot-accordion-summary-copy">
                      <span className="pulso-gv2-slot-accordion-title">
                        <strong>{slotLabel}</strong>
                        <span>{technicalName ? humanName : "Sin gráfico"}</span>
                      </span>
                      <span
                        className="pulso-gv2-slot-origin-map"
                        data-state={slotState.state}
                        aria-hidden="true"
                      >
                        <span data-step="base">Base</span>
                        <span data-step="mode">Copia</span>
                        <span data-step="manual">Ajustes</span>
                      </span>
                      <span className={`pulso-gv2-slot-state-pill is-${slotState.state}`}>
                        {slotState.label}
                      </span>
                    </span>
                    <ChevronDown size={13} />
                  </summary>
                  <div className="pulso-gv2-slot-accordion-body">
                    <GraficadorSlot
                      slideId={slide.id}
                      slotName={slotName}
                      value={slotValue as never}
                      mode="style"
                      onRequestDataTab={onRequestDataTab}
                    />
                  </div>
                </details>
              );
            })}
          </div>
        </section>
      )}

      {!hasSlideArgs && !hasSlots && (
        <div className="pulso-gv2-style-empty">
          <LayoutPanelTop size={14} />
          Sin opciones de estilo para este tipo de slide.
        </div>
      )}
    </div>
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}
