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
  codigos_sin_via: ["CH 89"],
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
    // Quedan 6 sin fecha y sólo 2 en gestión: hay por dónde empezar.
    const out = html(bloque({ cursos_en_gestion: 2 }));
    expect(out).toContain("Empieza por sus");
    expect(out).toContain("no gastan reserva");
    // Y NO lo plantea como excluyente: el refuerzo sigue sobre la mesa.
    expect(out).not.toContain("antes que gastar reserva");
  });

  it("cuando TODO lo que queda está en gestión no dice «empieza por» y se contradice", () => {
    // Visto en pantalla el 2026-09-11 en Psicología: «Empieza por sus 2 […] pero
    // 2 ya están en gestión sin cerrar» se desmiente a sí mismo.
    const out = html(bloque({ cursos_sin_agendar: 2, cursos_en_gestion: 2 }));
    expect(out).toContain("ya están todos en gestión sin cerrar");
    expect(out).not.toContain("Empieza por");
  });

  it("en singular concuerda: ni «sus 1 curso-horario» ni «no gastan»", () => {
    const out = html(bloque({ cursos_sin_agendar: 1, cursos_en_gestion: 0,
                              cursos_sin_via: 0, cursos_estancados: 0 }));
    expect(out).toContain("Empieza por el curso-horario que le queda sin fecha");
    expect(out).toContain("bastaría y no gasta reserva");
    expect(out).toContain("Si no cierra, queda su reserva.");
  });

  it("separa la gestión encallada de la que nadie ha llamado", () => {
    // Medido el 2026-09-11: de los 174 titulares, CERO estaban sin contactar.
    // «Te quedan 6 por agendar» hacía creer que eran seis llamadas por delante.
    expect(html(bloque({ cursos_en_gestion: 2 }))).toContain("ya están en gestión");
  });

  it("manda cubrir con reserva EN PARALELO cuando la gestión ya no va a cerrar sola", () => {
    const out = html(bloque());
    // Con el código delante deja de ser un diagnóstico y pasa a ser una llamada
    // que hacer: medido en Derecho, CH 89 es una de las tres.
    expect(out).toContain("CH 89 no tiene teléfono válido");
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

describe("los códigos del aviso", () => {
  const conCodigos = (codigos: string[], cuantas: number) =>
    renderToStaticMarkup(<AulasFacultadesEnRiesgo
      bloque={bloque({ cursos_sin_via: cuantas, codigos_sin_via: codigos, cursos_estancados: 0 })}
      celdasDeCuota={[]} plan={[]} />);

  it("lista los que caben y cuenta el resto", () => {
    // Tope de tres: más nombres en una línea dejan de leerse.
    const out = conCodigos(["CH 3", "CH 17", "CH 89"], 6);
    expect(out).toContain("CH 3, CH 17, CH 89 y 3 más no tienen teléfono válido");
  });

  it("sin códigos cae al conteo en vez de publicar una lista vacía", () => {
    expect(conCodigos([], 2)).toContain("no tienen teléfono válido");
  });
});
