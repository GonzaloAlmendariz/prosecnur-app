import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const leer = (rel: string) => fs.readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const source = leer("./CargaPage.tsx");
const pestanaBases = leer("./pestanas/PestanaBases.tsx");
const modelo = leer("./pestanas/useModeloCarga.ts");

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

  it("la topología es una decisión deliberada de Bases, no del toolbar", () => {
    expect(source).not.toContain("pulso-multibase-toggle is-compact");
    expect(source).not.toContain("<MultiBaseToggle");
    expect(source).not.toContain("function MultiBaseToggle(");

    // ADR 0142: una sola pestaña Bases para las dos organizaciones (una base y
    // varias), con la decisión que vivía en Plan.
    expect(source.split('activeCargaTab === "bases"')).toHaveLength(2);
    expect(source).toContain("<PestanaBases");
    expect(pestanaBases).toMatch(/<CargaTopologyDecision[\s\S]{0,500}?resolution=/u);
    expect(pestanaBases.match(/<CargaTopologyDecision\b/gu)).toHaveLength(1);
    expect(source.match(/<CargaTopologyDecision\b/gu) ?? []).toHaveLength(0);
  });

  it("declara las hermanas sugeridas por Acreditación sin materializarlas desde Bases", () => {
    const resolverStart = modelo.indexOf(
      "const topologyResolution = resolveCargaTopology({",
    );
    const resolverEnd = modelo.indexOf("});", resolverStart);
    const wiring = modelo.slice(Math.max(0, resolverStart - 1_600), resolverEnd + 3);

    expect(resolverStart).toBeGreaterThan(-1);
    expect(wiring).toContain("declaredStrategy:");
    expect(wiring).toContain("processing_intake_mode");
    expect(wiring).toContain("independent_siblings");
    expect(wiring).not.toContain("apiEstudioProcessingSuggestions");
    expect(wiring).toContain('"independent"');
  });
});
