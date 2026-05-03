import { useState } from "react";
import { ChevronDown, Database, Type, Palette, Filter, Gauge, Sparkles, LayoutPanelTop, Table2, BarChart3, Tags, SlidersHorizontal } from "lucide-react";
import { ArgGrupo, ArgMetadata, VarInfo } from "../../api/client";
import { ArgField, ArgState } from "./ArgField";

// Agrupa los args por intención. El backend ya manda los nombres nuevos
// (lectura, valores, leyenda, espacio...), pero mantenemos compatibilidad
// con metadatos legacy del proyecto.

export const GRUPO_META: Record<
  ArgGrupo,
  { label: string; icon: typeof Database; descripcion: string; defaultOpen: boolean; order: number }
> = {
  datos:       { label: "Datos",                     icon: Database,          descripcion: "Qué variable se muestra y cómo se segmenta.",                         defaultOpen: true,  order: 0 },
  lectura:     { label: "Texto y lectura",           icon: Type,              descripcion: "Títulos, etiquetas, tamaños y reglas que mejoran la lectura.",         defaultOpen: false, order: 1 },
  valores:     { label: "Valores y barras",          icon: BarChart3,         descripcion: "Porcentajes, N, top boxes, cortes y comportamiento de barras.",        defaultOpen: false, order: 2 },
  leyenda:     { label: "Leyenda",                   icon: Tags,              descripcion: "Ubicación y tamaño de la leyenda dentro del canvas.",                  defaultOpen: false, order: 3 },
  espacio:     { label: "Distribución del espacio",  icon: LayoutPanelTop,    descripcion: "Cómo se reparte el canvas entre etiquetas, barras y columnas de apoyo.", defaultOpen: false, order: 4 },
  tabla:       { label: "Tabla",                     icon: Table2,            descripcion: "Configuración de tablas asociadas al gráfico.",                       defaultOpen: false, order: 5 },
  diagnostico: { label: "Diagnóstico",               icon: SlidersHorizontal, descripcion: "Guías y controles técnicos para verificar layout.",                    defaultOpen: false, order: 6 },
  textos:      { label: "Texto y lectura",           icon: Type,              descripcion: "Títulos, etiquetas, tamaños y reglas que mejoran la lectura.",         defaultOpen: false, order: 1 },
  filtro:      { label: "Valores y barras",          icon: Filter,            descripcion: "Umbrales, decimales, top2box y filtros numéricos.",                   defaultOpen: false, order: 2 },
  semaforo:    { label: "Valores y barras",          icon: Gauge,             descripcion: "Colores por rangos de valores.",                                     defaultOpen: false, order: 2 },
  estilo:      { label: "Valores y barras",          icon: Palette,           descripcion: "Tipografía, tamaños, colores, leyenda y negritas.",                   defaultOpen: false, order: 2 },
  canvas:      { label: "Distribución del espacio",  icon: LayoutPanelTop,    descripcion: "Dimensiones del canvas interno.",                                    defaultOpen: false, order: 4 },
  avanzado:    { label: "Diagnóstico",               icon: Sparkles,          descripcion: "Opciones poco comunes.",                                             defaultOpen: false, order: 6 },
};

export const ARG_GROUP_ORDER: ArgGrupo[] = [
  "datos",
  "lectura",
  "valores",
  "leyenda",
  "espacio",
  "tabla",
  "diagnostico",
  "textos",
  "filtro",
  "semaforo",
  "estilo",
  "canvas",
  "avanzado",
];

export function normalizeArgGroup(grupo: ArgGrupo | string | null | undefined): ArgGrupo {
  switch (grupo) {
    case "textos": return "lectura";
    case "estilo":
    case "filtro":
    case "semaforo": return "valores";
    case "canvas": return "espacio";
    case "avanzado": return "diagnostico";
    case "datos":
    case "lectura":
    case "valores":
    case "leyenda":
    case "espacio":
    case "tabla":
    case "diagnostico":
      return grupo;
    default:
      return "diagnostico";
  }
}

export function ArgGroup({
  grupo,
  args,
  values,
  onChangeArg,
  variables,
  flatten = false,
  argStates,
  inheritedValues,
  onResetArg,
}: {
  grupo: ArgGrupo;
  args: ArgMetadata[];
  values: Record<string, unknown>;
  onChangeArg: (name: string, value: unknown) => void;
  variables: VarInfo[];
  flatten?: boolean;
  /** Map name → estado visual del arg (inherited|from-mode|custom). Si
   *  no se provee, todos los args son "custom" cuando tienen valor (i.e.
   *  comportamiento previo). */
  argStates?: Record<string, ArgState>;
  /** Map name → valor del preset (o del modo) que el ArgField muestra
   *  cuando el arg está en estado "inherited" sin valor propio. */
  inheritedValues?: Record<string, unknown>;
  /** Handler para resetear un arg al valor del preset. */
  onResetArg?: (name: string) => void;
}) {
  const normalizedGrupo = normalizeArgGroup(grupo);
  const meta = GRUPO_META[normalizedGrupo];
  const [open, setOpen] = useState(meta.defaultOpen);
  const [hover, setHover] = useState(false);
  const toggleOpen = () => setOpen((v) => !v);

  if (args.length === 0) return null;

  // Modo flatten: render plano sin header colapsable. Usado cuando el
  // ArgGroup vive dentro de una card mayor (StylePanel/FiltersPanel).
  if (flatten) {
    return (
      <div style={{ marginBottom: 8 }}>
        {args.map((a) => (
          <ArgField
            key={a.name}
            meta={a}
            value={values[a.name]}
            onChange={(v) => onChangeArg(a.name, v)}
            variables={variables}
            argState={argStates?.[a.name] ?? "inherited"}
            inheritedValue={inheritedValues?.[a.name]}
            onReset={onResetArg ? () => onResetArg(a.name) : undefined}
          />
        ))}
      </div>
    );
  }

  const Icon = meta.icon;
  const nValuados = args.filter((a) => {
    const v = values[a.name];
    if (v === null || v === undefined || v === "") return false;
    if (Array.isArray(v) && v.length === 0) return false;
    if (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0) return false;
    return true;
  }).length;

  return (
    <div
      style={{
        border: "1px solid var(--pulso-border)",
        borderRadius: 6,
        background: "var(--pulso-surface)",
        marginBottom: 8,
      }}
    >
      <button
        type="button"
        onMouseDown={(e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          e.stopPropagation();
          toggleOpen();
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onKeyDown={(e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          e.stopPropagation();
          toggleOpen();
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        aria-expanded={open}
        style={{
          width: "100%", textAlign: "left",
          padding: "9px 10px",
          display: "flex", alignItems: "flex-start", gap: 7,
          background: hover || open ? "var(--pulso-surface-2)" : "transparent",
          border: "none", cursor: "pointer",
          borderRadius: open ? "5px 5px 0 0" : 5,
          transition: "background 120ms ease",
        }}
      >
        <span style={{ display: "flex", alignItems: "flex-start", gap: 7, minWidth: 0, flex: 1 }}>
          <span
            style={{
              display: "inline-flex",
              marginTop: 2,
              transition: "transform 150ms ease",
              transform: open ? "rotate(0deg)" : "rotate(-90deg)",
              flexShrink: 0,
            }}
          >
            <ChevronDown size={12} color="var(--pulso-text-soft)" />
          </span>
          <Icon size={12} color="var(--pulso-text-soft)" style={{ marginTop: 2, flexShrink: 0 }} />
          <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, color: "var(--pulso-text-soft)" }}>
              {meta.label}
            </span>
            <span style={{ fontSize: 10.5, fontWeight: 500, lineHeight: 1.35, color: "var(--pulso-text-soft)" }}>
              {meta.descripcion}
            </span>
          </span>
        </span>
        <span
          title={nValuados > 0 ? `${nValuados} con valor · ${args.length - nValuados} vacíos` : `${args.length} args sin valor`}
          style={{
            marginLeft: "auto",
            fontSize: 10, fontWeight: 600,
            padding: "2px 8px", borderRadius: 999,
            border: "1px solid",
            borderColor: nValuados > 0 ? "var(--pulso-primary-border)" : "var(--pulso-border)",
            background: nValuados > 0 ? "var(--pulso-primary-soft)" : "white",
            color: nValuados > 0 ? "var(--pulso-primary)" : "var(--pulso-text-soft)",
            display: "inline-flex", alignItems: "center", gap: 4,
            lineHeight: 1.4,
          }}
        >
          {nValuados > 0 ? `${nValuados} / ${args.length}` : args.length}
        </span>
      </button>
      {open && (
        <div style={{ padding: "10px 12px", background: "white", borderTop: "1px solid var(--pulso-border)" }}>
          {args.map((a) => (
            <ArgField
              key={a.name}
              meta={a}
              value={values[a.name]}
              onChange={(v) => onChangeArg(a.name, v)}
              variables={variables}
              argState={argStates?.[a.name] ?? "inherited"}
              inheritedValue={inheritedValues?.[a.name]}
              onReset={onResetArg ? () => onResetArg(a.name) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
