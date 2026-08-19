import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { AulasColaDeContacto } from "./AulasColaDeContacto";
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
