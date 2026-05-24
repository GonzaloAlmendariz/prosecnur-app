import { useMemo } from "react";
import { Palette, Sliders, RotateCcw, Info, LayoutPanelTop, ArrowRight } from "lucide-react";
import { ArgMetadata, GraficadorRef, Slide, VarInfo } from "../../../../api/client";
import { usePlanStore, SLIDE_GRAF_SLOTS } from "../../store";
import { graficadorToPresetType } from "../../graficadorPresetMap";
import { ArgGroup } from "../../ArgGroup";
import GraficadorSlot from "../../GraficadorSlot";
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
};

export function StylePanel({ slide, args }: StylePanelProps) {
  const overridesReusables = usePlanStore((s) => s.overridesReusables);
  const updatePayload = usePlanStore((s) => s.updateSlidePayload);

  const slotNames = SLIDE_GRAF_SLOTS[slide.tipo] ?? [];

  // Detectar el "preset principal" del slide observando los slots.
  const presetInfo = useMemo(() => {
    const presetTypes: Set<string> = new Set();
    const populatedSlots: { slot: string; graf: string }[] = [];
    for (const slot of slotNames) {
      const v = (slide.payload as Record<string, unknown>)[slot] as GraficadorRef | undefined;
      if (!v?.graficador) continue;
      populatedSlots.push({ slot, graf: v.graficador });
      const ptype = graficadorToPresetType(v.graficador);
      if (ptype) presetTypes.add(ptype);
    }
    return { presetTypes: Array.from(presetTypes), populatedSlots };
  }, [slide.payload, slotNames]);

  // Args de estilo del SLIDE con valor custom (difieren del default)
  const customSlideArgKeys = useMemo(() => {
    const set = new Set<string>();
    for (const a of args) {
      const v = (slide.payload as Record<string, unknown>)[a.name];
      if (v !== undefined && v !== null && v !== "") set.add(a.name);
    }
    return set;
  }, [args, slide.payload]);

  const styleFlow = useMemo(() => {
    let hasPreset = false;
    let hasMode = false;
    let hasManual = false;

    for (const { slot, graf } of presetInfo.populatedSlots) {
      const value = (slide.payload as Record<string, unknown>)[slot] as GraficadorRef | undefined;
      const overrides = asRecord(value?.args?.overrides);
      const overrideKeys = Object.keys(overrides).filter(
        (k) => overrides[k] !== null && overrides[k] !== undefined
      );

      if (overrideKeys.length === 0) {
        hasPreset = true;
        continue;
      }

      const presetType = graficadorToPresetType(graf);
      const aplicables = presetType
        ? overridesReusables.filter((o) => o.tipo_preset === presetType)
        : [];
      if (!aplicables.length) {
        hasManual = true;
        continue;
      }

      const exactMatch = aplicables.find((o) => shallowEqualArgs((o.args as Record<string, unknown>) ?? {}, overrides));
      if (exactMatch) {
        hasMode = true;
        continue;
      }

      const partialMatch = aplicables.find((o) =>
        isSubsetArgs((o.args as Record<string, unknown>) ?? {}, overrides)
      );
      if (partialMatch) {
        hasManual = true;
        continue;
      }

      hasManual = true;
    }

    return {
      hasPreset,
      hasMode,
      hasManual,
    };
  }, [presetInfo.populatedSlots, slide.payload, overridesReusables]);

  function resetSlideStyleArgs() {
    if (!window.confirm("¿Restaurar los args de estilo del slide al estilo base?")) return;
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
            <div className="pulso-gv2-style-banner-title">
              Estilo del gráfico
            </div>
            <div className="pulso-gv2-style-banner-hint">
              <div className="pulso-gv2-style-flow-title">Ruta de estilo del gráfico</div>
              <div className="pulso-gv2-style-flow" aria-label="Jerarquía de origen de los valores">
                <div className="pulso-gv2-style-flow-step is-base is-active" data-state="Base">
                  <div className="pulso-gv2-style-flow-step-icon"><Palette size={12} /></div>
                  <div className="pulso-gv2-style-flow-step-copy">
                    <strong>Base global</strong>
                    <span>
                      Configura el aspecto base del tipo de gráfico para toda la presentación.
                      Es el punto de inicio compartido antes de los ajustes por gráfico.
                    </span>
                  </div>
                </div>
                <ArrowRight size={13} className="pulso-gv2-style-flow-arrow" />
                <div className={`pulso-gv2-style-flow-step is-mode ${styleFlow.hasMode ? "is-active" : ""}`} data-state="Modo">
                  <div className="pulso-gv2-style-flow-step-icon"><Palette size={12} /></div>
                  <div className="pulso-gv2-style-flow-step-copy">
                    <strong>Modo</strong>
                    <span>
                      Ajuste reutilizable para varios gráficos (compacto, narrativo, etc.).
                      Aplícalo para homogeneidad sin tocar cada gráfico uno por uno.
                    </span>
                  </div>
                </div>
                <ArrowRight size={13} className="pulso-gv2-style-flow-arrow" />
                <div className={`pulso-gv2-style-flow-step is-custom ${styleFlow.hasManual ? "is-active" : ""}`} data-state="Manual">
                  <div className="pulso-gv2-style-flow-step-icon"><Sliders size={12} /></div>
                  <div className="pulso-gv2-style-flow-step-copy">
                    <strong>Manual</strong>
                    <span>
                      Ajustes puntuales solo de este slide/slot.
                      Si interviene aquí, <strong>Manual tiene prioridad</strong> sobre modo y base.
                    </span>
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
              title="Borrar tus cambios y volver al estilo por defecto"
            >
              <RotateCcw size={11} /> Restaurar
            </button>
          </div>
          <div className="pulso-gv2-style-section-hint">
            Márgenes, color de fondo, encabezado y pie de la lámina. No del gráfico.
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
            Ajusta lectura, espacio, leyenda y valores del gráfico.
            Usa <strong>Modo</strong> para reutilizar el mismo estilo en varios gráficos y,
            cuando hace falta, <strong>Manual</strong> para ajustes finos por slot.
          </div>
          <div className="pulso-gv2-slot-stack">
            {slotNames.map((slotName) => (
              <GraficadorSlot
                key={slotName}
                slideId={slide.id}
                slotName={slotName}
                value={(slide.payload as Record<string, unknown>)[slotName] as never}
                mode="style"
              />
            ))}
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

function shallowEqualArgs(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const key of ka) {
    if (!sameValue(a[key], b[key])) return false;
  }
  return true;
}

function isSubsetArgs(subset: Record<string, unknown>, superset: Record<string, unknown>): boolean {
  const keys = Object.keys(subset);
  if (keys.length === 0) return false;
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(superset, key)) return false;
    if (!sameValue(subset[key], superset[key])) return false;
  }
  return true;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
