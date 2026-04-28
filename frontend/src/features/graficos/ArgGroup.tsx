import { useState } from "react";
import { ChevronDown, ChevronRight, Database, Type, Palette, Filter, Gauge, Sparkles, LayoutPanelTop, Table2 } from "lucide-react";
import { ArgGrupo, ArgMetadata, VarInfo } from "../../api/client";
import { ArgField, ArgState } from "./ArgField";

// Agrupa los args de un graficador o preset por su `grupo` semántico.
// Los grupos son colapsables; "datos" y "textos" arrancan expandidos
// porque son lo primero que el usuario necesita tocar. Los demás se
// abren on-demand.
//
// Los grupos coinciden con lo declarado en graficos_metadata.R:
//   datos / textos / estilo / filtro / semaforo / canvas / tabla / avanzado

export const GRUPO_META: Record<
  ArgGrupo,
  { label: string; icon: typeof Database; descripcion: string; defaultOpen: boolean; order: number }
> = {
  datos:    { label: "Datos",    icon: Database,        descripcion: "Qué variable se muestra y cómo se segmenta.",                  defaultOpen: true,  order: 0 },
  textos:   { label: "Textos",   icon: Type,            descripcion: "Títulos, subtítulos, pie, etiquetas, formato de la base.",    defaultOpen: true,  order: 1 },
  filtro:   { label: "Filtro",   icon: Filter,          descripcion: "Umbrales, decimales, top2box, filtros numéricos.",            defaultOpen: false, order: 2 },
  semaforo: { label: "Semáforo", icon: Gauge,           descripcion: "Colores por rangos de valores.",                              defaultOpen: false, order: 3 },
  estilo:   { label: "Estilo",   icon: Palette,         descripcion: "Tipografía, tamaños, colores, leyenda, negritas.",            defaultOpen: false, order: 4 },
  canvas:   { label: "Canvas",   icon: LayoutPanelTop,  descripcion: "Dimensiones del canvas interno (anchos, altos, márgenes).",   defaultOpen: false, order: 5 },
  tabla:    { label: "Tabla",    icon: Table2,          descripcion: "Configuración de la tabla derecha (solo en radar_tabla).",    defaultOpen: false, order: 6 },
  avanzado: { label: "Avanzado", icon: Sparkles,        descripcion: "Opciones poco comunes.",                                      defaultOpen: false, order: 7 },
};

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
  const meta = GRUPO_META[grupo];
  const [open, setOpen] = useState(meta.defaultOpen);
  const [hover, setHover] = useState(false);

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
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        aria-expanded={open}
        style={{
          width: "100%", textAlign: "left",
          padding: "8px 10px",
          display: "flex", alignItems: "center", gap: 7,
          background: hover || open ? "var(--pulso-surface-2)" : "transparent",
          border: "none", cursor: "pointer",
          borderRadius: open ? "5px 5px 0 0" : 5,
          transition: "background 120ms ease",
        }}
      >
        <span style={{ display: "inline-flex", transition: "transform 150ms ease", transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}>
          <ChevronDown size={12} color="var(--pulso-text-soft)" />
        </span>
        <Icon size={12} color="var(--pulso-text-soft)" />
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, color: "var(--pulso-text-soft)" }}>
          {meta.label}
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
