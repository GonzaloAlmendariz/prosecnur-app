// «Agrupar en la lista» del mapa de distribución (`agrupar_lista`, api/R/graficos_mapa_distribucion_agrupar.R).
//
// CCSS Perfil 2026: el mapa lee A6_1 (distritos de Lima) y junta A6_2 (distritos del Callao); la lista decía «Callao 12»
// y el resto del Callao caía en «Otros distritos». Un grupo suma en una fila de la lista todas las áreas de las preguntas
// que nombra, sin cambiar el mapa. El motor acepta una lista con nombre (`{"Callao": ["A6_2"]}`, lo que guarda el plan)
// o texto «Rótulo | preguntas», una línea por grupo. La tarjeta lee las dos y escribe siempre la lista con nombre.
//
// Reglas del motor (.mapa_dist_agrupar_normalizar y .mapa_dist_agrupar_validar): cada grupo lleva rótulo y al menos una
// pregunta, dos grupos no comparten rótulo ni pregunta, y las preguntas son las que el mapa lee (`var` o `juntar`). Un
// grupo que rompe alguna se queda en la tarjeta con su aviso y no se guarda: el motor rechazaría la lámina entera.

export type GrupoLista = { clave: string; rotulo: string; preguntas: string[] };

/** El nombre de una pregunta sin su base (`base$A6_2` → `A6_2`), como la compara el motor (`.graficos_ref_parts`). */
export function nombrePregunta(ref: string): string {
  const i = ref.lastIndexOf("$");
  return (i >= 0 ? ref.slice(i + 1) : ref).trim();
}

const textos = (v: unknown): string[] =>
  (Array.isArray(v) ? v : v == null ? [] : [v])
    .flatMap((x) => (Array.isArray(x) ? x : [x]))
    .filter((x): x is string | number => typeof x === "string" || typeof x === "number")
    .map((x) => String(x).trim())
    .filter(Boolean);

/** Las preguntas que el mapa lee: `var` y las de `juntar`, sin repetir, en ese orden. */
export function preguntasDelMapa(args: Readonly<Record<string, unknown>>): string[] {
  const vistas = new Set<string>();
  return [...textos(args.var), ...textos(args.juntar)].filter((r) => {
    const n = nombrePregunta(r);
    if (!n || vistas.has(n)) return false;
    vistas.add(n);
    return true;
  });
}

/** Lo guardado (lista con nombre, texto por líneas o nada) como filas de la tarjeta. */
export function gruposAFilas(valor: unknown): GrupoLista[] {
  if (typeof valor === "string") {
    return valor.split("\n").map((l) => l.trim()).filter(Boolean).map((linea, i) => {
      const corte = linea.indexOf("|");
      const rotulo = corte >= 0 ? linea.slice(0, corte).trim() : linea;
      const preguntas = corte >= 0 ? linea.slice(corte + 1).split(",").map((x) => x.trim()).filter(Boolean) : [];
      return { clave: `g${i}`, rotulo, preguntas };
    });
  }
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return [];
  return Object.entries(valor as Record<string, unknown>).map(([rotulo, preguntas], i) => ({
    clave: `g${i}`, rotulo: rotulo.trim(), preguntas: textos(preguntas),
  }));
}

/** ¿Algún grupo anterior a `indice` ya usa este rótulo? El motor rechaza dos filas con el mismo. */
const rotuloRepetido = (filas: readonly GrupoLista[], indice: number) => {
  const r = filas[indice].rotulo.trim().toLowerCase();
  return r !== "" && filas.slice(0, indice).some((f) => f.rotulo.trim().toLowerCase() === r);
};

/** El grupo que ya tiene esta pregunta, fuera de la fila `indice` (o `null`). Una pregunta va en un solo grupo. */
export function grupoConPregunta(filas: readonly GrupoLista[], indice: number, pregunta: string): GrupoLista | null {
  const n = nombrePregunta(pregunta);
  return filas.find((f, k) => k !== indice && f.preguntas.some((p) => nombrePregunta(p) === n)) ?? null;
}

/** Las preguntas de la fila que el mapa ya no lee: el motor rechazaría la lámina. */
export function preguntasFuera(f: Pick<GrupoLista, "preguntas">, delMapa: readonly string[]): string[] {
  const leidas = new Set(delMapa.map(nombrePregunta));
  return f.preguntas.filter((p) => !leidas.has(nombrePregunta(p)));
}

/** El aviso de una fila que no se guarda (o `null` si se guarda). */
export function avisoGrupo(filas: readonly GrupoLista[], indice: number, delMapa: readonly string[]): string | null {
  const f = filas[indice];
  const sinRotulo = f.rotulo.trim() === "";
  const sinPreguntas = f.preguntas.length === 0;
  if (sinRotulo && sinPreguntas) return "Falta el rótulo y las preguntas: no sale.";
  if (sinRotulo) return "Falta el rótulo: no sale.";
  if (sinPreguntas) return "Marca al menos una pregunta: no sale.";
  if (rotuloRepetido(filas, indice)) return "Otra fila ya tiene este rótulo: no sale.";
  if (preguntasFuera(f, delMapa).length) return "Tiene una pregunta que el mapa ya no lee. Quítala para que la fila salga.";
  const previa = f.preguntas.map((p) => grupoConPregunta(filas.slice(0, indice), -1, p)).find(Boolean);
  if (previa) return `Comparte una pregunta con “${previa.rotulo.trim() || "otra fila"}”: no sale.`;
  return null;
}

/**
 * Lo que se guarda: la lista con nombre que lee el motor, sólo con las filas que acepta y en su orden. Sin ninguna fila
 * válida, `null` (el arg se borra y la lista vuelve a ir por área).
 */
export function filasAGrupos(filas: readonly GrupoLista[], delMapa: readonly string[]): Record<string, string[]> | null {
  const salida: Record<string, string[]> = {};
  filas.forEach((f, i) => {
    if (!avisoGrupo(filas, i, delMapa)) salida[f.rotulo.trim()] = [...f.preguntas];
  });
  return Object.keys(salida).length ? salida : null;
}

/** ¿Lo guardado y el borrador dicen lo mismo al motor? Si no, cambió afuera (deshacer, el plan) y manda lo guardado. */
export function mismosGrupos(valor: unknown, filas: readonly GrupoLista[], delMapa: readonly string[]): boolean {
  return JSON.stringify(filasAGrupos(gruposAFilas(valor), delMapa)) === JSON.stringify(filasAGrupos(filas, delMapa));
}

/** Marca o desmarca una pregunta en la fila; una pregunta que ya está en otra fila no se marca. */
export function alternarPregunta(filas: readonly GrupoLista[], indice: number, pregunta: string): GrupoLista[] {
  const n = nombrePregunta(pregunta);
  return filas.map((f, k) => {
    if (k !== indice) return f;
    const tiene = f.preguntas.some((p) => nombrePregunta(p) === n);
    if (tiene) return { ...f, preguntas: f.preguntas.filter((p) => nombrePregunta(p) !== n) };
    if (grupoConPregunta(filas, indice, pregunta)) return f;
    return { ...f, preguntas: [...f.preguntas, pregunta] };
  });
}

/** ¿Queda alguna pregunta del mapa sin grupo? Si no, agregar otra fila no sirve. */
export function quedanLibres(filas: readonly GrupoLista[], delMapa: readonly string[]): boolean {
  return delMapa.some((p) => !grupoConPregunta(filas, -1, p));
}
