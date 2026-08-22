/**
 * Las tres ramas del resumen de riesgos, incluida la que nunca se ve.
 *
 * HSVG2026 sólo produce avisos de gravedad media, así que la rama de gravedad
 * ALTA y la de «sin riesgos» no se han observado en pantalla en todo el loop. Y
 * la rama alta es justo la que más importa: es la que tiene que destacar.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ClassroomRiskList } from "../ClassroomRiskList";

const render = (risks: unknown[], audited = true) =>
  renderToStaticMarkup(
    <ClassroomRiskList risks={risks} audited={audited} resumen alcance="Riesgos de prueba" />,
  );

const alta = { code: "salud_x", severity: "alta", title: "Representatividad baja", detail: "…" };
const media = { code: "reservas_profundidad", severity: "media", title: "Baja profundidad", detail: "5 celdas" };
const nota = { code: "", severity: "media", title: "", detail: "balance del sorteo" };
// Distinta de `nota`: `classroomRiskRows` deduplica por severidad+título+detalle,
// así que dos copias iguales cuentan como una sola.
const nota2 = { code: "", severity: "media", title: "", detail: "ajuste de tamano divulgado" };

describe("resumen de riesgos: las tres ramas", () => {
  it("con un aviso de gravedad alta, lo dice primero y marca la severidad", () => {
    const html = render([alta, media, nota]);
    expect(html).toContain("1 de gravedad alta");
    expect(html).toContain('data-severidad="alta"');
  });

  it("sin avisos reales dice que no hay riesgos activos y no marca alarma", () => {
    const html = render([], true);
    expect(html).toContain("no reporta riesgos activos");
    expect(html).toContain('data-severidad="ok"');
  });

  it("sólo con notas del sorteo NO se marca como asunto pendiente", () => {
    // Una nota de que el motor hizo su trabajo no es una alerta: si esto se
    // marcara «media», volveríamos al «5 avisos» que no distinguía nada.
    const html = render([nota, nota2]);
    expect(html).toContain("notas de cómo salió el sorteo");
    expect(html).toContain('data-severidad="ok"');
  });

  it("un asunto real sí eleva la severidad del resumen", () => {
    const html = render([media]);
    expect(html).toContain("asunto para revisar");
    expect(html).toContain('data-severidad="media"');
  });

  it("sin auditar, el resumen no promete que no haya riesgos", () => {
    const html = render([], false);
    expect(html).not.toContain("no reporta riesgos activos");
  });
});
