import { describe, expect, it } from "vitest";

import { aulasKpis } from "./kpisDeAulas";

/**
 * «Sin empezar» suma dos tramos y tiene que decir cuál pesa.
 *
 * `sinSalirACampo` = «Sin agendar» + «Agendado». La pista decía «agendadas que
 * aún no salen a campo» sobre 145 aulas de las que ninguna estaba agendada:
 * medido el 2026-08-29, el Status de aplicación de esa misma sesión daba
 * «Agendada 0» y el panel de abajo «145 sin fecha, al final de su facultad».
 * Llamar agendado a lo que no tiene fecha invierte la decisión: una agendada se
 * espera, una sin fecha hay que salir a agendarla.
 */

const fila = (application_state: string) => ({ application_state, sample_role: "titular" });
const tablero = (pendientes: number, listas: number) => ({
  course_status: [
    ...Array.from({ length: pendientes }, () => fila("pendiente")),
    ...Array.from({ length: listas }, () => fila("lista")),
  ],
  kpis: {},
}) as never;

const sinEmpezar = (t: never) => aulasKpis(t, "modelo").find((k) => k.label === "Sin empezar");

describe("la pista de «Sin empezar»", () => {
  it("con ninguna agendada dice que hay que agendarlas", () => {
    const k = sinEmpezar(tablero(145, 0));
    expect(k?.value).toBe("145");
    expect(k?.pista).toContain("sin fecha");
    // «agendados,» con la o de la unidad: al pasar el participio a masculino, esta
    // negativa se cumplía sola contra el texto viejo y el test se apagaba en
    // silencio. Una aserción negativa sobre un literal caduca cuando el literal
    // se mueve.
    expect(k?.pista).not.toContain("agendados,");
  });

  it("con todas agendadas no habla de fechas que faltan", () => {
    const k = sinEmpezar(tablero(0, 40));
    expect(k?.pista).toBe("agendados, todavía sin salir a campo");
  });

  it("con las dos, declara el reparto", () => {
    // El caso que importa en un operativo a medias: sin el reparto, 100 se lee
    // como «ya están agendadas» y nadie sale a agendar las 60 que faltan.
    const k = sinEmpezar(tablero(60, 40));
    expect(k?.value).toBe("100");
    expect(k?.pista).toContain("60");
    expect(k?.pista).toContain("40");
  });

  it("el total sigue siendo la suma de los dos tramos", () => {
    // El control del arreglo: si alguien «simplificara» la pista tomando sólo un
    // tramo, el valor y la pista dejarían de hablar del mismo conjunto.
    expect(sinEmpezar(tablero(7, 3))?.value).toBe("10");
  });
});

/**
 * **Y «Agendado» tampoco es un tramo homogéneo.**
 *
 * Medido el 2026-08-30 sobre el estudio de 174 titulares: los 22 de este sello
 * eran **13 `agendada` + 9 `sin_contactar`**, y la pista decía «agendados,
 * todavía sin salir a campo» sobre los 22. Los 9 son exactamente los que la
 * cola de contacto publica dos bloques más abajo, en la misma pantalla, como
 * «9 cursos-horario siguen sin cita · el que más lleva va por 5 intentos».
 *
 * Es la misma advertencia de arriba —una agendada se espera, una sin cita hay
 * que salir a conseguirla— sobre el otro eje: `application_state` agrupa las
 * dos y `sample_status` las separa.
 */
const conEstado = (agendadas: number, sinContactar: number) => ({
  course_status: [
    ...Array.from({ length: agendadas }, () => ({
      application_state: "lista", sample_role: "titular", sample_status: "agendada",
    })),
    ...Array.from({ length: sinContactar }, () => ({
      application_state: "lista", sample_role: "titular", sample_status: "sin_contactar",
    })),
  ],
  kpis: {},
}) as never;

describe("«Agendado» se separa cuando el tramo mezcla estados", () => {
  it("con 13 agendadas y 9 sin contactar, dice el reparto", () => {
    const k = sinEmpezar(conEstado(13, 9));
    expect(k?.value).toBe("22");
    expect(k?.pista).toBe("13 con cita · 9 sin contactar todavía");
  });

  it("con todas agendadas no inventa un reparto", () => {
    expect(sinEmpezar(conEstado(5, 0))?.pista).toBe("agendados, todavía sin salir a campo");
  });

  it("si NINGUNA declara su estado, no se afirma que no tienen cita", () => {
    // El control del arreglo. Sin `sample_status` no se sabe, y asumir «sin
    // contactar» es el mismo error que asumir «agendada»: los cuatro tests de
    // arriba usan ese fixture y tienen que seguir midiendo lo suyo.
    expect(sinEmpezar(tablero(0, 40))?.pista).toBe("agendados, todavía sin salir a campo");
  });
});
