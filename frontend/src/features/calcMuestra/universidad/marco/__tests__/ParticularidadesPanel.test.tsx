import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CalcMuestraAulasParticularidades } from "../../../../../api/client";
import { ParticularidadesPanel } from "../ParticularidadesPanel";

/**
 * F101 · C4 (todo alcanzable) del Contrato de Superficie, como guard.
 *
 * El panel se titula «Casos detectados para tu revisión manual» y sus filas son
 * el único sitio donde se decide incluir/excluir/revisado. Vivían dentro de
 * `<details>` cerrados, bajo una cabecera que contaba «K sin decidir»: la
 * pantalla pedía una acción y escondía el control que la ejecuta.
 *
 * Se comprueba sobre el marcado renderizado SIN interacción, que es justo la
 * diferencia entre estar y estar alcanzable. Una captura probaría lo mismo una
 * vez; esto lo prueba en cada corrida.
 */
const particularidades = {
  session_type_dominante: { categoria: "TEORÍA", share: 0.91, total_categorias: 3 },
  multi_facultad: [
    { id: "mf-1", curso: "Matemática Básica", n_facultades: 4, facultades: ["Ing.", "Salud"] },
    { id: "mf-2", curso: "Redacción", n_facultades: 2, facultades: ["Derecho", "Educación"] },
  ],
  codigo_z: [{ id: "cz-1", curso: "Taller externo", local: "Z-04" }],
  nombre_tesis: [{ id: "nt-1", curso: "Tesis I" }],
  counts: { multi_facultad: 2, codigo_z: 1, nombre_tesis: 1 },
} as unknown as CalcMuestraAulasParticularidades;

function render(p: CalcMuestraAulasParticularidades | null) {
  return renderToStaticMarkup(
    <ParticularidadesPanel particularidades={p} decisiones={{}} onDecisiones={() => {}} />,
  );
}

describe("ParticularidadesPanel — la revisión manual no está plegada (F101)", () => {
  it("no usa <details>: nada que decidir queda detrás de un click", () => {
    const html = render(particularidades);
    expect(html).not.toContain("<details");
    expect(html).not.toContain("<summary");
  });

  it("las filas decidibles llegan renderizadas, sin abrir nada", () => {
    const html = render(particularidades);
    // Los cuatro casos del fixture, cada uno con su nombre visible.
    for (const curso of ["Matemática Básica", "Redacción", "Taller externo", "Tesis I"]) {
      expect(html).toContain(curso);
    }
  });

  it("los controles de decisión existen en el marcado inicial", () => {
    const html = render(particularidades);
    // Tres opciones × cuatro casos. Se cuenta el marcado real de los botones,
    // no la palabra suelta: «excluir» aparece también en la prosa del panel, y
    // afirmar sobre el texto pasaría con los controles ausentes.
    const botones = html.match(/aria-pressed=/g) ?? [];
    expect(botones.length).toBeGreaterThanOrEqual(4 * 3);
  });

  it("la cabecera sigue contando lo detectado", () => {
    const html = render(particularidades);
    expect(html).toContain("Cursos que sirven a ≥2 facultades");
    expect(html).toContain("2 detectados");
  });

  it("sin señales declara el vacío y no dibuja secciones", () => {
    const html = render({
      session_type_dominante: null,
      multi_facultad: [],
      codigo_z: [],
      nombre_tesis: [],
      counts: { multi_facultad: 0, codigo_z: 0, nombre_tesis: 0 },
    } as unknown as CalcMuestraAulasParticularidades);
    expect(html).toContain("Sin señales detectadas");
    expect(html).not.toContain("cmv2-partic-section");
  });

  it("sin análisis en el marco lo dice y pide reconstruir", () => {
    const html = render(null);
    expect(html).toContain("Reconstruye el marco");
  });
});
