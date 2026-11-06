/**
 * Rótulos dentro de los nodos circulares de «Construcción» (Dimensiones). Las etiquetas vienen del XLSForm y suelen
 * ser frases largas («Recepción y/o registro inicial en Espacio de Protección de …»): en una sola línea blanca se
 * salían del círculo y lo que sobraba quedaba blanco sobre blanco. Aquí se parten en las líneas que caben y, si aún
 * sobra, la última termina en «…»; el rótulo completo va en el `<title>` del nodo.
 */

export type Medidor = (texto: string) => number;

/** Medidor por canvas con la fuente dada; sin canvas (tests, SSR), una aproximación por carácter. */
export function crearMedidor(fuente: string, pxPorCaracter: number): Medidor {
  let ctx: CanvasRenderingContext2D | null = null;
  if (typeof document !== "undefined") {
    try {
      ctx = document.createElement("canvas").getContext("2d");
      if (ctx) ctx.font = fuente;
    } catch {
      // Sin canvas (jsdom/happy-dom sin soporte): la aproximación de abajo basta para partir el rótulo.
      ctx = null;
    }
  }
  const cache = new Map<string, number>();
  return (texto) => {
    const previo = cache.get(texto);
    if (previo !== undefined) return previo;
    const ancho = ctx ? ctx.measureText(texto).width : texto.length * pxPorCaracter;
    cache.set(texto, ancho);
    return ancho;
  };
}

const ELIPSIS = "…";

function recortar(texto: string, anchoMax: number, medir: Medidor): string {
  let t = texto.trimEnd();
  while (t.length > 0 && medir(t + ELIPSIS) > anchoMax) t = t.slice(0, -1).trimEnd();
  return t ? t + ELIPSIS : ELIPSIS;
}

/**
 * Parte `texto` en a lo sumo `maxLineas` líneas de `anchoMax` px. Corta por palabras; una palabra que sola no cabe se
 * recorta. Si sobra texto, la última línea termina en «…».
 */
export function partirRotulo(texto: string, anchoMax: number, medir: Medidor, maxLineas: number): string[] {
  const palabras = texto.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (!palabras.length) return [""];
  const lineas: string[] = [];
  let actual = "";
  let k = 0;
  while (k < palabras.length && lineas.length < maxLineas) {
    const candidata = actual ? `${actual} ${palabras[k]}` : palabras[k];
    if (medir(candidata) <= anchoMax) {
      actual = candidata;
      k++;
    } else if (!actual) {
      // Una palabra sola más ancha que el renglón: se recorta.
      lineas.push(recortar(palabras[k], anchoMax, medir));
      k++;
    } else {
      // La palabra que no entró abre el renglón siguiente.
      lineas.push(actual);
      actual = "";
    }
  }
  if (actual && lineas.length < maxLineas) {
    lineas.push(actual);
    actual = "";
  }
  if ((k < palabras.length || actual) && lineas.length) {
    const ultima = lineas.length - 1;
    const resto = [lineas[ultima], actual, ...palabras.slice(k)].filter(Boolean).join(" ");
    lineas[ultima] = recortar(resto, anchoMax, medir);
  }
  return lineas;
}
