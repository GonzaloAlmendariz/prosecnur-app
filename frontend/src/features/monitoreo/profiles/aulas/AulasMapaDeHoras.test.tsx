// AulasMapaDeHoras.test.tsx — la superficie del «Mapa de horas» y su sitio en
// la Agenda (dictado de Gonzalo 2026-09-01: «que el gráfico de la separación
// de tiempo… se vea mejor»).
//
// Wiring pineado ligero, patrón eslabonDeLaAgenda: la geometría fina la
// verifica el helper (mapaDeHoras.test.ts); aquí se fija lo que la superficie
// DICE — el pico protagonista, la tentativa distinguible, los pendientes
// declarados y los vacíos con dueño.
import { describe, expect, it } from "vitest";

import { renderToStaticMarkup } from "react-dom/server";

import { AulasMapaDeHoras } from "./AulasMapaDeHoras";
import { AulasSeccionModelo } from "./AulasSeccionModelo";
import type { MonitoreoAulasDashboard, MonitoreoAulasFranjas } from "../../../../api/monitoreo";

const franjas: MonitoreoAulasFranjas = {
  dias: [
    {
      fecha: "2026-09-08",
      ventanas: [
        { codigo: "CH 1", inicio: "18:45", fin: "19:05", confirmada: true },
        { codigo: "CH 2", inicio: "19:00", fin: "19:20", confirmada: true },
        { codigo: "CH 5", inicio: "17:00", fin: "20:00", confirmada: false },
      ],
      pico: { aulas: 2, inicio: "19:00", fin: "19:05" },
      por_confirmar: ["CH 5", "CH 3"],
    },
  ],
  personas_fuente: "confirmadas",
};

describe("AulasMapaDeHoras", () => {
  const html = renderToStaticMarkup(<AulasMapaDeHoras franjas={franjas} />);

  it("el pico es el protagonista del día: cuánta gente hace falta y cuándo", () => {
    // C5: ese número dimensiona a los aplicadores. Va como lectura del día,
    // no como tooltip. «Citas a la vez» y no «aulas»: la unidad del perfil es
    // el curso-horario (ADR 0060, ratchet de vocabulario) y lo que coincide
    // son citas confirmadas — cada una pide su aplicador.
    expect(html).toContain("2 aplicaciones a la vez");
    expect(html).toContain("19:00–19:05");
  });

  it("la cabecera dice el pico del operativo entero", () => {
    expect(html).toContain("hasta 2 aplicaciones a la vez");
    expect(html).toContain("Martes 08/09");
  });

  it("cada cita se lee por sí sola, con su ventana", () => {
    expect(html).toContain("CH 1: de 18:45 a 19:05");
  });

  it("la franja tentativa se distingue de la cita pactada", () => {
    expect(html).toContain("es-tentativa");
    expect(html).toContain("CH 5: de 17:00 a 20:00, por confirmar");
  });

  it("los por confirmar del día están en el marco, no escondidos (C3)", () => {
    expect(html).toContain("Por confirmar");
    expect(html).toContain("CH 3");
  });

  it("declara de qué citas sale el pico", () => {
    // Dictado 2026-09-03: la unidad del reparto es la aplicación.
    expect(html).toContain("aplicaciones confirmadas");
  });

  it("sin bloque en el payload la ausencia se declara, no se rompe (C3)", () => {
    const sinBloque = renderToStaticMarkup(<AulasMapaDeHoras franjas={undefined} />);
    expect(sinBloque).toContain("Mapa de horas");
    expect(sinBloque).toContain("no trae el mapa de horas");
  });

  it("con bloque y cero días el vacío tiene dueño y no cuenta sobre cero", () => {
    const vacio = renderToStaticMarkup(
      <AulasMapaDeHoras franjas={{ dias: [], personas_fuente: "confirmadas" }} />,
    );
    expect(vacio).toContain("Mapa de horas");
    expect(vacio).toContain("Ninguna cita");
    // El guard de la casa: nada de «de los 0».
    expect(vacio.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ")).not.toMatch(/\bde (los |las )?0\b/);
  });

  it("cuarenta pendientes se muestran COMPLETOS: el techo quedó revocado", () => {
    // Este pin decía lo contrario —recortar a 12 con «y N más»— y el dueño
    // revocó ese techo mirando la pantalla (dictado 2026-09-02: «no pones las
    // cosas completas y actúas como si no tuvieras espacio cuando la pestaña
    // puede darle más espacio sin problema»). La lista larga se ORGANIZA
    // —crece hacia abajo y la sección scrollea—, no se esconde. El total sigue
    // declarado delante, que es lo que deja verificar la lista de un vistazo.
    const muchos = renderToStaticMarkup(
      <AulasMapaDeHoras
        franjas={{
          dias: [{
            fecha: "2026-09-08",
            ventanas: [],
            pico: { aulas: 0 },
            por_confirmar: Array.from({ length: 40 }, (_, i) => `CH ${i + 1}`),
          }],
          personas_fuente: "confirmadas",
        }}
      />,
    );
    expect(muchos).toContain("Por confirmar · 40:");
    expect(muchos).toContain("CH 40");
    expect(muchos).not.toContain("más (la lista completa está en la tabla de la agenda)");
  });

  it("una hora ilegible del libro se declara en vez de esfumarse", () => {
    const roto = renderToStaticMarkup(
      <AulasMapaDeHoras
        franjas={{
          dias: [{
            fecha: "2026-09-08",
            ventanas: [
              { codigo: "CH 1", inicio: "18:45", fin: "19:05", confirmada: true },
              { codigo: "CH 9", inicio: "", fin: "19:05", confirmada: true },
            ],
            pico: { aulas: 1, inicio: "18:45", fin: "19:05" },
            por_confirmar: [],
          }],
          personas_fuente: "confirmadas",
        }}
      />,
    );
    expect(roto).toContain("hora ilegible");
  });
});

describe("el Mapa de horas vive en la Agenda, debajo de «Aulas agendadas»", () => {
  const tablero = {
    agenda: [{ operational_code: "CH 1", sample_role: "titular" }],
    course_status: [],
    kpis: { aulas_titulares: 1 },
    generated_at: "2026-09-01",
    franjas,
  } as unknown as MonitoreoAulasDashboard;

  const pinta = (pestana: string, dashboard: MonitoreoAulasDashboard = tablero) =>
    renderToStaticMarkup(
      <AulasSeccionModelo
        dashboard={dashboard}
        pestana={pestana}
        facultadEnFoco={undefined}
        onFoco={() => {}}
        tabla={() => null}
        traza={null}
        agendaRows={(d) => (d?.agenda ?? []) as unknown as Array<Record<string, unknown>>}
        agendaReservas={() => 0}
      />,
    );

  it("en la pestaña Agenda el panel existe y declara su geometría (C1)", () => {
    const html = pinta("agenda");
    const posTabla = html.indexOf("Aulas agendadas");
    const posMapa = html.indexOf("Mapa de horas");
    expect(posTabla).toBeGreaterThanOrEqual(0);
    expect(posMapa).toBeGreaterThan(posTabla);
    expect(html).toContain('data-qa-geometry-group="aulas-mapa-horas"');
    expect(html).toContain('data-qa-geometry-contract="intrinsic"');
  });

  it("las otras pestañas no lo cargan: es lectura de la agenda", () => {
    for (const pestana of ["carga", "contacto", "facultad"]) {
      expect(pinta(pestana)).not.toContain("Mapa de horas");
    }
  });

  it("un dashboard viejo sin `franjas` deja el panel declarando su ausencia", () => {
    const viejo = { ...tablero, franjas: undefined } as MonitoreoAulasDashboard;
    expect(pinta("agenda", viejo)).toContain("no trae el mapa de horas");
  });
});
