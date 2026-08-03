import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CriteriosEmbudoVivo } from "../CriteriosEmbudoVivo";

/**
 * La etiqueta de un paso no puede contradecir su propia fila.
 *
 * Medido en la app: el Paso 6 mostraba «recorta el marco» junto a «849 → 849 ·
 * quedan fuera: ninguno». El origen fue traducir `status === "aplicado"` por
 * «recorta el marco», cuando «aplicado» sólo significa que el criterio se
 * ejecutó —puede no haber quitado nada—.
 *
 * Una etiqueta que contradice la cifra de al lado es **peor que la jerga que
 * vino a reemplazar**: «gate · aplicado» era opaco, pero no afirmaba nada falso.
 */
function cascada(excluidos: number) {
  return {
    momento: "marco_ejecutado",
    criteria_hash: "abc123def456",
    steps: [
      {
        order: 6,
        card_id: "modality",
        label: "Modalidad",
        gate: true,
        status: "aplicado",
        applies: true,
        total: { ch_antes: 849, ch_despues: 849 - excluidos, excluded_ch: excluidos },
        faculties: [],
      },
    ],
  } as never;
}

describe("CriteriosEmbudoVivo · coherencia entre etiqueta y cifra", () => {
  it("un criterio aplicado que no quitó nada no dice que recorta", () => {
    const html = renderToStaticMarkup(
      <CriteriosEmbudoVivo cardId="modality" executed={cascada(0)} previewRequest={null} />,
    );
    expect(html).toContain("se aplicó y no quitó ninguno");
    expect(html).not.toContain("recorta el marco");
  });

  it("un criterio que sí quitó cursos-horario lo dice", () => {
    const html = renderToStaticMarkup(
      <CriteriosEmbudoVivo cardId="modality" executed={cascada(182)} previewRequest={null} />,
    );
    expect(html).toContain("recorta el marco");
  });
});
