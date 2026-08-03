import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CriterioSeleccion, CriterioVariable } from "../../../../../api/client";
import type { AporteCategoria } from "../controles";
import { FacultadCategoriaToggles } from "../FacultadCategoriaToggles";
import type { FilaFacultad } from "../tipoSesionModel";

/**
 * F109 · Qué categorías llegas a ver.
 *
 * El plegado usaba `ch > 0 || activo`, y `ch` cuenta sólo los CH que **siguen
 * incluidos**. Una categoría que el criterio excluye tiene `ch = 0` y el
 * conmutador apagado: se plegaba, y el botón la contaba como «sin cursos en esta
 * facultad» teniéndolos. Es la confusión que F105 reparó dentro de la tarjeta,
 * gobernando aquí qué tarjetas existen.
 */
const variable = {
  id: "condicion_curso",
  label: "Condición del curso",
  kind: "flat",
  categories: [],
} as unknown as CriterioVariable;

/** Diez categorías: dos con cursos incluidos, una excluida, siete ausentes. */
function fila(): FilaFacultad {
  const tipos = [
    { key: "regular", label: "Regular", ch: 120, elegibles: 3000, activo: true },
    { key: "repitencia", label: "Repitencia", ch: 40, elegibles: 800, activo: true },
    { key: "dirigido", label: "Dirigido", ch: 0, elegibles: 0, activo: false },
    ...Array.from({ length: 7 }, (_, i) => ({
      key: `ruido${i}`,
      label: `Ruido DTI ${i}`,
      ch: 0,
      elegibles: 0,
      activo: false,
    })),
  ];
  return { facKey: "derecho", facLabel: "Derecho", decision: "heredada", tipos } as unknown as FilaFacultad;
}

/** «Dirigido» tiene 18 CH en esta facultad, todos fuera por el criterio. */
const evidencia = (key: string): AporteCategoria | null => {
  if (key === "regular") return { ch: 120, chContraste: 130, elegibles: 3000 } as AporteCategoria;
  if (key === "repitencia") return { ch: 40, chContraste: 44, elegibles: 800 } as AporteCategoria;
  if (key === "dirigido") return { ch: 0, chContraste: 18, elegibles: 0 } as AporteCategoria;
  return { ch: 0, chContraste: 0, elegibles: 0 } as AporteCategoria;
};

function render(conEvidencia: boolean) {
  const sel = { mode: "include", categories: ["regular", "repitencia"] } as CriterioSeleccion;
  return renderToStaticMarkup(
    <FacultadCategoriaToggles
      fila={fila()}
      variable={variable}
      sel={sel}
      onSel={() => {}}
      ariaLabel="Condición del curso en Derecho"
      evidencia={conEvidencia ? evidencia : undefined}
    />,
  );
}

describe("FacultadCategoriaToggles · lo excluido no se pliega como inexistente", () => {
  it("una categoría con cursos aquí pero fuera del marco se sigue viendo", () => {
    const html = render(true);
    expect(html).toContain("Dirigido");
  });

  it("el botón cuenta sólo las que de verdad no están en la facultad", () => {
    // Siete de ruido, no ocho: «Dirigido» tiene cursos aquí aunque estén fuera.
    const html = render(true);
    expect(html).toContain("Ver todas (7 sin cursos en esta facultad)");
  });

  it("las categorías sin cursos aquí siguen plegadas: el domado no se pierde", () => {
    // El motivo original del plegado —«condición del curso trae ~52 valores DTI,
    // casi todos ruido»— se conserva: sin cursos en la facultad, siguen fuera.
    const html = render(true);
    expect(html).not.toContain("Ruido DTI 0");
  });

  it("sin evidencia publicada cae al comportamiento anterior, sin romperse", () => {
    const html = render(false);
    expect(html).toContain("Regular");
    expect(html).toContain("Ver todas (8 sin cursos en esta facultad)");
  });
});
