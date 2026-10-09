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
    // **El guard cambió de sitio, no de intención.**
    //
    // Defendía que las dos cifras nunca se peguen —«3» y «2» leídos como
    // «32»— y lo hacía exigiendo un punto medio en el texto. El punto se
    // retiró: separaba a la vista y nada más, porque la separación real la
    // hace ahora la rejilla de dos columnas. Lo que un lector de pantalla
    // anuncia es el `aria-label` de la fila, y ES AHÍ donde las cifras no
    // pueden pegarse.
    //
    // Mirar el `textContent` plano habría sido medir lo que ya no se lee:
    // los dos spans llevan `aria-hidden`, así que su concatenación no la
    // pronuncia nadie.
    const etiquetas = [...html.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]);
    expect(etiquetas.length).toBeGreaterThan(0);
    const conSinEmpezar = etiquetas.filter((e) => e.includes("sin empezar"));
    expect(conSinEmpezar.length).toBeGreaterThan(0);
    for (const e of conSinEmpezar) {
      // La forma: «N cursos-horario, M sin empezar». Las dos cifras separadas
      // por palabras, que es lo que impide que se lean como una sola.
      expect(e).toMatch(/^\d+ cursos?-horario, \d+ sin empezar$/);
    }
    // El aserto que mata al separador decorativo, ahora sobre lo que se
    // pronuncia: si las cifras volvieran a pegarse saldría «32 sin empezar»,
    // un número que no existe, y el de arriba seguiría pasando.
    for (const e of etiquetas) expect(e).not.toMatch(/\b\d{2,} sin empezar\b/);
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
