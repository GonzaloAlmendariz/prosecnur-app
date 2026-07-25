import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  fileURLToPath(new URL("./CargaPage.tsx", import.meta.url)),
  "utf8",
);

/**
 * El medidor de preparación ya no existe.
 *
 * Este test cuidaba que viviera en UN solo lugar —el resumen persistente de la
 * toolbar— porque antes estaba duplicado entre la banda y el cuerpo. El dueño
 * decidió después retirarlo por completo de la banda: sus tres pasos repetían lo
 * que el rail de secciones ya marca como completado, y costaban 352px del lado
 * izquierdo contra 168 del derecho.
 *
 * Lo que se cuida ahora es lo mismo en espíritu: que no vuelva por la puerta de
 * atrás, ni en la banda ni en el cuerpo. Si alguna vez se quiere reponer, hay que
 * borrar este test a conciencia y no de pasada.
 */
describe("medidor de preparación de Carga", () => {
  it("no vuelve a aparecer, ni en la banda ni en el cuerpo", () => {
    expect(source).not.toContain("<CargaProgressMeter");
    expect(source).not.toContain("function CargaProgressMeter(");
    expect(source).not.toContain("<CargaCommandSummary");
  });

  it("la banda lleva el modo del estudio en su lugar", () => {
    // El espacio que ocupaba el medidor lo usa un control que sí se opera. Si
    // esto falla, la banda quedó con el lado izquierdo vacío.
    const portal = source.slice(
      source.indexOf('<ChromeSlotPortal zona="contexto">'),
      source.indexOf("</ChromeSlotPortal>"),
    );
    expect(portal).toContain("<MultiBaseToggle");
    expect(portal).toContain("compact");
  });
});
