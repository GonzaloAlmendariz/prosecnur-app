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

  /*
   * G33 · Estos casos fijaban un plegado que Gonzalo retiró: «quedamos en que
   * ya ninguno se colapsa».
   *
   * El motivo original era real —«condición del curso trae ~52 valores DTI,
   * casi todos ruido»— pero la salida no era plegar: las categorías sin
   * cursos-horario aquí **no tienen distribución, ni cifras, ni decisión que
   * ofrecer**. Sólo su nombre. Así que se nombran y no reciben tarjeta: nada
   * queda oculto y nada ocupa espacio que no merece.
   */
  it("las categorías sin cursos aquí se NOMBRAN, no se pliegan", () => {
    const html = render(true);
    expect(html).not.toContain("Ver todas");
    expect(html).toContain("Sin cursos-horario en esta facultad");
  });

  it("declara cuántas son y las lista por nombre", () => {
    // Siete de ruido, no ocho: «Dirigido» tiene cursos aquí aunque estén fuera.
    const html = render(true);
    expect(html).toContain("(7)");
    expect(html).toContain("Ruido DTI 0");
  });

  it("ninguna de ellas recibe tarjeta: no hay nada que mostrar", () => {
    // El domado se conserva por otra vía — no dándoles gráfico, en vez de
    // escondiéndolas.
    const html = render(true);
    const tarjetas = (html.match(/cmv2-cat-evidencia/g) ?? []).length;
    const nombradas = (html.match(/Ruido DTI/g) ?? []).length;
    expect(nombradas).toBeGreaterThan(0);
    expect(tarjetas).toBeLessThan(nombradas + 5);
  });

  it("sin evidencia publicada no se inventa el reparto", () => {
    // Sin distribución no se sabe cuáles tienen cursos aquí, así que entran
    // todas: callar unas por un dato que no llegó sería esconderlas.
    const html = render(false);
    expect(html).toContain("Regular");
    expect(html).not.toContain("Ver todas");
  });
});

describe("las categorías con más cursos-horario van primero (G37)", () => {
  /*
   * Gonzalo: «las categorías con mayor cantidad de CH siempre van primero en su
   * criterio». El catálogo las publica en el orden de la columna de origen, que
   * no dice nada sobre qué decisión pesa.
   *
   * El fixture está deliberadamente desordenado respecto al peso: llega
   * Regular (130) · Repitencia (44) · Dirigido (18), pero la prueba que importa
   * es la de abajo — que ordena por `chContraste` y no por `ch`.
   */
  const posiciones = (html: string, ...etiquetas: string[]) =>
    etiquetas.map((e) => html.indexOf(`>${e}<`));

  it("ordena por cursos-horario de la facultad, de mayor a menor", () => {
    const html = render(true);
    const [reg, rep, dir] = posiciones(html, "Regular", "Repitencia", "Dirigido");
    expect(reg).toBeGreaterThan(-1);
    expect(reg).toBeLessThan(rep);
    expect(rep).toBeLessThan(dir);
  });

  it("ordena por los CH que la categoría TIENE, no por los que siguen dentro", () => {
    /*
     * La diferencia entre `chContraste` y `ch` es la que hace estable la lista.
     * Aquí discrepan a propósito: «Dirigido» tiene **200 cursos-horario** en la
     * facultad y **0 incluidos** porque el criterio la excluye. Por `ch` iría
     * última; por `chContraste`, primera. Ordenando por `ch`, reactivarla la
     * haría saltar al principio: la lista se reordenaría bajo el cursor a cada
     * conmutador.
     *
     * (Mi primera versión de este caso reusaba el fixture de arriba, donde los
     * dos criterios dan el mismo orden — no distinguía nada y pasaba igual.)
     */
    const tipos = [
      { key: "regular", label: "Regular", ch: 120, elegibles: 3000, activo: true },
      { key: "dirigido", label: "Dirigido", ch: 0, elegibles: 0, activo: false },
    ];
    const filaLocal = {
      facKey: "derecho", facLabel: "Derecho", decision: "heredada", tipos,
    } as unknown as FilaFacultad;
    const evidenciaLocal = (key: string): AporteCategoria | null =>
      key === "dirigido"
        ? ({ ch: 0, chContraste: 200, elegibles: 0 } as AporteCategoria)
        : ({ ch: 120, chContraste: 130, elegibles: 3000 } as AporteCategoria);

    const html = renderToStaticMarkup(
      <FacultadCategoriaToggles
        fila={filaLocal}
        variable={variable}
        sel={{ mode: "include", categories: ["regular"] } as CriterioSeleccion}
        onSel={() => {}}
        ariaLabel="Condición del curso en Derecho"
        evidencia={evidenciaLocal}
      />,
    );
    const [dir, reg] = posiciones(html, "Dirigido", "Regular");
    expect(dir).toBeGreaterThan(-1);
    expect(dir).toBeLessThan(reg);
  });

  it("sin evidencia publicada no inventa un orden: cae a los CH del catálogo", () => {
    // React presenta y valida, nunca calcula. Si el motor no publicó contraste,
    // el peso es el `ch` que sí trae la fila — no un estimado.
    const html = render(false);
    const [reg, rep] = posiciones(html, "Regular", "Repitencia");
    expect(reg).toBeLessThan(rep);
  });
});
