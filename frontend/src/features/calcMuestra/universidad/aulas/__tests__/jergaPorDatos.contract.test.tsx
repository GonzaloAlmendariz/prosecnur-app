/**
 * La jerga no llega a la pantalla, venga del código o de los DATOS.
 *
 * `copySinJerga.contract.test.ts` barre archivos, así que no puede ver el texto
 * que entra por el payload. Y por ahí entró: un `.pulso` guardado con el motor
 * viejo hacía que el panel de Método dijera «reduce mejor el solape» a 300 px de
 * la tarjeta que ya lo tenía glosado.
 *
 * Este contrato renderiza con datos SUCIOS a propósito y comprueba la salida.
 * Es la diferencia entre verificar la fuente y verificar el resultado: reparar
 * mirando el grep dejó el defecto vivo cuatro veces en la misma jornada.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ClassroomMethodDecisionHero } from "../ClassroomMethodStories";
import { resolveClassroomMethodDecision } from "../classroomMethodStoriesModel";

const JERGA = /\bsolape\b|\bestratos?\b|post[ -]hoc|\bcube\b|\bpivotal\b|\bPPS\b/i;

const heroCon = (razon: string) => {
  const decision = resolveClassroomMethodDecision({
    comparisonReady: true,
    comparison: {
      recommendation: { method_id: "pool_controlado", operational_reason: razon },
    } as never,
    configuredMethodId: "cube_balanceado",
    configuredMethodLabel: "Balance por cuotas y tamaño",
  });
  return renderToStaticMarkup(<ClassroomMethodDecisionHero decision={decision} />);
};

describe("jerga que entra por el payload guardado", () => {
  it("una razón guardada con «solape» no llega a la pantalla", () => {
    const html = heroCon("Compara muestras candidatas y elige la que reduce mejor el solape, registrando probabilidades por simulación.");
    expect(html).not.toMatch(JERGA);
    expect(html).toContain("menos estudiantes se repiten");
  });

  it("tampoco llegan «estrato», «post hoc» ni los nombres internos", () => {
    for (const sucia of [
      "Selecciona dentro de cada estrato sin optimización adicional.",
      "El descuento actuó como auditoría post hoc.",
      "Se resolvió con cube balanceado.",
      "Equivalente a local pivotal.",
    ]) {
      expect(heroCon(sucia), `dejó pasar: ${sucia}`).not.toMatch(JERGA);
    }
  });

  it("una razón guardada LIMPIA sí se muestra tal cual", () => {
    const limpia = "Se eligió porque el marco no traía la lista de alumnos por curso-horario.";
    expect(heroCon(limpia)).toContain("no traía la lista de alumnos");
  });
});
