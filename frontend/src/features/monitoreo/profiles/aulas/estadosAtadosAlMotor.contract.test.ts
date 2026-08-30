import { describe, expect, it } from "vitest";
import { ESTADOS_DORMIDOS } from "./candidatosDeReemplazo";
import { fuenteDelMotor } from "./fuenteDelMotor.testutil";

/**
 * **Dos listas del mismo concepto, una en R y otra en TypeScript.**
 *
 * `MONITOREO_AULAS_ESTADOS_DORMIDOS` decide en el motor qué cursos-horario están
 * «en juego», y el frontend tiene su propia copia literal para elegir candidatos
 * de reemplazo. Nadie las ataba: si una crece y la otra no, el frontend ofrece
 * como candidato algo que el motor ya descartó, o al revés.
 *
 * No es hipotético en este perfil. La vuelta 82 encontró que esa misma lista NO
 * incluye «reemplazada» —y que además se aplica sobre `sample_status`, no sobre
 * `operational_status`—, lo que dejaba 18 aulas muertas sumando 329,3 encuestas
 * al aporte pendiente. Una lista de estados que nadie ata es el patrón más caro
 * del repo.
 *
 * El test lee el R en vez de copiar la lista: copiarla sería crear la tercera.
 */
const R = new URL("../../../../../../api/R/monitoreo_aulas_en_juego.R", import.meta.url);

function dormidosDelMotor(): string[] {
  const fuente = fuenteDelMotor(R);
  const m = fuente.match(/MONITOREO_AULAS_ESTADOS_DORMIDOS\s*<-\s*c\(([^)]*)\)/);
  if (!m) throw new Error("no se encontró MONITOREO_AULAS_ESTADOS_DORMIDOS en el motor");
  return [...m[1].matchAll(/"([^"]*)"/g)].map((x) => x[1]);
}

describe("los estados dormidos del frontend son los del motor", () => {
  it("la lista del motor se lee y no está vacía: sin eso el test no probaría nada", () => {
    const motor = dormidosDelMotor();
    expect(motor.length).toBeGreaterThan(3);
    expect(motor).toContain("en_reserva");
  });

  it("frontend y motor declaran exactamente los mismos", () => {
    const motor = [...dormidosDelMotor()].sort();
    const front = [...ESTADOS_DORMIDOS].sort();
    expect(front).toEqual(motor);
  });
});
