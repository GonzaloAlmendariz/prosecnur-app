// `word_fijado` del payload de `/api/graficos/presets-metadata`: los ajustes del Word que fija el recetario para un tipo
// de gráfico (hoy barras_apiladas, multi_apiladas y multi_apiladas_multiactor). La fuente es
// `api/R/reporte_word_escala_fijados.R`; el editor de ajustes Word los pinta cerrados porque, aunque se guarden, no
// llegan al documento.

/** Valor escalar que realmente sale en el Word. */
export type WordFijadoValor = number | string | boolean;

export type WordFijado = {
  /** Nombre del arg (puede no ser arg del preset en el catálogo del editor). */
  arg: string;
  /** Lo que sale en el Word. Ausente = el ajuste no tiene efecto en el Word. */
  valor?: WordFijadoValor;
  /** Unidad de `valor` tal como la declara el backend («pt», «cm», «proporción», …). */
  unidad?: string;
  /** Texto para el analista; empieza con «Lo fija el recetario en el Word: …». */
  motivo: string;
  /** Si el gráfico cae al marco (sin espec del recetario), el arg vuelve a mandar. */
  aplica_si_marco: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

// jsonlite puede mandar un escalar como vector de largo 1 si el serializador no lo desenvuelve.
function escalar(value: unknown): unknown {
  return Array.isArray(value) && value.length === 1 ? value[0] : value;
}

function normalizeValor(value: unknown): WordFijadoValor | undefined {
  const v = escalar(value);
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v;
  return undefined;
}

function textoNoVacio(value: unknown): string | undefined {
  const v = escalar(value);
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

/**
 * Defensivo: ausente o no-array → `[]`; una entrada sin `arg` o sin `motivo` de texto se descarta; un `arg` repetido
 * conserva la primera entrada. `valor` que no es número finito, texto o lógico se trata como «sin efecto».
 */
export function normalizeWordFijado(value: unknown): WordFijado[] {
  if (!Array.isArray(value)) return [];
  const out: WordFijado[] = [];
  const vistos = new Set<string>();
  for (const raw of value) {
    if (!isRecord(raw)) continue;
    const arg = textoNoVacio(raw.arg);
    const motivo = textoNoVacio(raw.motivo);
    if (!arg || !motivo || vistos.has(arg)) continue;
    vistos.add(arg);
    const entry: WordFijado = { arg, motivo, aplica_si_marco: escalar(raw.aplica_si_marco) !== false };
    const valor = normalizeValor(raw.valor);
    if (valor !== undefined) {
      entry.valor = valor;
      const unidad = textoNoVacio(raw.unidad);
      if (unidad) entry.unidad = unidad;
    }
    out.push(entry);
  }
  return out;
}
