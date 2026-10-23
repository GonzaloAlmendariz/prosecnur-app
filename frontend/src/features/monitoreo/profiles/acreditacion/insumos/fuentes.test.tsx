import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { MonitoreoInternalQueryTotal, MonitoreoSource } from "../../../../../api/client";
import { fuentesPorPublico, recopiladoresDeLaFuente, tipoDeRecopilador } from "./fuentesModelo";
import { FuentesVista } from "./Fuentes";

const fuentes: MonitoreoSource[] = [
  {
    id: "sm1", kind: "surveymonkey", label: "Estudiantes web", enabled: true, role: "respuestas", survey_id: "S1",
    dimensions: { actor: "Estudiantes", canal: "correo" }, last_sync_at: "2026-10-20T10:00:00Z",
    collectors: [
      { collector_id: "c1", name: "Faltantes_presencial", type: "weblink", response_count: 70 },
      { collector_id: "c2", name: "Envío 1", type: "email", response_count: 12 },
    ],
  },
  { id: "pad1", kind: "google_sheets", label: "Padrón estudiantes", enabled: true, role: "universo", dimensions: { actor: "Estudiantes" }, sync_cursor: { fetched_count: 1200 } },
  { id: "sm2", kind: "surveymonkey", label: "Docentes web", enabled: true, role: "respuestas", survey_id: "S2", dimensions: { actor: "Docentes" }, collectors: [{ collector_id: "c9", name: "Envío 1", type: "email" }] },
];

const totales: MonitoreoInternalQueryTotal[] = [
  { collector: "Faltantes_presencial", total: 59, efectivas: 55, parciales: 2, rechazos: 1, pendientes: 0, revision: 1, salen_de_pendientes: 0 },
];

describe("Insumos › Fuentes", () => {
  it("agrupa por público con el padrón primero", () => {
    const grupos = fuentesPorPublico(fuentes);
    expect(grupos.map((grupo) => grupo.publico)).toEqual(["Docentes", "Estudiantes"]);
    expect(grupos[1].fuentes.map((item) => item.papelRotulo)).toEqual(["Padrón", "Respuestas"]);
    expect(grupos[1].fuentes[0].filas).toBe(1200);
  });

  it("toma respuestas y efectivas del cruce, no del metadato de la plataforma", () => {
    const filas = recopiladoresDeLaFuente(fuentes[0], [], totales, fuentes);
    const faltantes = filas.find((item) => item.nombre === "Faltantes_presencial");
    expect(faltantes?.respuestas).toBe(59);
    expect(faltantes?.efectivas).toBe(55);
    expect(faltantes?.tipo).toBe("Link abierto");
  });

  it("no atribuye cifras a un nombre que se repite en otra encuesta", () => {
    const envio = recopiladoresDeLaFuente(fuentes[0], [], totales, fuentes).find((item) => item.nombre === "Envío 1");
    expect(envio?.ambiguo).toBe(true);
    expect(envio?.respuestas).toBeNull();
  });

  it("sin el corte de Control no inventa ceros", () => {
    const filas = recopiladoresDeLaFuente(fuentes[0], [], null, fuentes);
    expect(filas.every((item) => item.respuestas === null && item.efectivas === null)).toBe(true);
  });

  it("nombra el tipo de recopilador sin claves técnicas", () => {
    expect(tipoDeRecopilador("email")).toBe("Envío por correo");
    expect(tipoDeRecopilador("")).toBe("Enlace");
  });

  it("dibuja maestro y detalle sin claves técnicas en pantalla", () => {
    const html = renderToStaticMarkup(
      <FuentesVista sources={fuentes} borrador={[]} totales={totales} foco="sm1" onElegir={() => {}} onIncluir={() => {}} onGuardar={() => {}} pendientes={false} guardando={false} />,
    );
    expect(html).toContain("Faltantes_presencial");
    expect(html).toContain("Padrón");
    expect(html).toContain("Incluir Faltantes_presencial");
    expect(html).not.toMatch(/surveymonkey|google_sheets|weblink|universo|respuestas"/);
  });

  it("sin fuentes avisa con el componente del sistema", () => {
    const html = renderToStaticMarkup(
      <FuentesVista sources={[]} borrador={[]} totales={null} foco={null} onElegir={() => {}} onIncluir={() => {}} onGuardar={() => {}} pendientes={false} guardando={false} />,
    );
    expect(html).toContain("pulso-alert");
  });
});
