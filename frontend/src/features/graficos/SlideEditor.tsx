import { useMemo } from "react";
import * as Lucide from "lucide-react";
import { ArgGrupo, GraficadorRef } from "../../api/client";
import { useSession } from "../../lib/SessionContext";
import { usePlanStore, SLIDE_GRAF_SLOTS, SLIDE_LABELS } from "./store";
import { useGraficosRegistry } from "./useGraficosRegistry";
import { useVariables } from "./useVariables";
import { ArgGroup, GRUPO_META } from "./ArgGroup";
import GraficadorSlot from "./GraficadorSlot";
import { SlidePreview } from "./SlidePreview";

// Editor de slide rediseñado. Reemplaza el switch/case + mapas hardcoded
// por un renderer dinámico que lee el metadata del registry:
//
//   Header        → icono + título humano del slide + nombre técnico
//   Args del slide → agrupados por `grupo` (Textos / Datos / Avanzado)
//                    con tooltips e iconos de info
//   Slots         → cards GraficadorSlot renderizadas en el orden definido
//                    por la firma real de la función R
//
// Si se añade un nuevo tipo de slide en prosecnur, solo hay que
// documentar su metadata en `graficos_metadata.R` y este componente lo
// edita sin más código.

export default function SlideEditor() {
  const { state } = useSession();
  const prepOk = !!state?.analitica_prep_ok;

  const selectedSlideId = usePlanStore((s) => s.selectedSlideId);
  const slide = usePlanStore((s) => s.plan.slides.find((x) => x.id === selectedSlideId));
  const updatePayload = usePlanStore((s) => s.updateSlidePayload);

  const { slidesById, loading } = useGraficosRegistry();
  const { variables } = useVariables();

  const slideMeta = slide ? slidesById[slide.tipo] : undefined;

  // Filtrar args del slide: los que son slots de graficador los
  // renderiza GraficadorSlot, no ArgField. Igualmente `icono` si el
  // slide lo acepta (se mapea al catálogo de iconos subidos).
  const grafSlots = slide ? (SLIDE_GRAF_SLOTS[slide.tipo] ?? []) : [];
  const grafSlotSet = useMemo(() => new Set(grafSlots), [grafSlots]);

  const gruposDeArgs = useMemo(() => {
    if (!slideMeta) return [];
    // Excluir args que son slots de graficador (ya los maneja GraficadorSlot).
    const nonSlotArgs = slideMeta.args.filter((a) => !grafSlotSet.has(a.name));
    const byGrupo: Record<ArgGrupo, typeof nonSlotArgs> = {
      datos: [], textos: [], estilo: [], filtro: [], semaforo: [], canvas: [], tabla: [], avanzado: [],
    };
    for (const a of nonSlotArgs) {
      const g: ArgGrupo = (a.grupo as ArgGrupo) ?? "avanzado";
      (byGrupo[g] ?? byGrupo.avanzado).push(a);
    }
    return (Object.keys(byGrupo) as ArgGrupo[])
      .filter((g) => byGrupo[g].length > 0)
      .sort((a, b) => GRUPO_META[a].order - GRUPO_META[b].order)
      .map((g) => ({ grupo: g, args: byGrupo[g] }));
  }, [slideMeta, grafSlotSet]);

  if (!slide) {
    return (
      <div style={{ padding: "2rem", color: "var(--pulso-text-soft)", fontSize: 14, flex: 1 }}>
        Selecciona o agrega un slide en el panel izquierdo.
      </div>
    );
  }

  const humanTitle = SLIDE_LABELS[slide.tipo] ?? slide.tipo;
  const SlideIcon = slideMeta ? resolveLucide(slideMeta.icono_ui) : Lucide.FileText;

  const payloadMap = slide.payload as Record<string, GraficadorRef | null | undefined>;

  return (
    <div style={{ flex: 1, padding: "18px 22px", overflowY: "auto" }}>
      {/* Header del slide */}
      <header style={{ marginBottom: 14 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: "var(--pulso-primary-soft)",
              color: "var(--pulso-primary)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <SlideIcon size={16} />
          </span>
          <span>
            <h2 style={{ margin: 0, fontSize: 16, lineHeight: 1.2 }}>{humanTitle}</h2>
            <code style={{ fontSize: 10, color: "var(--pulso-text-soft)", fontFamily: "ui-monospace, monospace" }}>
              {slide.tipo}
            </code>
          </span>
        </div>
        {slideMeta?.descripcion && (
          <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", marginTop: 6, lineHeight: 1.5, maxWidth: 600 }}>
            {slideMeta.descripcion}
          </div>
        )}
      </header>

      {loading && (
        <div style={{ fontSize: 12, color: "var(--pulso-text-soft)", padding: 10 }}>
          Cargando opciones del slide…
        </div>
      )}

      {/* Args no-slot (textos, datos del slide) */}
      {gruposDeArgs.length > 0 && (
        <section style={{ marginBottom: 16, maxWidth: 600 }}>
          {gruposDeArgs.map(({ grupo, args }) => (
            <ArgGroup
              key={grupo}
              grupo={grupo}
              args={args}
              values={slide.payload}
              onChangeArg={(name, value) => updatePayload(slide.id, { [name]: value })}
              variables={variables}
            />
          ))}
        </section>
      )}

      {/* Slots de graficador */}
      {grafSlots.length > 0 && (
        <section>
          <div
            style={{
              fontSize: 11, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: 0.4,
              color: "var(--pulso-text-soft)",
              marginBottom: 8,
            }}
          >
            Gráficos del slide · {grafSlots.length} slot{grafSlots.length === 1 ? "" : "s"}
          </div>
          {grafSlots.map((slotName) => (
            <GraficadorSlot
              key={slotName}
              slideId={slide.id}
              slotName={slotName}
              value={payloadMap[slotName]}
            />
          ))}
        </section>
      )}

      {/* Slide estructural sin args ni slots (ej. p_slide_indice) */}
      {gruposDeArgs.length === 0 && grafSlots.length === 0 && (
        <div
          style={{
            fontSize: 12, color: "var(--pulso-text-soft)",
            padding: "14px 16px", borderRadius: 6,
            background: "var(--pulso-surface)",
            border: "1px solid var(--pulso-border)",
            maxWidth: 600,
          }}
        >
          Este slide no requiere configuración. Se genera automáticamente en el export.
        </div>
      )}

      {/* Preview del slide individual — mini-PPTX descargable */}
      <div style={{ maxWidth: 760 }}>
        <SlidePreview slide={slide} prepOk={prepOk} />
      </div>
    </div>
  );
}

type LucideIcon = (props: { size?: number; color?: string }) => JSX.Element;
function resolveLucide(name: string): LucideIcon {
  const registry = Lucide as unknown as Record<string, LucideIcon>;
  return registry[name] ?? registry["FileText"] ?? registry["Square"];
}
