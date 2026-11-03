// Mata: la tarjeta que edita la regla desde Analítica, que cuelga el QA fuera de la carga o que esconde el código del 422.
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { normalizeDiferenciasReglaRespuesta } from "../../../api/graficosDiferencias";
import { CrucesReglaEstudioVista } from "./CrucesReglaEstudio";

const pintar = (lectura: Parameters<typeof CrucesReglaEstudioVista>[0]["lectura"]) =>
  renderToStaticMarkup(<MemoryRouter><CrucesReglaEstudioVista lectura={lectura} /></MemoryRouter>);

describe("tarjeta de la regla del estudio en Cruces", () => {
  it("lista: resume la regla, dice su origen y sólo ofrece ir a cambiarla", () => {
    const datos = normalizeDiferenciasReglaRespuesta({
      regla: { prueba: "rao_scott", correccion: "bh_informe", conglomerado: "seccion", alfa: 0.05 },
      origen: "estudio",
      columnas: [{ name: "seccion", n_valores: 20 }],
    });
    const html = pintar({ estado: "listo", datos });
    expect(html).toContain('data-audit-ready="analitica-regla-estudio"');
    expect(html).toContain("Rao-Scott por seccion");
    expect(html).toContain("Del estudio");
    expect(html).toContain("Cambiar la regla del estudio");
    expect(html).toContain("La misma regla gobierna las láminas, el Word y estas tablas.");
    expect(html).not.toMatch(/<select|<input/);
  });
  it("cargando: la única marca en false", () => {
    expect(pintar({ estado: "cargando" })).toContain('data-audit-ready="false"');
  });
  it("422: el texto y el código, y la marca terminal", () => {
    const html = pintar({ estado: "error", code: "E_SIG_ESTRATO_NO_ANIDADO", texto: "El estrato no es constante dentro de cada conglomerado." });
    expect(html).toContain("E_SIG_ESTRATO_NO_ANIDADO");
    expect(html).toContain("El estrato no es constante");
    expect(html).toContain('data-audit-ready="analitica-regla-estudio"');
  });
});
