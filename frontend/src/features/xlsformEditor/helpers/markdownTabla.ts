// Tablas markdown en el texto de una nota (checklist editor-conjoint, E2, 2026-11-06).
// Enketo pinta una tabla `| a | b |` con su fila separadora `|---|---|`; un conjoint la usa para poner dos perfiles
// lado a lado. Aquí se detectan esos bloques dentro del texto y se pintan como <table>; el resto del texto sigue
// pasando por el render de una línea. Las celdas pasan por el mismo render, así que el HTML queda escapado.

export type BloqueTexto =
  | { tipo: "texto"; texto: string }
  | { tipo: "tabla"; encabezado: string[]; filas: string[][] };

const FILA = /^\s*\|.*\|\s*$/;
const SEPARADORA = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;

function celdas(linea: string): string[] {
  return linea.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}

/** Parte el texto en tramos de texto y tablas (encabezado, separadora y al menos el encabezado). */
export function partirEnBloques(texto: string): BloqueTexto[] {
  const lineas = (texto ?? "").split("\n");
  const out: BloqueTexto[] = [];
  let suelto: string[] = [];
  const soltar = () => {
    if (suelto.length) out.push({ tipo: "texto", texto: suelto.join("\n") });
    suelto = [];
  };
  for (let i = 0; i < lineas.length; i += 1) {
    const linea = lineas[i]!;
    if (FILA.test(linea) && SEPARADORA.test(lineas[i + 1] ?? "")) {
      soltar();
      const encabezado = celdas(linea);
      const filas: string[][] = [];
      i += 2;
      while (i < lineas.length && FILA.test(lineas[i]!)) filas.push(celdas(lineas[i++]!));
      i -= 1;
      out.push({ tipo: "tabla", encabezado, filas });
    } else {
      suelto.push(linea);
    }
  }
  soltar();
  return out;
}

/** ¿El texto trae al menos una tabla? */
export function tieneTabla(texto: string): boolean {
  return partirEnBloques(texto).some((b) => b.tipo === "tabla");
}

/**
 * HTML del texto con sus tablas. `enLinea` pinta (y escapa) cada tramo y cada celda. La primera columna es el rótulo
 * de la fila (`th scope="row"`), como en una ficha de perfiles.
 */
export function conTablasHtml(texto: string, enLinea: (s: string) => string): string {
  const bloques = partirEnBloques(texto);
  if (!bloques.some((b) => b.tipo === "tabla")) return enLinea(texto);
  return bloques
    .map((b) => {
      if (b.tipo === "texto") return b.texto.trim() ? `<span class="pulso-md-tabla-texto">${enLinea(b.texto.trim())}</span>` : "";
      const ancho = Math.max(b.encabezado.length, ...b.filas.map((f) => f.length));
      const completa = (f: string[]) => Array.from({ length: ancho }, (_, i) => f[i] ?? "");
      const cab = completa(b.encabezado).map((c) => `<th scope="col">${enLinea(c)}</th>`).join("");
      const cuerpo = b.filas
        .map((f) => `<tr>${completa(f).map((c, i) => (i === 0 ? `<th scope="row">${enLinea(c)}</th>` : `<td>${enLinea(c)}</td>`)).join("")}</tr>`)
        .join("");
      return `<span class="pulso-md-tabla-marco"><table class="pulso-md-tabla"><thead><tr>${cab}</tr></thead><tbody>${cuerpo}</tbody></table></span>`;
    })
    .join("");
}
