import { readFileSync } from "node:fs";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import {
  AulasSerieDeRendimiento, diasDelRango, escalaDeEje, esDomingo, separaLasMetas,
} from "./AulasSerieDeRendimiento";

/**
 * El gráfico tiene que separar lo aplicado de lo agendado.
 *
 * Gonzalo: «el gráfico sigue sin diferenciar el pasado del futuro o lo previsto».
 * Y la separación EXISTÍA —una vertical punteada, con un comentario en el código
 * que decía «sin esta raya las dos mitades se leen igual»— sólo que estaba
 * pintada en `--pulso-border`, **el mismo gris exacto de la rejilla de fondo**.
 * Una frontera del color del fondo no es una frontera.
 *
 * Por eso este guard no comprueba que la raya exista: comprueba que **se
 * distinga**. Una superficie teñida sobre todo lo agendado, la frontera en un
 * color que no es el de la rejilla, y los dos lados nombrados.
 *
 * El componente no tenía ninguna prueba, y el defecto es de los que vuelven
 * solos: media hora antes, al neutralizar la barra observada por otro motivo, se
 * borró de paso la única señal de color que quedaba entre las dos mitades.
 */

const GRIS_DE_LA_REJILLA = "var(--pulso-border)";

function aplicada(fecha: string, efectivas: number, codigo: string): MonitoreoRow {
  return {
    faculty: "Derecho",
    applied_at: fecha,
    effective_surveys: efectivas,
    operational_code: codigo,
  } as unknown as MonitoreoRow;
}

function agendada(fecha: string, codigo: string): MonitoreoRow {
  return {
    faculty: "Derecho",
    scheduled_date: fecha,
    eligible_n: 40,
    operational_code: codigo,
  } as unknown as MonitoreoRow;
}

/** Cuatro días aplicados y dos agendados por delante. */
function pintar() {
  const partes = [
    aplicada("2026-08-10", 20, "A1"),
    aplicada("2026-08-11", 22, "A2"),
    aplicada("2026-08-12", 19, "A3"),
    aplicada("2026-08-13", 24, "A4"),
  ];
  const agenda = [agendada("2026-08-17", "B1"), agendada("2026-08-18", "B2")];
  return renderToStaticMarkup(
    <AulasSerieDeRendimiento partes={partes} agenda={agenda} />);
}

describe("la serie separa lo aplicado de lo agendado", () => {
  it("nombra los dos lados del corte", () => {
    const html = pintar();
    // Uno por gráfico: el acumulado y el diario.
    expect(html.match(/aulas-serie-zona es-aplicado/g)).toHaveLength(2);
    expect(html.match(/aulas-serie-zona es-agendado/g)).toHaveLength(2);
    expect(html).toContain(">aplicado<");
    expect(html).toContain(">agendado<");
  });

  it("tiñe la superficie de lo agendado, que es lo que se lee de un vistazo", () => {
    const html = pintar();
    // Se comprueba que la zona SE PINTE, no que exista: un `<rect>` con
    // `fill="none" opacity="0"` tiene la misma geometría y no se ve. La primera
    // versión de este aserto miraba sólo x/ancho/alto y ese mutante pasaba.
    const zonas = [...html.matchAll(
      /<rect x="([\d.]+)" y="4" width="([\d.]+)" height="92" fill="([^"]+)" opacity="([\d.]+)"/g)];
    expect(zonas).toHaveLength(2);
    for (const [, x, ancho, fill, opacidad] of zonas) {
      expect(Number(x)).toBeGreaterThan(4);
      expect(Number(ancho)).toBeGreaterThan(0);
      expect(fill).not.toBe("none");
      expect(Number(opacidad)).toBeGreaterThan(0.02);
    }
  });

  it("la frontera NO va del color de la rejilla", () => {
    const html = pintar();
    // Las verticales de corte: mismo x1 y x2, de arriba abajo del área.
    const cortes = [...html.matchAll(/<line x1="([\d.]+)" y1="4" x2="([\d.]+)" y2="96"[^>]*stroke="([^"]+)"/g)];
    expect(cortes).toHaveLength(2);
    for (const [, x1, x2, color] of cortes) {
      expect(x1).toBe(x2);
      expect(color).not.toBe(GRIS_DE_LA_REJILLA);
    }
  });

  it("sin nada agendado por delante no inventa una frontera", () => {
    const partes = [aplicada("2026-08-10", 20, "A1"), aplicada("2026-08-11", 22, "A2")];
    const html = renderToStaticMarkup(
      <AulasSerieDeRendimiento partes={partes} agenda={[]} />);
    expect(html).not.toContain("aulas-serie-zona");
  });
});

describe("la escala del eje vertical", () => {
  it("da pasos redondos, no fracciones del tope", () => {
    // Gonzalo: «los ticks del eje y pueden tener saltos más lógicos, como cada 20
    // o cada 10». Con fracciones del tope, 45 daba 34 · 23 · 11.
    expect(escalaDeEje(45)).toEqual({ tope: 50, escalones: [50, 40, 30, 20, 10, 0] });
    expect(escalaDeEje(23)).toEqual({ tope: 25, escalones: [25, 20, 15, 10, 5, 0] });
    expect(escalaDeEje(240)).toEqual({ tope: 250, escalones: [250, 200, 150, 100, 50, 0] });
    expect(escalaDeEje(4400)).toEqual({
      tope: 5000, escalones: [5000, 4000, 3000, 2000, 1000, 0],
    });
  });

  it("el tope nunca queda por debajo de lo que hay que dibujar", () => {
    // Si el tope se quedara corto, la serie saldría fuera del área: «un elemento
    // que no cabe en su eje es un eje mal calculado».
    for (const v of [1, 3, 7, 19, 45, 99, 101, 240, 999, 4400, 12345]) {
      expect(escalaDeEje(v).tope).toBeGreaterThanOrEqual(v);
    }
  });

  it("siempre cierra en cero y en el tope, y no pasa de seis escalones", () => {
    for (const v of [1, 7, 45, 240, 4400, 12345]) {
      const { tope, escalones } = escalaDeEje(v);
      expect(escalones[0]).toBe(tope);
      expect(escalones[escalones.length - 1]).toBe(0);
      expect(escalones.length).toBeGreaterThanOrEqual(4);
      expect(escalones.length).toBeLessThanOrEqual(6);
    }
  });
});

describe("los dos gráficos se leen como uno", () => {
  it("el acumulado también tiene puntos con hover, no sólo el diario", () => {
    // Gonzalo: «el acumulado por día no tiene hover cuando el día a día sí».
    const html = pintar();
    const acumulado = html.slice(0, html.indexOf("Día a día"));
    const puntos = [...acumulado.matchAll(/aulas-serie-punto/g)];
    // Cuatro días aplicados y dos agendados: seis puntos en la línea del total.
    expect(puntos).toHaveLength(6);
    // Y cada uno dice lo que hay que saber sin bajar la vista al eje de días.
    // El globo se pinta con colores en vez de palabras, asi que la palabra tiene
    // que seguir viva en el `aria-label`: si el color sustituye al texto, el
    // lector de pantalla no puede quedarse sin el.
    expect(acumulado).toMatch(/aria-label="\d{2}\/\d{2}, \d+ \/ \d+/);
    expect(acumulado).toContain("· inferido");
  });

  it("los dos lienzos tienen el mismo carril de eje, o el mismo día no cae en la misma vertical", () => {
    // El defecto original: cada rejilla dimensionaba su columna del eje Y por sus
    // propias cifras —«250» arriba, «45» abajo— y los lienzos salían de 1262 y
    // 1269 px. Comparten el eje de días: si no coinciden, apilarlos no significa
    // nada. El carril se declara una vez en el CSS del panel; aquí se fija que
    // ninguna de las dos rejillas lo redefina.
    const css = readFileSync(
      new URL("./aulasMonitoreo.css", import.meta.url), "utf8");
    const rejillas = [...css.matchAll(
      /\.aulas-serie-plot\s*\{[^}]*grid-template-columns:\s*([^;]+);/g)];
    expect(rejillas).toHaveLength(1);
    expect(rejillas[0][1]).toContain("var(--aulas-serie-carril)");
    expect(css).not.toMatch(/\.aulas-serie-plot\.es-acumulado[^{]*\{[^}]*grid-template-columns/);
  });
});

describe("las dos líneas de sexo no suman la verde, y hay que decirlo", () => {
  /** Dos aulas: la primera sin reparto en el libro, la segunda con él. */
  function conLibroAMedias() {
    const partes = [
      aplicada("2026-08-10", 31, "A1"),
      aplicada("2026-08-12", 18, "A2"),
    ];
    const control = [
      { operational_code: "A2", women_n: 8, men_n: 6 },
    ] as unknown as MonitoreoRow[];
    return renderToStaticMarkup(
      <AulasSerieDeRendimiento partes={partes} control={control} />);
  }

  it("el hover del día sin reparto dice que el libro todavía no lo declara", () => {
    // Gonzalo: «¿por qué las líneas de hombre y mujer recién salen el 11 de
    // agosto y no el 10?». Porque el libro calla el reparto de esas aulas, no
    // porque no hubiera aulas: el 10/08 la verde ya valía 31. Eso tenía que
    // poder leerse en el gráfico, y no se podía.
    expect(conLibroAMedias()).toContain("sin sexo declarado todavía");
  });

  it("el hover del día con reparto da el desglose Y su cobertura", () => {
    const html = conLibroAMedias();
    // **El color dice de quién es la cifra**, así que en el globo van los números
    // solos con su punto. La palabra tiene que seguir viva en el `aria-label`, o
    // el lector de pantalla se queda sin ella: un color no se oye.
    //
    // El globo en sí NO se puede comprobar aquí —sólo existe al posarse, y esto
    // es un render estático—; sus puntos de color se verifican en pantalla. Lo
    // que este archivo sujeta es que la información no se pierda al quitar las
    // palabras, que es el riesgo del cambio.
    expect(html).toMatch(/aria-label="[^"]*8 mujeres · 6 hombres/);
    // 14 de 49: las dos cifras de sexo NO suman lo conseguido.
    expect(html).toMatch(/aria-label="[^"]*sexo en 14 de 49/);
  });

  it("cuando el reparto cubre menos que el total, la leyenda lo declara", () => {
    expect(conLibroAMedias()).toContain("sexo declarado en 14 de 49 encuestas");
  });

  it("cuando el reparto cubre todo, no molesta con la advertencia", () => {
    const partes = [aplicada("2026-08-10", 14, "A1")];
    const control = [{ operational_code: "A1", women_n: 8, men_n: 6 }] as unknown as MonitoreoRow[];
    const html = renderToStaticMarkup(
      <AulasSerieDeRendimiento partes={partes} control={control} />);
    // Cuando cubre todo NO se dice nada: en un globo que se lee de un vistazo,
    // confirmar lo que no falta es ruido.
    expect(html).not.toContain("sexo en 14 de 14");
    expect(html).not.toContain("sin sexo declarado");
  });
});

describe("el eje X es un calendario, no una lista de días con datos", () => {
  it("no se salta ni un día entre la primera fecha y la última", () => {
    // Gonzalo: «cada tick del eje x debe ser un día de calendario sí o sí, ahora
    // veo saltos de varios días entre tick y tick». Era literal: las fechas se
    // repartían por ÍNDICE, así que del viernes 14 se pasaba al lunes 17 y el fin
    // de semana ocupaba lo mismo que un día. **El gráfico mentía sobre el ritmo**,
    // que es justo lo que viene a medir.
    expect(diasDelRango("2026-08-14", "2026-08-17")).toEqual([
      "2026-08-14", "2026-08-15", "2026-08-16", "2026-08-17",
    ]);
    expect(diasDelRango("2026-08-10", "2026-08-26")).toHaveLength(17);
  });

  it("cruza el fin de mes sin inventarse días", () => {
    expect(diasDelRango("2026-08-30", "2026-09-02")).toEqual([
      "2026-08-30", "2026-08-31", "2026-09-01", "2026-09-02",
    ]);
    // Y febrero, que es donde se rompen los saltos hechos a mano.
    expect(diasDelRango("2028-02-27", "2028-03-01")).toEqual([
      "2028-02-27", "2028-02-28", "2028-02-29", "2028-03-01",
    ]);
  });

  it("un solo día es un solo tick, y un rango invertido no cuelga", () => {
    expect(diasDelRango("2026-08-10", "2026-08-10")).toEqual(["2026-08-10"]);
    expect(diasDelRango("2026-08-20", "2026-08-10")).toEqual(["2026-08-20"]);
  });

  it("reconoce el domingo, que no es día de campo", () => {
    // 2026-08-16 es domingo; el 15 es sábado y el 17 lunes.
    expect(esDomingo("2026-08-16")).toBe(true);
    expect(esDomingo("2026-08-15")).toBe(false);
    expect(esDomingo("2026-08-17")).toBe(false);
  });

  it("el eje pinta los días vacíos del calendario, no sólo los que tienen parte", () => {
    // Dos días con parte separados por un fin de semana: el eje tiene que
    // enseñar los cuatro, o el salto se lee como un día.
    const partes = [aplicada("2026-08-14", 20, "A1"), aplicada("2026-08-17", 22, "A2")];
    const html = renderToStaticMarkup(
      <AulasSerieDeRendimiento partes={partes} agenda={[]} />);
    const ticks = [...html.matchAll(/<li class="[^"]*" style="left:/g)];
    expect(ticks).toHaveLength(4);
    expect(html).toContain("es-domingo");
    expect(html).toContain("es-vacio");
  });
});

describe("el acumulado dice CUÁNDO se llega a la meta", () => {
  /** Cuatro días aplicados y seis agendados: la meta cae en lo agendado. */
  function conMetaPorDelante() {
    const partes = [
      aplicada("2026-08-10", 20, "A1"), aplicada("2026-08-11", 20, "A2"),
      aplicada("2026-08-12", 20, "A3"), aplicada("2026-08-13", 20, "A4"),
    ];
    const plan = [
      // El plan espera 40 por aula visitada: la meta de lo visitado son 160,
      // y lo conseguido son 80. Falta la mitad.
      ...["A1", "A2", "A3", "A4"].map((c) => ({
        operational_code: c, faculty: "Derecho", expected_valid: 40, eligible_n: 50,
      })),
    ] as unknown as MonitoreoRow[];
    // Del 17 al 22 de agosto. Escrito como `2026-08-1${7 + i}` daba
    // «2026-08-110» a partir del cuarto: fechas invalidas que el motor descarta
    // en silencio, y el test fallaba sin decir por que.
    const agenda = Array.from({ length: 6 }, (_, i) =>
      agendada(`2026-08-${17 + i}`, `B${i}`));
    return renderToStaticMarkup(
      <AulasSerieDeRendimiento partes={partes} plan={plan} agenda={agenda} />);
  }

  it("marca el cruce en la franja agendada, y lo dice como previsión", () => {
    // Gonzalo: «tengo que ver si voy a llegar a la cuota y a la meta [...] **¿Y
    // cuándo llegaría?**». El dato existía —`fechaDeCruce` en la proyección— pero
    // sólo se escribía en la tabla de cuotas, que además exige elegir facultad.
    // En el acumulado la línea cruzaba la horizontal de la meta sin decir nada.
    const html = conMetaPorDelante();
    expect(html).toContain("aulas-serie-cruce");
    // «llegaría», no «alcanzada»: en lo agendado no es un hecho, es previsión.
    expect(html).toContain("llegaría el");
    expect(html).toContain("es-inferido");
    expect(html).not.toContain("meta alcanzada el");
  });

  it("cuando la meta ya se pasó lo dice como hecho, no como previsión", () => {
    const partes = [aplicada("2026-08-10", 60, "A1"), aplicada("2026-08-11", 60, "A2")];
    const plan = ["A1", "A2"].map((c) => ({
      operational_code: c, faculty: "Derecho", expected_valid: 40, eligible_n: 50,
    })) as unknown as MonitoreoRow[];
    const html = renderToStaticMarkup(
      <AulasSerieDeRendimiento partes={partes} plan={plan} agenda={[]} />);
    expect(html).toContain("meta alcanzada el");
    expect(html).not.toContain("llegaría el");
  });

  it("sin meta que cruzar no inventa una marca", () => {
    // Sin plan no hay meta de lo visitado contra la que medirse.
    const html = renderToStaticMarkup(
      <AulasSerieDeRendimiento partes={[aplicada("2026-08-10", 20, "A1")]} agenda={[]} />);
    expect(html).not.toContain("aulas-serie-cruce");
  });
});

describe("cada sexo se proyecta y dice cuándo llega a SU cuota", () => {
  /** Un estudio con reparto declarado y cuotas por sexo, con agenda por delante. */
  function conCuotasYAgenda() {
    const partes = [
      aplicada("2026-08-10", 30, "A1"), aplicada("2026-08-11", 30, "A2"),
      aplicada("2026-08-12", 30, "A3"), aplicada("2026-08-13", 30, "A4"),
    ];
    const control = ["A1", "A2", "A3", "A4"].map((c) => ({
      operational_code: c, women_n: 18, men_n: 12,
    })) as unknown as MonitoreoRow[];
    const plan = ["A1", "A2", "A3", "A4"].map((c) => ({
      operational_code: c, faculty: "Derecho", expected_valid: 30, eligible_n: 40,
    })) as unknown as MonitoreoRow[];
    const cuotas = [
      { faculty: "Derecho", sex: "Mujer", target: 100, observed: 0 },
      { faculty: "Derecho", sex: "Hombre", target: 70, observed: 0 },
    ] as unknown as MonitoreoRow[];
    const agenda = Array.from({ length: 8 }, (_, i) =>
      agendada(`2026-08-${17 + i}`, `B${i}`));
    return renderToStaticMarkup(
      <AulasSerieDeRendimiento
        partes={partes} plan={plan} control={control} cuotas={cuotas} agenda={agenda} />);
  }

  it("las líneas de sexo NO se cortan en el día del último parte", () => {
    // Sólo el total se proyectaba (`inf: ""`): las dos líneas de sexo se cortaban
    // en seco y el gráfico no podía contestar la pregunta con la que empezó todo
    // —«¿voy a llegar a la meta de hombres y mujeres, y cuándo?»—.
    const html = conCuotasYAgenda();
    // Seis polilíneas: total, mujeres y hombres, cada una sólida + punteada.
    const punteadas = [...html.matchAll(/<polyline[^>]*stroke-dasharray="6 4"/g)];
    expect(punteadas.length).toBeGreaterThanOrEqual(3);
  });

  it("marca el cruce de cada cuota en su color", () => {
    const html = conCuotasYAgenda();
    expect(html).toContain("aulas-serie-cruce es-sexo");
  });

  it("cuando las dos cuotas cruzan el mismo día, es UN solo chip", () => {
    // Medido en pantalla: 2 de cada 12 facultades cruzan ambas el mismo día y sus
    // dos etiquetas caían solapadas en la misma vertical. Fundirlas no es sólo
    // evitar el choque: «las dos cuotas el 28/08» es una frase.
    const html = conCuotasYAgenda();
    const chips = [...html.matchAll(/aulas-serie-cruce es-sexo/g)];
    if (html.includes("las dos cuotas")) expect(chips).toHaveLength(1);
  });
});


describe("las etiquetas de meta no se montan una sobre otra", () => {
  // Cada meta se coloca por su valor, asi que con la cuota repartida mitad y
  // mitad —el caso mas comun— las de hombres y mujeres caen casi en la misma
  // altura. 368 px de lienzo y 14 de etiqueta dan un minimo de 3.8 %.
  const MINIMO = (100 * 14) / 368;

  it("separa dos metas casi iguales lo justo, sin tocar la de arriba", () => {
    const fuera = separaLasMetas([
      { clave: "m", y: 40 },
      { clave: "h", y: 41 },
    ]);
    expect(fuera[0].y).toBe(40);
    expect(fuera[1].y - fuera[0].y).toBeCloseTo(MINIMO, 5);
  });

  it("no toca las que ya estan separadas", () => {
    // El caso del fixture: 2 089 y 1 654 dejan sitio de sobra.
    const fuera = separaLasMetas([{ clave: "a", y: 20 }, { clave: "b", y: 60 }]);
    expect(fuera.map((m) => m.y)).toEqual([20, 60]);
  });

  it("conserva el orden por valor, para que cada etiqueta siga a su linea", () => {
    // Entra desordenada a proposito: si el orden se perdiera, «Hombres» acabaria
    // rotulando la linea de «Mujeres», que es peor que un solape.
    const fuera = separaLasMetas([
      { clave: "abajo", y: 80 }, { clave: "arriba", y: 10 }, { clave: "medio", y: 45 },
    ]);
    expect(fuera.map((m) => m.clave)).toEqual(["arriba", "medio", "abajo"]);
  });

  it("con tres pegadas, las aparta en cascada", () => {
    const fuera = separaLasMetas([{ clave: "a", y: 50 }, { clave: "b", y: 50 }, { clave: "c", y: 50 }]);
    expect(fuera[1].y - fuera[0].y).toBeCloseTo(MINIMO, 5);
    expect(fuera[2].y - fuera[1].y).toBeCloseTo(MINIMO, 5);
  });
});
