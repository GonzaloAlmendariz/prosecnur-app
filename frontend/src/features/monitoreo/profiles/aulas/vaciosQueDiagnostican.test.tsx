import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { AulasColaDeContacto } from "./AulasColaDeContacto";
import { AulasConsumoDelBanco } from "./AulasConsumoDelBanco";
import { AulasMedioDeContacto } from "./AulasMedioDeContacto";
import { AulasRitmoPorFacultad } from "./AulasRitmoPorFacultad";

/**
 * Un vacío tiene que decir POR QUÉ está vacío, y hay dos porqués.
 *
 * Estos tres paneles quedaban vacíos por dos causas muy distintas —que no hubiera
 * nada que mirar, o que lo hubiera y le faltara un campo— y daban el mismo
 * mensaje, el de la segunda. «Ningún parte de campo trae fecha de aplicación» en
 * un estudio que **todavía no ha salido a campo** manda a buscar un defecto en el
 * libro que no está ahí, y ese es el estado normal al abrir un proyecto.
 *
 * Es el mismo defecto que este perfil lleva corrigiendo en otras formas: un
 * rótulo que vale igual para dos diagnósticos opuestos esconde el que decide.
 * Siete paneles del perfil ya lo distinguían con un ternario; estos tres no.
 */

describe("un vacío nombra su causa, no la más grave", () => {
  it("sin partes de campo no acusa a los partes de venir sin fecha", () => {
    const vacio = renderToStaticMarkup(<AulasRitmoPorFacultad partes={[]} />);
    expect(vacio).toContain("Todavía no hay partes de campo");
    expect(vacio).not.toContain("trae fecha de aplicación");

    // Y con partes SIN fecha sí se acusa al dato, que ahí sí falta.
    const sinFecha = renderToStaticMarkup(
      <AulasRitmoPorFacultad partes={[
        { faculty: "Derecho", effective_surveys: 20 },
        { faculty: "Derecho", effective_surveys: 18 },
      ] as unknown as MonitoreoRow[]} />);
    expect(sinFecha).toContain("Ninguno de los 2 partes de campo trae fecha");
    expect(sinFecha).not.toContain("Todavía no hay partes de campo");
  });

  it("sin plan no acusa al plan de no declarar el medio de contacto", () => {
    const vacio = renderToStaticMarkup(<AulasMedioDeContacto filas={[]} />);
    expect(vacio).toContain("El plan todavía no trae cursos-horario");

    const sinMedio = renderToStaticMarkup(
      <AulasMedioDeContacto filas={[
        { operational_code: "CH 1" }, { operational_code: "CH 2" }, { operational_code: "CH 3" },
      ] as unknown as MonitoreoAulasPlanRow[]} />);
    expect(sinMedio).toContain("Ninguno de los 3 cursos-horario declara por qué medio");
  });

  it("con la cola vacía dice por qué no hay a quién llamar, y no culpa al libro", () => {
    const vacio = renderToStaticMarkup(<AulasColaDeContacto filas={[]} />);
    expect(vacio).toContain("El plan todavía no trae cursos-horario");

    // Dos reservas dormidas: hay plan, y aun así no hay a quién llamar. El
    // mensaje que había —«ninguno declara su ciclo de contacto»— mandaba a
    // rellenar un campo del libro que está perfectamente bien.
    const todasDormidas = renderToStaticMarkup(
      <AulasColaDeContacto filas={[
        { operational_code: "CH 1", sample_status: "en reserva" },
        { operational_code: "CH 2", sample_status: "en reserva" },
      ] as unknown as MonitoreoAulasPlanRow[]} />);
    expect(todasDormidas).toContain("No queda ningún curso-horario a quien llamar");
    expect(todasDormidas).toContain("los 2 del plan están citados, en reserva o ya reemplazados");
    expect(todasDormidas).not.toContain("declara su ciclo");
  });
});

describe("el vacío usa lo que el motor ya contó", () => {
  // NOTA: no hay test de «reemplazos sin fecha» porque **ese vacío no puede
  // ocurrir**. En `consumoDelBanco` la facultad se registra antes del chequeo de
  // fecha, así que un reemplazo sin fecha siempre produce entrada. Lo comprobó
  // este archivo: el aserto que lo esperaba fallaba con el panel ya reparado.

  it("sin ningún reemplazo sí da la buena noticia, y sin plan no la da", () => {
    const sinReemplazos = renderToStaticMarkup(
      <AulasConsumoDelBanco filas={[
        { operational_code: "CH 1", faculty: "Derecho", sample_status: "aplicada" },
      ] as unknown as MonitoreoAulasPlanRow[]} />);
    expect(sinReemplazos).toContain("Ningún curso-horario ha sido reemplazado todavía");

    const sinPlan = renderToStaticMarkup(<AulasConsumoDelBanco filas={[]} />);
    expect(sinPlan).toContain("El plan todavía no trae cursos-horario");
    expect(sinPlan).not.toContain("ha sido reemplazado todavía");
  });
});

describe("«med.» no es una unidad", () => {
  /**
   * Tres cursos-horario ya citados, con intentos: eso llena «lo que costó».
   *
   * La cita se declara con `sample_status: "agendada"`, no con `scheduled_date`:
   * `tieneCita()` mira el estado de muestra. Con la fecha sola las tres filas
   * caían en la cola de pendientes y el panel no pintaba el bloque de esfuerzo.
   */
  const citados = [
    { operational_code: "CH 1", faculty: "Derecho", contact_attempts: 2, sample_status: "agendada" },
    { operational_code: "CH 2", faculty: "Derecho", contact_attempts: 2, sample_status: "agendada" },
    { operational_code: "CH 3", faculty: "Derecho", contact_attempts: 3, sample_status: "agendada" },
  ] as unknown as MonitoreoAulasPlanRow[];

  it("la cola dice «intentos» y declara que es la mediana", () => {
    // Decía «2 med.», y en un perfil cuyo panel vecino se llama «Medio de
    // contacto» eso se lee como **2 medios**: la lectura natural es la falsa.
    // Y aquí no hay cabecera de columna que declare la unidad.
    const html = renderToStaticMarkup(<AulasColaDeContacto filas={citados} />);
    expect(html).not.toContain("med.");
    expect(html).toContain("intentos");
    expect(html).toContain("mediana de intentos");
  });

  it("medio de contacto no repite la unidad: su columna ya se llama «Intentos»", () => {
    const html = renderToStaticMarkup(
      <AulasMedioDeContacto filas={[
        { operational_code: "CH 1", faculty: "Derecho", contact_medium: "llamada",
          contact_attempts: 2, sample_status: "agendada" },
        { operational_code: "CH 2", faculty: "Derecho", contact_medium: "llamada",
          contact_attempts: 4, sample_status: "agendada" },
      ] as unknown as MonitoreoAulasPlanRow[]} />);
    expect(html).not.toContain("med.");
    // La unidad sigue declarada donde toca: la cabecera y el pie.
    expect(html).toContain("<span>Intentos</span>");
    expect(html).toContain("<strong>mediana</strong>");
  });
});
