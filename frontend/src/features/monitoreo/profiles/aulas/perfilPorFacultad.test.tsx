import { describe, expect, it } from "vitest";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { avanceEnRespuestas } from "./avanceEnRespuestas";
import { renderToStaticMarkup } from "react-dom/server";

import { AulasPerfilPorFacultad } from "./AulasPerfilPorFacultad";
import { perfilDesdeElMotor } from "./perfilPorFacultad";
import { perfilPorFacultad } from "./perfilPorFacultad";

/**
 * Entre el total y el aula no había nada.
 *
 * Avance decía cuánto se lleva en total y cuánto lleva cada curso-horario; para
 * saber que a una facultad le faltan doscientas respuestas había que sumar a
 * mano treinta filas de la tabla. Y es la pregunta con la que se decide a dónde
 * va el equipo mañana.
 */

function aula(facultad: string, meta: number, validas: number): MonitoreoAulasPlanRow {
  return {
    faculty: facultad,
    expected_valid: meta,
    respuestas_validas: validas,
  } as unknown as MonitoreoAulasPlanRow;
}

const plan = [
  aula("Derecho", 30, 10),
  aula("Derecho", 30, 30),
  aula("Gestión", 40, 5),
  aula("Letras", 20, 20),
];

describe("el perfil por facultad", () => {
  it("ordena por lo que falta, no por la tasa", () => {
    // El caso que distingue las dos ordenaciones: una facultad diminuta con
    // pésima tasa (25 %) contra una grande a medias (50 %). Por tasa iría
    // primero la de tres respuestas; por lo que falta, la de doscientas, que es
    // donde de verdad hay que mandar al equipo.
    //
    // Con un plan donde las dos ordenaciones coinciden, este aserto pasaría
    // igual ordenando por tasa y no verificaría nada. Comprobado: al invertir
    // el criterio en el módulo, es este caso el que se pone rojo.
    const { facultades } = perfilPorFacultad([
      aula("Micro", 4, 1),
      aula("Grande", 400, 200),
    ]);
    expect(facultades.map((f) => f.facultad)).toEqual(["Grande", "Micro"]);
    expect(facultades[0].falta).toBe(200);
    expect(facultades[0].avance).toBe(50);
    expect(facultades[1].avance).toBe(25);
  });

  it("agrupa cada aula en su facultad", () => {
    const { facultades } = perfilPorFacultad(plan);
    expect(facultades.map((f) => f.facultad).sort()).toEqual(["Derecho", "Gestión", "Letras"]);
    expect(facultades.find((f) => f.facultad === "Derecho")?.aulas).toBe(2);
  });

  it("las partes suman exactamente el total", () => {
    // El aserto que fija la propiedad: cada facultad se calcula con la MISMA
    // función que da el total, así que no pueden discrepar.
    const { facultades } = perfilPorFacultad(plan);
    const total = avanceEnRespuestas(plan);
    expect(facultades.reduce((s, f) => s + f.falta, 0)).toBe(total.falta);
    expect(facultades.reduce((s, f) => s + f.cubierto, 0)).toBe(total.cubierto);
    expect(facultades.reduce((s, f) => s + f.meta, 0)).toBe(total.meta);
  });

  it("el excedente de una facultad no cubre la falta de otra", () => {
    // Misma regla que en el total, ahora entre facultades: 20 de más en Letras
    // no tapan las 35 que faltan en Gestión.
    const { facultades } = perfilPorFacultad([
      aula("Letras", 20, 40),
      aula("Gestión", 40, 5),
    ]);
    const letras = facultades.find((f) => f.facultad === "Letras");
    expect(letras?.excedente).toBe(20);
    expect(letras?.falta).toBe(0);
    expect(facultades.find((f) => f.facultad === "Gestión")?.falta).toBe(35);
  });

  it("un aula sin facultad se cuenta aparte, no se reparte", () => {
    // Repartirla a ojo entre las demás falsearía la facultad que la reciba; se
    // dice, que es lo que deja arreglarlo en el plan.
    const res = perfilPorFacultad([aula("Derecho", 30, 10), aula("", 30, 10)]);
    expect(res.facultades).toHaveLength(1);
    expect(res.sinFacultad).toBe(1);
  });

  it("cuenta las facultades que ya cumplieron", () => {
    const res = perfilPorFacultad(plan);
    expect(res.cumplidas).toBe(1);
    expect(res.tope).toBe(60);
  });
});

/**
 * El bloque del motor manda sobre el cálculo local.
 *
 * La vista calculaba el perfil sobre `course_status`, que viaja recortado a 500
 * filas de 2 615 y además incluye las reservas dormidas de cada cadena: el
 * panel que contesta «¿cómo va Derecho?» medía un subconjunto arbitrario.
 */
describe("perfilDesdeElMotor", () => {
  it("deriva lo cubierto de la meta y la brecha, no de las respuestas", () => {
    // Las respuestas pueden pasarse de la meta en un aula y no cubrir otra, así
    // que `cubierto` sale de meta − brecha y no de `respuestas_validas`.
    const [derecho] = perfilDesdeElMotor([
      { faculty: "DERECHO", aulas: 18, meta: 664, brecha: 164, respuestas_validas: 700 },
    ]).facultades;

    expect(derecho.meta).toBe(664);
    expect(derecho.falta).toBe(164);
    expect(derecho.cubierto).toBe(500);
    expect(derecho.avance).toBe(75.3)  // un decimal, igual que `avanceEnRespuestas()`: las dos
    // funciones calculan el mismo avance y el panel usa una u otra segun llegue
    // el resumen del motor. Con dos redondeos, la misma pantalla decia «20%» o
    // «19,6 %» segun la fuente.;
  });

  it("una facultad sin nombre se rotula, no se descarta", () => {
    const { facultades } = perfilDesdeElMotor([{ faculty: "", aulas: 3, meta: 60, brecha: 60 }]);
    expect(facultades).toHaveLength(1);
    expect(facultades[0].facultad).toBe("Sin facultad");
  });

  it("cuenta como cumplida la que no tiene brecha", () => {
    const r = perfilDesdeElMotor([
      { faculty: "A", aulas: 2, meta: 40, brecha: 0 },
      { faculty: "B", aulas: 2, meta: 40, brecha: 5 },
    ]);
    expect(r.cumplidas).toBe(1);
    expect(r.tope).toBe(40);
  });
});

/**
 * Y que el COMPONENTE lo use.
 *
 * El cálculo bueno no sirve de nada si la vista sigue llamando al local: un
 * mutante que devolvía `perfilPorFacultad(filas)` dejaba los 161 tests del
 * perfil en verde. Este guard es el que lo caza.
 */
describe("AulasPerfilPorFacultad y el bloque del motor", () => {
  it("cuando llega el resumen del motor, manda sobre las filas", () => {
    // Las filas dicen una cosa y el resumen otra, a propósito: si el componente
    // vuelve al cálculo local, sale «CIENCIAS» y este aserto cae.
    const html = renderToStaticMarkup(
      <AulasPerfilPorFacultad
        filas={[
          { faculty: "CIENCIAS", expected_valid: 10, respuestas_validas: 0 },
        ] as unknown as MonitoreoAulasPlanRow[]}
        resumen={[{ faculty: "DERECHO", aulas: 18, meta: 664, brecha: 164 }]}
      />,
    );

    expect(html).toContain("DERECHO");
    expect(html).not.toContain("CIENCIAS");
  });
});

describe("las dos rutas del perfil redondean igual", () => {
  /**
   * `perfilPorFacultad()` calcula desde el plan y `perfilDesdeElMotor()` desde
   * `avance_por_facultad`; el panel usa una u otra según llegue el resumen. Con
   * redondeos distintos —`Math.round(100·x/meta)` contra
   * `Math.round(1000·x/meta)/10`— la MISMA pantalla enseñaba «20%» o «19,6 %»
   * según la fuente, y nadie podía saber cuál estaba viendo.
   */
  it("el avance del motor conserva su decimal", () => {
    const [f] = perfilDesdeElMotor([
      { facultad: "Derecho", aulas: 10, respuestas_validas: 130, meta: 662, brecha: 532 },
    ] as never[]).facultades;
    // 130 de 662 es 19,6 %, no 20 %.
    expect(f!.avance).toBe(19.6);
  });

  it("y una meta cero no lo manda a NaN", () => {
    const [f] = perfilDesdeElMotor([
      { facultad: "Derecho", aulas: 1, respuestas_validas: 0, meta: 0, brecha: 0 },
    ] as never[]).facultades;
    expect(f!.avance).toBe(0);
  });
});

describe("el panel dice contra qué está midiendo", () => {
  /**
   * **En este perfil «meta» y «cuota» son cosas distintas.**
   *
   * La meta es por curso-horario —`expected_valid`, y suma 3.227 en el
   * estudio—; la cuota es por facultad y sexo, y suma 2.500. El panel usa una
   * vara u otra según le llegue el resumen del motor, y decía «con su meta
   * cumplida» en los dos casos, justo debajo de un subtítulo que afirma «contra
   * la cuota del estudio».
   *
   * Cuál manda está comprobado en las dos puntas: el bloque del motor se titula
   * «Avance por facultad y sexo contra la cuota del diseño»
   * (`carga_aulas_libro_avance_facultad.R`) y sale de `design_targets`; y en
   * pantalla, Ciencias Sociales da 63.1 % y faltan 55 tanto aquí como en la
   * pestaña de Cuotas, que mide contra la cuota.
   */
  const conMotor = () => renderToStaticMarkup(
    <AulasPerfilPorFacultad
      filas={[] as unknown as MonitoreoAulasPlanRow[]}
      resumen={[{ faculty: "DERECHO", aulas: 18, meta: 664, brecha: 0 }]}
    />,
  );

  const sinMotor = () => renderToStaticMarkup(
    <AulasPerfilPorFacultad
      filas={[
        { faculty: "DERECHO", expected_valid: 10, respuestas_validas: 10 },
      ] as unknown as MonitoreoAulasPlanRow[]}
      resumen={[]}
    />,
  );

  it("con el bloque del motor habla de la cuota", () => {
    const html = conMotor();
    expect(html).toContain("cuota cumplida");
    expect(html).not.toContain("meta cumplida");
  });

  it("con el cálculo local habla de la meta del plan, que es otro denominador", () => {
    // El control que distingue: si el componente dijera siempre «cuota», la
    // aserción de arriba pasaría sin probar que la palabra sigue a la vara.
    const html = sinMotor();
    expect(html).toContain("meta cumplida");
    expect(html).not.toContain("cuota cumplida");
  });
});
