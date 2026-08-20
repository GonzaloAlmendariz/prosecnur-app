import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Un comentario JSX entre dos líneas de texto se come el espacio que las separa.
 *
 * JSX colapsa el salto de línea entre dos textos en un espacio, pero si en medio
 * hay una expresión —y `{/* … *\/}` lo es— ese espacio desaparece. El resultado
 * son dos palabras pegadas en pantalla sin que el texto haya cambiado.
 *
 * Lo introduje dos veces en cinco minutos escribiendo el pie de «Cuándo se
 * termina de aplicar el plan»: primero salió «según eldía» y, al mover el
 * comentario una línea, «15 aulaspor día». **Es invisible en el diff**: el
 * comentario explica y no toca la frase, así que nadie lo mira dos veces.
 *
 * Barrido al escribir esto: **0 casos en los 719 `.tsx` del frontend**, o sea
 * que no es deuda heredada. El guard queda porque el defecto es facil de meter
 * y no se ve leyendo el codigo, no porque haya nada que arreglar. Vive acotado
 * a este perfil, que es el de mayor densidad de comentarios del repo.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));

/** Si un comentario JSX en `lineas[i]` parte un texto en dos. */
export function parteUnTexto(lineas: string[], i: number): boolean {
  let j = i;
  while (j < lineas.length && !lineas[j].includes("*/}")) j += 1;
  const prev = [...lineas.slice(0, i)].reverse().find((l) => l.trim()) ?? "";
  const sig = lineas.slice(j + 1).find((l) => l.trim()) ?? "";
  if (!prev || !sig) return false;
  // Si la línea de antes cierra un tag o una expresión, no hay texto que partir.
  if (/[>})\],;=:?]\s*$/.test(prev)) return false;
  if (/^\s*[<{})/*]/.test(sig)) return false;
  // Y las dos tienen que parecer texto de verdad: una palabra al final y otra al
  // principio.
  return /[A-Za-zÁÉÍÓÚÑáéíóúñ]{2,}\s*$/.test(prev) && /^\s*[A-Za-zÁÉÍÓÚÑáéíóúñ]{2,}/.test(sig);
}

function comentariosQueParten(fuente: string): number[] {
  const lineas = fuente.split("\n");
  const malos: number[] = [];
  for (let i = 0; i < lineas.length; i += 1) {
    if (!/^\s*\{\/\*/.test(lineas[i])) continue;
    if (parteUnTexto(lineas, i)) malos.push(i + 1);
    while (i < lineas.length && !lineas[i].includes("*/}")) i += 1;
  }
  return malos;
}

describe("un comentario no puede cambiar lo que se lee", () => {
  it("caza el caso real que lo motivó", () => {
    // Copiado del pie roto, tal cual estaba.
    const roto = [
      "            Proyectado al ritmo observado de <strong>{fmt(p.ritmo)}</strong> aulas",
      "            {/* un comentario cualquiera */}",
      "            por día de campo (entre 14 y 17 según el día),",
    ];
    expect(comentariosQueParten(roto.join("\n"))).toEqual([2]);
  });

  it("no se queja del comentario que va entre etiquetas", () => {
    // El caso normal y correcto: el comentario separa elementos, no texto.
    const sano = [
      "      <p className=\"pie\">",
      "        {/* explica el bloque siguiente */}",
      "        <strong>{fmt(x)}</strong>",
      "      </p>",
    ];
    expect(comentariosQueParten(sano.join("\n"))).toEqual([]);
  });

  it("ni del que abre un bloque de texto", () => {
    const sano = [
      "      {cond ? (",
      "        {/* explica */}",
      "        Texto que empieza aquí",
      "      ) : null}",
    ];
    expect(comentariosQueParten(sano.join("\n"))).toEqual([]);
  });

  it("y el perfil de aulas está limpio", () => {
    const sucios = readdirSync(AQUI)
      .filter((f) => f.endsWith(".tsx"))
      .map((f) => ({ f, malos: comentariosQueParten(readFileSync(join(AQUI, f), "utf-8")) }))
      .filter((x) => x.malos.length);
    expect(sucios.map((x) => `${x.f}:${x.malos.join(",")}`)).toEqual([]);
  });
});
