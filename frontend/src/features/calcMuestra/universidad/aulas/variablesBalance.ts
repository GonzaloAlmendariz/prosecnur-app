/**
 * Las variables con las que el sorteo equilibra, y cuántos niveles trae cada una.
 *
 * `balance_vars` no tenía control en la UI: se leía del config y no se escribía
 * desde ningún sitio. Es la única de las brechas de control con consecuencia
 * medida — `program` trae 1 049 niveles en HSVG2026, el aterrizaje del cubo
 * cuesta 2^columnas, y con eso el sorteo no terminaba. La cota del motor evita
 * el cuelgue descartando por cardinalidad, pero elegir QUÉ se balancea había
 * que hacerlo por API.
 *
 * Los niveles se cuentan sobre el marco entero, que es lo que el front tiene.
 * El motor decide POR ESTRATO y declara lo que descarta en su aviso del sorteo:
 * esta cuenta sirve para anticipar el riesgo, no para predecir el corte.
 */

export type VariableBalance = {
  nombre: string;
  niveles: number;
  enBalance: boolean;
  enDispersion: boolean;
  /** Sin variación en el marco: no aporta equilibrio, sea cual sea el estrato. */
  constante: boolean;
};

function listaDe(x: unknown): string[] {
  if (!Array.isArray(x)) return [];
  return x.map((v) => String(v ?? "").trim()).filter(Boolean);
}

export function variablesDeBalance(
  filas: ReadonlyArray<Record<string, unknown>> | null | undefined,
  config: { balance_vars?: unknown; spread_vars?: unknown } | null | undefined,
): VariableBalance[] {
  if (!Array.isArray(filas) || !filas.length || config == null) return [];
  const balance = listaDe(config.balance_vars);
  const dispersion = listaDe(config.spread_vars);
  const declaradas = [...new Set([...balance, ...dispersion])];
  const presentes = new Set(Object.keys(filas[0] ?? {}));
  return declaradas
    .filter((nombre) => presentes.has(nombre))
    .map((nombre) => {
      const vistos = new Set<string>();
      for (const fila of filas) {
        const v = fila[nombre];
        vistos.add(v == null || v === "" ? "sin_dato" : String(v));
      }
      return {
        nombre,
        niveles: vistos.size,
        enBalance: balance.includes(nombre),
        enDispersion: dispersion.includes(nombre),
        constante: vistos.size < 2,
      };
    });
}
