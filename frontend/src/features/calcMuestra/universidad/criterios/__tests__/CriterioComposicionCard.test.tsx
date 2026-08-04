import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { CriterioComposicionCard } from "../CriterioComposicionCard";
import type { CalcMuestraWorkspaceAulasConfig } from "../../../../../api/client";

/**
 * G41 · Qué hace cada paso de composición con el marco, y de qué marco habla.
 *
 * Gonzalo, con el paso de nivel encendido al 90 %: «no tiene sentido que 554
 * lleguen hasta aquí y que si declaro no deje ninguna; alguna debe irse».
 *
 * Tenía razón, y el defecto era de la superficie: la cifra sale del marco
 * EJECUTADO y en su proyecto ese paso estaba apagado cuando se construyó, así
 * que no dejó fuera a nadie porque no corrió. Medido en su base, exigir el 90 %
 * del mismo nivel alcanza a 2.084 cursos-horario: el umbral muerde, lo que
 * faltaba era decir que todavía no se había aplicado.
 */
const config = (patch: Partial<CalcMuestraWorkspaceAulasConfig> = {}) => ({
  require_faculty_prevalence: false,
  require_cycle_homogeneity: false,
  require_min_prevalence: false,
  min_faculty_prevalence_pct: 0.8,
  min_cycle_homogeneity_pct: 0.9,
  min_prevalence_pct: 0.8,
  ...patch,
} as unknown as CalcMuestraWorkspaceAulasConfig);

describe("CriterioComposicionCard · qué recorta cada paso", () => {
  it("un paso que corrió declara a cuántos deja fuera", () => {
    const html = renderToStaticMarkup(
      <CriterioComposicionCard
        config={config({ require_cycle_homogeneity: true })}
        onPatch={() => {}}
        recorteDe={(id) =>
          id === "c8" ? { llegan: 554, quedan: 470, aplicado: true } : null}
      />,
    );
    expect(html).toContain("554");
    expect(html).toContain("deja fuera");
    expect(html).toContain("84");
    expect(html).toContain("470");
  });

  it("un paso encendido pero no recalculado no promete que no filtre", () => {
    const html = renderToStaticMarkup(
      <CriterioComposicionCard
        config={config({ require_cycle_homogeneity: true })}
        onPatch={() => {}}
        recorteDe={(id) =>
          id === "c8" ? { llegan: 554, quedan: 554, aplicado: false } : null}
      />,
    );
    expect(html).toContain("recalcula el marco");
    expect(html).not.toContain("no deja fuera ninguno");
  });

  /*
   * G41 · Gonzalo: «lo moví y me sale este paso aún no ha corrido». El recorrido
   * vivo necesita el contexto transitorio del motor, que sólo existe si el marco
   * se construyó en esta sesión: al abrir un `.pulso` guardado hay que
   * reconstruir UNA vez y desde ahí el deslizador se recalcula solo. El aviso
   * lo dice en vez de dejarlo como un misterio que se repite en cada cambio.
   */
  it("sin recorrido vivo explica que basta reconstruir una vez", () => {
    const html = renderToStaticMarkup(
      <CriterioComposicionCard
        config={config({ require_cycle_homogeneity: true })}
        onPatch={() => {}}
        recorteDe={(id) =>
          id === "c8"
            ? { llegan: 554, quedan: 554, aplicado: false, sinRecorridoVivo: true }
            : null}
      />,
    );
    expect(html).toContain("Recalcula el marco una vez");
    expect(html).toContain("se actualiza solo");
  });

  it("un paso apagado dice que está apagado, no que el umbral no muerde", () => {
    const html = renderToStaticMarkup(
      <CriterioComposicionCard
        config={config()}
        onPatch={() => {}}
        recorteDe={(id) =>
          id === "c8" ? { llegan: 554, quedan: 554, aplicado: false } : null}
      />,
    );
    expect(html).toContain("el paso está apagado");
    expect(html).not.toContain("recalcula el marco para ver");
  });

  /*
   * G41 · Cada preview sobre un marco real tarda, y durante ese rato la
   * pantalla enseña la respuesta del umbral ANTERIOR. Sin decirlo, mover el
   * deslizador parecía contradecir al motor: a más exigencia, menos descartes.
   * El motor es monótono; lo que faltaba era declarar el desfase.
   */
  it("mientras el motor recalcula no da la cifra vieja por buena", () => {
    const html = renderToStaticMarkup(
      <CriterioComposicionCard
        config={config({ require_cycle_homogeneity: true })}
        onPatch={() => {}}
        recorteDe={(id) =>
          id === "c8"
            ? { llegan: 554, quedan: 89, aplicado: true, recalculando: true }
            : null}
      />,
    );
    expect(html).toContain("Recalculando con el umbral nuevo");
    expect(html).not.toContain("deja fuera");
  });

  it("monta el confirmador que el resto de criterios ya tenía", () => {
    const html = renderToStaticMarkup(
      <CriterioComposicionCard
        config={config()}
        onPatch={() => {}}
        confirmador={<button type="button">Confirmar criterio</button>}
      />,
    );
    expect(html).toContain("Confirmar criterio");
  });

  it("el pie ya no promete que se guarda al instante", () => {
    const html = renderToStaticMarkup(
      <CriterioComposicionCard config={config()} onPatch={() => {}} />,
    );
    expect(html).not.toContain("Se guarda al instante");
    expect(html).toContain("Confirma para dejarlo fijado");
  });

  it("sin cifra del motor no se dibuja la línea", () => {
    const html = renderToStaticMarkup(
      <CriterioComposicionCard config={config()} onPatch={() => {}} />,
    );
    expect(html).not.toContain("llegan hasta aquí");
  });
});
