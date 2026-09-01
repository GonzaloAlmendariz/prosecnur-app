import { describe, expect, it } from "vitest";
import { YA_SE_TOCO } from "./estadoDeMuestraLegible";
import { fuenteDelMotor } from "./fuenteDelMotor.testutil";

/**
 * **La lista cerrada del motor y el detector que la compensa.**
 *
 * `monitoreo_aulas_estado_muestra()` reconoce sólo `agendada`, `reagendada`,
 * `reemplazada` y `en reserva N`; **todo lo demás cae al default
 * `sin_contactar`**. Y lo demás incluye palabras que los equipos escriben de
 * verdad en la hoja —«aplicada», «contactada», «en campo», «cerrada», «parcial»—,
 * lo que hace que la misma fila diga «Aplicada» en una columna y «Sin contactar»
 * en la otra.
 *
 * Abrir la lista es una decisión con su propio gate y aquí no se toca. Lo que
 * este contrato protege es **el detector**: `YA_SE_TOCO` existe para cazar la
 * contradicción sin mirar el valor crudo, y si el día de mañana alguien le quita
 * una palabra —o el motor abre su lista y nadie sincroniza— la contradicción
 * dejaría de señalarse **en silencio**, que es como empezó.
 */
const R = new URL("../../../../../../api/R/monitoreo_aulas_universitarias.R", import.meta.url);

function reconocidosPorElMotor(): string[] {
  const fuente = fuenteDelMotor(R);
  const i = fuente.indexOf("monitoreo_aulas_estado_muestra <- function");
  const bloque = fuente.slice(i, i + 900);
  const m = bloque.match(/switch\(gsub\("[^"]*", "[^"]*", key[^)]*\)([\s\S]*?)\n\s*\)/);
  if (!m) throw new Error("no se encontró el switch de monitoreo_aulas_estado_muestra()");
  return [...m[1].matchAll(/^\s{4}(\w+) = /gm)].map((x) => x[1]);
}

describe("la contradicción de la lista cerrada sigue detectándose", () => {
  it("el motor se lee y sigue reconociendo pocos: si abriera la lista, esto avisa", () => {
    const reconocidos = reconocidosPorElMotor();
    // B13b (D-B13, poda del dueño): el motor gana en_contacto y rechazo — el
    // aviso de este pin disparo como debia y la lista se actualiza a conciencia.
    expect(reconocidos).toEqual(
      ["agendada", "reagendada", "reemplazada", "en_contacto", "rechazo"],
    );
  });

  it("las palabras reales que el motor NO reconoce están todas en el detector", () => {
    // Son las que el equipo escribe en la hoja y acaban en `sin_contactar`.
    // Si una se cae de `YA_SE_TOCO`, su contradicción deja de señalarse.
    for (const palabra of ["aplicada", "cerrada", "parcial", "en_campo", "contactada"]) {
      expect(YA_SE_TOCO.has(palabra), `«${palabra}» dejaría de delatar la contradicción`).toBe(true);
    }
  });

  it("lo que el motor SÍ reconoce no se cuela en el detector como si fuera contradicción", () => {
    // `agendada` es la excepción declarada: el motor la reconoce Y es «ya se
    // tocó», porque una cita ya cerrada contradice «sin contactar» igual.
    for (const palabra of ["reagendada", "reemplazada", "en_reserva"]) {
      expect(YA_SE_TOCO.has(palabra), `«${palabra}» no es una contradicción`).toBe(false);
    }
  });
});
