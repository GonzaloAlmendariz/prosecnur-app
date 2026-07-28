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

  it("la topología es una decisión deliberada de Plan, no del toolbar", () => {
    expect(source).not.toContain("pulso-multibase-toggle is-compact");
    expect(source).not.toContain("<MultiBaseToggle");
    expect(source).not.toContain("function MultiBaseToggle(");

    const planBranches = source.split('activeCargaTab === "plan"').slice(1);
    expect(planBranches).toHaveLength(2);
    for (const branch of planBranches) {
      expect(branch).toContain("<CargaPlanOverview");
      expect(branch).toMatch(/<CargaPlanOverview[\s\S]{0,500}?topology=/u);
      expect(branch).toMatch(/<CargaTopologyDecision[\s\S]{0,500}?resolution=/u);
    }

    expect(source.match(/<CargaTopologyDecision\b/gu)).toHaveLength(2);
  });

  it("declara las hermanas sugeridas por Acreditación sin materializarlas desde Plan", () => {
    const resolverStart = source.indexOf(
      "const topologyResolution = resolveCargaTopology({",
    );
    const resolverEnd = source.indexOf("});", resolverStart);
    const wiring = source.slice(Math.max(0, resolverStart - 1_600), resolverEnd + 3);

    expect(resolverStart).toBeGreaterThan(-1);
    expect(wiring).toContain("declaredStrategy:");
    expect(wiring).toContain("processing_intake_mode");
    expect(wiring).toContain("independent_siblings");
    expect(wiring).not.toContain("apiEstudioProcessingSuggestions");
    expect(wiring).toContain('"independent"');
  });
});
