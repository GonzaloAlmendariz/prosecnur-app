import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AulasCursosDeUnTramo } from "./AulasCursosDeUnTramo";
import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";

/**
 * **La barra decía 19 y la lista abría con 1.**
 *
 * Medido en pantalla el 2026-09-10 con Derecho en el selector: se hace clic en
 * «Llegó a lo esperado — 19» y el desglose se titula «1 curso-horario en "Llegó
 * a lo esperado"». Las dos cifras son correctas y juntas se leen como una
 * contradicción: la barra sale del bloque del motor, que cuenta el plan entero
 * de la facultad, y la lista se arma con `course_status`, que viaja recortado a
 * 500 filas de 1 392.
 *
 * El pie ya advertía del recorte en abstracto. Un aviso que no dice el número
 * no le sirve a quien está mirando dos números distintos.
 */
const fila = (codigo: string): MonitoreoAulasPlanRow => ({
  application_state: "cerrando",
  operational_code: codigo,
  faculty: "DERECHO",
  expected_valid: 20,
  respuestas_validas: 20,
  eligible_n: 40,
  observed_students: 30,
} as unknown as MonitoreoAulasPlanRow);

describe("el desglose de un tramo cuando el recorte se queda corto", () => {
  it("dice cuántos de los que cuenta la barra puede listar", () => {
    const html = renderToStaticMarkup(
      <AulasCursosDeUnTramo
        filas={[fila("CH 84")]} tramo="pleno" etiqueta="Llegó a lo esperado"
        enElTramo={19} onCerrar={() => {}}
      />,
    );
    expect(html).toContain("de los 19");
    expect(html).toContain("no viajan");
  });

  it("sin diferencia no añade ruido", () => {
    const html = renderToStaticMarkup(
      <AulasCursosDeUnTramo
        filas={[fila("CH 84")]} tramo="pleno" etiqueta="Llegó a lo esperado"
        enElTramo={1} onCerrar={() => {}}
      />,
    );
    // «de los N» es la marca del recorte; el pie fijo dice «de los
    // cursos-horario aplicados» y ése no cuenta.
    expect(html).not.toMatch(/de los \d/);
    expect(html).not.toContain("no viajan");
  });

  it("sin cifra del motor se comporta como antes", () => {
    const html = renderToStaticMarkup(
      <AulasCursosDeUnTramo
        filas={[fila("CH 84")]} tramo="pleno" etiqueta="Llegó a lo esperado"
        onCerrar={() => {}}
      />,
    );
    expect(html).toContain("curso-horario");
    expect(html).not.toMatch(/de los \d/);
    expect(html).not.toContain("no viajan");
  });
});
