/**
 * Variables de control de Avance (sub-vista de Por cuota): por público y por
 * variable, cuánto pesa cada categoría en el universo y en las efectivas del
 * corte, con parciales, rechazos y la diferencia en puntos. Las filas las
 * arma el page-file desde el reporte; aquí solo se agrupan y ordenan.
 */

export type FilaDeControl = {
  actor: string;
  variable: string;
  value: string;
  universe: number;
  effective: number;
  partial: number;
  refusals: number;
  unanswered: number;
  baseShare: number | null;
  effectiveShare: number | null;
  deltaPp: number | null;
};

export type GrupoDeControl = {
  actor: string;
  variables: Array<{ variable: string; rows: FilaDeControl[] }>;
};

/**
 * ¿Las categorías de esta variable son años?
 *
 * Se exige que TODAS lo sean: una sola categoría suelta como «Sin dato» no debe
 * decidir el orden del resto, pero tampoco convertir la serie en alfabética.
 */
export function esSerieDeAnios(rows: ReadonlyArray<{ value: string }>) {
  if (rows.length < 2) return false;
  return rows.every((row) => /^(19|20)\d{2}$/.test(row.value.trim()));
}

export function agruparVariablesDeControl(rows: readonly FilaDeControl[]): GrupoDeControl[] {
  const actorMap = new Map<string, Map<string, FilaDeControl[]>>();
  rows.forEach((row) => {
    const variables = actorMap.get(row.actor) ?? new Map<string, FilaDeControl[]>();
    const values = variables.get(row.variable) ?? [];
    values.push(row);
    variables.set(row.variable, values);
    actorMap.set(row.actor, variables);
  });
  return Array.from(actorMap.entries()).map(([actor, variables]) => ({
    actor,
    variables: Array.from(variables.entries()).map(([variable, variableRows]) => ({
      variable,
      // Una cohorte se lee en orden cronológico, no por tamaño: «2021, 2023,
      // 2025, 2022» obliga a releer la columna para situarse. El resto de
      // variables —categoría, área, dedicación— no tienen orden natural, así
      // que ahí sigue mandando el peso en el universo.
      rows: [...variableRows].sort((a, b) => (
        esSerieDeAnios(variableRows)
          ? a.value.localeCompare(b.value, "es", { numeric: true })
          : b.universe - a.universe || a.value.localeCompare(b.value, "es", { numeric: true })
      )),
    })),
  }));
}

/** Diferencia en puntos con signo y una decimal; «—» sin dato. */
export function puntos(valor: number | null | undefined) {
  if (valor == null || !Number.isFinite(valor)) return "—";
  return `${valor > 0 ? "+" : ""}${valor.toLocaleString("es-PE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} pp`;
}

/** Una diferencia de 2 puntos o más se marca. */
export function diferenciaMarcada(valor: number | null | undefined) {
  return valor != null && Math.abs(valor) >= 2;
}
