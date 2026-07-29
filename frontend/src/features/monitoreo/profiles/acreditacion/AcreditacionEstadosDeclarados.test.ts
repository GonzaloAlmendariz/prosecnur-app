import { describe, expect, test } from "vitest";
import type { MonitoreoStateRule } from "../../../../api/client";
import {
  ACREDITACION_COLOR_FAMILIA,
  acreditacionColorDeFamilia,
  acreditacionDeclaracionesDesdeReglas,
  acreditacionEstadosDetectados,
  acreditacionFamiliaDeclarada,
  acreditacionFamiliaDeEstado,
} from "./AcreditacionEstadosLlamada";

// Los estados telefónicos los escribe el cliente y cambian entre estudios, así
// que la heurística por regex no puede ser la última palabra. Estas pruebas
// fijan la regla que gobierna el definidor: lo confirmado por el usuario manda
// sobre lo inferido, y el color vive en un solo sitio.

function regla(patch: Partial<MonitoreoStateRule> & { color?: string }): MonitoreoStateRule {
  return {
    id: "r1",
    label: "",
    final_state: "efectivo",
    priority: 1,
    outcome_values: [],
    stop_contact: false,
    ...patch,
  } as MonitoreoStateRule;
}

describe("declaraciones guardadas", () => {
  test("se leen desde state_rules, que ya viaja en el .pulso", () => {
    const declaraciones = acreditacionDeclaracionesDesdeReglas([
      regla({ id: "efectivo", final_state: "efectivo", color: "#00aa55", outcome_values: ["Contactado por WhatsApp"] }),
    ]);
    expect(declaraciones).toHaveLength(1);
    expect(declaraciones[0].color).toBe("#00aa55");
    expect(declaraciones[0].crudos).toEqual(["Contactado por WhatsApp"]);
  });

  test("las reglas del modelo operativo telefónico no se confunden con familias", () => {
    // `final_state: "non_effective"` es del vocabulario del motor, no una
    // familia de acreditación. Leerla como tal pintaría una familia fantasma.
    const declaraciones = acreditacionDeclaracionesDesdeReglas([
      regla({ id: "non_effective_contact", final_state: "non_effective" }),
    ]);
    expect(declaraciones).toHaveLength(0);
  });
});

describe("color", () => {
  test("el declarado por el usuario gana al de fábrica", () => {
    const declaraciones = acreditacionDeclaracionesDesdeReglas([
      regla({ final_state: "rechazo", color: "#123456" }),
    ]);
    expect(acreditacionColorDeFamilia("rechazo", declaraciones)).toBe("#123456");
  });

  test("sin declarar, cae al de fábrica y nunca a vacío", () => {
    expect(acreditacionColorDeFamilia("efectivo", [])).toBe(ACREDITACION_COLOR_FAMILIA.efectivo);
    const sinColor = acreditacionDeclaracionesDesdeReglas([regla({ final_state: "efectivo", color: "" })]);
    expect(acreditacionColorDeFamilia("efectivo", sinColor)).toBe(ACREDITACION_COLOR_FAMILIA.efectivo);
  });

  test("las seis familias tienen color y ninguna repite", () => {
    const colores = Object.values(ACREDITACION_COLOR_FAMILIA);
    expect(colores).toHaveLength(6);
    expect(new Set(colores).size).toBe(6);
  });
});

describe("lo confirmado manda sobre lo inferido", () => {
  test("una asignación manual sobreescribe la heurística", () => {
    // La regex mete «Contactado por WhatsApp» en sin_contacto. Si el usuario
    // dice que en SU estudio cuenta como efectivo, eso no se puede revertir en
    // el siguiente corte.
    expect(acreditacionFamiliaDeEstado("Contactado por WhatsApp").familia).toBe("sin_contacto");
    const declaraciones = acreditacionDeclaracionesDesdeReglas([
      regla({ final_state: "efectivo", outcome_values: ["Contactado por WhatsApp"] }),
    ]);
    expect(acreditacionFamiliaDeclarada("Contactado por WhatsApp", declaraciones).familia).toBe("efectivo");
  });

  test("la comparación tolera tildes, mayúsculas y espacios", () => {
    const declaraciones = acreditacionDeclaracionesDesdeReglas([
      regla({ final_state: "rechazo", outcome_values: ["  NÚMERO Incorrrecto "] }),
    ]);
    expect(acreditacionFamiliaDeclarada("numero incorrrecto", declaraciones).familia).toBe("rechazo");
  });

  test("sin declaración se mantiene la heurística", () => {
    expect(acreditacionFamiliaDeclarada("No contesta", []).familia).toBe("sin_contacto");
  });
});

describe("estados detectados", () => {
  const crudos = [
    { label: "Efectivo", value: 141 },
    { label: "No contesta", value: 61 },
    { label: "Número Incorrrecto", value: 9 },
    { label: "Contactado por WhatsApp", value: 1 },
  ];

  test("lista lo que trae el corte y marca qué está confirmado", () => {
    const declaraciones = acreditacionDeclaracionesDesdeReglas([
      regla({ final_state: "efectivo", outcome_values: ["Contactado por WhatsApp"] }),
    ]);
    const detectados = acreditacionEstadosDetectados(crudos, declaraciones);

    expect(detectados).toHaveLength(4);
    // Ordenados por volumen: lo que más pesa se revisa primero.
    expect(detectados[0].crudo).toBe("Efectivo");
    const whatsapp = detectados.find((item) => item.crudo === "Contactado por WhatsApp");
    expect(whatsapp?.confirmado).toBe(true);
    expect(whatsapp?.familia).toBe("efectivo");
    // Lo que nadie tocó queda sin confirmar, que es la información que hace
    // útil a esta pantalla.
    expect(detectados.find((item) => item.crudo === "No contesta")?.confirmado).toBe(false);
  });

  test("un crudo repetido con distinta grafía se suma una sola vez", () => {
    const detectados = acreditacionEstadosDetectados([
      { label: "No contesta", value: 40 },
      { label: "  no CONTESTA ", value: 21 },
    ], []);
    expect(detectados).toHaveLength(1);
    expect(detectados[0].value).toBe(61);
  });

  test("los ceros no ensucian la lista de confirmación", () => {
    expect(acreditacionEstadosDetectados([{ label: "Rechazo", value: 0 }], [])).toHaveLength(0);
  });
});
