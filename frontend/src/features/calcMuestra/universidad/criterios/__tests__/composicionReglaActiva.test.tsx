import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { CriterioComposicionCard } from "../CriterioComposicionCard";
import type { CalcMuestraWorkspaceAulasConfig } from "../../../../../api/client";

/**
 * ADR 0057 · Una regla activa no puede estar plegada.
 *
 * «Prevalencia de elegibles» es una métrica heredada que normalmente está
 * apagada, y por eso vivía tras un control cerrado. Encendida **recorta el
 * marco**: dejarla detrás de un plegado no la hace difícil de encontrar, la hace
 * invisible mientras opera. Apagada sigue contenida —una opción inactiva no es
 * contenido oculto—.
 */
function config(activa: boolean): CalcMuestraWorkspaceAulasConfig {
  return { require_min_prevalence: activa, min_prevalence: 0.5 } as unknown as CalcMuestraWorkspaceAulasConfig;
}

describe("CriterioComposicionCard · prevalencia heredada", () => {
  /*
   * G33 · Estos dos casos fijaban el plegado, y Gonzalo lo retiró: «quedamos en
   * que ya ninguno se colapsa».
   *
   * El argumento que sostenían —«apagada queda contenida sin ocupar la
   * superficie»— es la racionalización que la regla prohíbe: quien no la abre no
   * sabe que existe, y una métrica que puede cambiar un denominador no puede
   * depender de que alguien la descubra.
   *
   * Un test puede fijar un defecto con la misma firmeza con que fija una
   * reparación; éstos fijaban uno.
   */
  it("se muestra siempre, activa o apagada", () => {
    for (const activa of [true, false]) {
      const html = renderToStaticMarkup(
        <CriterioComposicionCard config={config(activa)} onPatch={vi.fn()} />,
      );
      expect(html, String(activa)).toContain("cmv2-crit-otra-regla");
    }
  });

  it("dice lo que la regla HACE, no de dónde viene (G39)", () => {
    /*
     * Gonzalo: «no entiendo bien el propósito de referencial y gris».
     *
     * El texto contaba su procedencia —«métrica referencial heredada», «no forma
     * parte de la composición»— y nunca su función. Eso es útil para quien
     * mantiene el código; quien decide necesita saber qué descarta. Y la palabra
     * «referencial» sugería que no filtra, cuando encendida recorta el marco
     * como cualquier otro criterio.
     */
    const html = renderToStaticMarkup(<CriterioComposicionCard config={config(false)} onPatch={vi.fn()} />);
    expect(html).toContain("Descarta los cursos-horario donde");
    expect(html).not.toContain("referencial");
    expect(html).not.toContain("heredada");
  });

  it("no queda un botón que no controle nada", () => {
    // Un control que no controla invita a un click que no hace nada.
    const html = renderToStaticMarkup(<CriterioComposicionCard config={config(false)} onPatch={vi.fn()} />);
    expect(html).not.toContain("cmv2-crit-exc-toggle");
  });
});

describe("cada paso de composición enseña sobre qué corta (G38)", () => {
  /*
   * Gonzalo: «en Composición del curso-horario no hay forma de saber cuántos
   * perdemos por el porcentaje que estamos aplicando». Los dos pasos se decidían
   * con un deslizador y una frase: era el único criterio del embudo sin su
   * tarjeta estándar.
   *
   * La señal llega del motor en porcentaje con escala 0–100 (contrato v2), así
   * que la caja describe la composición misma y no los alumnos elegibles.
   */
  const aporte = (nFuera: number | null) => ({
    ch: 84,
    chContraste: 120,
    elegibles: 2110,
    nFuera,
    escalaEje: { min: 0, max: 100 },
    distribucion: {
      media: 71, p10: 40, p25: 58, p50: 74, p75: 86, p90: 95,
      min: 22, max: 100, bigote_inf: 22, bigote_sup: 100,
      n_atipicos: 0, n_atipicos_inf: 0, n_atipicos_sup: 0,
      hist_breaks: [0, 25, 50, 75, 100], hist_counts: [3, 17, 44, 56],
    },
  }) as never;

  const render = (evidencia?: (id: string) => never) =>
    renderToStaticMarkup(
      <CriterioComposicionCard
        config={{
          require_faculty_prevalence: true,
          min_faculty_prevalence_pct: 0.8,
          require_cycle_homogeneity: true,
          min_cycle_homogeneity_pct: 0.8,
        } as unknown as CalcMuestraWorkspaceAulasConfig}
        onPatch={vi.fn()}
        evidenciaDe={evidencia}
      />,
    );

  it("monta la tarjeta de proporción en las tres reglas", () => {
    /*
     * G39 · Eran dos y ahora son tres: la prevalencia de elegibles también la
     * lleva. Vivía como anexo gris rotulado «referencial», sin evidencia, aunque
     * encendida recorta el marco igual que los dos pasos. Presentar como
     * secundario algo que cambia el resultado es la misma familia de defecto que
     * plegarlo.
     */
    const html = render(() => aporte(37));
    expect(html.match(/data-variante="proporcion"/g)).toHaveLength(3);
  });

  it("dice cuántos cursos-horario deja fuera el porcentaje aplicado", () => {
    // La cifra la cuenta el motor (`n_fuera`), no se deduce restando: la resta
    // mide todo lo que la cascada descartó, no lo que descarta ESTE corte.
    expect(render(() => aporte(37))).toContain("<strong>37</strong>quedan fuera");
  });

  it("sin evidencia publicada la tarjeta se dibuja igual, sin inventar una", () => {
    // React presenta y valida, nunca calcula. Un paso sin distribución sigue
    // siendo decidible: pierde la evidencia, no el control.
    const html = render(undefined);
    expect(html).not.toContain("data-variante=");
    expect(html).toContain("Misma facultad del curso");
    expect(html).toContain("Mismo nivel del curso");
  });
});
