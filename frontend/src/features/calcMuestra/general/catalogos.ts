/**
 * Catálogos y rótulos de Muestra general y Acreditación. Salieron de
 * `CalcMuestraPage.tsx` (congelada a crecimiento) con las mesas que los usan;
 * la página los importa para su chrome.
 */
import type {
  CalcMuestraAsignacion,
  CalcMuestraCanalRecojo,
  CalcMuestraComponente,
  CalcMuestraTecnica,
  CalcMuestraWorkspaceProducto,
  CalcMuestraWorkspaceVariableControl,
} from "../../../api/calcMuestra";
import { fmtInt, safeNumber } from "../sharedCore";

export const CANAL_OPTIONS: Array<{ id: CalcMuestraCanalRecojo; label: string }> = [
  { id: "aula_qr", label: "Cursos-horario / QR" },
  { id: "online_email", label: "Correo / online" },
  { id: "telefonico", label: "Telefónico" },
  { id: "presencial", label: "Presencial" },
  { id: "mixto", label: "Mixto" },
  { id: "sin_definir", label: "Por definir" },
];

export const METODOS_CLASICOS: Array<{
  id: CalcMuestraTecnica;
  label: string;
  marco: string;
  producto: CalcMuestraWorkspaceProducto;
}> = [
  { id: "prob_aleatorio_simple", label: "Probabilístico clásico", marco: "Marco enumerable con unidades individuales", producto: "muestra_probabilistica" },
  { id: "prob_estratificado", label: "Estratificado", marco: "Marco por capas o variables de control", producto: "muestra_probabilistica" },
  { id: "prob_estratificado_independiente", label: "Dominios independientes", marco: "Cada dominio calcula su propio n con margen y p propios", producto: "muestra_probabilistica" },
  { id: "sistematico", label: "Sistemático", marco: "Marco ordenado con arranque aleatorio", producto: "muestra_probabilistica" },
  { id: "prob_conglomerado_multietapico", label: "Por conglomerados", marco: "Unidades agrupadas: cursos-horario, sedes, servicios, manzanas", producto: "muestra_probabilistica" },
  { id: "intencion_censal", label: "Cobertura censal", marco: "Universo pequeño o actor que conviene cubrir", producto: "cobertura_marco" },
  { id: "barrido", label: "Barrido operativo", marco: "Marco operativo a cubrir por rutas, cursos-horario o servicios", producto: "cobertura_marco" },
  { id: "no_prob_cuotas", label: "Cuotas controladas", marco: "Control sin selección probabilística final", producto: "matriz_cuotas" },
  { id: "no_prob_conveniencia", label: "Conveniencia con pisos", marco: "Acceso parcial con cuotas mínimas por capa", producto: "matriz_cuotas" },
];

export function tecnicaLabel(tecnica: CalcMuestraTecnica) {
  return METODOS_CLASICOS.find((m) => m.id === tecnica)?.label ??
    ({
      medicion_recurrente: "Medición recurrente",
      listado_externo_meta_fija: "Flujo legacy",
    } as Partial<Record<CalcMuestraTecnica, string>>)[tecnica] ??
    tecnica;
}

/**
 * La técnica tal como se calculó. El estratificado reparte el n entre estratos
 * de forma proporcional, por Neyman o por potencia; su nombre solo no dice
 * cuál, así que lleva la asignación: la del resultado si ya se calculó, si no
 * la declarada.
 */
export function tecnicaCalculadaLabel(comp: Pick<CalcMuestraComponente, "tecnica" | "parametros" | "resultado">): string {
  const base = tecnicaLabel(comp.tecnica);
  if (comp.tecnica !== "prob_estratificado") return base;
  return `${base} · ${ETIQUETA_ASIGNACION[asignacionEstratificada(comp)]}`;
}

/** La asignación en el nombre de la técnica: «Estratificado · Neyman». */
export const ETIQUETA_ASIGNACION: Record<CalcMuestraAsignacion, string> = {
  proporcional: "proporcional",
  neyman: "Neyman",
  potencia: "potencia",
};

const ASIGNACION_DE_FORMULA: Record<NonNullable<NonNullable<CalcMuestraComponente["resultado"]>["formula_n"]>, CalcMuestraAsignacion> = {
  proporcional_por_estrato: "proporcional",
  neyman: "neyman",
  potencia: "potencia",
  // Con una media el motor reparte proporcional (Neyman y potencia necesitan
  // la variabilidad de cada estrato).
  media_global: "proporcional",
};

/** Asignación entre estratos: la del resultado manda; si no, la declarada; por defecto, proporcional. */
export function asignacionEstratificada(comp: Pick<CalcMuestraComponente, "parametros" | "resultado">): CalcMuestraAsignacion {
  const r = comp.resultado;
  // Una media se reparte proporcional aunque se haya pedido otra asignación:
  // la declarada no manda (el verificador vio «Neyman» con un reparto proporcional).
  const declarada = comp.parametros?.tipo_indicador === "media" ? "proporcional" : comp.parametros?.asignacion;
  const candidata = r?.asignacion ?? (r?.formula_n ? ASIGNACION_DE_FORMULA[r.formula_n] : undefined) ?? declarada;
  return candidata && candidata in ETIQUETA_ASIGNACION ? candidata : "proporcional";
}

export function productoLabel(producto: CalcMuestraWorkspaceProducto) {
  const labels: Record<CalcMuestraWorkspaceProducto, string> = {
    muestra_probabilistica: "Muestra probabilística",
    cobertura_marco: "Cobertura / marco a cubrir",
    matriz_cuotas: "Matriz de cuotas",
    componentes_mixtos: "Componentes mixtos calculables",
  };
  return labels[producto];
}

export function tecnicaProducto(comp: CalcMuestraComponente): CalcMuestraWorkspaceProducto {
  if ((comp.marco.matriz_operativa?.length ?? 0) > 0) return "matriz_cuotas";
  if (comp.tecnica === "intencion_censal" || comp.tecnica === "barrido") return "cobertura_marco";
  if (comp.tecnica === "no_prob_cuotas" || comp.tecnica === "no_prob_conveniencia") return "matriz_cuotas";
  return "muestra_probabilistica";
}

export function variableControl(
  id: string,
  label: string,
  tipo: CalcMuestraWorkspaceVariableControl["tipo"],
): CalcMuestraWorkspaceVariableControl {
  return { id, label, tipo, disponible: true, notas: "" };
}

const ACTOR_ETIQUETA: Record<string, string> = {
  administrativos: "Personal administrativo",
  docentes: "Docentes",
  estudiantes: "Estudiantes pregrado",
  egresados: "Egresados",
  empleadores: "Empleadores",
};

/** Nombre y clase visual del actor (el tono de su fila). */
export function actorVisual(comp: CalcMuestraComponente): { key: string; label: string } {
  const key = comp.actor_categoria === "otros" ? comp.actor_id || "otros" : comp.actor_categoria;
  const label = ACTOR_ETIQUETA[key];
  return label ? { key, label } : { key: "otros", label: comp.actor };
}

/** La cifra del resultado en una línea; sin n calculado, «Por calcular». */
export function primaryMetric(comp: CalcMuestraComponente) {
  const r = comp.resultado;
  if (!r || !(safeNumber(r.n_objetivo, 0) > 0)) return "Por calcular";
  if ((r.cuotas_matriz?.length ?? 0) > 0) {
    return `${fmtInt(r.n_objetivo)} encuestas · ${r.cuotas_matriz?.length ?? 0} cuotas`;
  }
  if (comp.tecnica === "intencion_censal" || comp.tecnica === "barrido") {
    return `${fmtInt(r.n_objetivo)} objetivo · ${fmtInt(r.n_operativo)} a cubrir`;
  }
  if (r.unidades_operativas) {
    return `${fmtInt(r.n_objetivo)} casos · ${fmtInt(r.unidades_operativas)} unidades`;
  }
  return `${fmtInt(r.n_objetivo)} casos`;
}
