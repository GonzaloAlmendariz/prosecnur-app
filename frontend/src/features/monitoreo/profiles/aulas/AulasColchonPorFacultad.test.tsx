import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AulasColchonPorFacultad } from "./AulasColchonPorFacultad";
import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";

/**
 * **Dónde se queda sin reservas el operativo**, y por qué columna se pregunta.
 *
 * El panel contesta «dónde se rompe la reserva», así que agruparlo por una
 * columna que en un estudio vale lo mismo en todas las filas lo deja con UNA
 * línea y sin nada que contestar. Es la misma generalización que se hizo en su
 * hermano «Consumo de la reserva» (`0b5d1c2f`), y responde a la vara de Gonzalo
 * del 2026-09-18: «una particularidad es eso; la app debe ser útil para
 * cualquier estudio, y por eso la importancia de que sea generalista y de
 * configuración».
 */

const fila = (f: Partial<MonitoreoAulasPlanRow>) => f as MonitoreoAulasPlanRow;

const NIVEL = {
  clave: "nivel", etiqueta: "Nivel", etiqueta_plural: "Niveles",
  etiqueta_sin: "Sin nivel", columna: "level", atribucion: "persona",
};

/** Una facultad, dos niveles: el caso degenerado de CCSS. */
const PLAN = [
  fila({ operational_code: "CH 1", faculty: "CIENCIAS SOCIALES", level: "6",
    titular_operational_code: "CH 1", sample_status: "en_juego" }),
  fila({ operational_code: "R 1.1", faculty: "CIENCIAS SOCIALES", level: "6",
    sample_role: "chain_reserve", titular_operational_code: "CH 1",
    sample_status: "en_reserva" }),
  fila({ operational_code: "CH 2", faculty: "CIENCIAS SOCIALES", level: "7",
    titular_operational_code: "CH 2", sample_status: "en_juego" }),
];

describe("AulasColchonPorFacultad", () => {
  it("con el eje en nivel agrupa por nivel, y lo dice con su palabra", () => {
    const html = renderToStaticMarkup(
      <AulasColchonPorFacultad filas={PLAN} eje={NIVEL} />,
    );
    expect(html).toContain('aria-label="Reservas por nivel"');
    expect(html).toContain(">Nivel<");
    // Dos líneas, que es lo que el panel promete: dónde se rompe.
    expect(html).toContain("Nivel 6");
    expect(html).toContain("Nivel 7");
    expect(html).not.toContain("CIENCIAS SOCIALES");
  });

  it("sin eje declarado no cambia un byte", () => {
    // HSVG está en campo con 15 facultades: su panel dice lo mismo que ayer.
    const html = renderToStaticMarkup(<AulasColchonPorFacultad filas={PLAN} />);
    expect(html).toContain('aria-label="Reservas por facultad"');
    expect(html).toContain(">Facultad<");
    expect(html).toContain("CIENCIAS SOCIALES");
  });

  it("el vacío también sigue al eje, en vez de nombrar una columna ajena", () => {
    // «El plan todavía no reparte cursos-horario por facultad» sobre un estudio
    // que no mide por facultad manda a mirar la columna equivocada.
    const html = renderToStaticMarkup(
      <AulasColchonPorFacultad filas={[]} eje={NIVEL} />,
    );
    expect(html).toContain("por nivel");
    expect(html).not.toContain("por facultad");
  });
});
