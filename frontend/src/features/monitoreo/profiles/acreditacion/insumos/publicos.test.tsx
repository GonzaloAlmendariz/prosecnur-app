import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { MonitoreoActorUnit, MonitoreoSource } from "../../../../../api/client";
import { canalesDeLaMatriz, celda, padronesPorPublico } from "./publicosModelo";
import { Publicos } from "./Publicos";

const fuente = (id: string, role: string, kind: string, actor: string, canal = ""): MonitoreoSource =>
  ({ id, label: id, kind, role, enabled: true, dimensions: { actor, ...(canal ? { canal } : {}) } }) as unknown as MonitoreoSource;

const FUENTES = [
  fuente("Universo · Egresados", "universo", "google_sheets", "Egresados"),
  fuente("Barrido · Egresados", "barrido", "google_sheets", "Egresados"),
  fuente("SurveyMonkey · Egresados · Correo", "respuestas", "surveymonkey", "Egresados", "correo"),
  fuente("SurveyMonkey · Egresados · Teléfono", "respuestas", "surveymonkey", "Egresados", "telefono"),
  fuente("Universo · Estudiantes", "universo", "google_sheets", "Estudiantes"),
  fuente("SurveyMonkey · Estudiantes · QR", "respuestas", "surveymonkey", "Estudiantes", "qr"),
];
const CUOTAS = [
  { actor: "Egresados", universo: 270, efectivas: 178, meta: 108, variables: [{ variable: "Ciclo de egreso", categorias: 10 }] },
  { actor: "Estudiantes", universo: 180, efectivas: 173, meta: 126, variables: [] },
];

describe("Insumos › Públicos", () => {
  it("relaciona cada público con su padrón, encuestas, barrido y variables", () => {
    const filas = padronesPorPublico(["Egresados", "Estudiantes", "Docentes"], FUENTES, CUOTAS);
    expect(filas.map((fila) => [fila.publico, fila.padrones.length, fila.encuestas.length, fila.barridos.length, fila.personas])).toEqual([
      ["Egresados", 1, 2, 1, 270], ["Estudiantes", 1, 1, 0, 180], ["Docentes", 0, 0, 0, null],
    ]);
    const canales = canalesDeLaMatriz(filas);
    expect(canales[0]).toBe("Barrido");
    expect(celda(filas[0], "Barrido")).toEqual({ canal: "Barrido", fuentes: 1, servicios: ["Google Sheets"] });
  });

  it("la vista no muestra claves crudas", () => {
    const unidades = [
      { id: "egresados", type: "actor", actor: "Egresados", label: "Egresados", segment: "", group: "", origin: "declarado", phone: { enabled: true, role: "target" } },
    ] as unknown as MonitoreoActorUnit[];
    const html = renderToStaticMarkup(
      <MemoryRouter><Publicos sources={FUENTES} unidades={unidades} llave={["CodPulso", "Código PUCP"]} cuotasDePrueba={CUOTAS} /></MemoryRouter>,
    );
    expect(html).toContain("Por dónde entra cada público");
    expect(html).toContain("Ciclo de egreso");
    expect(html).not.toMatch(/>[a-z0-9]+([_-][a-z0-9]+)+</);
  });
});
