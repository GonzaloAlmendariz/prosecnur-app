import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AulasEstadoPorRol } from "./AulasEstadoPorRol";
import { accionesDeHoy, estadoPorRol, sinColocar } from "./estadoPorRol";
import type { MonitoreoAulasDashboard } from "../../../../api/monitoreo";

/**
 * El panel que sustituye al eje plano de «Estado de aplicación».
 *
 * Lo que sujeta: que las reservas dejen de caer en un solo cajón. Gonzalo,
 * 2026-09-10: «no entiendo por qué en reserva hay mil ciento sesenta y nueve».
 * La respuesta es que ahí dentro hay dos poblaciones que piden cosas distintas
 * —las que todavía pueden entrar y las que ya no van a entrar nunca— y el panel
 * tiene que separarlas.
 */

const tablero = (bloque: unknown) => ({
  course_status_rol_y_estado: bloque,
} as unknown as MonitoreoAulasDashboard);

const REAL = {
  titulares: { total: 174, aplicado: 52, agendado: 86, sin_agendar: 32, rechazado: 4, reemplazado: 0 },
  reemplazos: { total: 1173, utilizado: 2, en_cadena: 823, al_aire: 348 },
  banco: { total: 45, utilizado: 0, disponible: 45 },
};

describe("AulasEstadoPorRol", () => {
  it("separa las reservas que todavía pueden entrar de las que ya no", () => {
    const html = renderToStaticMarkup(<AulasEstadoPorRol dashboard={tablero(REAL)} />);
    expect(html).toContain("En cadena");
    expect(html).toContain("Al aire");
    // Y las nombra con su cifra, no sólo con la etiqueta: el defecto que este
    // panel corrige es exactamente una cifra sin desglosar.
    expect(html).toContain("823");
    expect(html).toContain("348");
  });

  it("cada barra reparte SU grupo al 100 %, no un carril común", () => {
    // 174 titulares y 1 173 reservas en un mismo carril dejarían a los titulares
    // en una raya de doce píxeles. Los aplicados son 52 de 174 = 29,9 % de SU
    // barra; sobre el total de 1 392 serían un 3,7 %.
    const html = renderToStaticMarkup(<AulasEstadoPorRol dashboard={tablero(REAL)} />);
    expect(html).toMatch(/width:29\.8\d*%/);
  });

  it("un tramo en cero no se dibuja ni se lista", () => {
    // `reemplazado: 0` y `utilizado: 0` del banco: enseñarlos gastaría leyenda
    // en decir que no ha pasado nada.
    const html = renderToStaticMarkup(<AulasEstadoPorRol dashboard={tablero(REAL)} />);
    expect(html).not.toContain("Reemplazados");
    expect(html).not.toContain("Utilizadas");
  });

  it("sin el bloque del motor lo DICE, en vez de dibujar tres grupos en cero", () => {
    // Tres barras vacías se leerían como «no hay nada», que es otra cosa que
    // «este tablero se calculó con una versión anterior».
    const html = renderToStaticMarkup(<AulasEstadoPorRol dashboard={tablero(undefined)} />);
    expect(html).toContain("versión anterior del cálculo");
    expect(html).not.toContain("aulas-epr-barra");
  });
});

describe("estadoPorRol", () => {
  it("devuelve null cuando el motor no publica el bloque", () => {
    expect(estadoPorRol(tablero(undefined))).toBeNull();
    expect(estadoPorRol(tablero({}))).toBeNull();
  });

  it("no calcula nada: los números salen del motor tal cual", () => {
    const grupos = estadoPorRol(tablero(REAL))!;
    const titulares = grupos.find((g) => g.clave === "titulares")!;
    expect(titulares.total).toBe(174);
    expect(titulares.tramos.find((t) => t.clave === "aplicado")?.aulas).toBe(52);
  });

  it("lo que el reparto no coloca se cuenta, no se pierde", () => {
    // El control invertido: si el motor declara un total mayor que la suma de
    // sus estados —porque el payload viene de otra versión—, la pantalla lo dice.
    const grupos = estadoPorRol(tablero({
      titulares: { total: 10, aplicado: 3, agendado: 2, sin_agendar: 1, rechazado: 0, reemplazado: 0 },
    }))!;
    expect(sinColocar(grupos[0])).toBe(4);
    const html = renderToStaticMarkup(<AulasEstadoPorRol dashboard={tablero({
      titulares: { total: 10, aplicado: 3, agendado: 2, sin_agendar: 1 },
    })} />);
    expect(html).toContain("sin clasificar");
  });
});

describe("aplicadas sin agenda y lo que hay que hacer hoy (2026-09-24)", () => {
  // CCSS 23/09, medido: 22 titulares aplicados, 3 de ellos sin fecha en el
  // libro (CH 12, CH 15, CH 24). El panel los metía en «Aplicados» sin avisar.
  const CCSS = {
    acciones: {
      aplicado_sin_agenda: ["CH 12", "CH 15", "CH 24"],
      agendado_vencido: "CH 6", // Plumber desempaqueta el vector de largo uno
      sin_agendar: ["CH 3", "CH 31", "CH 35", "CH 36"],
      rechazado: [],
    },
    titulares: { total: 50, aplicado: 22, agendado: 22, sin_agendar: 4, rechazado: 2, reemplazado: 0,
                 aplicado_sin_agenda: 3, agendado_vencido: 1 },
    reemplazos: { total: 85, utilizado: 3, en_cadena: 44, al_aire: 38, utilizado_sin_agenda: 0 },
    banco: { total: 1, utilizado: 0, disponible: 1 },
  };

  it("parte «Aplicados» sin mover la suma", () => {
    const tit = estadoPorRol(tablero(CCSS))![0];
    expect(tit.tramos.find((t) => t.clave === "aplicado")?.aulas).toBe(19);
    expect(tit.tramos.find((t) => t.clave === "aplicado_sin_agenda")?.aulas).toBe(3);
    expect(tit.tramos.find((t) => t.clave === "agendado")?.aulas).toBe(21);
    expect(tit.tramos.find((t) => t.clave === "agendado_vencido")?.aulas).toBe(1);
    expect(sinColocar(tit)).toBe(0);
  });

  it("nombra los códigos de lo que pide trabajo, y calla lo que no tiene casos", () => {
    const acciones = accionesDeHoy(tablero(CCSS));
    expect(acciones.map((a) => a.clave)).toEqual(["aplicado_sin_agenda", "agendado_vencido", "sin_agendar"]);
    expect(acciones[1].codigos).toEqual(["CH 6"]);
    const html = renderToStaticMarkup(<AulasEstadoPorRol dashboard={tablero(CCSS)} />);
    expect(html).toContain("el libro no les puso fecha");
    expect(html).toContain("CH 15");
    expect(html).toContain("Aplicados sin agenda");
    expect(html).not.toContain("Rechazados sin relevo");
  });

  it("sin el subconjunto publicado, «Aplicados» va entero y con su nombre corto", () => {
    const tit = estadoPorRol(tablero(REAL))![0];
    expect(tit.tramos.map((t) => t.etiqueta)).toContain("Aplicados");
    expect(tit.tramos.some((t) => t.clave === "aplicado_sin_agenda")).toBe(false);
  });
});
