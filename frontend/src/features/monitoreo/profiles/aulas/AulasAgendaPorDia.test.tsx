import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { AulasAgendaPorDia } from "./AulasAgendaPorDia";

/**
 * Las dos cifras de la fila del día se leían como un solo número.
 *
 * El total del día y los que no empezaron iban pegados en el texto —«19» y
 * «3» daban «193 sin empezar»—; a la vista los separaba el `gap` del flex,
 * pero el texto no, así que un lector de pantalla anunciaba un número de tres
 * dígitos que no existe.
 *
 * Este guard mira el TEXTO, no el CSS, que es justo la diferencia: un intento
 * previo lo arregló con `::before` y la vista quedó bien mientras el texto
 * seguía roto. Con el separador decorativo, este aserto sigue rojo.
 */

function aula(fecha: string, estado: string): MonitoreoAulasPlanRow {
  return {
    operational_code: `CH ${fecha}-${estado}-${Math.random()}`,
    scheduled_date: fecha,
    application_state: estado,
  } as unknown as MonitoreoAulasPlanRow;
}

/** El texto que ve un lector de pantalla: sin etiquetas y con los espacios normalizados. */
function texto(html: string) {
  return html.replace(/<[^>]+>/g, "").replace(/&middot;|&#xB7;/g, "·").replace(/\s+/g, " ");
}

describe("AulasAgendaPorDia", () => {
  const html = renderToStaticMarkup(
    <AulasAgendaPorDia
      filas={[
        aula("2026-08-10", "lista"),
        aula("2026-08-10", "lista"),
        aula("2026-08-10", "agendada"),
      ]}
    />,
  );
  const plano = texto(html);

  it("separa el total del día de los que no han empezado", () => {
    // Se ata a la FORMA y no a las cifras: cuántos cuentan como empezados lo
    // decide `agendaPorDia`, y ese reparto ya tiene sus propias pruebas. Lo
    // que este guard defiende es que las dos cifras nunca se peguen.
    expect(plano).toMatch(/\b\d+ · \d+ sin empezar\b/);
    // El aserto que mata al separador decorativo: con un `::before` el texto
    // quedaría «32 sin empezar», dos cifras convertidas en un número que no
    // existe, y la primera línea seguiría pasando porque mira el CSS.
    expect(plano).not.toMatch(/\b\d{2,} sin empezar\b/);
  });

  it("el separador está en el texto, no sólo en la vista", () => {
    // `renderToStaticMarkup` no aplica CSS: si el punto viviera en un
    // `::before`, aquí no habría ninguno.
    expect(plano).toContain(" · ");
  });
});

/**
 * La franja se pliega, y plegada sigue diciendo lo que resume.
 *
 * En pantalla corta el panel baja a 180 px y no caben los diez días y una tabla
 * usable: la tabla se quedaba en tres filas de 236 cursos-horario. El contrato
 * reconoce el `details` cerrado —lo que cuelga de él no es contenido
 * inalcanzable, porque se abre— pero el `summary` tiene que seguir diciendo
 * algo, o cerrar equivale a perder.
 */
describe("AulasAgendaPorDia plegable", () => {
  it("el resumen conserva los días de campo y el rango", () => {
    const html = renderToStaticMarkup(
      <AulasAgendaPorDia
        filas={[aula("2026-08-10", "lista"), aula("2026-08-11", "agendada")] as never}
      />,
    );
    const plano = texto(html);

    expect(html).toContain("<details");
    expect(html).toContain("<summary");
    // Lo que se lee con la franja cerrada.
    expect(plano).toMatch(/\d+ días de campo/);
    expect(plano).toContain("de Lunes 10/08 a Martes 11/08");
  });
});
