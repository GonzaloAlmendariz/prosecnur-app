import { useMemo } from "react";
import { Palette, Sparkles, Sliders, RotateCcw, Info, LayoutPanelTop } from "lucide-react";
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
  const presets = usePlanStore((s) => s.presets);
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

  function resetSlideStyleArgs() {
    if (!window.confirm("¿Restaurar los args de estilo del slide al preset?")) return;
    const patch: Record<string, unknown> = {};
    for (const a of args) patch[a.name] = null;
    updatePayload(slide.id, patch);
  }

  const grouped = groupArgs(args);
  const hasSlideArgs = grouped.length > 0;
  const hasSlots = slotNames.length > 0;

  return (
    <div style={{ maxWidth: 760 }}>
      {/* Banner: leyenda visual de estados (más concisa). */}
      {presetInfo.presetTypes.length > 0 ? (
        <div className="pulso-gv2-style-banner">
          <span className="pulso-gv2-style-banner-icon"><Palette size={14} /></span>
          <div className="pulso-gv2-style-banner-body">
            <div className="pulso-gv2-style-banner-title">
              Estilo del gráfico
            </div>
            <div className="pulso-gv2-style-banner-hint">
              <span className="pulso-gv2-state-chip is-inherited">●</span> valor por defecto ·
              {" "}<span className="pulso-gv2-state-chip is-mode">●</span> viene de un modo guardado ·
              {" "}<span className="pulso-gv2-state-chip is-custom">●</span> tu cambio.
              <br />
              Modifica cualquier valor, o usa el botón <strong>"Modo"</strong> arriba de cada gráfico para aplicar un estilo guardado o guardar tus cambios como uno nuevo.
            </div>
          </div>
        </div>
      ) : slotNames.length > 0 ? (
        <div className="pulso-gv2-style-banner is-info">
          <span className="pulso-gv2-style-banner-icon"><Info size={14} /></span>
          <div className="pulso-gv2-style-banner-body">
            <div className="pulso-gv2-style-banner-title">Aún no hay gráficos</div>
            <div className="pulso-gv2-style-banner-hint">
              Ve a la pestaña <strong>Datos</strong> y elige el tipo de gráfico. Después podrás ajustar su estilo aquí.
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
            {customSlideArgKeys.size > 0 && (
              <span className="pulso-gv2-style-section-meta has-custom">
                {customSlideArgKeys.size} con cambios
              </span>
            )}
            <button
              type="button"
              className="pulso-gv2-style-reset"
              onClick={resetSlideStyleArgs}
              disabled={customSlideArgKeys.size === 0}
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
          <div className="pulso-gv2-style-section-head" style={{ padding: "0 0 8px" }}>
            <Sparkles size={13} />
            <span>Cada gráfico</span>
            <span className="pulso-gv2-style-section-meta">
              {presetInfo.populatedSlots.length} de {slotNames.length} configurado{presetInfo.populatedSlots.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="pulso-gv2-style-section-hint" style={{ marginBottom: 12 }}>
            Ajusta colores, fuentes y dimensiones. Usa la varita ▿ para cambiar a otro modo o crear uno nuevo.
          </div>
          {slotNames.map((slotName) => (
            <GraficadorSlot
              key={slotName}
              slideId={slide.id}
              slotName={slotName}
              value={(slide.payload as Record<string, unknown>)[slotName] as never}
              mode="style"
            />
          ))}
        </section>
      )}

      {!hasSlideArgs && !hasSlots && (
        <div style={{ marginTop: 12, padding: 16, fontSize: 12, color: "var(--pulso-text-soft)", textAlign: "center", border: "1px dashed var(--pulso-border)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <LayoutPanelTop size={14} />
          Sin opciones de estilo para este tipo de slide.
        </div>
      )}
    </div>
  );
}
