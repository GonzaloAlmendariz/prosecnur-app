import { Database, Type, Palette, Filter, Gauge, LayoutPanelTop, Table2, BarChart3, Tags, SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { IconDiagnostic } from "../../lib/icons";
import { ArgGrupo, ArgMetadata, VarInfo } from "../../api/client";
import { ArgField, ArgState } from "./ArgField";

// Agrupa los args por intención. El backend ya manda los nombres nuevos
// (lectura, valores, leyenda, espacio...), pero mantenemos compatibilidad
// con metadatos legacy del proyecto.

export const GRUPO_META: Record<
  ArgGrupo,
  { label: string; icon: typeof Database; descripcion: string; order: number }
> = {
  datos:       { label: "Datos",                     icon: Database,          descripcion: "Qué variable se muestra y cómo se segmenta.",                         order: 0 },
  lectura:     { label: "Texto y lectura",           icon: Type,              descripcion: "Títulos, etiquetas, tamaños y reglas que mejoran la lectura.",         order: 1 },
  valores:     { label: "Valores y barras",          icon: BarChart3,         descripcion: "Porcentajes, N, top boxes, cortes y comportamiento de barras.",        order: 2 },
  leyenda:     { label: "Leyenda",                   icon: Tags,              descripcion: "Ubicación y tamaño de la leyenda dentro del canvas.",                  order: 3 },
  espacio:     { label: "Distribución del espacio",  icon: LayoutPanelTop,    descripcion: "Cómo se reparte el canvas entre etiquetas, barras y columnas de apoyo.", order: 4 },
  tabla:       { label: "Tabla",                     icon: Table2,            descripcion: "Configuración de tablas asociadas al gráfico.",                       order: 5 },
  diagnostico: { label: "Diagnóstico",               icon: SlidersHorizontal, descripcion: "Guías y controles técnicos para verificar layout.",                    order: 6 },
  textos:      { label: "Texto y lectura",           icon: Type,              descripcion: "Títulos, etiquetas, tamaños y reglas que mejoran la lectura.",         order: 1 },
  filtro:      { label: "Valores y barras",          icon: Filter,            descripcion: "Umbrales, decimales, top2box y filtros numéricos.",                   order: 2 },
  semaforo:    { label: "Valores y barras",          icon: Gauge,             descripcion: "Colores por rangos de valores.",                                     order: 2 },
  estilo:      { label: "Valores y barras",          icon: Palette,           descripcion: "Tipografía, tamaños, colores, leyenda y negritas.",                   order: 2 },
  canvas:      { label: "Distribución del espacio",  icon: LayoutPanelTop,    descripcion: "Dimensiones del canvas interno.",                                    order: 4 },
  avanzado:    { label: "Diagnóstico",               icon: IconDiagnostic,    descripcion: "Opciones poco comunes.",                                             order: 6 },
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
  headerAction,
  bodyIntro,
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
  /** Acción visual opcional en el header del grupo (ej. editor de layout). */
  headerAction?: ReactNode;
  /** Contenido opcional antes de los campos (ej. editor visual del layout). */
  bodyIntro?: ReactNode;
}) {
  const normalizedGrupo = normalizeArgGroup(grupo);
  const meta = GRUPO_META[normalizedGrupo];

  if (args.length === 0) return null;

  // Modo flatten: render plano sin header colapsable. Usado cuando el
  // ArgGroup vive dentro de una card mayor (StylePanel/FiltersPanel).
  if (flatten) {
    return (
      <div className="pulso-gv2-arg-body pulso-gv2-arg-body--flat">
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
  return (
    <section
      className="pulso-gv2-arg-group pulso-gv2-arg-group--section is-open"
    >
      <div
        className="pulso-gv2-arg-group-trigger pulso-gv2-arg-group-header"
        role="heading"
        aria-level={4}
      >
        <span className="pulso-gv2-arg-group-main">
          <span className="pulso-gv2-arg-group-icon">
            <Icon size={12} />
          </span>
          <span className="pulso-gv2-arg-group-copy">
            <span className="pulso-gv2-arg-group-label">
              {meta.label}
            </span>
            <span className="pulso-gv2-arg-group-description">
              {meta.descripcion}
            </span>
          </span>
        </span>
        {headerAction && (
          <span className="pulso-gv2-arg-group-actions">
            {headerAction}
          </span>
        )}
      </div>
      <div className="pulso-gv2-arg-body">
        {bodyIntro && (
          <div className="pulso-gv2-arg-body-intro">
            {bodyIntro}
          </div>
        )}
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
    </section>
  );
}
