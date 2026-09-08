import { describe, expect, it } from "vitest";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { celdasPrevistas, piramideDeCuota } from "./piramideDeCuota";

/**
 * La cuota enfrentada, una facultad por fila.
 *
 * La lista ordenada por cumplimiento contesta «qué celda se va a incumplir» y
 * deja las dos celdas de una misma facultad lejos una de otra. La pregunta de
 * campo es la contraria: en esta facultad, ¿de qué lado voy corto?
 */

function celda(facultad: string, sexo: string, meta: number, observadas: number): MonitoreoRow {
  return { faculty: facultad, sex: sexo, target: meta, observed: observadas } as unknown as MonitoreoRow;
}

describe("la pirámide de cuota", () => {
  it("mide cada lado contra SU propia meta", () => {
    // 50 de 100 y 30 de 40 son 50 % y 75 %: sin cada meta, la barra más larga
    // sería la de la izquierda y diría lo contrario de lo que pasa.
    const { facultades } = piramideDeCuota([
      celda("Derecho", "F", 100, 50),
      celda("Derecho", "M", 40, 30),
    ]);
    expect(facultades[0].izquierda?.avance).toBe(50);
    expect(facultades[0].derecha?.avance).toBe(75);
  });

  /**
   * **Un lado no cumple por compensación, aunque hoy no tenga con qué.**
   *
   * `quotas_sex_faculty` sale de un `merge` por `(fac_key, sex_key)`, así que
   * hoy hay una fila por facultad y sexo y `observadas >= meta` daba lo mismo
   * que `faltan === 0`. Ese empate es del grano del payload, no de la regla: si
   * estas filas se abrieran alguna vez por estrato o por nivel, sumar el lado
   * volvería a declarar «cumplida» una celda con gente faltando —que es
   * exactamente lo que el ADR 0079 prohíbe y lo que la tabla del cliente ya
   * hizo una vez con 17 mujeres pendientes en Arquitectura—.
   *
   * El invariante lo detecta; una salvedad escrita en un comentario, no.
   */
  it("no da por cumplido un lado que suma bastante debiendo en una de sus filas", () => {
    // 60 de 40 en una y 10 de 30 en la otra: el lado suma 70 sobre 70 y aun así
    // le faltan 20 personas donde hacen falta.
    const { facultades } = piramideDeCuota([
      celda("Derecho", "F", 40, 60),
      celda("Derecho", "F", 30, 10),
      celda("Derecho", "M", 50, 50),
    ]);
    const lado = facultades[0].izquierda?.sexo === "F"
      ? facultades[0].izquierda
      : facultades[0].derecha;
    expect(lado?.faltan).toBe(20);
    expect(lado?.cumple).toBe(false);
  });

  it("el lado con más celdas declaradas va a la izquierda", () => {
    // El orden no puede depender del alfabeto ni de cómo devolvió las filas el
    // motor: con «Hombre»/«Mujer» el alfabeto pondría a los hombres primero.
    const { izquierda, derecha } = piramideDeCuota([
      celda("Derecho", "Mujer", 100, 50),
      celda("Letras", "Mujer", 100, 50),
      celda("Derecho", "Hombre", 40, 30),
    ]);
    expect(izquierda).toBe("Mujer");
    expect(derecha).toBe("Hombre");
  });

  it("una facultad sin esa celda no se dibuja como un cero", () => {
    // «Sin cuota declarada» y «cuota en cero» son dos cosas distintas.
    const { facultades } = piramideDeCuota([
      celda("Derecho", "F", 100, 50),
      celda("Derecho", "M", 40, 30),
      celda("Letras", "F", 60, 10),
    ]);
    const letras = facultades.find((f) => f.facultad === "Letras");
    expect(letras?.izquierda).not.toBeNull();
    expect(letras?.derecha).toBeNull();
  });

  it("un tercer valor de sexo no desaparece", () => {
    // Una pirámide tiene dos lados; el resto se declara para que la vista lo
    // diga, en vez de perderse en silencio.
    const { otros } = piramideDeCuota([
      celda("Derecho", "F", 100, 50),
      celda("Derecho", "F", 100, 50),
      celda("Derecho", "M", 40, 30),
      celda("Derecho", "Otro", 10, 1),
    ]);
    expect(otros).toEqual(["Otro"]);
  });

  /**
   * **De la facultad más pequeña a la más grande** (Gonzalo, 2026-09-08):
   * «debería estar ordenado de facultad más pequeña a facultad más grande».
   *
   * Contrato anterior, citado para quien lea un diff: ordenaba por lo que iba a
   * faltar al acabar la agenda, o sea por urgencia proyectada. La predicción
   * salió de esta pestaña con el mismo dictado, y lo que queda es una
   * comparación de magnitudes: para eso el orden que se lee es el del tamaño,
   * porque la escalera que forman las barras es en sí misma la información.
   */
  it("ordena de la facultad más pequeña a la más grande", () => {
    const { facultades } = piramideDeCuota([
      celda("Poco", "F", 10, 8),
      celda("Poco", "M", 10, 9),
      celda("Mucho", "F", 400, 100),
      celda("Mucho", "M", 100, 90),
    ]);
    // 20 personas contra 500: la pequeña abre y la grande cierra, aunque a la
    // grande le falten 310 y a la pequeña 3.
    expect(facultades.map((f) => f.facultad)).toEqual(["Poco", "Mucho"]);
    expect(facultades[1].faltan).toBe(310);
  });

  it("lo que se recogió de más se nombra: «sobran», no un cumple mudo", () => {
    const { facultades } = piramideDeCuota([
      celda("Pasada", "F", 100, 130),
      celda("Pasada", "M", 100, 100),
    ]);
    const [fila] = facultades;
    // Pasarse en una celda no cubre lo que falta en otra (ADR 0079), así que el
    // exceso se declara en vez de callarse: son 30 encuestas de trabajo que
    // este grupo no necesitaba.
    expect(fila.izquierda?.sobran).toBe(30);
    expect(fila.derecha?.sobran).toBe(0);
    expect(fila.derecha?.cumple).toBe(true);
  });

  it("una celda sin meta no entra", () => {
    const res = piramideDeCuota([
      celda("Derecho", "F", 100, 50),
      celda("Derecho", "M", 0, 0),
    ]);
    expect(res.facultades[0].derecha).toBeNull();
    expect(res.sinMeta).toBe(1);
  });
});

it("el gris es para la celda sin recoger, no para la que va atrasada", () => {
  // El control del defecto: la primera celda va al 45 % y la segunda al 56 %.
  // Con el corte inventado en el 50 % la primera salia del color que la paleta
  // define como «todavia sin trabajar» —y tiene 191 respuestas recogidas—, asi
  // que la que iba mas atrasada se leia como la menos urgente. Las dos estan en
  // marcha y las dos tienen que verse igual; el largo de la barra ya dice cual
  // va mas lejos.
  const { facultades } = piramideDeCuota([
    { faculty: "Ciencias", sex: "F", target: 421, observed: 191 },
    { faculty: "Letras", sex: "F", target: 431, observed: 243 },
    { faculty: "Gestion", sex: "F", target: 100, observed: 0 },
  ] as never);

  const lado = (f: string) => facultades.find((x) => x.facultad === f)?.izquierda;
  expect(lado("Ciencias")?.observadas).toBe(191);
  expect(lado("Ciencias")?.cumple).toBe(false);
  expect(lado("Letras")?.cumple).toBe(false);
  // La unica que merece el gris es la que no ha recogido nada.
  expect(lado("Gestion")?.observadas).toBe(0);
});

describe("la pirámide predice, no sólo describe", () => {
  // La pregunta «qué celda se va a incumplir» se quedó sin responder en todo el
  // perfil cuando se retiró la lista ordenada —siendo que el estudio se aprueba
  // o no por estas celdas—. Se responde aquí en vez de en un panel aparte, que
  // sería una segunda forma del MISMO cruce.
  const celda = (faculty: string, sex: string, target: number, observed: number) =>
    ({ faculty, sex, target, observed }) as unknown as MonitoreoRow;

  const previstas = (entradas: Array<[string, string, number, boolean, string | null, number]>) =>
    new Map(entradas.map(([f, s, esperadas, alcanza, fechaDeCruce, faltanAlCerrarAgenda]) =>
      [`${f}|${s}`, { esperadas, alcanza, fechaDeCruce, faltanAlCerrarAgenda }]));

  it("la sombra se recorta a lo que falta, no se pasa de la meta", () => {
    // Una sombra que rebasara el carril diría que el excedente sirve para algo,
    // y en este módulo pasarse en una celda no cubre otra.
    const { facultades } = piramideDeCuota(
      [celda("D", "Mujer", 100, 80), celda("D", "Hombre", 100, 100)],
      previstas([["D", "Mujer", 90, true, "2026-08-24", 0], ["D", "Hombre", 50, true, null, 0]]),
    );
    const [f] = facultades;
    const mujer = [f.izquierda, f.derecha].find((l) => l?.sexo === "Mujer")!;
    const hombre = [f.izquierda, f.derecha].find((l) => l?.sexo === "Hombre")!;
    // Le faltaba el 20 % y se le esperan 90: se dibuja el 20, no el 90.
    expect(mujer.previsto).toBe(20);
    // Ya cumplió: no crece.
    expect(hombre.previsto).toBe(0);
  });

  it("sin proyección no se inventa un pronóstico", () => {
    // No saber qué va a llegar no es saber que no llega nada: pintar cero
    // acusaría de una parálisis que nadie midió.
    const { facultades } = piramideDeCuota([celda("D", "Mujer", 100, 10)]);
    expect(facultades[0].izquierda?.previsto).toBeNull();
    expect(facultades[0].izquierda?.cierra).toBeNull();
  });

  it("una celda cumplida cierra aunque no haya nada agendado", () => {
    const { facultades } = piramideDeCuota(
      [celda("D", "Mujer", 100, 120)],
      previstas([["D", "Mujer", 0, false, null, 0]]),
    );
    expect(facultades[0].izquierda?.cierra).toBe(true);
    expect(facultades[0].izquierda?.cierraEl).toBeNull();
  });

  it("una celda que no cierra siempre deja algo por faltar", () => {
    // Es la invariante que permite ordenar por UNA sola clave: `alcanza` es
    // falso exactamente cuando lo esperado no cubre lo que falta. Si algún día
    // el motor rompiera esa relación, ordenar por «lo que faltará» dejaría de
    // poner en peligro arriba, y este aserto se pondría rojo antes.
    const { facultades } = piramideDeCuota(
      [celda("D", "Mujer", 100, 10)],
      previstas([["D", "Mujer", 5, false, null, 85]]),
    );
    const lado = facultades[0].izquierda!;
    expect(lado.cierra).toBe(false);
    expect(lado.faltanAlCerrar).toBeGreaterThan(0);
  });

  /**
   * **El orden ya no depende de la proyección** (Gonzalo, 2026-09-08). La
   * urgencia proyectada ordenaba la pirámide; desde que la predicción salió de
   * esta pestaña, ordena el tamaño de la meta y nada más. La consecuencia que
   * este test fija: pasar o no pasar previsiones NO cambia el orden.
   */
  it("el orden es el mismo con proyección y sin ella: manda el tamaño", () => {
    const filas = [
      celda("Grande", "Mujer", 500, 100), celda("Grande", "Hombre", 500, 100),
      celda("Peligro", "Mujer", 60, 10), celda("Peligro", "Hombre", 60, 10),
    ];
    const conProyeccion = piramideDeCuota(filas, previstas([
      ["Grande", "Mujer", 400, true, "2026-08-24", 0],
      ["Grande", "Hombre", 400, true, "2026-08-24", 0],
      ["Peligro", "Mujer", 5, false, null, 45],
      ["Peligro", "Hombre", 5, false, null, 45],
    ]));
    const sinProyeccion = piramideDeCuota(filas);
    // 120 personas contra 1 000: la pequeña abre en los dos casos.
    expect(conProyeccion.facultades.map((f) => f.facultad)).toEqual(["Peligro", "Grande"]);
    expect(sinProyeccion.facultades.map((f) => f.facultad)).toEqual(["Peligro", "Grande"]);
  });

  it("de la más pequeña a la más grande, aunque la grande vaya peor", () => {
    const { facultades } = piramideDeCuota([
      celda("Poca", "Mujer", 60, 50), celda("Mucha", "Mujer", 500, 100),
    ]);
    expect(facultades.map((f) => f.facultad)).toEqual(["Poca", "Mucha"]);
  });
});

describe("celdasPrevistas indexa por facultad y sexo", () => {
  it("no mezcla la celda de una facultad con la de otra", () => {
    // Si la clave fuera sólo el sexo, la previsión de Derecho pintaría la barra
    // de Arte.
    const mapa = celdasPrevistas([
      { facultad: "Derecho", esperadoPorAula: 20, aulasAgendadas: 2, dias: [], reparto: "observada",
        alcanzaTodo: false, corte: "", esperadasPorDisenoTotal: null, aulasConDiseno: 0, cuotas: [
          { sexo: "Mujer", meta: 100, observadas: 10, faltan: 90, esperadasDeLaAgenda: 40,
            alcanza: false, fechaDeCruce: null, faltanAlCerrarAgenda: 50 }] },
      { facultad: "Arte", esperadoPorAula: 20, aulasAgendadas: 0, dias: [], reparto: "observada",
        alcanzaTodo: true, corte: "", esperadasPorDisenoTotal: null, aulasConDiseno: 0, cuotas: [
          { sexo: "Mujer", meta: 10, observadas: 10, faltan: 0, esperadasDeLaAgenda: 0,
            alcanza: true, fechaDeCruce: null, faltanAlCerrarAgenda: 0 }] },
    ]);
    expect(mapa.get("Derecho|Mujer")?.esperadas).toBe(40);
    expect(mapa.get("Arte|Mujer")?.esperadas).toBe(0);
    expect(mapa.get("Arte|Hombre")).toBeUndefined();
  });
});
