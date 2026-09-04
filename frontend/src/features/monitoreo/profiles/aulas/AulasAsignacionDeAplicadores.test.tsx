import { describe, expect, it } from "vitest";

import { renderToStaticMarkup } from "react-dom/server";

import { AulasAsignacionDeAplicadores } from "./AulasAsignacionDeAplicadores";
import { repartoDeAplicadores } from "./repartoDeAplicadores";
import type { MonitoreoAulasReparto } from "../../../../api/monitoreo";

const pinta = (crudo: unknown, lugares?: ReadonlyMap<string, string>) =>
  renderToStaticMarkup(
    <AulasAsignacionDeAplicadores
      reparto={repartoDeAplicadores(crudo as MonitoreoAulasReparto | null)}
      lugares={lugares}
    />,
  );

const REPARTO = {
  dias: [
    {
      fecha: "2026-09-11",
      asignaciones: [
        { codigo: "CH 1", aplicador: "Ana Prueba", inicio: "10:00", fin: "10:20" },
        { codigo: "CH 3", aplicador: "Berta Ficticia", inicio: "15:00", fin: "15:20" },
      ],
      no_cubiertos: ["CH 2"],
      por_confirmar: ["CH 7"],
    },
  ],
  equidad: [
    { aplicador: "Ana Prueba", asignadas: 1 },
    { aplicador: "Berta Ficticia", asignadas: 1 },
    { aplicador: "Mario Sintetico", asignadas: 0 },
  ],
};

/**
 * El cuarto cuadro de Carga de campo (dictado 2026-09-02: «una pestaña de
 * asignación… equitativa… pero que sea repetible por si llegan nuevas
 * confirmaciones»): el reparto vigente por día, con lo descubierto DESTACADO
 * y las cargas por aplicador con los ceros a la vista.
 */
describe("AulasAsignacionDeAplicadores", () => {
  it("sin la clave en sesión declara que el reparto necesita la disponibilidad", () => {
    const html = pinta(null);
    expect(html).toContain("disponibilidad de los aplicadores");
    expect(html).toContain("data-qa-geometry-member");
  });

  it("lista cada día con sus citas: quién va, a qué cita y en qué ventana", () => {
    const html = pinta(REPARTO);
    expect(html).toContain("Viernes 11/09");
    expect(html).toContain("CH 1");
    // Dictado 2026-09-04: cada hora lleva su verbo, y el rango se lee «a».
    expect(html).toContain("aplica 10:00 a 10:20");
    expect(html).toContain("Ana Prueba");
  });

  it("el lugar de la cita va en su chip, con el color de su letra", () => {
    // Dictado 2026-09-02 (sistema de chips): la tabla de Asignación lleva la
    // columna del lugar; el color sale de `tonoDePabellon` — determinista, el
    // mismo A206 del detalle de la malla. Sin mapa, la columna calla.
    const conLugares = pinta(REPARTO, new Map([["CH 1", "A206"]]));
    expect(conLugares).toContain(">Lugar<");
    expect(conLugares).toMatch(/aulas-chip-lugar es-tono-\d">A206</);
    expect(pinta(REPARTO)).not.toContain("A206");
  });

  it("lo descubierto va destacado: es el problema operativo, no un pie de página", () => {
    const html = pinta(REPARTO);
    expect(html).toContain("aulas-asigna-descubiertos");
    expect(html).toContain("sin nadie que llegue");
    expect(html).toContain("CH 2");
    // Y el KPI lo cuenta arriba, no solo dentro del día.
    expect(html).toContain("Sin nadie que llegue");
  });

  it("la equidad enseña también a los de cero: estar libre es un dato", () => {
    const html = pinta(REPARTO);
    expect(html).toContain("Mario Sintetico");
    expect(html).toMatch(/Mario Sintetico[^]*?>0</);
  });

  it("promete su vigencia en una línea: se recalcula con cada Recargar", () => {
    expect(pinta(REPARTO)).toContain("se recalcula con cada Recargar");
  });

  it("declara lo por confirmar sin inventarle gente", () => {
    const html = pinta(REPARTO);
    expect(html).toContain("Por confirmar");
    expect(html).toContain("CH 7");
    expect(html).toContain("no piden gente todavía");
  });

  it("las listas van COMPLETAS: el techo con «y N más» quedó revocado", () => {
    // Dictado 2026-09-02, mirando un detalle recortado: «no pones las cosas
    // completas y actúas como si no tuvieras espacio cuando la pestaña puede
    // darle más espacio sin problema». Doce descubiertos son doce códigos en
    // pantalla; la línea envuelve y crece, no esconde.
    const html = pinta({
      dias: [{
        fecha: "2026-09-11",
        asignaciones: [],
        no_cubiertos: Array.from({ length: 12 }, (_, i) => `CH ${i + 1}`),
        por_confirmar: [],
      }],
      equidad: [{ aplicador: "Ana Prueba", asignadas: 0 }],
    });
    expect(html).toContain("CH 12");
    expect(html).not.toContain("más");
  });

  it("cargada y sin citas pactadas: nada que repartir, con el equipo a la vista", () => {
    const html = pinta({
      dias: [],
      equidad: [{ aplicador: "Ana Prueba", asignadas: 0 }],
    });
    expect(html).toContain("Nada que repartir todavía");
    // El equipo libre sigue visible: el rail no desaparece con el vacío (C2).
    expect(html).toContain("Ana Prueba");
    expect(html).not.toContain("libro de disponibilidad");
  });

  it("con el rango vigente el botón narra el estado: Aplicado ✓, no un gris mudo", () => {
    // Dictado 2026-09-03 («no me permite ni aplicar ni resortear… es poco
    // intuitivo»): aplicar sí trabajaba, pero el botón deshabilitado de
    // después se leía como roto. Con el rango tecleado = el que rige, el
    // botón lo DICE; y el de limpiar se llama por su acción, no por su
    // destino a secas.
    const html = renderToStaticMarkup(
      <AulasAsignacionDeAplicadores
        reparto={repartoDeAplicadores({
          ...REPARTO,
          rango: { desde: "2026-09-07", hasta: "2026-09-12" },
          semilla: 1,
        } as unknown as MonitoreoAulasReparto)}
        onDeclararRango={() => {}}
        onResortear={() => {}}
      />,
    );
    expect(html).toContain("Aplicado ✓");
    expect(html).toContain("Volver a todo el horizonte");
    // El resorteo declara en cuál sorteo va (semilla 1 = sorteo n.º 2).
    expect(html).toContain("Resortear");
    expect(html).toContain("sorteo n.º 2");
  });
});

/**
 * B36 (dictado 2026-09-02: «que tengo mecanismo propio de asignación y
 * reasignación, que sea equitativo»): con onFijar la superficie es de
 * escritura — selector por cita, descubiertos resolubles y huérfanas con
 * soltar; sin onFijar sigue siendo la hoja de solo lectura de siempre.
 */
describe("AulasAsignacionDeAplicadores — el mecanismo de fijar (B36)", () => {
  const CON_FIJADA = {
    dias: [
      {
        fecha: "2026-09-11",
        asignaciones: [
          { codigo: "CH 1", aplicador: "Zoe Tardia", inicio: "10:00", fin: "10:20", fijada: true, advertencia: "sin_disponibilidad" },
          { codigo: "CH 3", aplicador: "Ana Prueba", inicio: "15:00", fin: "15:20", fijada: false },
        ],
        no_cubiertos: ["CH 2"],
        por_confirmar: [],
      },
    ],
    equidad: [
      { aplicador: "Ana Prueba", asignadas: 1 },
      { aplicador: "Zoe Tardia", asignadas: 1 },
    ],
    fijadas: [{ codigo: "CH 1", aplicador: "Zoe Tardia" }, { codigo: "CH 99", aplicador: "Ana Prueba" }],
    fijadas_sin_cita: ["CH 99"],
  };
  const conFijar = (crudo: unknown) =>
    renderToStaticMarkup(
      <AulasAsignacionDeAplicadores
        reparto={repartoDeAplicadores(crudo as MonitoreoAulasReparto | null)}
        onFijar={() => {}}
      />,
    );

  it("cada cita lleva su selector con el NOMBRE, y el sello dice de quién fue la decisión", () => {
    // Dictado 2026-09-04: «automático no necesita una palabra grandota y un
    // guion, eso es muy AI slop; necesita tener el nombre». La palabra pasó
    // a un sello pequeño al lado, que además cambia a manual al tocarla.
    const html = conFijar(CON_FIJADA);
    expect(html).toContain("aulas-asigna-selector");
    expect(html).not.toContain("Automático —");
    // La automática lleva `selected` en esa misma opción, así que el
    // atributo se deja pasar: lo que se afirma es que el texto de la
    // opción del automático es el NOMBRE, sin rótulo delante.
    expect(html).toMatch(/<option value=""[^>]*>Ana Prueba<\/option>/);
    expect(html).toContain("automática");
    expect(html).toContain("Ana Prueba · 1");
  });

  it("la puesta a mano se sella como manual, y ese sello es el camino de vuelta", () => {
    const html = conFijar(CON_FIJADA);
    expect(html).toContain("aulas-asigna-sello es-manual");
    expect(html).toContain("manual");
    // Dictado 2026-09-04: sin este botón, deshacer obligaba a buscar una
    // opción «Automático» dentro de una lista de treinta y un nombres.
    expect(html).toContain("Devolver al reparto automático");
    expect(html).toContain("fuera de su disponibilidad declarada");
  });

  it("la cita descubierta se resuelve ahí mismo: elegir a alguien la fija", () => {
    const html = conFijar(CON_FIJADA);
    expect(html).toContain("fijar a…");
  });

  it("la fijación huérfana se declara con su soltar — se conserva, no se limpia sola", () => {
    const html = conFijar(CON_FIJADA);
    expect(html).toContain("Fijaciones sin cita pactada");
    expect(html).toContain("CH 99");
    expect(html).toContain("soltar");
  });

  it("sin onFijar no hay selectores: la hoja de solo lectura de siempre", () => {
    const html = pinta(CON_FIJADA);
    expect(html).not.toContain("aulas-asigna-selector");
    expect(html).not.toContain("soltar");
  });
});

/**
 * El día QUE TOCA protagoniza (régimen 2026-09-02: el énfasis es «cómo se va
 * a desplegar a los aplicadores»): el primer día no pasado lleva su sello,
 * lo pasado se atenúa y se rotula, y el futuro lejano queda neutro.
 */
describe("AulasAsignacionDeAplicadores — el día que toca", () => {
  const DOS_DIAS = {
    dias: [
      { fecha: "2026-09-07", asignaciones: [{ codigo: "CH 1", aplicador: "Ana Prueba", inicio: "10:00", fin: "10:20" }], no_cubiertos: [], por_confirmar: [] },
      { fecha: "2026-09-14", asignaciones: [{ codigo: "CH 2", aplicador: "Ana Prueba", inicio: "09:00", fin: "09:20" }], no_cubiertos: [], por_confirmar: [] },
    ],
    equidad: [{ aplicador: "Ana Prueba", asignadas: 2 }],
  };
  const pintaCon = (hoy: string) =>
    renderToStaticMarkup(
      <AulasAsignacionDeAplicadores reparto={repartoDeAplicadores(DOS_DIAS as unknown as MonitoreoAulasReparto)} hoy={hoy} />,
    );

  it("el KPI del despliegue abre la vista: cuántas citas trae la próxima salida", () => {
    // «el que toca» cayó en el mapa de jergas (dictado 2026-09-03): el
    // vocabulario del lector es «próxima salida».
    const html = pintaCon("2026-09-05");
    expect(html).toMatch(/Lunes 07\/09 · próxima salida/);
  });

  it("entre dos fechas futuras, la primera es la que toca y la otra queda neutra", () => {
    const html = pintaCon("2026-09-05");
    expect(html).toMatch(/es-el-que-toca[\s\S]*Lunes 07\/09/);
    expect(html).not.toContain("es-pasado");
    expect((html.match(/es-el-que-toca/g) ?? []).length).toBe(1);
  });

  it("el día de hoy se sella como «hoy, salida de campo»", () => {
    expect(pintaCon("2026-09-07")).toContain("hoy, salida de campo");
  });

  it("ningún em dash sobrevive en la vista (dictado 2026-09-04: «basta»)", () => {
    // El guion de «sin dato» sigue siendo legítimo en una celda vacía; lo
    // que se fue es el em dash usado como puntuación de una frase.
    const html = pintaCon("2026-09-07");
    expect(html).not.toMatch(/\w\s—\s\w/);
  });

  it("lo pasado se atenúa y se rotula; el que toca salta al siguiente", () => {
    const html = pintaCon("2026-09-10");
    expect(html).toMatch(/es-pasado[\s\S]*Lunes 07\/09/);
    expect(html).toContain("ya pasó");
    expect(html).toMatch(/es-el-que-toca[\s\S]*Lunes 14\/09/);
  });
});

describe("AulasAsignacionDeAplicadores — el rail como hoja de despliegue", () => {
  it("cada aplicador con cita en el día que toca lleva su hora y su destino; quien no sale, no", () => {
    const html = renderToStaticMarkup(
      <AulasAsignacionDeAplicadores
        reparto={repartoDeAplicadores({
          dias: [{
            fecha: "2026-09-07",
            asignaciones: [
              { codigo: "CH 1", aplicador: "Ana Prueba", inicio: "10:00", fin: "10:20" },
              { codigo: "CH 3", aplicador: "Ana Prueba", inicio: "15:00", fin: "15:20" },
            ],
            no_cubiertos: [], por_confirmar: [],
          }],
          equidad: [
            { aplicador: "Ana Prueba", asignadas: 2 },
            { aplicador: "Mario Sintetico", asignadas: 0 },
          ],
        } as unknown as MonitoreoAulasReparto)}
        lugares={new Map([["CH 1", "A703"]])}
        hoy="2026-09-05"
      />,
    );
    // La PRIMERA cita del día que toca, con su pabellón resuelto por el mapa.
    expect(html).toMatch(/aulas-asigna-despliegue[\s\S]{0,200}10:00[\s\S]{0,200}A703/);
    // Una sola línea de despliegue: Mario no sale ese día.
    expect((html.match(/aulas-asigna-despliegue/g) ?? []).length).toBe(1);
  });
});

/**
 * Dictado 2026-09-04, dos indicaciones sobre la MISMA superficie:
 *
 * 1. «Igual esto puede ser seleccionable o no; en este caso sí quiero que se
 *    active. Es mejor que un aplicador haga sus aplicaciones [el mismo día]…
 *    que sus cursos-horario no estén dispersos en toda la semana, sino
 *    concentrados en un día o dos como máximo».
 * 2. «Quiénes no tienen asignación deben estar al principio; quiénes tienen
 *    mayor asignación, en cuántos días toma en cuenta esa asignación; y si le
 *    doy clic a un aplicador, que me diga: aplica este día y este otro».
 */
describe("AulasAsignacionDeAplicadores — concentrar el día del aplicador", () => {
  const TRES_DIAS = {
    dias: [
      {
        fecha: "2026-09-07",
        asignaciones: [
          { codigo: "CH 1", aplicador: "Ana Prueba", inicio: "10:00", fin: "10:20" },
          { codigo: "CH 2", aplicador: "Ana Prueba", inicio: "12:00", fin: "12:20" },
          { codigo: "CH 3", aplicador: "Berta Ficticia", inicio: "09:00", fin: "09:20" },
        ],
        no_cubiertos: [], por_confirmar: [],
      },
      {
        fecha: "2026-09-14",
        asignaciones: [{ codigo: "CH 4", aplicador: "Berta Ficticia", inicio: "16:00", fin: "16:20" }],
        no_cubiertos: [], por_confirmar: [],
      },
    ],
    equidad: [
      { aplicador: "Ana Prueba", asignadas: 2 },
      { aplicador: "Berta Ficticia", asignadas: 2 },
      { aplicador: "Mario Sintetico", asignadas: 0 },
    ],
    concentrado: true,
  };
  const conToggle = (crudo: unknown) =>
    renderToStaticMarkup(
      <AulasAsignacionDeAplicadores
        reparto={repartoDeAplicadores(crudo as MonitoreoAulasReparto | null)}
        onConcentrar={() => {}}
        hoy="2026-09-05"
      />,
    );

  it("el criterio es un INTERRUPTOR del panel y dice el estado del MOTOR, no un deseo local", () => {
    // Dictado 2026-09-04: «no debe ser un check, debe ser un switch». Un
    // criterio que queda puesto no es una casilla de formulario.
    const encendido = conToggle(TRES_DIAS);
    expect(encendido).toContain("Concentrar el día del aplicador");
    expect(encendido).toMatch(/aulas-asigna-concentrar[\s\S]{0,320}role="switch"[\s\S]{0,120}aria-checked="true"/);
    expect(encendido).not.toContain('type="checkbox"');
    // Apagado en el motor = interruptor apagado: la UI no puede decir lo
    // contrario de lo que armó el reparto que está pintando abajo.
    expect(conToggle({ ...TRES_DIAS, concentrado: false }))
      .toMatch(/aulas-asigna-concentrar[\s\S]{0,320}aria-checked="false"/);
  });

  it("sin onConcentrar el mando no se pinta: la hoja de solo lectura de siempre", () => {
    expect(pinta(TRES_DIAS)).not.toContain("Concentrar el día del aplicador");
  });

  it("sin fechas de asignación el control lo DICE: dos casillas vacías no lo declaran", () => {
    // Dictado 2026-09-04: «la asignación nunca va a ser total… siempre voy a
    // tener que establecer una fecha de asignación… y la app también sepa que
    // eso debe ser así». Repartir todo el horizonte no es el modo de trabajo:
    // que sea el estado vigente se dice, no se infiere del hueco.
    const sinRango = renderToStaticMarkup(
      <AulasAsignacionDeAplicadores
        reparto={repartoDeAplicadores(TRES_DIAS as unknown as MonitoreoAulasReparto)}
        onDeclararRango={() => {}}
        hoy="2026-09-05"
      />,
    );
    expect(sinRango).toContain("sin fechas: se reparte todo el horizonte");
    // Con el rango puesto la nota desaparece y manda el botón de limpiar.
    const conRango = renderToStaticMarkup(
      <AulasAsignacionDeAplicadores
        reparto={repartoDeAplicadores({ ...TRES_DIAS, rango: { desde: "2026-09-07", hasta: "2026-09-12" } } as unknown as MonitoreoAulasReparto)}
        onDeclararRango={() => {}}
        hoy="2026-09-05"
      />,
    );
    expect(conRango).not.toContain("sin fechas: se reparte todo el horizonte");
    expect(conRango).toContain("Volver a todo el horizonte");
  });

  it("el rail abre con los que no tienen nada y sigue de mayor a menor carga", () => {
    const html = conToggle(TRES_DIAS);
    const orden = [...html.matchAll(/aulas-asigna-nombre">([^<]+)</g)].map((m) => m[1]);
    // «Quiénes no tienen asignación deben estar al principio»: Mario abre,
    // aunque el motor entregue la equidad en alfabeto.
    expect(orden).toEqual(["Mario Sintetico", "Ana Prueba", "Berta Ficticia"]);
  });

  it("cada carga dice en cuántos DÍAS cae: dos el mismo día no es lo mismo que dos sueltos", () => {
    const html = conToggle(TRES_DIAS);
    // Ana concentró sus dos en el 07; Berta las tiene partidas en dos días.
    expect(html).toMatch(/Ana Prueba[\s\S]{0,400}aulas-asigna-ndias[^>]*>\s*1\s*día/);
    expect(html).toMatch(/Berta Ficticia[\s\S]{0,400}aulas-asigna-ndias[^>]*>\s*2\s*días/);
    // Y el nombre accesible lo dice también: la marca no es solo pintura.
    expect(html).toContain("2 aplicaciones asignadas en 1 día");
    expect(html).toContain("2 aplicaciones asignadas en 2 días");
    // Quien está libre no lleva marca de días: no tiene ninguno.
    expect(html).toMatch(/Mario Sintetico[\s\S]{0,200}>0</);
    expect(html).toContain("0 aplicaciones asignadas. Resalta");
  });
});
