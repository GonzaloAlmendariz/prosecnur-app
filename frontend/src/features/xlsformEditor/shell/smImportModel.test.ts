import { describe, expect, test } from "vitest";
import type { SurveyMonkeyVisualLogicRule } from "../../../api/multiIntegrado";
import type { SmSugerenciaLogica } from "../../../api/xlsformSmSugerencias";
import type { VisualLogicQuestion } from "./RuleWizard";
import {
  aplicarSugerenciaFinDeEncuesta,
  estadoConexionSm,
  perfilesAlternativosSm,
  refCanonicaSm,
  sugerenciaYaAplicada,
  textoConteoSm,
  textoSaltosSm,
  textoSugerencia,
  truncarHuella,
  versionTraductorLegible,
} from "./smImportModel";

const CONSENTIMIENTO: SmSugerenciaLogica = {
  tipo: "fin_de_encuesta",
  variable: "p1",
  etiqueta: "¿Desea continuar con la encuesta?",
  opciones_que_cortan: [{ codigo: "2", etiqueta: "No" }],
  motivo: "Es la pregunta de consentimiento.",
};

// La lógica visual nombra la pregunta como SurveyMonkey (`Q0001`); el servidor,
// como el formulario (`p1`). Es la misma pregunta.
const PREGUNTAS: VisualLogicQuestion[] = [
  {
    ref: "Q0001",
    label: "p1: ¿Desea continuar con la encuesta?",
    choices: [
      { name: "1", label: "Sí", index: 1 },
      { name: "2", label: "No", index: 2 },
    ],
  },
  {
    ref: "Q0002",
    label: "p2: Sexo",
    choices: [
      { name: "1", label: "Mujer", index: 1 },
      { name: "2", label: "Hombre", index: 2 },
    ],
  },
];

let n = 0;
const id = () => `r${++n}`;

describe("conteo único (U8)", () => {
  test("dice preguntas y campos con su plural", () => {
    expect(textoConteoSm(26, 74)).toBe("26 preguntas · 74 campos");
    expect(textoConteoSm(1, 1)).toBe("1 pregunta · 1 campo");
  });
});

describe("saltos (U7)", () => {
  test("sin reglas no promete saltos y nombra la salida", () => {
    expect(textoSaltosSm(0, 1)).toBe("Sin saltos: agrégalos o aplica la sugerencia");
    expect(textoSaltosSm(0, 0)).toMatch(/^Sin saltos: agrégalos/);
    expect(textoSaltosSm(3, 1)).toBe("3 saltos");
  });
});

describe("estado de la conexión (U4)", () => {
  test("refleja la prueba apenas termina, sin esperar a la encuesta", () => {
    expect(estadoConexionSm({ hasUsableToken: true, tokenStatus: { ok: true, status_code: 200, n_surveys_visible: 4 }, encuestaConectada: false }).tono).toBe("lista");
    expect(estadoConexionSm({ hasUsableToken: true, tokenStatus: { ok: false, status_code: 401, error: "x" }, encuestaConectada: false }))
      .toMatchObject({ tono: "error", valor: "Token rechazado" });
    expect(estadoConexionSm({ hasUsableToken: true, tokenStatus: { ok: false, error: "timeout" }, encuestaConectada: false }).tono).toBe("error");
    expect(estadoConexionSm({ hasUsableToken: false, tokenStatus: null, encuestaConectada: false })).toMatchObject({ tono: "sin-token", valor: "Sin token" });
    expect(estadoConexionSm({ hasUsableToken: true, tokenStatus: null, encuestaConectada: false, probando: true }).valor).toBe("Probando…");
    expect(estadoConexionSm({ hasUsableToken: true, tokenStatus: null, encuestaConectada: false }).valor).toBe("Sin probar");
  });
});

describe("detalles técnicos (U6)", () => {
  test("trunca la huella y traduce la versión del traductor sin snake_case", () => {
    const sha = "42f8a1c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f6071829304152639e0d";
    expect(truncarHuella(sha)).toBe("42f8a1c3…9e0d");
    expect(truncarHuella("")).toBe("");
    expect(versionTraductorLegible("surveymonkey_api_xlsform/v1")).toBe("Versión 1");
    expect(versionTraductorLegible("surveymonkey_api_xlsform/v2")).not.toMatch(/_/);
  });
});

describe("sugerencia → lógica visual (H4)", () => {
  test("p1 y Q0001 son la misma pregunta", () => {
    expect(refCanonicaSm("Q0001")).toBe("p1");
    expect(refCanonicaSm("p1")).toBe("p1");
  });

  test("Aplicar crea la regla «Fin de encuesta» en las opciones que cortan", () => {
    const r = aplicarSugerenciaFinDeEncuesta([], PREGUNTAS, CONSENTIMIENTO, id);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rules).toHaveLength(1);
    const regla = r.rules[0]!;
    expect(regla.variableRef).toBe("Q0001");
    expect(regla.choices.map((c) => [c.choiceName, c.action.kind])).toEqual([["1", "none"], ["2", "end"]]);
    expect(sugerenciaYaAplicada(r.rules, PREGUNTAS, CONSENTIMIENTO)).toBe(true);
  });

  test("respeta lo que el analista ya marcó en esa pregunta y en otras", () => {
    const previas: SurveyMonkeyVisualLogicRule[] = [
      {
        id: "a",
        variableRef: "Q0001",
        variableLabel: "p1",
        choices: [
          { choiceName: "1", choiceLabel: "Sí", choiceIndex: 1, action: { kind: "page_top", pageId: "3", pageLabel: "Pag3" } },
          { choiceName: "2", choiceLabel: "No", choiceIndex: 2, action: { kind: "none" } },
        ],
      },
      {
        id: "b",
        variableRef: "Q0002",
        variableLabel: "p2",
        choices: [{ choiceName: "2", choiceLabel: "Hombre", choiceIndex: 2, action: { kind: "end" } }],
      },
    ];
    const r = aplicarSugerenciaFinDeEncuesta(previas, PREGUNTAS, CONSENTIMIENTO, id);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const p1 = r.rules.find((x) => x.variableRef === "Q0001")!;
    expect(p1.id).toBe("a");
    expect(p1.choices[0]!.action.kind).toBe("page_top");
    expect(p1.choices[1]!.action.kind).toBe("end");
    expect(r.rules.find((x) => x.variableRef === "Q0002")).toEqual(previas[1]);
  });

  test("si el código no calza, empareja por la etiqueta que se ve", () => {
    const r = aplicarSugerenciaFinDeEncuesta([], PREGUNTAS, {
      ...CONSENTIMIENTO,
      opciones_que_cortan: [{ codigo: "no", etiqueta: "NO" }],
    }, id);
    expect(r.ok && r.rules[0]!.choices.find((c) => c.choiceName === "2")!.action.kind).toBe("end");
  });

  test("sin la pregunta entre las que admiten saltos, no inventa nada", () => {
    const r = aplicarSugerenciaFinDeEncuesta([], PREGUNTAS, { ...CONSENTIMIENTO, variable: "p9" }, id);
    expect(r.ok).toBe(false);
    expect(sugerenciaYaAplicada([], PREGUNTAS, CONSENTIMIENTO)).toBe(false);
  });

  test("la tarjeta dice la regla en una línea", () => {
    expect(textoSugerencia(CONSENTIMIENTO)).toBe("Si responde «No» a «¿Desea continuar con la encuesta?» → fin de encuesta");
  });
});

describe("perfiles para rescatar la conexión (U2)", () => {
  test("ofrece los otros perfiles con token, el predeterminado primero", () => {
    const perfiles = [
      { id: "vencido", alias: "Arte", is_default: false, has_token: true },
      { id: "principal", alias: "Principal", is_default: true, has_token: true },
      { id: "vacio", alias: "Vacío", is_default: false, has_token: false },
      { id: "otro", alias: "Otro", is_default: false, has_token: true },
    ];
    expect(perfilesAlternativosSm(perfiles, "vencido").map((p) => p.id)).toEqual(["principal", "otro"]);
    expect(perfilesAlternativosSm(perfiles, null).map((p) => p.id)).toEqual(["vencido", "otro"]);
  });
});
