import { describe, expect, it } from "vitest";

import type { SessionState } from "../../../api/core";
import { seccionesDeProcesamiento } from "./seccionesDeProcesamiento";

// Las reglas salieron de `app/Layout.tsx` (`useNavItems`) sin cambiar. Estas
// pruebas fijan el comportamiento que la banda ya tenía, caso por caso.

function sesion(parcial: Partial<SessionState>): SessionState {
  return parcial as SessionState;
}

const resumen = (state: SessionState | null) =>
  seccionesDeProcesamiento(state).map(({ to, done, blockedReason, faltaReason }) => ({
    to,
    done,
    blockedReason,
    faltaReason,
  }));

describe("seccionesDeProcesamiento", () => {
  it("conserva las cinco secciones, su orden, su ruta y su numeral", () => {
    expect(seccionesDeProcesamiento(null).map(({ to, n, label }) => ({ to, n, label }))).toEqual([
      { to: "/carga", n: 1, label: "Carga" },
      { to: "/validacion", n: 2, label: "Validación" },
      { to: "/codificacion", n: 3, label: "Codificación" },
      { to: "/analitica", n: 4, label: "Analítica" },
      { to: "/graficos", n: 5, label: "Gráficos" },
    ]);
  });

  it("sin sesión todo está por hacer y bloqueado salvo Carga", () => {
    expect(resumen(null)).toEqual([
      { to: "/carga", done: false, blockedReason: undefined, faltaReason: undefined },
      { to: "/validacion", done: false, blockedReason: "Bloqueada: carga un XLSForm en Carga.", faltaReason: undefined },
      { to: "/codificacion", done: false, blockedReason: "Bloqueada: completa carga y consolidación.", faltaReason: undefined },
      { to: "/analitica", done: false, blockedReason: "Bloqueada: completa carga y consolidación.", faltaReason: undefined },
      { to: "/graficos", done: false, blockedReason: "Bloqueada: prepara Analítica.", faltaReason: undefined },
    ]);
  });

  it("con formulario y sin respuestas abre Validación y mantiene bloqueadas Codificación y Analítica", () => {
    const r = resumen(sesion({ xlsform: true, data: false }));
    expect(r[0].done).toBe(false);
    expect(r[1].blockedReason).toBeUndefined();
    expect(r[2].blockedReason).toBe("Bloqueada: completa carga y consolidación.");
    expect(r[3].blockedReason).toBe("Bloqueada: completa carga y consolidación.");
  });

  it("marca hecha cada sección con su indicador de la sesión", () => {
    const r = resumen(
      sesion({
        xlsform: true,
        data: true,
        auditoria_run: true,
        codif_aplicado: true,
        analitica_prep_ok: true,
        graficos_ppt_ok: true,
      }),
    );
    expect(r.map((s) => s.done)).toEqual([true, true, true, true, true]);
    expect(r.every((s) => s.blockedReason === undefined && s.faltaReason === undefined)).toBe(true);
  });

  it("Gráficos incompleto lleva `faltaReason` y no `blockedReason`", () => {
    const r = resumen(
      sesion({
        xlsform: true,
        data: true,
        analitica_prep_ok: true,
        graficos_ppt_ok: true,
        bases_nombres: ["docentes", "egresados"],
        graficos_bases_sin_mazo: ["egresados"],
      }),
    );
    expect(r[4]).toEqual({
      to: "/graficos",
      done: false,
      blockedReason: undefined,
      faltaReason: "Falta el mazo de egresados.",
    });
  });

  it("sin Analítica preparada, lo que falta en Gráficos no se dice: la sección está bloqueada", () => {
    const r = resumen(
      sesion({
        xlsform: true,
        data: true,
        analitica_prep_ok: false,
        bases_nombres: ["docentes", "egresados"],
        graficos_bases_sin_mazo: ["egresados"],
      }),
    );
    expect(r[4].blockedReason).toBe("Bloqueada: prepara Analítica.");
    expect(r[4].faltaReason).toBeUndefined();
  });
});
