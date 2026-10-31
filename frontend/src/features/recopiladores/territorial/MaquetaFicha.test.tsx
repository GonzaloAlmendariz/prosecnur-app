import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { UnidadTerritorial } from "../../../api/materialTerritorial";
import { MaquetaFicha } from "./MaquetaFicha";

const unidad = (role: "titular" | "reemplazo"): UnidadTerritorial => ({
  unit_id: "150117032000320", label: role === "titular" ? "UMP 71" : "R 71", role, titular_id: role === "reemplazo" ? "x" : null,
  distrito: "LOS OLIVOS", ubigeo: "150117", zona: "03200", manzana: "0320", rango_inicio: 561, rango_fin: 568, viviendas: 0,
});

describe("MaquetaFicha", () => {
  it("muestra la estructura de la ficha con los datos de la UMP, sin pedir nada al servidor", () => {
    const html = renderToStaticMarkup(<MaquetaFicha unidad={unidad("titular")} />);
    for (const t of ["Ficha de trabajo de campo", "UMP 71", "Encuestas 561 a 568", "LOS OLIVOS · Zona 03200 · Manzana 0320", "A. Datos generales", "B. Cuota de la hoja", "C. Selección de hogares", "Procedimiento ante la no respuesta", "Cara 2", "Mapa de la manzana"]) {
      expect(html).toContain(t);
    }
    expect(html).not.toContain("<img");
  });
  it("una de reemplazo se titula como tal", () => {
    expect(renderToStaticMarkup(<MaquetaFicha unidad={unidad("reemplazo")} />)).toContain("Ficha de reemplazo");
  });
});
