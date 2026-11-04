import { renderToStaticMarkup } from "react-dom/server";
import { Calculator } from "lucide-react";
import { describe, expect, it } from "vitest";

import { AulasStageNotice } from "../aulasSurfaceState";
import { promesaDeLaPestana, recorridoDeLaCausa } from "../recorridoEtapa";

describe("recorrido de Selección en el aviso de etapa", () => {
  it("la causa marca su paso: lo anterior hecho, ella falta y lo demás espera", () => {
    expect(recorridoDeLaCausa("missing-objective").map((p) => p.estado))
      .toEqual(["hecho", "falta", "espera", "espera", "espera"]);
    expect(recorridoDeLaCausa("missing-frame")[0].estado).toBe("falta");
    expect(recorridoDeLaCausa("missing-replacements").map((p) => p.estado))
      .toEqual(["hecho", "hecho", "hecho", "hecho", "falta"]);
  });

  it("la selección guardada sin objetivo cae en Cálculo, igual que el objetivo que falta", () => {
    expect(recorridoDeLaCausa("stored-unaccredited")).toEqual(recorridoDeLaCausa("missing-objective"));
  });

  it("toda pestaña con aviso dice qué se verá en ella", () => {
    for (const etapa of ["objetivo", "metodo", "laboratorio", "seleccion", "relato", "reemplazos", "auditoria", "salidas-monitoreo"] as const) {
      expect(promesaDeLaPestana(etapa), etapa).toMatch(/\.$/);
    }
    expect(promesaDeLaPestana(undefined)).toBeNull();
  });

  it("el aviso pinta el recorrido, la referencia aparte y la promesa", () => {
    const html = renderToStaticMarkup(
      <AulasStageNotice
        notice={{
          kind: "stored-unaccredited",
          icon: Calculator,
          eyebrow: "Cálculo",
          title: "La selección existe; falta acreditar el objetivo",
          detail: "Hay una selección guardada (30 titulares).",
          actionLabel: "Ir a Cálculo",
          destination: { section: "calculo", tab: "calculo-propuestas" },
          etapa: "laboratorio",
          referencia: "Corrida guardada sel_x",
        }}
        onNavigate={() => undefined}
      />,
    );
    expect(html).toContain('aria-label="Recorrido de la selección"');
    expect(html).toContain('aria-current="step"');
    expect(html.match(/data-estado="hecho"/g)).toHaveLength(1);
    expect(html).toContain("Corrida guardada sel_x");
    expect(html).toContain("Cuando esté listo, aquí verás");
    expect(html).not.toContain("·");
  });
});
