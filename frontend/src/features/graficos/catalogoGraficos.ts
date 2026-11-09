// Catálogo de tipos de gráfico (ADR 0139): cada graficador del catálogo y cada variante son una entrada con su nombre.
// Una variante reusa un graficador con args fijos (`p_dumbbell` en estilo resumen es «Contraste de públicos»); no hay
// graficador nuevo ni cambia el plan guardado. Todo sale de iconos/catalogoTipos.generated.ts (graficos_tipos.json).
// Módulo puro.

import {
  CATALOGO_GRAFICOS, CATALOGO_LAMINAS, VARIANTES_GRAFICO, type VarianteGraficoCatalogo,
} from "./iconos/catalogoTipos.generated";

type Args = Readonly<Record<string, unknown>>;

const GRAFICO_POR_NOMBRE = new Map(CATALOGO_GRAFICOS.map((g) => [g.name, g]));
const VARIANTE_POR_ID = new Map(VARIANTES_GRAFICO.map((v) => [v.id, v]));

/** Nombre legible de cada tipo de gráfico del catálogo (`titulo_humano`). */
export const NOMBRE_TIPO_GRAFICO: Readonly<Record<string, string>> = Object.fromEntries(
  CATALOGO_GRAFICOS.map((g) => [g.name, g.titulo_humano]),
);

/** Ranuras de gráfico (`role: "chart"`) de cada tipo de lámina, en su orden. El ícono no es un gráfico. */
export const RANURAS_GRAFICO_POR_LAMINA: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
  CATALOGO_LAMINAS.map((s) => [s.name, s.ranuras.filter((r) => r.role === "chart").map((r) => r.name)]),
);

export function varianteGrafico(id: string | null | undefined): VarianteGraficoCatalogo | null {
  return (id && VARIANTE_POR_ID.get(id)) || null;
}

export const variantesDeGraficador = (graficador: string): VarianteGraficoCatalogo[] =>
  VARIANTES_GRAFICO.filter((v) => v.graficador === graficador);

/** ¿El id es un graficador o una variante del catálogo? */
export function existeEntradaCatalogo(id: string): boolean {
  return GRAFICO_POR_NOMBRE.has(id) || VARIANTE_POR_ID.has(id);
}

/**
 * Los args que una variante del graficador fija en `null` (`cruce` en «Contraste de públicos»). En ese graficador el
 * `null` es un valor declarado, no «borrar la clave»: el plan lo guarda tal cual (ronda 19, F2).
 */
export function nulosDeclarados(graficador: string): ReadonlySet<string> {
  const out = new Set<string>();
  for (const v of variantesDeGraficador(graficador)) {
    for (const [k, valor] of Object.entries(v.args_fijos)) if (valor === null) out.add(k);
  }
  return out;
}

/** El graficador de una entrada (el suyo, o el de la variante). */
export function graficadorDeEntrada(id: string): string {
  return VARIANTE_POR_ID.get(id)?.graficador ?? id;
}

/** El nombre con que el catálogo vende la entrada. */
export function nombreDeEntrada(id: string): string {
  return VARIANTE_POR_ID.get(id)?.nombre ?? GRAFICO_POR_NOMBRE.get(id)?.titulo_humano ?? id;
}

// ---------------------------------------------------------------------------
// Versiones (enmienda 2026-11-09 del ADR 0139): una variante es una versión dentro de la tarjeta de su tipo.
// ---------------------------------------------------------------------------

/** El nombre del tipo de gráfico (`titulo_humano`), o el id si el catálogo no lo tiene. */
const nombreTipo = (graficador: string): string => NOMBRE_TIPO_GRAFICO[graficador] ?? graficador;

/** El nombre corto de la variante como versión de su tipo (`nombre_version`); sin él, su `nombre`. */
export function nombreVersion(variante: VarianteGraficoCatalogo): string {
  return variante.nombre_version?.trim() || variante.nombre;
}

/** El nombre de la versión base de un tipo (`version_base`); sin él, el nombre del tipo. */
export function nombreVersionBase(graficador: string): string {
  return GRAFICO_POR_NOMBRE.get(graficador)?.version_base?.trim() || nombreTipo(graficador);
}

/**
 * Cómo se nombra un gráfico que es una variante, en todas partes (selector, maqueta, aviso, inspector, Estructura):
 * «<tipo>, versión <versión>». Ronda 19 (O3): antes «<tipo>: <versión>», y en frases como «Hoy: …» o «Gráfico
 * insertado: …» salían dos veces dos puntos. `tipo` es el nombre del tipo cuando quien llama lo tiene (el del registro);
 * sin él, el del catálogo.
 */
export function nombreConVersion(variante: VarianteGraficoCatalogo, tipo?: string): string {
  return `${tipo?.trim() || nombreTipo(variante.graficador)}, versión ${nombreVersion(variante)}`;
}

/** Los args de partida de una entrada: los fijos de la variante (un `null` queda nulo) y un `undefined` por cada
 *  argumento que la variante quita (el parche los borra al aplicarse sobre un gráfico del mismo tipo). */
export function argsDeEntrada(id: string): Record<string, unknown> {
  const v = VARIANTE_POR_ID.get(id);
  if (!v) return {};
  const out: Record<string, unknown> = { ...v.args_fijos };
  for (const k of v.args_quitar) out[k] = undefined;
  return out;
}

/** Los args de un gráfico con la variante aplicada: escribe los fijos y borra los que quita. */
export function aplicarVariante(args: Args, variante: VarianteGraficoCatalogo): Record<string, unknown> {
  const out: Record<string, unknown> = { ...args, ...variante.args_fijos };
  for (const k of variante.args_quitar) delete out[k];
  return out;
}

const texto = (v: unknown): string => {
  const x = Array.isArray(v) ? v[0] : v;
  return typeof x === "string" ? x.trim() : typeof x === "number" ? String(x) : "";
};

/**
 * ¿`cruce` está declarado y nulo? El `null` que escribe la versión «Contraste de públicos» vuelve del backend como `{}`
 * (jsonlite serializa el NULL de R como objeto vacío): los dos significan lo mismo que el `NULL` que lee el motor.
 */
export function cruceNuloDeclarado(args: Args): boolean {
  const v = args.cruce;
  return v === null || (!!v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0);
}

/** Espejo de `.graficos_variantes_dumbbell_entre_grupos` (api/R/graficos_variantes.R). */
function dumbbellEntreGrupos(args: Args): boolean {
  if (cruceNuloDeclarado(args)) return false;   // `null` del JSON (o `{}` de vuelta del backend): declarado y nulo
  if (texto(args.cruce)) return true;
  const v = args.vars;
  const porBase = !!v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length > 0
    && Object.keys(v).every((k) => k.length > 0);
  return !porBase;
}

/**
 * La variante que corresponde a un gráfico guardado, o `null` si es el tipo base. Espejo de `.graficos_variante_de`
 * (api/R/graficos_variantes.R): sólo lee, no migra el plan.
 */
export function varianteDeGrafico(graficador: string, args: Args = {}): VarianteGraficoCatalogo | null {
  // ADR 0140: la cobertura se reconoce por su `modo`, no por el estilo (antes del chequeo de `estilo`, como en R).
  if (graficador === "p_cobertura") return texto(args.modo) === "categorias" ? varianteGrafico("p_cobertura:categorias") : null;
  if (texto(args.estilo) !== "resumen") return null;
  if (graficador === "p_dumbbell") {
    return varianteGrafico(dumbbellEntreGrupos(args) ? "p_dumbbell:aperturas" : "p_dumbbell:contraste");
  }
  if (graficador === "p_barras_divergentes") return varianteGrafico("p_barras_divergentes:escala_sin_informacion");
  return null;
}

/** La entrada del catálogo que un gráfico guardado es: su variante o su graficador. */
export function entradaDeGrafico(graficador: string, args: Args = {}): string {
  return varianteDeGrafico(graficador, args)?.id ?? graficador;
}
