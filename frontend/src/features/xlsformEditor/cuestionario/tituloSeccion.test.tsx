// Las secciones sin título legible se marcan y se titulan ahí mismo; las que tienen título no se tocan.
// Mata: inventar un título, o marcar como técnico uno legible que empieza con «Página».
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { tituloTecnico } from "./modeloCuestionario";
import { TituloSeccion } from "../shell/TituloSeccion";

describe("título de sección", () => {
  it("reconoce los rótulos que no le dicen nada a quien lee", () => {
    expect(tituloTecnico("Pag1 (p1)", "Pag1")).toBe(true);
    expect(tituloTecnico("Pag2 (p2-p7)", "Pag2")).toBe(true);
    expect(tituloTecnico("Página 3", "g3")).toBe(true);
    expect(tituloTecnico("", "bloque_a")).toBe(true);
    expect(tituloTecnico("bloque_a", "bloque_a")).toBe(true);
  });

  it("respeta los títulos legibles", () => {
    expect(tituloTecnico("Datos del hogar", "hogar")).toBe(false);
    expect(tituloTecnico("Páginas web que visita", "web")).toBe(false);
    expect(tituloTecnico("**Sección A**: Empleo", "a")).toBe(false);
  });

  it("muestra el rótulo técnico atenuado con la acción, sin inventar otro", () => {
    const html = renderToStaticMarkup(<TituloSeccion rotulo="Pag1 (p1)" onTitular={() => {}} />);
    expect(html).toContain("Pag1 (p1)");
    expect(html).toContain("Ponerle título");
  });
});
