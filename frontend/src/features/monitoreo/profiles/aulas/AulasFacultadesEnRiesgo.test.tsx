import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AulasFacultadesEnRiesgo } from "./AulasFacultadesEnRiesgo";
import type { MonitoreoAulasEfectividadSeguimiento } from "../../../../api/monitoreo";

/**
 * «Si vemos que los titulares no confirman, poder ir reforzando con reemplazos
 * disponibles», partiendo de que «un refuerzo tampoco es una aplicación
 * garantizada» (Gonzalo, 2026-09-11). Lo segundo obliga a lo primero: si la
 * reserva también tiene que contactar y esperar confirmación, aguardar a que el
 * titular falle del todo llega tarde.
 */
const facultad = (sobre: Record<string, unknown> = {}) => ({
  facultad: "DERECHO", faculty_key: "derecho", aulas_aplicadas: 7,
  cuota: 363, conseguido: 147, cursos_agendados: 6, proyectado_agendado: 282,
  margen_agendado: -81, riesgo_agendado: "riesgo", cursos_sin_agendar: 6,
  cursos_en_gestion: 6, cursos_sin_via: 1, cursos_estancados: 2,
  cursos_vencidos: 0, elegibles_vencidos: 0, margen_restante: 216,
  reservas_libres: 207, tau_previsto: 0.568, ...sobre,
});

const bloque = (f: Record<string, unknown> = {}, total: Record<string, unknown> = {}) =>
  ({ total: { titulares_resueltos: 154, titulares_rechazo: 4, ...total },
     facultades: [facultad(f)] }) as unknown as MonitoreoAulasEfectividadSeguimiento;

const html = (b: MonitoreoAulasEfectividadSeguimiento) =>
  renderToStaticMarkup(<AulasFacultadesEnRiesgo bloque={b} celdasDeCuota={[]} plan={[]} />);

describe("«Facultades en riesgo»", () => {
  it("dice por dónde empezar sin presentarlo como la única puerta", () => {
    const out = html(bloque());
    expect(out).toContain("Empieza por sus");
    expect(out).toContain("no gastan reserva");
    // Y NO lo plantea como excluyente: el refuerzo sigue sobre la mesa.
    expect(out).not.toContain("antes que gastar reserva");
  });

  it("separa la gestión encallada de la que nadie ha llamado", () => {
    // Medido el 2026-09-11: de los 174 titulares, CERO estaban sin contactar.
    // «Te quedan 6 por agendar» hacía creer que eran seis llamadas por delante.
    expect(html(bloque())).toContain("ya están en gestión sin cerrar");
  });

  it("manda cubrir con reserva EN PARALELO cuando la gestión ya no va a cerrar sola", () => {
    const out = html(bloque());
    expect(out).toContain("no tiene teléfono válido");
    expect(out).toContain("llevan días sin cerrar");
    expect(out).toContain("en paralelo");
    // La razón, dicha: es la premisa de la que parte todo el consejo.
    expect(out).toContain("el refuerzo también tarda en confirmar");
  });

  it("sin señales de encalle no mete prisa: dice que la reserva sigue ahí", () => {
    const out = html(bloque({ cursos_sin_via: 0, cursos_estancados: 0 }));
    expect(out).toContain("Si no cierran, quedan sus reservas.");
    expect(out).not.toContain("en paralelo");
  });

  it("cuando ni su plan alcanza, el refuerzo va ya y además se cierra lo abierto", () => {
    const out = html(bloque({ margen_restante: -40 }));
    expect(out).toContain("contactar docentes");
    expect(out).toContain("además de cerrar lo que esté en gestión");
  });

  it("el pie advierte que ni el titular ni el refuerzo son aforo asegurado", () => {
    const out = html(bloque());
    expect(out).toContain("un refuerzo tampoco");
    expect(out).toContain("sólo se agenda cuando el docente confirma");
    // Con la base medida, no con una estimación.
    expect(out).toContain("de 154 titulares ya contactados (2.6 %)");
  });
});
