// Tarjetas de diferencias junto al total (ADR 0129, propuesta P08): qué láminas las admiten y cómo se guarda su opción
// en `payload.meta.tarjetas_diferencias`. El motor decide qué tarjetas hay; aquí se enciende y se dice cómo: qué cruces,
// cómo se nombra cada uno, el rótulo corto de los grupos largos, cómo se nombran los casos y cuántas como máximo
// (`.tarjetas_opcion`, api/R/graficos_tarjetas_diferencias.R). En la lámina de dos gráficos la opción va por ranura
// (`izquierda` / `derecha`, api/R/graficos_tarjetas_ranuras.R). Lo que el inspector no edita (`modo`, `indicador`…) se
// conserva tal como llegó.

import type { SlideMeta, TarjetasDiferenciasMeta, TarjetasPorRanura } from "../../slideMeta";

/** Graficadores cuyo total es un gráfico de categorías o una batería de escala (lo que el motor acompaña). */
export const GRAFICADORES_CON_TARJETAS: ReadonlySet<string> = new Set([
  "p_barras_agrupadas",
  "p_barras_apiladas",
  "p_barras_multiapiladas",
]);

/** Tope por defecto de una lámina de un gráfico (`.TARJETAS_MAX`). */
export const TARJETAS_MAX = 4;
/** Tope de cada gráfico en la lámina de dos (`.TARJETAS_MAX_RANURA`): van debajo de su gráfico, en su mitad. */
export const TARJETAS_MAX_RANURA = 2;
/** Lo más que el motor acepta en `max` (`min(mx, 9L)`). */
export const TARJETAS_TOPE = 9;

export const RANURAS_TARJETAS = ["izquierda", "derecha"] as const;
export type RanuraTarjetas = (typeof RANURAS_TARJETAS)[number];

/** Lo que vale la opción de una lámina o de una ranura. */
export type ValorTarjetas = boolean | TarjetasDiferenciasMeta | undefined;

const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const esRanura = (slot: string): slot is RanuraTarjetas => (RANURAS_TARJETAS as readonly string[]).includes(slot);

/** La ranura cuyas tarjetas edita la tarjeta de este gráfico; `null` en la lámina de un gráfico (la opción es de la lámina). */
export function ranuraDeTarjetas(tipoLamina: string, slot: string): RanuraTarjetas | null {
  return tipoLamina === "p_slide_2_graficos" && esRanura(slot) ? slot : null;
}

/**
 * ¿El gráfico admite tarjetas? Un gráfico de un tipo que el motor acompaña, sin cruce propio, en una lámina de un
 * gráfico o en una ranura de la lámina de dos.
 */
export function admiteTarjetas(tipoLamina: string, graficador: string, cruce: string, slot = "grafico"): boolean {
  if (!GRAFICADORES_CON_TARJETAS.has(graficador) || cruce.trim() !== "") return false;
  return tipoLamina === "p_slide_1_grafico" || ranuraDeTarjetas(tipoLamina, slot) !== null;
}

/** ¿El valor guardado es un mapa por ranura? (la misma prueba que `.tarjetas_es_mapa`). */
export function esMapaRanuras(v: unknown): v is TarjetasPorRanura {
  return esObjeto(v) && RANURAS_TARJETAS.some((r) => Object.hasOwn(v, r));
}

/** La opción de la lámina (sin ranura) o de una ranura. Una opción de lámina no vale como la de una ranura, ni al revés. */
export function leerTarjetas(meta: SlideMeta, ranura: RanuraTarjetas | null): ValorTarjetas {
  const t = meta.tarjetas_diferencias;
  if (ranura === null) return esMapaRanuras(t) ? undefined : t;
  return esMapaRanuras(t) ? t[ranura] : undefined;
}

/**
 * La `meta` con la opción de la lámina o de una ranura reemplazada; `undefined` la borra. La otra ranura queda intacta.
 * En una ranura, una opción de lámina guardada (de cuando la lámina era de un gráfico) no se puede leer: se reemplaza.
 */
export function metaConTarjetas(meta: SlideMeta, ranura: RanuraTarjetas | null, valor: ValorTarjetas): SlideMeta {
  const siguiente: SlideMeta = { ...meta };
  let nuevo: SlideMeta["tarjetas_diferencias"] = valor;
  if (ranura !== null) {
    const previo = meta.tarjetas_diferencias;
    const mapa: TarjetasPorRanura = esMapaRanuras(previo) ? { ...previo } : {};
    if (valor === undefined) delete mapa[ranura];
    else mapa[ranura] = valor;
    nuevo = Object.keys(mapa).length ? mapa : undefined;
  }
  if (nuevo === undefined) delete siguiente.tarjetas_diferencias;
  else siguiente.tarjetas_diferencias = nuevo;
  return siguiente;
}

const comoOpcion = (v: ValorTarjetas): TarjetasDiferenciasMeta => (esObjeto(v) ? { ...v } : {});

/** ¿Están encendidas? `true` o una opción sin `activo: false`. */
export function opcionActiva(v: ValorTarjetas): boolean {
  if (v === true) return true;
  return esObjeto(v) && v.activo !== false;
}

/**
 * El valor al alternar. Apagar conserva la opción (rótulos cortos, cruces) con `activo: false`, para que volver a
 * encender no la pierda; sin opción que conservar, la clave se borra.
 */
export function opcionAlternada(v: ValorTarjetas, activo: boolean): ValorTarjetas {
  const { activo: _previo, ...resto } = comoOpcion(v);
  const tieneConfig = Object.keys(resto).length > 0;
  if (activo) return tieneConfig ? { ...resto, activo: true } : true;
  return tieneConfig ? { ...resto, activo: false } : undefined;
}

/** ¿Muestran todos los grupos, aunque no difieran? (`todas`, apagada por defecto). */
export function opcionTodas(v: ValorTarjetas): boolean {
  return esObjeto(v) && v.todas === true;
}

/** El valor al alternar «todos los grupos»: conserva el resto de la opción y las deja encendidas. */
export function opcionConTodas(v: ValorTarjetas, todas: boolean): TarjetasDiferenciasMeta {
  const { todas: _previa, activo: _activo, ...resto } = comoOpcion(v);
  return todas ? { ...resto, activo: true, todas: true } : { ...resto, activo: true };
}

export type CambiosOpcion = Partial<Pick<TarjetasDiferenciasMeta, "cruces" | "rotulos" | "cortos" | "publico" | "max">>;

/**
 * La opción con unos ajustes cambiados y encendida. Un ajuste vacío (lista o mapa sin nada, texto en blanco,
 * `undefined`) borra su clave para que mande lo del motor; lo demás se conserva.
 */
export function opcionCon(v: ValorTarjetas, cambios: CambiosOpcion): TarjetasDiferenciasMeta {
  const siguiente: Record<string, unknown> = { ...comoOpcion(v), activo: true };
  for (const [clave, valor] of Object.entries(cambios)) {
    const vacio = valor === undefined || (typeof valor === "string" && valor.trim() === "") ||
      (Array.isArray(valor) && valor.length === 0) || (esObjeto(valor) && Object.keys(valor).length === 0);
    if (vacio) delete siguiente[clave];
    // El texto se guarda como se escribe (recortarlo a cada tecla comería el espacio entre palabras); el motor lo recorta.
    else siguiente[clave] = valor;
  }
  return siguiente as TarjetasDiferenciasMeta;
}

// ---- tope ------------------------------------------------------------------

/** El tope por defecto: 4 en una lámina de un gráfico, 2 en una ranura. */
export const maxPorDefecto = (ranura: RanuraTarjetas | null): number => (ranura === null ? TARJETAS_MAX : TARJETAS_MAX_RANURA);

/** El tope que el motor aplica, con la misma normalización que `.tarjetas_opcion` (y la de la ranura). */
export function maxEfectivo(v: ValorTarjetas, ranura: RanuraTarjetas | null): number {
  const crudo = esObjeto(v) && typeof v.max === "number" && Number.isFinite(v.max) ? Math.trunc(v.max) : NaN;
  const mx = Number.isNaN(crudo) || crudo < 1 ? TARJETAS_MAX : Math.min(crudo, TARJETAS_TOPE);
  return ranura === null ? mx : Math.min(mx, TARJETAS_MAX_RANURA);
}

/** Los topes que se ofrecen: 1 a 6 en una lámina (más no caben junto al total), 1 o 2 en una ranura. */
export function opcionesMax(ranura: RanuraTarjetas | null): number[] {
  const hasta = ranura === null ? 6 : TARJETAS_MAX_RANURA;
  return Array.from({ length: hasta }, (_, i) => i + 1);
}

/** El `max` que se guarda: sin clave cuando es el de fábrica. */
export const maxAGuardar = (n: number, ranura: RanuraTarjetas | null): number | undefined =>
  n === maxPorDefecto(ranura) ? undefined : n;

// ---- cruces y sus nombres --------------------------------------------------

/** La variable sin su base («estudiantes$area» → «area»), como la lee el motor (`.sig_var_local`). */
export function nombreLocal(ref: string): string {
  const r = ref.trim();
  return r.includes("$") ? r.slice(r.lastIndexOf("$") + 1) : r;
}

export function crucesDe(v: ValorTarjetas): string[] {
  const c = esObjeto(v) ? v.cruces : undefined;
  return Array.isArray(c) ? c.filter((x): x is string => typeof x === "string" && x.trim() !== "") : [];
}

/** El nombre escrito para un cruce (vacío: el motor usa la etiqueta de la variable). */
export function rotuloDeCruce(v: ValorTarjetas, ref: string): string {
  const r = esObjeto(v) ? v.rotulos : undefined;
  const t = r ? r[nombreLocal(ref)] : undefined;
  return typeof t === "string" ? t : "";
}

/** Los `rotulos` con el de un cruce cambiado (por su variable sin base); vacío lo quita. Los demás se conservan. */
export function rotulosCon(v: ValorTarjetas, ref: string, texto: string): Record<string, string> {
  const mapa: Record<string, string> = { ...((esObjeto(v) && esObjeto(v.rotulos) ? v.rotulos : {}) as Record<string, string>) };
  const clave = nombreLocal(ref);
  if (texto.trim()) mapa[clave] = texto;
  else delete mapa[clave];
  return mapa;
}

// ---- rótulos cortos de los grupos ------------------------------------------

/** Una fila «grupo → corto» del editor. `clave` es estable mientras la fila vive en la tarjeta. */
export type FilaCorto = { clave: string; grupo: string; corto: string };

export function cortosAFilas(v: ValorTarjetas): FilaCorto[] {
  const m = esObjeto(v) && esObjeto(v.cortos) ? v.cortos : {};
  return Object.entries(m)
    .filter((e): e is [string, string] => typeof e[1] === "string")
    .map(([grupo, corto], i) => ({ clave: `c${i}`, grupo, corto }));
}

/** El mapa que se guarda: sólo las filas completas; con un grupo repetido manda la primera. */
export function filasACortos(filas: readonly FilaCorto[]): Record<string, string> {
  const mapa: Record<string, string> = {};
  for (const f of filas) {
    const g = f.grupo.trim();
    const c = f.corto.trim();
    if (g && c && !Object.hasOwn(mapa, g)) mapa[g] = c;
  }
  return mapa;
}

/** ¿El borrador y lo guardado dicen lo mismo al motor? Si no, cambió afuera (deshacer, el plan). */
export function mismosCortos(v: ValorTarjetas, filas: readonly FilaCorto[]): boolean {
  return JSON.stringify(filasACortos(cortosAFilas(v))) === JSON.stringify(filasACortos(filas));
}

/** El aviso discreto de una fila que no se guarda (o `null` si se guarda). */
export function avisoCorto(f: FilaCorto, filas: readonly FilaCorto[]): string | null {
  const g = f.grupo.trim();
  const c = f.corto.trim();
  if (!g && !c) return "Escribe el grupo y su rótulo corto.";
  if (!g) return "Falta el grupo: no se usa.";
  if (!c) return "Falta el rótulo corto: no se usa.";
  const primera = filas.find((x) => x.grupo.trim() === g);
  if (primera && primera.clave !== f.clave) return "Ese grupo ya tiene rótulo corto: no se usa.";
  return null;
}

// ---- compatibilidad: la opción de la lámina de un gráfico -------------------

export const tarjetasActivas = (meta: SlideMeta): boolean => opcionActiva(leerTarjetas(meta, null));
export const tarjetasAlternadas = (meta: SlideMeta, activo: boolean): ValorTarjetas => opcionAlternada(leerTarjetas(meta, null), activo);
export const tarjetasTodas = (meta: SlideMeta): boolean => opcionTodas(leerTarjetas(meta, null));
export const tarjetasConTodas = (meta: SlideMeta, todas: boolean): TarjetasDiferenciasMeta => opcionConTodas(leerTarjetas(meta, null), todas);
