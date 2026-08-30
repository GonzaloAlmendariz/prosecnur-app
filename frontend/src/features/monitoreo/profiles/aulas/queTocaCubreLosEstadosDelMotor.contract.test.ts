import { describe, expect, it } from "vitest";
import { queTocaConCadaAula } from "./queTocaConCadaAula";
import { fuenteDelMotor } from "./fuenteDelMotor.testutil";

/**
 * **Cuarta lista del perfil atada al motor.**
 *
 * `queTocaConCadaAula` traduce el estado en la acción que toca, y su comentario
 * declara que trabaja con «los estados canónicos del motor —
 * `monitoreo_aulas_estados_muestra()`». Hoy coinciden. El riesgo no es que
 * divergan las palabras, sino **el silencio**: si el motor añade un estado de
 * muestra, esta función lo manda al default —«Llamar al docente»— sin que nada
 * avise, y esa fila diría que hay que llamar a alguien a quien quizá no.
 *
 * Es el mismo patrón que ya costó caro en este perfil con la lista cerrada de
 * `monitoreo_aulas_estado_muestra()`, donde seis palabras reales caían al default.
 */
const R = new URL("../../../../../../api/R/monitoreo_aulas_universitarias.R", import.meta.url);
const CORTE = "2026-09-30";

function estadosDelMotor(): string[] {
  const fuente = fuenteDelMotor(R);
  const m = fuente.match(/monitoreo_aulas_estados_muestra\s*<-\s*function\(\)\s*\{\s*c\(([^)]*)\)/);
  if (!m) throw new Error("no se encontró monitoreo_aulas_estados_muestra() en el motor");
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

describe("cada estado de muestra del motor tiene su acción", () => {
  it("la lista del motor se lee y trae los cinco de siempre", () => {
    expect(estadosDelMotor()).toEqual(
      ["agendada", "reagendada", "en_reserva", "reemplazada", "sin_contactar"],
    );
  });

  it("ninguno cae al default por accidente: los que no piden llamada lo dicen", () => {
    // `reemplazada` y `en_reserva` salieron del plan o aún no han entrado; el
    // resto sí termina en una acción de contacto, y eso es correcto.
    expect(queTocaConCadaAula({ sample_status: "reemplazada" } as never, CORTE)).toBe("Reemplazado");
    expect(queTocaConCadaAula({ sample_status: "en_reserva" } as never, CORTE)).toBe("En reserva");
  });

  it("«agendada» y «reagendada» sin fecha piden cerrar la fecha, no volver a llamar", () => {
    // La distinción que el comentario defiende: decir «llamar» a quien ya
    // contestó sería empezar de cero un trabajo que ya avanzó.
    for (const estado of ["agendada", "reagendada"]) {
      expect(queTocaConCadaAula({ sample_status: estado } as never, CORTE), estado).toBe("Cerrar fecha");
    }
  });

  it("«sin contactar» es el único que manda llamar, y es el default", () => {
    expect(queTocaConCadaAula({ sample_status: "sin_contactar" } as never, CORTE)).toBe("Llamar al docente");
  });

  it("un estado que el motor todavía no declara acaba en «llamar», y ESO es lo que hay que vigilar", () => {
    // No es un fallo: es el default. La prueba existe para que, si el motor
    // añade un estado, la primera de este bloque falle y alguien decida qué
    // acción le toca en vez de dejarlo caer aquí.
    expect(queTocaConCadaAula({ sample_status: "estado_futuro" } as never, CORTE)).toBe("Llamar al docente");
  });
});
