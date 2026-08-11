import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BarChart,
  BarChart3,
  ClipboardCheck,
  ClipboardList,
  CircleUserRound,
  Contact,
  Crosshair,
  Lightbulb,
  Plus,
  Sparkles,
  Target,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { usePlanStore } from "./store";
import type { Slide } from "../../api/client";
import { SectionEyebrow } from "../../components/States";

const ICONO_PREVIEW: Record<string, LucideIcon> = {
  Target,
  ClipboardList,
  CircleUserRound,
  BarChart3,
  Sparkles,
  Lightbulb,
  Crosshair,
  BarChart,
  ClipboardCheck,
  Contact,
};
import {
  INDICE_ICONOS,
  MAX_FOCOS,
  moverSeccion,
  parseIndicePayload,
  serializeIndiceModel,
  type IndiceModel,
} from "./indiceModel";

// =============================================================================
// IndiceBuilder — editor jerárquico del slide de Índice (B47/G-5)
// =============================================================================
// Reemplaza las 4 textareas crudas (secciones / subtemas / subindices /
// iconos_focos) por una superficie profesional: secciones ordenables con su
// ícono ELEGIBLE del catálogo de la plantilla y sus subtemas como chips.
// El payload que escribe es EXACTAMENTE el contrato plano del motor — el
// modelo traduce en ambos sentidos (indiceModel.ts).

const S = {
  card: {
    border: "1px solid var(--pulso-border)",
    borderRadius: 12,
    padding: "10px 12px",
    marginBottom: 8,
    background: "var(--pulso-surface)",
  } as React.CSSProperties,
  row: { display: "flex", alignItems: "center", gap: 8 } as React.CSSProperties,
  num: {
    width: 22,
    height: 22,
    borderRadius: 7,
    background: "var(--pulso-surface-2)",
    border: "1px solid var(--pulso-border)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11,
    fontWeight: 600,
    flex: "0 0 22px",
  } as React.CSSProperties,
  input: {
    flex: 1,
    minWidth: 0,
    border: "1px solid var(--pulso-border)",
    borderRadius: 8,
    padding: "6px 9px",
    fontSize: 13,
    background: "transparent",
    color: "var(--pulso-text)",
  } as React.CSSProperties,
  iconBtn: (active: boolean) => ({
    width: 26,
    height: 26,
    borderRadius: 7,
    border: `1px solid ${active ? "var(--pulso-button-accent)" : "var(--pulso-border)"}`,
    background: active ? "color-mix(in srgb, var(--pulso-button-accent) 12%, transparent)" : "transparent",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    color: active ? "var(--pulso-button-accent)" : "var(--pulso-text-soft)",
    padding: 0,
  }) as React.CSSProperties,
  ghost: {
    border: "1px solid var(--pulso-border)",
    background: "transparent",
    borderRadius: 8,
    width: 24,
    height: 24,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    color: "var(--pulso-text-soft)",
    padding: 0,
  } as React.CSSProperties,
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    border: "1px solid var(--pulso-border)",
    borderRadius: 6,
    padding: "2px 6px",
    fontSize: 12,
    background: "var(--pulso-surface-2)",
  } as React.CSSProperties,
};

export default function IndiceBuilder({ slide }: { slide: Slide }) {
  const updatePayload = usePlanStore((s) => s.updateSlidePayload);
  const guardado = useMemo(
    () => parseIndicePayload(slide.payload as Record<string, unknown>),
    [slide.payload],
  );
  const [drafts, setDrafts] = useState<Record<number, string>>({});

  // El serializador descarta las secciones sin título. Para el motor está
  // bien —una sección en blanco no significa nada en el mazo—, pero para
  // editar era fatal: «Agregar sección» creaba una con `titulo: ""`, el
  // commit la filtraba, y el modelo volvía idéntico. El botón no hacía nada.
  // El mismo filtro borraba una sección existente en cuanto le vaciabas el
  // título para reescribirlo.
  //
  // El borrador conserva la forma que el analista tiene entre manos; al motor
  // sigue yendo sólo lo que tiene título. La firma es lo que evita que el
  // borrador tape un cambio de fuera (deshacer, cambio de slide): si el
  // payload ya no es el que escribimos, mandamos lo guardado.
  const [borrador, setBorrador] = useState<{
    slideId: string;
    firma: string;
    model: IndiceModel;
  } | null>(null);
  const firmaGuardada = JSON.stringify(serializeIndiceModel(guardado));
  const model =
    borrador && borrador.slideId === slide.id && borrador.firma === firmaGuardada
      ? borrador.model
      : guardado;

  function commit(next: IndiceModel) {
    const payload = serializeIndiceModel(next);
    setBorrador({ slideId: slide.id, firma: JSON.stringify(payload), model: next });
    updatePayload(slide.id, payload);
  }

  function patchSeccion(index: number, patch: Partial<IndiceModel["secciones"][number]>) {
    const secciones = model.secciones.map((s, i) => (i === index ? { ...s, ...patch } : s));
    commit({ secciones });
  }

  function addSubtema(index: number) {
    const texto = (drafts[index] ?? "").trim();
    if (!texto) return;
    patchSeccion(index, { subtemas: [...model.secciones[index].subtemas, texto] });
    setDrafts((d) => ({ ...d, [index]: "" }));
  }

  return (
    <section style={{ maxWidth: 600, marginBottom: 16 }}>
      <div style={{ marginBottom: 8 }}>
        <SectionEyebrow
          label="Estructura del índice"
          hint={`Secciones con su ícono del foco (la plantilla trae ${MAX_FOCOS}) y subtemas por sección. Todo se escribe al plan tal como el motor lo espera.`}
        />
      </div>

      {model.secciones.map((sec, i) => {
        const tieneFoco = i < MAX_FOCOS;
        return (
          <div key={i} style={S.card}>
            <div style={S.row}>
              <span style={S.num}>{i + 1}</span>
              <input
                style={S.input}
                value={sec.titulo}
                placeholder="Título de la sección"
                onChange={(e) => patchSeccion(i, { titulo: e.target.value })}
              />
              <button
                type="button"
                style={S.ghost}
                title="Subir"
                disabled={i === 0}
                onClick={() => commit(moverSeccion(model, i, -1))}
              >
                <ArrowUp size={13} />
              </button>
              <button
                type="button"
                style={S.ghost}
                title="Bajar"
                disabled={i === model.secciones.length - 1}
                onClick={() => commit(moverSeccion(model, i, 1))}
              >
                <ArrowDown size={13} />
              </button>
              <button
                type="button"
                style={S.ghost}
                title="Eliminar sección"
                onClick={() => commit({ secciones: model.secciones.filter((_, j) => j !== i) })}
              >
                <Trash2 size={13} />
              </button>
            </div>

            {tieneFoco ? (
              <div style={{ ...S.row, marginTop: 8, flexWrap: "wrap", gap: 4 }}>
                <span style={{ fontSize: 11, color: "var(--pulso-text-soft)", marginRight: 2 }}>
                  Ícono del foco:
                </span>
                {INDICE_ICONOS.map((ico) => {
                  const Icon = ICONO_PREVIEW[ico.lucide] ?? Target;
                  const active = sec.icono === ico.name;
                  return (
                    <button
                      key={ico.name}
                      type="button"
                      style={S.iconBtn(active)}
                      title={`${ico.label} (${ico.name})`}
                      aria-pressed={active}
                      onClick={() => patchSeccion(i, { icono: active ? null : ico.name })}
                    >
                      <Icon size={14} />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: "var(--pulso-text-faint)", marginTop: 6 }}>
                Sin foco en la plantilla (solo las primeras {MAX_FOCOS} secciones llevan ícono).
              </div>
            )}

            <div style={{ ...S.row, marginTop: 8, flexWrap: "wrap", gap: 4 }}>
              {sec.subtemas.map((st, j) => (
                <span key={`${st}-${j}`} style={S.chip}>
                  {st}
                  <button
                    type="button"
                    style={{ ...S.ghost, width: 16, height: 16, border: "none" }}
                    title="Quitar subtema"
                    onClick={() =>
                      patchSeccion(i, { subtemas: sec.subtemas.filter((_, k) => k !== j) })
                    }
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
              <input
                style={{ ...S.input, flex: "1 1 140px", fontSize: 12, padding: "3px 8px" }}
                value={drafts[i] ?? ""}
                placeholder="Agregar subtema y Enter"
                onChange={(e) => setDrafts((d) => ({ ...d, [i]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSubtema(i);
                  }
                }}
                onBlur={() => addSubtema(i)}
              />
            </div>
          </div>
        );
      })}

      <button
        type="button"
        onClick={() =>
          commit({ secciones: [...model.secciones, { titulo: "", icono: null, subtemas: [] }] })
        }
        style={{
          ...S.row,
          border: "1px dashed var(--pulso-border)",
          borderRadius: 10,
          padding: "7px 12px",
          background: "transparent",
          cursor: "pointer",
          fontSize: 13,
          color: "var(--pulso-text-soft)",
        }}
      >
        <Plus size={14} /> Agregar sección
      </button>
    </section>
  );
}
