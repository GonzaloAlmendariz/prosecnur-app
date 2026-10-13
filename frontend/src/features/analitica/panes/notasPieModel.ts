// Modelo puro de las notas al pie de Frecuencias y Cruces (checklist
// entregables HSyVBG 2026, ítems 1a a 1d). La forma del bloque `notas` es un
// contrato congelado con el motor R (`reporte_notas_pie.R`): no renombrar
// claves. El motor antepone «Fuente: » y «Base: » al texto guardado.

export type NotasBaseReducida = {
  activo: boolean;
  umbral: number;
};

export type NotasPieConfig = {
  fuente: string;
  base_defecto: string;
  base_por_pregunta: Record<string, string>;
  por_cruce: Record<string, string>;
  base_reducida: NotasBaseReducida;
};

export const UMBRAL_BASE_REDUCIDA_DEFECTO = 30;

export const DEFAULT_NOTAS_PIE: NotasPieConfig = {
  fuente: "Pulso PUCP",
  base_defecto: "",
  base_por_pregunta: {},
  por_cruce: {},
  base_reducida: { activo: false, umbral: UMBRAL_BASE_REDUCIDA_DEFECTO },
};

function isRecord(raw: unknown): raw is Record<string, unknown> {
  return !!raw && typeof raw === "object" && !Array.isArray(raw);
}

// Record<variable, texto> sin entradas vacías: un texto en blanco equivale a
// «sin nota» y no viaja al backend.
export function coerceNotasTexto(raw: unknown): Record<string, string> {
  if (!isRecord(raw)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    const clave = key.trim();
    if (!clave || typeof value !== "string") continue;
    if (value.trim().length === 0) continue;
    out[clave] = value;
  }
  return out;
}

// Umbral entero positivo. Cualquier otra cosa cae al valor por defecto.
export function coerceUmbral(raw: unknown): number {
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : Number.NaN;
  if (!Number.isFinite(n) || n < 1) return UMBRAL_BASE_REDUCIDA_DEFECTO;
  return Math.floor(n);
}

export function normalizeNotasPie(raw: unknown): NotasPieConfig {
  if (!isRecord(raw)) {
    return {
      ...DEFAULT_NOTAS_PIE,
      base_por_pregunta: {},
      por_cruce: {},
      base_reducida: { ...DEFAULT_NOTAS_PIE.base_reducida },
    };
  }
  const reducida = isRecord(raw.base_reducida) ? raw.base_reducida : {};
  return {
    fuente: typeof raw.fuente === "string" ? raw.fuente : DEFAULT_NOTAS_PIE.fuente,
    base_defecto: typeof raw.base_defecto === "string" ? raw.base_defecto : "",
    base_por_pregunta: coerceNotasTexto(raw.base_por_pregunta),
    por_cruce: coerceNotasTexto(raw.por_cruce),
    base_reducida: {
      activo: reducida.activo === true,
      umbral: coerceUmbral(reducida.umbral),
    },
  };
}

// Escribe o borra la nota de una variable. Devuelve un objeto nuevo; un texto
// en blanco elimina la clave.
export function setNotaTexto(
  actual: Record<string, string>,
  variable: string,
  texto: string,
): Record<string, string> {
  const clave = variable.trim();
  if (!clave) return actual;
  const out = { ...actual };
  if (texto.trim().length === 0) delete out[clave];
  else out[clave] = texto;
  return out;
}

// Notas de cruce visibles: solo las de variables seleccionadas como banner,
// en el orden del banner (el mismo orden en que el motor las imprime).
export function notasDeCruceVisibles(
  porCruce: Record<string, string>,
  crucesVars: readonly string[],
): Array<{ variable: string; texto: string }> {
  return crucesVars.map((variable) => ({ variable, texto: porCruce[variable] ?? "" }));
}

// Cuenta notas de cruce guardadas para variables que ya no están en el banner.
// No se borran (vuelven si la variable regresa), pero la UI lo avisa.
export function notasDeCruceHuerfanas(
  porCruce: Record<string, string>,
  crucesVars: readonly string[],
): string[] {
  const activas = new Set(crucesVars);
  return Object.keys(porCruce).filter((v) => !activas.has(v)).sort();
}

// Resumen corto para el plegable cerrado.
export function resumenNotasPie(notas: NotasPieConfig, conCruces: boolean): string {
  const partes: string[] = [];
  const fuente = notas.fuente.trim();
  partes.push(fuente ? `Fuente: ${fuente}` : "Sin fuente");
  const nPreg = Object.keys(notas.base_por_pregunta).length;
  if (notas.base_defecto.trim()) partes.push("base por defecto");
  if (nPreg > 0) partes.push(`${nPreg} ${nPreg === 1 ? "base propia" : "bases propias"}`);
  if (conCruces) {
    const nCruce = Object.keys(notas.por_cruce).length;
    if (nCruce > 0) partes.push(`${nCruce} ${nCruce === 1 ? "nota de cruce" : "notas de cruce"}`);
    if (notas.base_reducida.activo) partes.push(`aviso bajo ${notas.base_reducida.umbral} casos`);
  }
  return partes.join(", ");
}

// ---- Notas por pregunta (patrón único de Frecuencias, Cruces y Comparativos)

// Pregunta que puede llevar una nota propia. `codigo` es el nombre de la
// variable cuando lo hay; una fila del comparativo sólo tiene etiqueta.
export type OpcionNota = {
  clave: string;
  etiqueta: string;
  codigo?: string;
  tipo?: string;
};

function conTexto(texto: string | undefined): boolean {
  return typeof texto === "string" && texto.trim().length > 0;
}

// Filas que muestra la lista: las notas con texto, en su orden, y después las
// agregadas en la UI que aún no tienen texto.
export function filasDeNotas(valores: Record<string, string>, pendientes: readonly string[]): string[] {
  const guardadas = Object.keys(valores).filter((k) => conTexto(valores[k]));
  return [...guardadas, ...pendientes.filter((p) => !guardadas.includes(p))];
}

// Separa las notas con texto de las preguntas ofrecidas de las que quedaron
// guardadas para preguntas que ya no se ofrecen (no se imprimen, no se borran).
export function notasFueraDeOpciones(
  notas: Record<string, string>,
  opciones: readonly Pick<OpcionNota, "clave">[],
): { visibles: Record<string, string>; fuera: number } {
  const ofrecidas = new Set(opciones.map((o) => o.clave));
  const visibles: Record<string, string> = {};
  let fuera = 0;
  for (const [clave, texto] of Object.entries(notas)) {
    if (!conTexto(texto)) continue;
    if (ofrecidas.has(clave)) visibles[clave] = texto;
    else fuera += 1;
  }
  return { visibles, fuera };
}

// Resumen del plegable de Comparativos: cuántas notas saldrán en el archivo.
export function resumenNotasComparativo(
  notasPregunta: Record<string, string>,
  notasGenerales: string,
  opciones: readonly Pick<OpcionNota, "clave">[],
): string {
  const generales = notasGenerales.split("\n").filter((l) => l.trim().length > 0).length;
  const porPregunta = Object.keys(notasFueraDeOpciones(notasPregunta, opciones).visibles).length;
  const partes: string[] = [];
  if (generales > 0) partes.push(`${generales} ${generales === 1 ? "nota general" : "notas generales"}`);
  if (porPregunta > 0) partes.push(`${porPregunta} ${porPregunta === 1 ? "nota por pregunta" : "notas por pregunta"}`);
  return partes.length ? partes.join(", ") : "Sin notas";
}
