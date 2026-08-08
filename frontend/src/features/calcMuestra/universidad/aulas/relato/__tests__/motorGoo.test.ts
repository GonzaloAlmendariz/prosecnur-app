/**
 * Contrato del motor de asentamiento (ADR 0067 · gate 1).
 *
 * Lo que se congela acá no son números bonitos: son las tres propiedades que
 * distinguen «física» de «curva pegada». (1) La trayectoria es función pura del
 * dato, así que dos corridas coinciden cuadro a cuadro. (2) La masa manda: una
 * bola grande se asienta más lento que una chica. (3) El paso fijo hace que el
 * resultado no dependa de la tasa de refresco.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  MAX_MS_POR_CUADRO,
  MotorGoo,
  PASO_FIJO_MS,
  estaEnReposo,
  impulsoDeAterrizaje,
  parametrosDeBola,
  pasoResorte,
  simularAsentamiento,
} from "../motorGoo";

/** Frecuencia natural del oscilador: ω = √(k/m). Baja al subir la masa. */
function omega(radio: number): number {
  const { k, m } = parametrosDeBola(radio);
  return Math.sqrt(k / m);
}

/** Cuadros hasta el reposo, integrando con el paso fijo del motor. */
function cuadrosHastaReposo(radio: number, index = 0, tope = 20000): number {
  const parametros = parametrosDeBola(radio);
  let estado = impulsoDeAterrizaje(index);
  const dt = PASO_FIJO_MS / 1000;
  for (let i = 1; i <= tope; i += 1) {
    estado = pasoResorte(estado, parametros, dt);
    if (estaEnReposo(estado)) return i;
  }
  return tope;
}

describe("motor goo · el asentamiento sale de la ecuación, no de una curva", () => {
  it("es determinista: dos simulaciones del mismo dato coinciden exactamente", () => {
    expect(simularAsentamiento(6.2, 3)).toEqual(simularAsentamiento(6.2, 3));
  });

  it("la masa va con el área, así que la bola grande oscila más lento", () => {
    // ω = √(k/m) con m ∝ r². Es LA propiedad que hace que una bola de 900
    // elegibles no se mueva como una de 12.
    expect(omega(7.8)).toBeLessThan(omega(2.2));
    expect(parametrosDeBola(4.4).m).toBeGreaterThan(parametrosDeBola(2.2).m);
  });

  it("la bola pesada tarda más en calmarse que la liviana", () => {
    expect(cuadrosHastaReposo(7.8)).toBeGreaterThan(cuadrosHastaReposo(2.2));
  });

  it("es subamortiguada: se pasa del equilibrio y vuelve, más de una vez", () => {
    const escalas = simularAsentamiento(4.4, 0, 2400);
    // Sobrepico en ambos sentidos: sin esto es un ease-out, no un asentamiento.
    expect(Math.max(...escalas)).toBeGreaterThan(1.02);
    expect(Math.min(...escalas)).toBeLessThan(0.995);
    // Y cruza el equilibrio varias veces (oscila, no cae y ya).
    let cruces = 0;
    for (let i = 1; i < escalas.length; i += 1) {
      if ((escalas[i - 1]! - 1) * (escalas[i]! - 1) < 0) cruces += 1;
    }
    expect(cruces).toBeGreaterThanOrEqual(3);
  });

  it("converge a 1: la bola termina en su tamaño real, no cerca", () => {
    const escalas = simularAsentamiento(6.2, 2, 6000);
    expect(escalas.at(-1)!).toBeCloseTo(1, 3);
  });

  it("no hay azar en el fuente del motor", () => {
    // El gate 1 se vigila por barrido en relatoSinAzar; acá se fija que la
    // trayectoria no depende de nada más que el dato y el índice.
    expect(simularAsentamiento(5, 1)).not.toEqual(simularAsentamiento(5, 2));
    expect(simularAsentamiento(5, 1)).toEqual(simularAsentamiento(5, 1));
  });
});

describe("motor goo · ninguna animación le roba el transform", () => {
  // El defecto reincidente de este archivo: una animación CSS sobre el MISMO
  // elemento pisa su `transform`, y con `fill: both` el pisotón es permanente.
  // Ya colapsó las bolas al origen una vez, y volvió a morder acá: con la
  // entrada viva, las 196 bolas llevaban `is-motor` y su `--goo-escala`, y la
  // escala renderizada no se movía de 1 —el motor escribía una variable que
  // nadie leía—. Medido en la app, no deducido.
  const css = readFileSync(
    fileURLToPath(new URL("../relato.css", import.meta.url)),
    "utf8",
  );

  /** Cuerpo del `@keyframes` pedido, sin comentarios. */
  function keyframe(nombre: string): string {
    const desde = css.indexOf(`@keyframes ${nombre}`);
    expect(desde, `falta @keyframes ${nombre}`).toBeGreaterThan(-1);
    return css.slice(desde, css.indexOf("\n}", desde));
  }

  it("la entrada con motor anima opacidad y NO transform", () => {
    const entrada = keyframe("cmv2-relato-goo-entrada-motor");
    expect(entrada).toContain("opacity");
    expect(entrada).not.toContain("transform");
  });

  it("la bola con motor toma su escala de la variable que el motor escribe", () => {
    const bloque = css.slice(css.indexOf(".cmv2-relato-goo-bola.is-motor {"));
    expect(bloque.slice(0, bloque.indexOf("}"))).toContain(
      "transform: scale(var(--goo-escala, 1))",
    );
  });

  it("con motor se apaga toda animación declarativa que mueva la escala", () => {
    // El keyframe de aterrizaje sigue existiendo (es el camino de
    // reduced-motion), pero no puede convivir con el motor sobre la misma bola.
    expect(keyframe("cmv2-relato-goo-aterrizar")).toContain("scale(");
    const apagado = css.slice(css.indexOf(".cmv2-relato-goo-bola.is-motor.is-aterrizando"));
    expect(apagado.slice(0, apagado.indexOf("}"))).toContain("animation: none");
  });
});

describe("motor goo · el bucle no depende de la tasa de refresco", () => {
  /** Reloj falso: se le dictan los instantes de cada cuadro. */
  function motorConReloj(instantes: number[]) {
    const pendientes: Array<(t: number) => void> = [];
    const motor = new MotorGoo(
      (cb) => {
        pendientes.push(cb);
        return pendientes.length;
      },
      () => {},
    );
    const correr = () => {
      for (const t of instantes) {
        const cb = pendientes.shift();
        if (!cb) break;
        cb(t);
      }
    };
    return { motor, correr };
  }

  it("60 Hz y 120 Hz coinciden salvo el residuo de un paso fijo", () => {
    // Lo que el paso fijo garantiza no es identidad exacta a cualquier
    // instante: es que la trayectoria NO es función de la tasa de refresco. Los
    // dos relojes consumen los mismos 2,000 ms simulados, pero cada uno deja en
    // el acumulador un resto distinto —menor a un paso—, así que la muestra
    // final puede diferir en lo que la bola se mueve en ese resto. Esa cota es
    // la afirmación honesta; pedir igualdad bit a bit sería pedir que el
    // acumulador no exista.
    const leerAlFinal = (hz: number, cuadros: number) => {
      const instantes = Array.from({ length: cuadros }, (_, i) => (i * 1000) / hz);
      const { motor, correr } = motorConReloj(instantes);
      let ultima = 1;
      motor.soltar("b", 6.2, 0, (escala) => {
        ultima = escala;
      });
      correr();
      return ultima;
    };
    const a60 = leerAlFinal(60, 120);
    const b120 = leerAlFinal(120, 240);

    // Cota: lo que la bola recorre en UN paso fijo, con margen. Sin paso fijo
    // (integrando el delta crudo) la diferencia es de otro orden.
    const unPaso = simularAsentamiento(6.2, 0, 2);
    const cotaPorPaso = Math.abs(unPaso[1]! - unPaso[0]!) * 2;
    expect(Math.abs(a60 - b120)).toBeLessThan(cotaPorPaso);
    // Y ambos están asentándose sobre el mismo equilibrio, no en ramas
    // distintas de la oscilación.
    expect(a60).toBeCloseTo(1, 2);
    expect(b120).toBeCloseTo(1, 2);
  });

  it("un cuadro larguísimo no explota la simulación", () => {
    // Pestaña que vuelve del fondo: delta de 30 s. Sin tope, el bucle
    // integraría 7,200 pasos de golpe; con tope, la bola aparece asentada.
    const { motor, correr } = motorConReloj([0, 30000]);
    let ultima = Number.NaN;
    motor.soltar("b", 6.2, 0, (escala) => {
      ultima = escala;
    });
    correr();
    expect(Number.isFinite(ultima)).toBe(true);
    expect(Math.abs(ultima - 1)).toBeLessThan(0.6);
    expect(MAX_MS_POR_CUADRO).toBeLessThan(30000);
  });

  it("la bola que llegó al reposo se retira y aterriza exactamente en 1", () => {
    const instantes = Array.from({ length: 400 }, (_, i) => i * 16);
    const { motor, correr } = motorConReloj(instantes);
    const escalas: number[] = [];
    motor.soltar("b", 2.2, 0, (escala) => escalas.push(escala));
    correr();
    expect(escalas.at(-1)).toBe(1);
    expect(motor.activo).toBe(false);
  });

  it("un solo bucle atiende a todas las bolas de la escena", () => {
    let pedidos = 0;
    const pendientes: Array<(t: number) => void> = [];
    const motor = new MotorGoo(
      (cb) => {
        pedidos += 1;
        pendientes.push(cb);
        return pedidos;
      },
      () => {},
    );
    for (let i = 0; i < 40; i += 1) {
      motor.soltar(`b${i}`, 3 + i * 0.1, i, () => {});
    }
    // 40 bolas registradas, UN cuadro pedido: el bucle es compartido.
    expect(pedidos).toBe(1);
    expect(pendientes).toHaveLength(1);
  });
});
