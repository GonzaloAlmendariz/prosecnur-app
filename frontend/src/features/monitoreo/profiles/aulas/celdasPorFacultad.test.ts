import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";
import type { MonitoreoRow } from "../../../../api/monitoreo";
import { celdasPorFacultad } from "./celdasPorFacultad";

const celda = (p: Record<string, unknown>) => p as MonitoreoRow;

describe("celdasPorFacultad", () => {
  it("separa hombres y mujeres del ALUMNO, no la mayoría del aula", () => {
    const out = celdasPorFacultad([
      celda({ faculty: "DERECHO", sex: "F", logrado: 40, brecha: 12 }),
      celda({ faculty: "DERECHO", sex: "M", logrado: 55, brecha: 0 }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      facultad: "DERECHO",
      mujeresLogrado: 40, mujeresDeficit: 12,
      hombresLogrado: 55, hombresDeficit: 0,
      deficit: 12,
    });
  });

  it("NO publica decimales: las respuestas son personas", () => {
    // El defecto que Gonzalo señaló en el gráfico anterior: «236.1 respuestas».
    const [f] = celdasPorFacultad([
      celda({ faculty: "DERECHO", sex: "F", logrado: 40.4, brecha: 12.1 }),
    ]);
    expect(f.mujeresLogrado).toBe(40);
    expect(f.mujeresDeficit).toBe(13);       // el deficit se pide entero, hacia arriba
    expect(Number.isInteger(f.deficit)).toBe(true);
  });

  it("ordena por el déficit proyectado, que es lo que exige decidir", () => {
    const out = celdasPorFacultad([
      celda({ faculty: "POCA", sex: "F", logrado: 10, brecha: 2 }),
      celda({ faculty: "MUCHA", sex: "F", logrado: 10, brecha: 90 }),
      celda({ faculty: "MEDIA", sex: "M", logrado: 10, brecha: 30 }),
    ]);
    expect(out.map((f) => f.facultad)).toEqual(["MUCHA", "MEDIA", "POCA"]);
  });

  it("ignora sexos que no son del alumno", () => {
    // `sex_top_1` puede traer otras marcas; aquí sólo entran F y M de la celda
    // de cuota. Una fila con otra cosa no puede inventar una tercera barra.
    const out = celdasPorFacultad([
      celda({ faculty: "DERECHO", sex: "X", logrado: 99, brecha: 99 }),
      celda({ faculty: "DERECHO", sex: "F", logrado: 5, brecha: 1 }),
    ]);
    expect(out[0]!.mujeresLogrado).toBe(5);
    expect(out[0]!.hombresLogrado).toBe(0);
    expect(out[0]!.deficit).toBe(1);
  });

  it("una facultad con las dos celdas cubiertas queda con falta cero", () => {
    const [f] = celdasPorFacultad([
      celda({ faculty: "DERECHO", sex: "F", logrado: 40, brecha: 0 }),
      celda({ faculty: "DERECHO", sex: "M", logrado: 30, brecha: 0 }),
    ]);
    expect(f.deficit).toBe(0);
  });

  it("sin celdas devuelve lista vacía, no una facultad fantasma", () => {
    expect(celdasPorFacultad([])).toEqual([]);
  });
});

describe("los tres tramos", () => {
  it("separa lo agendado del déficit: no son lo mismo", () => {
    // `brecha` de la celda es `cuota − PROYECCIÓN`, no `cuota − logrado`.
    // Pintarla como «faltan» al lado de lo recogido deja fuera lo que las aulas
    // ya agendadas van a traer, y las barras dejan de sumar la cuota.
    const [f] = celdasPorFacultad([
      celda({ faculty: "DERECHO", sex: "F", logrado: 40, aporte_pendiente: 30, brecha: 12 }),
    ]);
    expect(f.mujeresLogrado).toBe(40);
    expect(f.mujeresPendiente).toBe(30);
    expect(f.mujeresDeficit).toBe(12);
  });

  it("lo agendado también va en personas enteras", () => {
    const [f] = celdasPorFacultad([
      celda({ faculty: "DERECHO", sex: "M", logrado: 0, aporte_pendiente: 6.1, brecha: 0 }),
    ]);
    expect(f.hombresPendiente).toBe(6);
  });
});

describe("el gráfico no puede llamar «agendadas» a lo que no lo es", () => {
  // Medido el 2026-08-29 sobre `aulas_con_respuestas.pulso`: la tarjeta decía
  // «Cierran con lo agendado: 0 de 30» y el gráfico de al lado, sobre esas
  // mismas 30 celdas, enseñaba seis sin déficit. Parecía una contradicción y no
  // lo era: son DOS DENOMINADORES.
  //
  //   · La tarjeta proyecta sobre la AGENDA — aulas con fecha comprometida.
  //   · El gráfico dibuja `aporte_pendiente`, que sale de
  //     `monitoreo_aulas_avance_sexo_facultad()` sobre `tracked_df`: las aulas
  //     EN JUEGO sin aplicar, tengan fecha o no. Es un conjunto mayor, así que
  //     cierra más celdas. Ambas cifras eran correctas.
  //
  // Lo que estaba mal era el rótulo del gráfico, que decía «Aportarán las aulas
  // agendadas» y «Con todas las aulas agendadas aplicadas». El número prometido
  // no era el entregado, y quien restara las dos superficies encontraría un
  // hueco inexistente.
  //
  // Este guard mira la fuente porque el rótulo vive en el markup de Plotly y no
  // hay DOM que interrogar sin arrancar el motor de gráficos.
  const fuente = readFileSync(
    new URL("./AulasSexoPorFacultadChart.tsx", import.meta.url),
    "utf8",
  );

  it("ninguna etiqueta visible del gráfico dice «agendad-»", () => {
    // Sólo las cadenas que ve el usuario. El gráfico pasó de Plotly a barras
    // CSS (dictado 2026-09-03: chips por facultad y sexo, hover propio), así
    // que las etiquetas visibles ya no viven en `name:`/`hovertemplate:` sino
    // en la leyenda JSX y en los template literals del detalle accesible.
    // Los comentarios SÍ nombran la agenda, y deben poder hacerlo: explican
    // justo esta distinción.
    const visibles = [
      ...fuente.matchAll(/<li><i className="[^"]*" \/>([^<]+)<\/li>/g),
      ...fuente.matchAll(/`([^`]*)`/g),
    ].map((m) => m[1]);
    expect(visibles.length).toBeGreaterThan(3);
    expect(visibles.filter((t) => /agendad/i.test(t))).toEqual([]);
  });

  it("el pie tampoco lo dice", () => {
    const pie = fuente.slice(fuente.indexOf("mon-profile-table-recorte"));
    // El texto del pie, sin los comentarios que lo preceden.
    expect(/quedaría un déficit de/.test(pie)).toBe(true);
    expect(/aulas agendadas/i.test(pie)).toBe(false);
  });
});

describe("el pie del gráfico cuenta las facultades que ponen déficit", () => {
  /**
   * Visto con `HSVG2026_sem15_como_2025.pulso`, el primero en que el déficit
   * total baja a 1: «quedaría un déficit de 1 respuestas, repartido en 15
   * facultades». El 15 eran TODAS las del gráfico, cerradas incluidas. Un
   * déficit de 1 está en una facultad, y decir quince manda a buscar en catorce
   * sitios donde no hay nada.
   */
  const fuenteChart = readFileSync(
    new URL("./AulasSexoPorFacultadChart.tsx", import.meta.url),
    "utf8",
  );

  it("el «repartido en» no usa el total de filas", () => {
    // `filas.length` en esa frase es justo el defecto: cuenta las cerradas.
    // El ancla se comprueba antes de usarla: si el texto se renombra,
    // `indexOf` devuelve -1, `slice(-1)` deja «\n» y el fallo sale como
    // «expected '\n' to contain …», que no dice nada de lo que pasó. Pasó al
    // cambiar «aulas» por «cursos-horario» en esa frase.
    const ancla = "Aplicando todos los cursos-horario";
    expect(
      fuenteChart.includes(ancla),
      `el pie del gráfico ya no empieza por «${ancla}»: actualiza el ancla de este test`,
    ).toBe(true);
    const pie = fuenteChart.slice(fuenteChart.indexOf(ancla));
    expect(pie).toContain("fmt(conDeficit)");
    expect(pie.slice(0, pie.indexOf("</p>"))).not.toContain("fmt(filas.length)");
  });

  it("y `conDeficit` se deriva de las filas con déficit > 0", () => {
    expect(fuenteChart).toContain("filas.filter((f) => f.deficit > 0).length");
  });
});
