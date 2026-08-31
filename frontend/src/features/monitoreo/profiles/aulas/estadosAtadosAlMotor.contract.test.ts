import { describe, expect, it } from "vitest";
import { ESTADOS_DORMIDOS, ESTADOS_QUE_LIBERAN } from "./candidatosDeReemplazo";
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

function listaDelMotor(nombre: string): string[] {
  const fuente = fuenteDelMotor(R);
  const m = fuente.match(new RegExp(`${nombre}\\s*<-\\s*c\\(([^)]*)\\)`));
  if (!m) throw new Error(`no se encontró ${nombre} en el motor`);
  return [...m[1].matchAll(/"([^"]*)"/g)].map((x) => x[1]);
}

const dormidosDelMotor = () => listaDelMotor("MONITOREO_AULAS_ESTADOS_DORMIDOS");
const aplicadosDelMotor = () => listaDelMotor("MONITOREO_AULAS_ESTADOS_APLICADOS");

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

/**
 * **La segunda lista del mismo par, atada por el mismo motivo.**
 *
 * `MONITOREO_AULAS_ESTADOS_APLICADOS` decide en el motor si una cadena está
 * resuelta, y `ESTADOS_QUE_LIBERAN` hace lo propio en el frontend. Nacieron
 * separadas —ocho sitios de R y siete de TS con `c("aplicada", "cerrada")`
 * escrito a mano— y ya habían divergido antes de tener nombre: el reparto por
 * estrato de `monitoreo_aulas_universitarias.R` contaba «parcial» y los demás
 * no. Atarlas es lo que impide que la próxima corrección se aplique en un lado.
 */
describe("los estados que liberan una cadena son los del motor", () => {
  it("la lista del motor se lee y trae «parcial», que es la decisión que la creó", () => {
    const motor = aplicadosDelMotor();
    expect(motor.length).toBeGreaterThan(2);
    expect(motor).toContain("parcial");
  });

  it("frontend y motor declaran exactamente los mismos", () => {
    expect([...ESTADOS_QUE_LIBERAN].sort()).toEqual([...aplicadosDelMotor()].sort());
  });

  it("no se solapa con los dormidos: un estado no puede ser las dos cosas", () => {
    const solapan = aplicadosDelMotor().filter((e) => dormidosDelMotor().includes(e));
    expect(solapan).toEqual([]);
  });
});
