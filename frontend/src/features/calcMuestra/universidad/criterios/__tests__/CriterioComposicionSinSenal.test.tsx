/**
 * D6 (ADR 0060) · La cifra de los que pasan sin señal llega a la pantalla.
 *
 * Los tres gates de composición NA-pasan: un curso-horario sin señal medible no
 * se queda fuera, entra. El motor publica cuántos son en
 * `perfil.opcionales[id].composicion_na_n` desde el ADR 0060 y ninguna
 * superficie lo leía — el dato viajaba tipado y moría en el cliente.
 *
 * Lo que estos tests fijan es la diferencia entre «no hay dato» y «el dato es
 * cero», que es justo donde una divulgación de calidad se vuelve mentira: un 0
 * dibujado sobre un frame que no trae la clave afirma que se midió y no había
 * ninguno, cuando la verdad es que no se midió.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CalcMuestraWorkspaceAulasConfig } from "../../../../../api/client";
import { CriterioComposicionCard } from "../CriterioComposicionCard";

const CONFIG = {
  require_faculty_prevalence: true,
  min_faculty_prevalence_pct: 0.8,
  require_cycle_homogeneity: true,
  min_cycle_homogeneity_pct: 0.8,
  require_min_prevalence: false,
  min_prevalence_pct: 0.8,
} as unknown as CalcMuestraWorkspaceAulasConfig;

const RECORTE = { llegan: 500, quedan: 420, aplicado: true };

function pintar(sinSenalDe?: (id: string) => number | null): string {
  return renderToStaticMarkup(
    <CriterioComposicionCard
      config={CONFIG}
      onPatch={() => {}}
      recorteDe={() => RECORTE}
      sinSenalDe={sinSenalDe}
    />,
  );
}

/** Trozos de la línea D6 presentes en el markup, en orden de aparición. */
function lineasSinSenal(html: string): string[] {
  return Array.from(html.matchAll(/<p class="cmv2-crit-paso-sinsenal"[^>]*>(.*?)<\/p>/g)).map(
    (m) => m[1].replace(/<[^>]+>/g, ""),
  );
}

describe("CriterioComposicionCard · los que pasan sin señal", () => {
  it("publica la cifra del motor con el denominador de los que quedan", () => {
    const html = pintar((id) => (id === "c8_facultad" ? 37 : null));
    const lineas = lineasSinSenal(html);

    expect(lineas).toHaveLength(1);
    expect(lineas[0]).toContain("37");
    // El denominador es el de los que QUEDAN tras el paso, no el de los que
    // llegan: la cifra describe a los que entraron sin evidencia.
    expect(lineas[0]).toContain("420");
    expect(lineas[0]).toMatch(/sin señal/i);
  });

  it("no dibuja nada cuando el frame no trae la clave", () => {
    // Frames anteriores al contrato. Un 0 aquí afirmaría que se midió.
    expect(lineasSinSenal(pintar(() => null))).toHaveLength(0);
  });

  it("no dibuja nada cuando la cifra es cero", () => {
    // Cero es «ninguno pasó sin señal»: no hay nada que divulgar, y una línea
    // que dice 0 es ruido en una tarjeta que ya lleva cuatro cifras.
    expect(lineasSinSenal(pintar(() => 0))).toHaveLength(0);
  });

  it("tolera que la tarjeta se dibuje sin el prop", () => {
    // Contrato aditivo: la tarjeta es la misma sin la capacidad.
    const html = pintar(undefined);
    expect(lineasSinSenal(html)).toHaveLength(0);
    expect(html).toContain("Composición del curso-horario");
  });

  it("cada paso lee su propio criterio y no el del vecino", () => {
    // El bug silencioso de esta familia: pasar el id equivocado hace que los
    // tres pasos publiquen la misma cifra y nadie lo nota, porque la cifra
    // existe y es plausible.
    const porCriterio: Record<string, number> = { c8_facultad: 11, c8: 22, c7: 33 };
    const lineas = lineasSinSenal(pintar((id) => porCriterio[id] ?? null));

    // c7 está apagado en CONFIG y su regla se dibuja igual: la cifra sale del
    // marco ejecutado, no del interruptor.
    expect(lineas).toHaveLength(3);
    expect(lineas[0]).toContain("11");
    expect(lineas[1]).toContain("22");
    expect(lineas[2]).toContain("33");
  });
});
