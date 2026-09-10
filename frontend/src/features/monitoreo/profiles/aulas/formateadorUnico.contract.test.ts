import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/** Los `.ts`/`.tsx` de producción del perfil, igual que los otros guards. */
function fuentes(dir: string): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(dir)) {
    const ruta = path.join(dir, entrada);
    if (statSync(ruta).isDirectory()) salida.push(...fuentes(ruta));
    else if (/\.tsx?$/.test(entrada) && !/\.test\./.test(entrada)) salida.push(ruta);
  }
  return salida;
}

/**
 * **Ningún archivo del perfil escribe su propio formateador de porcentaje.**
 *
 * `pctPerfil()` vive en `kpisDeAulas.ts` y su docstring ya contaba la historia:
 * «lo escribí dos veces como helper local antes de darme cuenta de que estaba
 * creando el mismo problema que llevo cerrando: dos sitios formateando lo mismo
 * acaban separándose».
 *
 * El censo del 2026-09-09 (loop de monitoreo, E1) encontró que se había vuelto
 * a abrir: DIEZ helpers `pct` locales en producción. Seis eran adaptadores de
 * una línea que delegan —correctos, la conversión de tanto-por-uno a puntos es
 * suya—, pero TRES reimplementaban el cuerpo y uno formateaba distinto. Es
 * decir: la profecía del docstring, cumplida.
 *
 * Este test no prohíbe un helper local que DELEGUE: prohíbe el que construya la
 * cadena por su cuenta. La diferencia se ve en el fuente y sólo en el fuente —
 * dos formatos del mismo número se ven idénticos hasta que uno tiene decimales
 * y el otro no.
 */
const AQUI = path.dirname(fileURLToPath(import.meta.url));

/**
 * Excepciones vivas, cada una con su motivo. Una lista que ya no aplica no
 * protege nada, así que el segundo test comprueba que siguen existiendo.
 */
const CON_MOTIVO = new Map<string, string>([
  [
    "kpisDeAulas.ts",
    "Es la CASA del formateador: aquí vive `pctPerfil()`. Si esta excepción "
      + "desapareciera, el porcentaje del perfil no lo escribiría nadie.",
  ],
  [
    "AulasAlertaDeAnticipacion.tsx",
    "`pctCorto` formatea SIN decimales a propósito: va dentro de una frase de "
      + "aviso donde «73 %» se lee y «73,2 %» estorba. Es otro formato, no otra "
      + "implementación del mismo.",
  ],
]);

/** Un formateador de porcentaje: construye el texto con el símbolo dentro. */
const CONSTRUYE_PORCENTAJE =
  /(toLocaleString|toFixed)\([^)]*\)[^;\n]{0,40}(%|\bpor ciento\b)|(%|\bpor ciento\b)[^;\n]{0,20}(toLocaleString|toFixed)\(/;

describe("un solo formateador de porcentaje en el perfil", () => {
  it("ningún archivo de producción construye el suyo", () => {
    const culpables: string[] = [];
    for (const archivo of fuentes(AQUI)) {
      const nombre = path.basename(archivo);
      if (CON_MOTIVO.has(nombre)) continue;
      const fuente = readFileSync(archivo, "utf8");
      // Sólo las líneas de código: un ejemplo dentro de un comentario no pinta
      // nada en pantalla.
      const lineas = fuente.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l));
      for (const linea of lineas) {
        if (CONSTRUYE_PORCENTAJE.test(linea)) culpables.push(`${nombre}: ${linea.trim()}`);
      }
    }
    expect(culpables, culpables.length
      ? "Estos construyen su propio porcentaje en vez de usar `pctPerfil()`:\n  "
        + culpables.join("\n  ")
        + "\nSi el formato es OTRO a propósito, decláralo en CON_MOTIVO."
      : "").toEqual([]);
  });

  it("las excepciones declaradas siguen existiendo", () => {
    const vivas = new Set(fuentes(AQUI).map((f) => path.basename(f)));
    for (const nombre of CON_MOTIVO.keys()) {
      expect(vivas.has(nombre), `${nombre} ya no existe: quita su excepción`).toBe(true);
    }
  });
});
