// Dos «Corte» distintos en la misma pantalla.
//
// El chrome miraba el sello del ESTADO —cuándo se sincronizaron los datos— y la
// tarjeta de Fuentes el del TABLERO —contra qué día se mide el atraso—. Son dos
// cosas distintas y las dos se llamaban «Corte»: con un proyecto recién
// importado, arriba decía «Snapshot» y abajo «23/8/2026».
//
// Este indicador pasa a llamarse «Sincronizado», que es lo que mide. «Corte» se
// queda para el sello del tablero, donde esa palabra significa algo.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MonitoreoModuleChrome } from "./MonitoreoModuleChrome";
import { MONITOREO_MODOS } from "../core/monitoreoRegistry";

const ruta = MONITOREO_MODOS.find((m) => m.family === "aulas_universitarias")!;

const render = (props: Record<string, unknown>) =>
  renderToStaticMarkup(
    <MonitoreoModuleChrome
      routes={[ruta]}
      route={ruta}
      routeSelected
      seccionActiva="fuentes"
      sourceTotal={1}
      activeSources={1}
      nRows={0}
      hasSnapshot
      saving={false}
      syncedAt=""
      onCambioSeccion={() => {}}
      {...props}
    />,
  );

describe("el indicador dice qué mide y cuándo", () => {
  it("se llama «Sincronizado», no «Corte»", () => {
    // «Corte» es el sello del tablero, que vive en Fuentes con otra fecha.
    const html = render({ generatedAt: "2026-08-23T10:00:00Z" });
    expect(html).toContain("Sincronizado");
    expect(html).not.toContain(">Corte<");
  });

  it("enseña la fecha cuando la hay, no el nombre técnico del origen", () => {
    const html = render({ generatedAt: "2026-08-23T10:00:00Z" });
    expect(html).toContain("23/8/2026");
    expect(html).not.toContain("Snapshot");
  });

  it("el origen baja al detalle", () => {
    const html = render({ generatedAt: "2026-08-23T10:00:00Z" });
    expect(html).toContain("sin sincronizar");
  });

  it("sin fecha lo dice en castellano, no con jerga", () => {
    // «Snapshot» era el nombre interno del origen del dato.
    const html = render({ generatedAt: "" });
    expect(html).toContain("Del proyecto");
    expect(html).not.toContain("Snapshot");
  });

  it("una fecha ilegible no produce «Invalid Date»", () => {
    const html = render({ generatedAt: "cualquier-cosa" });
    expect(html).not.toContain("Invalid");
  });
});
