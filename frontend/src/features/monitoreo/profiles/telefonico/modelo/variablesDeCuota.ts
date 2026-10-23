/**
 * Qué columnas de la base pueden ser el eje de las cuotas y cómo se rotulan.
 *
 * Una cuota reparte la meta entre pocas categorías (sede, periodo, sexo). Una
 * columna que identifica a cada persona —código, nombre, teléfono— tiene tantos
 * valores como filas y no reparte nada: elegirla como eje por defecto deja
 * «Avance de cada meta» con cero categorías. Se ofrece sólo si alguien ya la
 * guardó como variable de control o le puso metas.
 */

export type VariableCandidata = {
  name: string;
  label?: string;
  n_unique: number;
};

/** Categorías que todavía se leen como cuotas en una tabla y un gráfico de barras. */
export const MAXIMO_DE_CATEGORIAS = 30;

const PATRON_DE_IDENTIDAD = /(^|[\s_-])(c[oó]d(igo)?|id|dni|documento|nombres?|apellidos?|tel[eé]fonos?|tef\d*|celular|correo|e-?mail|progres|codpulso|uuid|instanceid)(\d*)($|[\s_-])/i;

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** La columna nombra o identifica a cada fila, o tiene demasiados valores para repartir una meta. */
export function esColumnaDeIdentidad(variable: VariableCandidata) {
  const textos = [variable.name, variable.label ?? ""].filter(Boolean);
  if (textos.some((texto) => PATRON_DE_IDENTIDAD.test(texto))) return true;
  return variable.n_unique > MAXIMO_DE_CATEGORIAS;
}

/** Columnas que lleva la operación del barrido, no el diseño: se ofrecen al final. */
const PATRON_OPERATIVO = /(responsable|encuestador|supervisor|operador|estado|status|intentos?|fecha|hora|origen|backup|reemplaz|observaci|comentario|resultado)/i;

const PREFERIDAS = ["sede", "distrito", "dim_segmento", "segmento", "dim_actor"];

/**
 * Ordena las variables que se ofrecen como eje. Las fijadas (guardadas o con
 * metas) siempre se ofrecen; las demás, sólo si reparten en pocas categorías.
 */
export function variablesDeCuotaOfrecidas(
  nombres: readonly string[],
  variables: readonly VariableCandidata[],
  fijadas: readonly string[],
) {
  const fijas = new Set(fijadas.map(normalizar));
  const porNombre = new Map(variables.map((variable) => [variable.name, variable]));
  const ofrecidas = nombres.filter((nombre) => {
    if (fijas.has(normalizar(nombre)) || PREFERIDAS.includes(normalizar(nombre))) return true;
    const variable = porNombre.get(nombre);
    return !variable || !esColumnaDeIdentidad(variable);
  });
  const rango = (nombre: string) => {
    const preferida = PREFERIDAS.indexOf(normalizar(nombre));
    if (preferida >= 0) return preferida;
    if (fijas.has(normalizar(nombre))) return PREFERIDAS.length;
    if (PATRON_OPERATIVO.test(nombre)) return PREFERIDAS.length + 3;
    const categorias = porNombre.get(nombre)?.n_unique ?? 0;
    return categorias >= 2 ? PREFERIDAS.length + 1 : PREFERIDAS.length + 2;
  };
  return ofrecidas
    .map((nombre, orden) => ({ nombre, orden, rango: rango(nombre) }))
    .sort((a, b) => a.rango - b.rango || a.orden - b.orden)
    .map(({ nombre }) => nombre);
}

/** Mayúscula inicial de cada palabra sin partir palabras en una vocal tildada. */
export function capitalizarPalabras(texto: string) {
  return texto.replace(/(^|[\s(/-])(\p{Ll})/gu, (_, borde: string, letra: string) => `${borde}${letra.toLocaleUpperCase("es")}`);
}

/**
 * Rótulo de una variable de cuota. Una clave técnica (`dim_periodo_llegada`) se
 * humaniza; un encabezado que ya escribió una persona («Código proGres») se
 * respeta tal cual.
 */
export function rotuloDeVariable(valor: string) {
  const crudo = String(valor ?? "").trim();
  if (!crudo) return "Variable";
  const limpio = crudo.replace(/^(dim|dimension|variable|var|control)[_\s-]+/i, "").trim() || crudo;
  const esClave = /_/.test(limpio) || !/[\sA-ZÁÉÍÓÚÑ]/.test(limpio);
  if (!esClave) return limpio;
  return capitalizarPalabras(limpio.replace(/_/g, " ").replace(/\s+/g, " ").trim());
}
