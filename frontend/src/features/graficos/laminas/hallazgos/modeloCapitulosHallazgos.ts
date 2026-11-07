// Capítulos del resumen ejecutivo de «Hallazgos clave» (`p_slide_hallazgos`, arg `capitulos`, modos «resumen» y
// «titulares»). Antes se escribían a mano en el plan (revisión del PPT v7.11, ítem 2). Sin React, para probarlo solo.
//
// Cada capítulo lleva su título, su titular (sólo cuenta en «titulares») y sus hallazgos: la pregunta, la respuesta que
// se cuenta, el texto que sigue a la cifra y la comparación. Lo que el editor no maneja (`sumar`, `filtros`,
// `base_texto`, `top2box`, claves desconocidas) viaja intacto en `resto` y se nombra en una nota de sólo lectura.
// Un hallazgo incompleto se queda en el editor con su aviso y no sale al plan; un capítulo sin hallazgos completos,
// tampoco.

export type TipoComparacion = "auto" | "ninguna" | "escrita";

export type HallazgoEditable = {
  clave: string;
  var: string;
  fila: string;
  texto: string;
  comparacion: TipoComparacion;
  /** El texto de la comparación escrita a mano. */
  comparacionTexto: string;
  resto: Readonly<Record<string, unknown>>;
};

export type CapituloEditable = {
  clave: string;
  titulo: string;
  titular: string;
  hallazgos: HallazgoEditable[];
  resto: Readonly<Record<string, unknown>>;
};

export type ModoHallazgos = "cifras" | "cifras_con_graficos" | "resumen" | "titulares";

/** Modos en los que la lámina es el resumen ejecutivo por capítulo. */
export const MODOS_RESUMEN: ReadonlySet<string> = new Set(["resumen", "titulares"]);

const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

const texto = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" && Number.isFinite(v) ? String(v) : "");

/** Una lista guardada, o un objeto suelto sin envolver, como lista. */
function comoLista(v: unknown, esSuelto: (o: Record<string, unknown>) => boolean): unknown[] {
  if (Array.isArray(v)) return v;
  return esObjeto(v) && esSuelto(v) ? [v] : [];
}

/** `comparacion` guardada: vacía, `true` o «auto» la elige el motor; `false` o «ninguna», sin comparación; otro texto, escrita. */
export function leerComparacion(v: unknown): Pick<HallazgoEditable, "comparacion" | "comparacionTexto"> {
  if (v === undefined || v === null || v === true) return { comparacion: "auto", comparacionTexto: "" };
  if (v === false) return { comparacion: "ninguna", comparacionTexto: "" };
  const t = texto(v);
  const norma = t.trim().toLowerCase();
  if (norma === "" || norma === "auto") return { comparacion: "auto", comparacionTexto: "" };
  if (norma === "ninguna") return { comparacion: "ninguna", comparacionTexto: "" };
  return { comparacion: "escrita", comparacionTexto: t };
}

export function leerHallazgo(v: unknown, clave: string): HallazgoEditable | null {
  if (!esObjeto(v)) return null;
  const { var: ref, fila, texto: frase, comparacion, ...resto } = v;
  return { clave, var: texto(ref), fila: texto(fila), texto: texto(frase), ...leerComparacion(comparacion), resto };
}

/** Lo guardado (lista, un capítulo suelto o nada) como capítulos editables. Lo que no es objeto no es un capítulo. */
export function leerCapitulos(valor: unknown): CapituloEditable[] {
  const lista = comoLista(valor, (o) => "titulo" in o || "cifras" in o);
  return lista.flatMap((c, i) => {
    if (!esObjeto(c)) return [];
    const { titulo, titular, cifras, ...resto } = c;
    const hallazgos = comoLista(cifras, (o) => "var" in o).flatMap((h, k) => {
      const leido = leerHallazgo(h, `c${i}h${k}`);
      return leido ? [leido] : [];
    });
    return [{ clave: `c${i}`, titulo: texto(titulo), titular: texto(titular), hallazgos, resto }];
  });
}

const tieneValor = (v: unknown): boolean =>
  Array.isArray(v) ? v.some((x) => texto(x).trim() !== "") : texto(v).trim() !== "";

/** La respuesta sale de otro campo que el editor no maneja (`sumar`, Top 2 Box o varias filas). */
export function cuentaPorOtroCampo(resto: Readonly<Record<string, unknown>>): boolean {
  return ["sumar", "top2box", "top2box_labels", "filas"].some((k) => tieneValor(resto[k]));
}

/** Qué le falta al hallazgo para salir; vacío si está completo. */
export function faltasHallazgo(h: HallazgoEditable): string[] {
  const faltas: string[] = [];
  if (!h.var.trim()) faltas.push("la pregunta");
  if (!h.fila.trim() && !cuentaPorOtroCampo(h.resto)) faltas.push("la respuesta");
  if (!h.texto.trim()) faltas.push("el texto");
  if (h.comparacion === "escrita" && !h.comparacionTexto.trim()) faltas.push("la comparación escrita");
  return faltas;
}

export function hallazgoCompleto(h: HallazgoEditable): boolean {
  return faltasHallazgo(h).length === 0;
}

const unirFaltas = (f: readonly string[]): string =>
  f.length <= 1 ? f.join("") : `${f.slice(0, -1).join(", ")} y ${f[f.length - 1]}`;

/** El aviso discreto de un hallazgo que no sale (o `null` si sale). */
export function avisoHallazgo(h: HallazgoEditable): string | null {
  const f = faltasHallazgo(h);
  if (!f.length) return null;
  return `Falta ${unirFaltas(f)}: no sale.`;
}

/** El aviso de un capítulo: sin hallazgos completos no sale; en «titulares», sin titular va la frase del hallazgo. */
export function avisoCapitulo(c: CapituloEditable, modo: string): string | null {
  if (!c.hallazgos.some(hallazgoCompleto)) {
    return c.hallazgos.length ? "Ningún hallazgo completo: el capítulo no sale." : "Sin hallazgos: el capítulo no sale.";
  }
  if (modo === "titulares" && !c.titular.trim()) return "Sin titular, la lámina usa la frase del primer hallazgo.";
  return null;
}

/** El valor de `comparacion` que entiende el motor. */
export function escribirComparacion(h: Pick<HallazgoEditable, "comparacion" | "comparacionTexto">): string {
  return h.comparacion === "escrita" ? h.comparacionTexto.trim() : h.comparacion;
}

export function escribirHallazgo(h: HallazgoEditable): Record<string, unknown> {
  const fila = h.fila.trim();
  return {
    ...h.resto,
    var: h.var.trim(),
    ...(fila ? { fila } : {}),
    texto: h.texto.trim(),
    comparacion: escribirComparacion(h),
  };
}

/**
 * Lo que se guarda: sólo los hallazgos completos, y sólo los capítulos que conservan alguno. Lo que el editor no maneja
 * va intacto. El titular se conserva aunque el modo no lo use: cambiar de modo no borra lo escrito.
 */
export function escribirCapitulos(capitulos: readonly CapituloEditable[]): Record<string, unknown>[] {
  return capitulos.flatMap((c) => {
    const cifras = c.hallazgos.filter(hallazgoCompleto).map(escribirHallazgo);
    if (!cifras.length) return [];
    const titular = c.titular.trim();
    return [{ ...c.resto, titulo: c.titulo.trim(), ...(titular ? { titular } : {}), cifras }];
  });
}

/** ¿Lo guardado y el borrador dicen lo mismo al motor? Si no, cambió afuera (deshacer, el plan). */
export function mismosCapitulos(valor: unknown, borrador: readonly CapituloEditable[]): boolean {
  return JSON.stringify(escribirCapitulos(leerCapitulos(valor))) === JSON.stringify(escribirCapitulos(borrador));
}

const NOMBRES_RESTO: Readonly<Record<string, string>> = {
  sumar: "Suma",
  top2box: "Suma",
  top2box_labels: "Suma",
  filas: "Suma",
  filtros: "Filtros propios",
  base_texto: "Base",
  base: "Base",
  base_rotulo: "Rótulo de la base",
  grafico: "Gráfico de apoyo",
};

const resumenValor = (v: unknown): string => {
  if (Array.isArray(v)) return v.map(texto).filter(Boolean).join(" + ");
  if (esObjeto(v)) return "";
  return texto(v).trim();
};

/** Lo que el hallazgo trae y el editor no edita, dicho en una línea de sólo lectura (o `null` si no trae nada). */
export function notaRestoHallazgo(resto: Readonly<Record<string, unknown>>): string | null {
  const partes: string[] = [];
  const otras: string[] = [];
  for (const [k, v] of Object.entries(resto)) {
    if (v === undefined || v === null) continue;
    const nombre = NOMBRES_RESTO[k];
    if (!nombre) { otras.push(k); continue; }
    const valor = resumenValor(v);
    partes.push(valor ? `${nombre}: ${valor}.` : `${nombre}.`);
  }
  if (otras.length) partes.push(`Otros campos guardados: ${otras.join(", ")}.`);
  return partes.length ? `${partes.join(" ")} No se edita aquí y se conserva.` : null;
}

/** Mueve el elemento `i` una posición (`-1` sube, `1` baja); fuera de rango, la lista no cambia. */
export function mover<T>(lista: readonly T[], i: number, delta: -1 | 1): T[] {
  const j = i + delta;
  if (i < 0 || i >= lista.length || j < 0 || j >= lista.length) return [...lista];
  const copia = [...lista];
  [copia[i], copia[j]] = [copia[j], copia[i]];
  return copia;
}

export function hallazgoNuevo(clave: string): HallazgoEditable {
  return { clave, var: "", fila: "", texto: "", comparacion: "auto", comparacionTexto: "", resto: {} };
}

export function capituloNuevo(clave: string, claveHallazgo: string): CapituloEditable {
  return { clave, titulo: "", titular: "", hallazgos: [hallazgoNuevo(claveHallazgo)], resto: {} };
}
