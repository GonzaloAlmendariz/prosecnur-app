import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AulasSeccionCalidad } from "./AulasSeccionCalidad";
import type { MonitoreoAulasDashboard } from "../../../../api/monitoreo";

/**
 * La sección de Validación se abre en «Base de control», y esa base sale de los
 * partes de campo: **el día 1 de cualquier estudio está vacía**.
 *
 * Estaba pintando la tabla con sus cabeceras y cero filas bajo un pie de dos
 * palabras —«Sin datos»—, mientras su panel hermano de más abajo comprobaba
 * `control.length` y desaparecía entero. Dos tratamientos del mismo vacío en la
 * misma sección, y ninguno decía qué falta.
 *
 * El motor ya separa las dos causas: `libro` llega `NULL` cuando el estudio
 * nunca importó uno, «que es distinto de un libro sin hojas» —su comentario—.
 * Ese campo existía en el payload y sólo lo leía la sección de Fuentes.
 */
const pintar = (dashboard: Partial<MonitoreoAulasDashboard>) =>
  renderToStaticMarkup(
    <AulasSeccionCalidad
      dashboard={{ control_calidad: [], ...dashboard } as MonitoreoAulasDashboard}
      criterioDeAula={null}
      facultadEnFoco={undefined}
      foco={{ tipo: "ninguno" } as never}
      irAPestana={null}
      onDeclararUmbralDeDuracion={null}
      onFoco={() => {}}
      pestana="base"
      registro={null}
    />,
  );

describe("la base de control vacía dice cuál de las dos causas es", () => {
  it("sin libro importado acusa al libro que falta, no a la hoja", () => {
    const html = pintar({ libro: null } as never);
    expect(html).toContain("no ha importado el libro del operativo");
    expect(html).toContain("Libro sin importar");
    // La causa contraria no aparece: si dijera las dos, no diría ninguna.
    expect(html).not.toContain("todavía no trae ninguna fila");
  });

  it("con libro importado acusa a la hoja sin filas, no al libro", () => {
    const html = pintar({ libro: { importado_en: "2026-08-22T10:00:00Z", hojas: [], hojas_ausentes: 0, control_sin_nombre: 0 } } as never);
    expect(html).toContain("todavía no trae ninguna fila");
    expect(html).toContain("Hoja de control sin filas");
    expect(html).not.toContain("no ha importado el libro del operativo");
  });

  it("«Sin datos» ya no es la respuesta: era el pie que no decía nada", () => {
    expect(pintar({ libro: null } as never)).not.toContain(">Sin datos<");
  });
});
