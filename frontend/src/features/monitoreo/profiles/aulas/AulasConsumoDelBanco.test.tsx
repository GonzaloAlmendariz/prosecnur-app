import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AulasConsumoDelBanco } from "./AulasConsumoDelBanco";
import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";

/**
 * **El panel del consumo de la reserva, y su rótulo siguiendo al eje.**
 *
 * Con CCSS —una sola facultad, cuota por nivel— este panel se reducía a UNA
 * fila, «CIENCIAS SOCIALES», bajo un subtítulo que decía «por facultad». Hoy no
 * se veía roto porque hay 0 reemplazadas; se vería en cuanto caiga la primera
 * aula. Visto en pantalla el 2026-09-17.
 *
 * La derivación se prueba en `consumoDelBanco.test.ts`; aquí se prueba lo que
 * SÓLO se ve en el markup: la palabra.
 */

const fila = (f: Partial<MonitoreoAulasPlanRow>) => f as MonitoreoAulasPlanRow;

const NIVEL = {
  clave: "nivel", etiqueta: "Nivel", etiqueta_plural: "Niveles",
  etiqueta_sin: "Sin nivel", columna: "level", atribucion: "persona",
};

const PLAN = [
  fila({ operational_code: "CH 1", faculty: "CIENCIAS SOCIALES", level: "6",
    titular_operational_code: "CH 1", sample_status: "reemplazada",
    replaced_at: "2026-09-15" } as Partial<MonitoreoAulasPlanRow>),
  fila({ operational_code: "CH 2", faculty: "CIENCIAS SOCIALES", level: "7",
    titular_operational_code: "CH 2", sample_status: "reemplazada",
    replaced_at: "2026-09-16" } as Partial<MonitoreoAulasPlanRow>),
  fila({ operational_code: "R 1.1", faculty: "CIENCIAS SOCIALES", level: "6",
    sample_role: "chain_reserve", titular_operational_code: "CH 1",
    sample_status: "en_reserva" }),
];

describe("AulasConsumoDelBanco", () => {
  it("con el eje en nivel, la columna y las filas son del nivel", () => {
    const html = renderToStaticMarkup(
      <AulasConsumoDelBanco filas={PLAN} diasDeCampo={2} eje={NIVEL} />,
    );
    expect(html).toContain('aria-label="Consumo de la reserva por nivel"');
    expect(html).toContain(">Nivel<");
    expect(html).toContain("Nivel 6");
    expect(html).toContain("Nivel 7");
    expect(html).not.toContain("CIENCIAS SOCIALES");
  });

  it("y «sin reserva disponible» se dice con la palabra del eje", () => {
    // Decía «facultades sin reserva disponible» en un estudio por nivel. CH 2
    // no tiene reserva detrás, así que su grupo sale seco.
    const html = renderToStaticMarkup(
      <AulasConsumoDelBanco filas={PLAN} diasDeCampo={2} eje={NIVEL} />,
    );
    expect(html).toContain("nivel sin reserva disponible");
    expect(html).not.toContain("facultad sin reserva disponible");
  });

  /**
   * **PRUEBA DE LA PALABRA DOBLE.** El nivel de un curso-horario es el de la
   * mayoría de sus alumnos; el de una meta, el de cada persona resuelta contra
   * el padrón. Sin decirlo, «Nivel 7: 1 reemplazado» y «Nivel 7: faltan 103
   * personas» parecen dos cifras del mismo grupo y son de dos poblaciones.
   */
  it("dice que el valor es del curso-horario cuando el eje es de la PERSONA", () => {
    const html = renderToStaticMarkup(
      <AulasConsumoDelBanco filas={PLAN} diasDeCampo={2} eje={NIVEL} />,
    );
    expect(html).toContain("es el de la mayoría de sus alumnos");
    // Y NO lo dice con el eje en facultad: ahí el valor del aula y el de la
    // meta son la misma dimensión (ADR 0081), así que la aclaración sobraría.
    const porFacultad = renderToStaticMarkup(
      <AulasConsumoDelBanco filas={PLAN} diasDeCampo={2} />,
    );
    expect(porFacultad).not.toContain("es el de la mayoría de sus alumnos");
  });

  it("sin eje declarado el panel no cambia un byte", () => {
    // HSVG está en campo. Es la misma vara que en la derivación.
    const html = renderToStaticMarkup(
      <AulasConsumoDelBanco filas={PLAN} diasDeCampo={2} />,
    );
    expect(html).toContain('aria-label="Consumo de la reserva por facultad"');
    expect(html).toContain(">Facultad<");
    expect(html).toContain("CIENCIAS SOCIALES");
    // Con el plan agrupado por facultad los dos caídos caen en el MISMO grupo,
    // que sí tiene una reserva libre: no hay grupo seco, así que la cláusula no
    // aparece — y es correcto. Para verla con la palabra de facultad hace falta
    // un grupo sin ninguna reserva detrás.
    const seca = renderToStaticMarkup(
      <AulasConsumoDelBanco diasDeCampo={2} filas={[PLAN[0], PLAN[1]]} />,
    );
    expect(seca).toContain("facultad sin reserva disponible");
  });

  it("el vacío no lo toca el eje: sin reemplazos sigue siendo una buena noticia", () => {
    const sinCaidas = [fila({ operational_code: "CH 1", faculty: "CIENCIAS SOCIALES",
      level: "6", titular_operational_code: "CH 1", sample_status: "en_juego" })];
    const html = renderToStaticMarkup(
      <AulasConsumoDelBanco filas={sinCaidas} diasDeCampo={2} eje={NIVEL} />,
    );
    expect(html).toContain("Ningún curso-horario ha sido reemplazado todavía");
  });
});
