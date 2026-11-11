import { describe, expect, it } from "vitest";

import type { SessionState } from "../../../api/core";
import { motivoSinPrefijo, queSigue, seccionQueSigue } from "./queSigueModel";

function sesion(parcial: Partial<SessionState>): SessionState {
  return parcial as SessionState;
}

const TODO_HECHO: Partial<SessionState> = {
  xlsform: true,
  data: true,
  auditoria_run: true,
  codif_aplicado: true,
  analitica_prep_ok: true,
  graficos_ppt_ok: true,
};

describe("seccionQueSigue: la regla del redirect que tenía /procesamiento", () => {
  // Tabla tomada de `features/home/ProcesamientoEntry.tsx` antes de la etapa P2.
  it.each<[string, Partial<SessionState> | null, string]>([
    ["sin sesión", null, "carga"],
    ["sin formulario", { data: true }, "carga"],
    ["sin respuestas", { xlsform: true }, "carga"],
    ["con insumos y sin auditoría", { xlsform: true, data: true }, "validacion"],
    ["auditada y sin codificar", { xlsform: true, data: true, auditoria_run: true }, "codificacion"],
    [
      "codificada y sin preparar Analítica",
      { xlsform: true, data: true, auditoria_run: true, codif_aplicado: true },
      "analitica",
    ],
    [
      "Analítica preparada",
      { xlsform: true, data: true, auditoria_run: true, codif_aplicado: true, analitica_prep_ok: true },
      "graficos",
    ],
    ["todo hecho", TODO_HECHO, "graficos"],
  ])("%s", (_caso, state, esperada) => {
    expect(seccionQueSigue(state ? sesion(state) : null)).toBe(esperada);
  });

  it("no salta una sección anterior aunque una posterior ya esté hecha", () => {
    expect(seccionQueSigue(sesion({ ...TODO_HECHO, auditoria_run: false }))).toBe("validacion");
  });
});

describe("queSigue", () => {
  it("sin insumos el paso es Carga, con la causa exacta de lo que falta", () => {
    expect(queSigue(null).paso).toEqual({
      seccion: "carga",
      to: "/carga",
      accion: "Abrir Carga",
      titulo: "Cargar el formulario y las respuestas",
      causa: "El estudio todavía no tiene formulario ni respuestas.",
    });
    expect(queSigue(sesion({ data: true })).paso.causa).toBe("Falta el formulario.");
    expect(queSigue(sesion({ xlsform: true })).paso.causa).toBe("Faltan las respuestas.");
  });

  it("sin insumos lista las cuatro secciones que la banda bloquea, sin el prefijo del estado", () => {
    const { pendientes, completo } = queSigue(null);
    expect(completo).toBe(false);
    expect(pendientes).toEqual([
      { seccion: "validacion", nombre: "Validación", to: "/validacion", estado: "bloqueada", motivo: "Carga un XLSForm en Carga." },
      { seccion: "codificacion", nombre: "Codificación", to: "/codificacion", estado: "bloqueada", motivo: "Completa carga y consolidación." },
      { seccion: "analitica", nombre: "Analítica", to: "/analitica", estado: "bloqueada", motivo: "Completa carga y consolidación." },
      { seccion: "graficos", nombre: "Gráficos", to: "/graficos", estado: "bloqueada", motivo: "Prepara Analítica." },
    ]);
  });

  it("la causa de Codificación distingue una base de varias", () => {
    const base = { xlsform: true, data: true, auditoria_run: true };
    expect(queSigue(sesion({ ...base, n_bases: 1 })).paso.causa).toBe("La codificación todavía no se ha aplicado.");
    expect(queSigue(sesion({ ...base, n_bases: 3 })).paso.causa).toBe(
      "La codificación no está aplicada en todas las bases.",
    );
  });

  it("con todo hecho no hay paso pendiente ni pendientes, y el botón lleva a Gráficos", () => {
    expect(queSigue(sesion(TODO_HECHO))).toEqual({
      completo: true,
      paso: { seccion: "graficos", to: "/graficos", accion: "Abrir Gráficos", titulo: "Sin pasos pendientes", causa: null },
      pendientes: [],
    });
  });

  it("no da el estudio por completo si a una base le falta su informe", () => {
    const estado = queSigue(
      sesion({ ...TODO_HECHO, bases_nombres: ["docentes", "egresados"], graficos_bases_sin_mazo: ["egresados"] }),
    );
    expect(estado.completo).toBe(false);
    expect(estado.paso.titulo).toBe("Generar el informe");
    expect(estado.paso.causa).toBe("Falta el mazo de egresados.");
    // La sección del paso no se repite entre los pendientes.
    expect(estado.pendientes).toEqual([]);
  });

  it("lo que falta en Gráficos aparece como pendiente cuando el paso es otro", () => {
    const estado = queSigue(
      sesion({
        ...TODO_HECHO,
        auditoria_run: false,
        bases_nombres: ["docentes", "egresados"],
        graficos_bases_sin_mazo: ["egresados"],
      }),
    );
    expect(estado.paso.seccion).toBe("validacion");
    expect(estado.pendientes).toEqual([
      { seccion: "graficos", nombre: "Gráficos", to: "/graficos", estado: "incompleta", motivo: "Falta el mazo de egresados." },
    ]);
  });
});

describe("motivoSinPrefijo", () => {
  it("quita el estado del motivo y deja la frase con mayúscula inicial", () => {
    expect(motivoSinPrefijo("Bloqueada: prepara Analítica.")).toBe("Prepara Analítica.");
    expect(motivoSinPrefijo("Falta el mazo de egresados.")).toBe("Falta el mazo de egresados.");
  });
});
