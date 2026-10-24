import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { MonitoreoSource, MonitoreoSourceVariableStat, MonitoreoState } from "../../../../../api/client";
import { CodigoDeLaPersona } from "./CodigoDeLaPersona";
import { codigoSugerido, estadoDelCodigo, fuentesDeRespuestas, opcionesDeCodigo } from "./codigoDePersonaModel";

// La forma del RMS: la respuesta de Kobo trae el código en `intro/Intro01`, «Código proGres».
const STATS: MonitoreoSourceVariableStat[] = [
  { name: "_uuid", label: "_uuid", non_empty: 363, total: 363, examples: ["a1"] },
  { name: "intro/name_enumerator", label: "Nombre del encuestador", non_empty: 363, total: 363, examples: ["Ana Prueba"] },
  { name: "intro/Intro01", label: "Código proGres", non_empty: 360, total: 363, examples: ["CGU268000417", "CGU268000007"] },
  { name: "group_consent/Intro04", label: "¿Acepta participar?", non_empty: 363, total: 363, examples: ["1"] },
];

const KOBO = { id: "kobo_rms", kind: "kobo", label: "Envíos Kobo", enabled: true, role: "respuestas" } as unknown as MonitoreoSource;

function estado(fuente: MonitoreoSource): MonitoreoState {
  return { sources: [fuente], source_metadata: { variables_by_source: { [fuente.id]: STATS } } } as unknown as MonitoreoState;
}

describe("pregunta con el código de la persona", () => {
  it("sugiere la de proGres por su etiqueta y deja fuera las columnas internas", () => {
    const opciones = opcionesDeCodigo(STATS);
    expect(opciones.map((item) => item.nombre)).not.toContain("_uuid");
    expect(codigoSugerido(opciones)).toBe("intro/Intro01");
    expect(estadoDelCodigo(KOBO, STATS)).toMatchObject({ actual: "intro/Intro01", origen: "sugerida" });
  });

  it("lo declarado manda y lo que el motor marca es «detectada automáticamente»", () => {
    expect(estadoDelCodigo({ ...KOBO, declared_person_code_var: "group_consent/Intro04" }, STATS))
      .toMatchObject({ actual: "group_consent/Intro04", origen: "declarada" });
    const marcadas = STATS.map((stat) => ({ ...stat, selected: stat.name === "intro/Intro01" }));
    expect(estadoDelCodigo(KOBO, marcadas)).toMatchObject({ actual: "intro/Intro01", origen: "detectada" });
  });

  it("sólo se declara en fuentes de respuestas de Kobo o SurveyMonkey", () => {
    const hoja = { ...KOBO, id: "hoja", kind: "google_sheets", role: "barrido" } as unknown as MonitoreoSource;
    expect(fuentesDeRespuestas([KOBO, hoja]).map((fuente) => fuente.id)).toEqual(["kobo_rms"]);
  });

  it("se pinta con la pregunta elegida, sus ejemplos, su cobertura y el cruce de hoy", () => {
    const html = renderToStaticMarkup(
      <CodigoDeLaPersona fuente={KOBO} state={estado(KOBO)} cruce={{ cruzan: 0, total: 360 }} />,
    ).replace(/<!-- -->/g, "");
    expect(html).toContain("Pregunta con el código de la persona");
    expect(html).toContain("Sugerida por el nombre");
    expect(html).toMatch(/<option value="intro\/Intro01" selected="">Código proGres \(intro\/Intro01\)<\/option>/);
    expect(html).toContain("CGU268000417, CGU268000007");
    expect(html).toContain("360 de 363 respuestas traen un valor");
    expect(html).toContain("Hoy cruzan 0 de 360 efectivas.");
  });
});
