import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AulasReservaDirigida } from "./AulasReservaDirigida";
import type {
  MonitoreoAulasCandidatoDirigido,
  MonitoreoAulasReservaDirigida,
} from "../../../../api/monitoreo";

const cand = (id: string, p: Partial<MonitoreoAulasCandidatoDirigido> = {}) =>
  ({
    classroom_id: id, faculty: "DERECHO", sexo: "F",
    elegibles_del_sexo: 20, solape_estimado: 1, aporte_esperado: 11,
    tasa_efectividad: 0.55, solape_medible: true,
    motivo: "Aporta 11 de 20 a la cuota de F de DERECHO",
    ...p,
  }) as MonitoreoAulasCandidatoDirigido;

const celda = (p: Partial<MonitoreoAulasReservaDirigida> = {}) =>
  ({
    faculty: "DERECHO", sex: "F", brecha: 12, candidatos: [cand("R 7")],
    aporte_de_los_candidatos: 11, alcanza: false,
    etiqueta: "El banco no alcanza: sus 1 aula aportan 11 y faltan 12",
    ...p,
  }) as MonitoreoAulasReservaDirigida;

const html = (celdas: MonitoreoAulasReservaDirigida[]) =>
  renderToStaticMarkup(<AulasReservaDirigida celdas={celdas} />);

describe("AulasReservaDirigida", () => {
  it("no ocupa sitio cuando no hay decision que tomar", () => {
    expect(html([])).toBe("");
  });

  it("tampoco con celdas sin brecha: un «todo bien» compite por la atencion", () => {
    expect(html([celda({ brecha: 0 })])).toBe("");
  });

  it("proyecta la frase del motor sin reescribirla", () => {
    const out = html([celda()]);
    expect(out).toContain("El banco no alcanza: sus 1 aula aportan 11 y faltan 12");
    expect(out).toContain("R 7");
    expect(out).toContain("Aporta 11 de 20");
  });

  it("nombra el sexo en palabras, que es como se lee la cuota", () => {
    const out = html([celda({ sex: "F" }), celda({ faculty: "LETRAS", sex: "M" })]);
    expect(out).toContain("mujeres");
    expect(out).toContain("hombres");
  });

  it("la celda que el banco NO cierra va primero", () => {
    // El orden es la decision: la que no se cierra obliga a algo distinto que
    // activar una reserva, y en una lista larga se perdia entre las que si.
    const out = html([
      celda({ faculty: "SI CIERRA", alcanza: true, brecha: 40 }),
      celda({ faculty: "NO CIERRA", alcanza: false, brecha: 2 }),
    ]);
    expect(out.indexOf("NO CIERRA")).toBeLessThan(out.indexOf("SI CIERRA"));
    expect(out.indexOf('data-alcanza="no"')).toBeLessThan(out.indexOf('data-alcanza="si"'));
  });

  it("marca el solape estimado, que no es lo mismo que medido", () => {
    const out = html([celda({ candidatos: [cand("R 1"), cand("R 2", { solape_medible: false })] })]);
    expect(out.match(/solape estimado/g) ?? []).toHaveLength(1);
    expect(out).not.toContain("en todas");
  });

  it("si NINGUNO trae padron lo dice una vez, no una por linea", () => {
    // Visto en pantalla sobre el fixture de aulas: cinco candidatos y cinco
    // «solape estimado» seguidos. Repetido cinco veces deja de distinguir.
    const out = html([celda({ candidatos: [
      cand("R 1", { solape_medible: false }),
      cand("R 2", { solape_medible: false }),
      cand("R 3", { solape_medible: false }),
    ] })]);
    expect(out.match(/solape estimado/g) ?? []).toHaveLength(1);
    expect(out).toContain("solape estimado en todas");
  });

  it("no repite la cola que el encabezado ya dice, y la conserva en el title", () => {
    // El motor redacta el motivo para ir SOLO. Bajo un encabezado que ya nombra
    // facultad y sexo, la cola se repetia una vez por candidato y tapaba lo
    // unico que los distingue: cuanto aporta cada uno.
    const out = html([celda({
      faculty: "DERECHO", sex: "M",
      candidatos: [cand("R 9", { motivo: "Aporta 16 de 29 a la cuota de hombres de DERECHO" })],
    })]);
    expect(out).toContain(">Aporta 16 de 29<");
    expect(out).toContain('title="Aporta 16 de 29 a la cuota de hombres de DERECHO"');
  });

  it("si la frase del motor cambia, se muestra entera: no se recorta a ciegas", () => {
    const out = html([celda({
      faculty: "DERECHO", sex: "M",
      candidatos: [cand("R 9", { motivo: "Aporta 16 de 29 a otra cosa" })],
    })]);
    expect(out).toContain("Aporta 16 de 29 a otra cosa");
  });

  it("una celda sin candidatos sigue apareciendo: es la que mas obliga", () => {
    const out = html([celda({
      candidatos: [], aporte_de_los_candidatos: 0,
      etiqueta: "El banco no tiene aulas de esa facultad y ese sexo",
    })]);
    expect(out).toContain("El banco no tiene aulas de esa facultad y ese sexo");
  });

  it("declara su geometria: sin C1 el gate no la mira", () => {
    // **Como MIEMBRO de su panel, no como grupo aparte.** Con grupo propio
    // quedaba fuera de los miembros del panel —el runner los filtra por
    // `closest("[data-qa-geometry-group]") === group`— y el panel caia a sus
    // hijos directos, midiendo el ENCABEZADO como contenedor de datos:
    // `capacity-drift` de 5 px sobre `mon-profile-panel-head`, medido el
    // 2026-09-12 en avance>cuotas. Declarada asi, el gate la sigue mirando
    // (sale en el audit del panel) y el encabezado deja de medirse.
    const out = html([celda()]);
    expect(out).toContain('data-qa-geometry-capacity="owned"');
    expect(out).toContain('data-qa-geometry-member="true"');
    expect(out).not.toContain('data-qa-geometry-group=');
  });

  it("dos celdas de la misma facultad se leen por separado, y manda la que no cierra", () => {
    // POSIBLE POR EL GRANO, NO OBSERVADO. `reservas_alcanzan` sale de
    // `cierre$alcanzan` (monitoreo_aulas_efectividad_seguimiento.R:475) sobre el
    // deficit en ALUMNOS de la facultad, sin dimension de sexo; esto es por
    // facultad×sexo. Asi que una facultad con banco de sobra puede tener su
    // celda de mujeres sin una sola aula util. Medido sobre el proyecto
    // derivado: ahi NO pasa —las 15 facultades dicen que alcanzan y las 9
    // celdas cierran—, asi que estos datos son sinteticos y lo que fija el test
    // es el RENDERIZADO, no que la divergencia ocurra.
    //
    // Lo que sostiene la superficie sin depender de eso: dice QUE aulas del
    // banco sirven a cada celda y cuanto aporta cada una, y eso ningun agregado
    // lo puede decir.
    const out = html([
      celda({ sex: "M", alcanza: true, brecha: 5,
              etiqueta: "Con 2 aulas del banco se cierra: aportan 9 y faltan 5" }),
      celda({ sex: "F", alcanza: false, brecha: 30, candidatos: [],
              etiqueta: "El banco no tiene aulas de esa facultad y ese sexo" }),
    ]);
    // La que no se cierra manda, y dice de que celda habla y cuanto falta.
    expect(out.indexOf("faltan 30")).toBeLessThan(out.indexOf("faltan 5"));
    expect(out.indexOf("mujeres")).toBeLessThan(out.indexOf("hombres"));
  });
});

describe("AulasReservaDirigida: el eje declarado", () => {
  const NIVEL = {
    clave: "nivel", etiqueta: "Nivel", etiqueta_plural: "Niveles", etiqueta_sin: "Sin nivel",
  };
  const porNivel = () => celda({
    faculty: "6", sex: "", brecha: 104,
    candidatos: [cand("R 1.2", {
      faculty: "6", sexo: "",
      motivo: "Aporta 11 de 40 a la cuota de nivel 6",
    })],
    etiqueta: "El banco no tiene cursos-horario de ese nivel",
  });

  it("titula la celda con la palabra del eje, no con el valor pelado", () => {
    // Cuatro filas que decían «6», «7», «8», «9» debajo de un selector que ya
    // las llamaba «Nivel 6». En una lista donde cada fila dice «faltan 104», un
    // «7» suelto se lee como una cifra. Visto en pantalla el 2026-09-17.
    const out = renderToStaticMarkup(
      <AulasReservaDirigida celdas={[porNivel()]} eje={NIVEL} />,
    );
    expect(out).toContain("Nivel 6");
  });

  it("con el eje en facultad el rótulo no se mueve un byte", () => {
    // HSVG está en campo: sus etiquetas de gráfico y de lista son el valor
    // crudo, y `etiquetaDeValorEnGrafico` lo devuelve tal cual para ese eje.
    const out = renderToStaticMarkup(<AulasReservaDirigida celdas={[celda()]} />);
    expect(out).toContain("DERECHO");
    expect(out).not.toContain("Facultad DERECHO");
  });

  it("recorta la cola del motivo con las DOS redacciones del motor", () => {
    // Se corta por el separador « a la cuota de » y no por una cola
    // reconstruida: el motor redacta una frase con dimensión de sexo y otra sin
    // ella, cada una con la palabra que su eje declara, y esta capa no tiene
    // por qué conocer ninguna de las dos plantillas.
    const conSexo = renderToStaticMarkup(<AulasReservaDirigida celdas={[celda()]} />);
    expect(conSexo).toContain(">Aporta 11 de 20<");
    const sinSexo = renderToStaticMarkup(
      <AulasReservaDirigida celdas={[porNivel()]} eje={NIVEL} />,
    );
    expect(sinSexo).toContain(">Aporta 11 de 40<");
    // La frase entera sigue viajando en el `title`, así que no se pierde nada.
    expect(sinSexo).toContain("Aporta 11 de 40 a la cuota de nivel 6");
  });

  it("un motivo con otra redacción se muestra entero, no a medias", () => {
    // Si el motor cambia el separador, no casa: mostrarlo completo es correcto
    // y recortar por una posición adivinada sería mutilarlo.
    const out = renderToStaticMarkup(
      <AulasReservaDirigida eje={NIVEL} celdas={[celda({
        faculty: "6", sex: "", candidatos: [cand("R 9", { motivo: "Aporta 11 de 40" })],
      })]} />,
    );
    expect(out).toContain(">Aporta 11 de 40<");
  });
});

describe("cuando el banco no tiene salida para ninguno", () => {
  /**
   * Gonzalo, 2026-09-22, sobre la pestaña Metas: «no veo bien los niveles de
   * avance […] los gráficos bonitos y elegantes». Medido en su pantalla: cuatro
   * tarjetas de 80 px, una por nivel, repitiendo palabra por palabra «El banco
   * no tiene cursos-horario de ese nivel». Media pantalla para una frase, y lo
   * único que distinguía a las cuatro —cuánto falta— de adorno a la derecha.
   */
  const sinBanco = (valor: string, brecha: number) =>
    celda({
      faculty: valor, sex: "", brecha, candidatos: [],
      aporte_de_los_candidatos: 0, alcanza: false,
      etiqueta: "El banco no tiene cursos-horario de ese nivel",
    });

  const texto = (h: string) => h.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

  it("dice la frase UNA vez y conserva lo que distingue a cada grupo", () => {
    const t = texto(html([sinBanco("7", 95), sinBanco("6", 86), sinBanco("8", 77)]));
    expect(t.match(/El banco no tiene cursos-horario de ese nivel/g)).toHaveLength(1);
    // Los grupos y su falta siguen enteros: es lo único que los separa.
    expect(t).toContain("faltan 95");
    expect(t).toContain("faltan 86");
    expect(t).toContain("faltan 77");
  });

  it("con DOS motivos distintos no se colapsa: informan cosas distintas", () => {
    // «el banco no tiene de ese nivel» y «sus aulas no alcanzan» se arreglan de
    // formas distintas; juntarlos escondería una de las dos.
    const t = texto(html([
      sinBanco("7", 95),
      celda({ faculty: "6", sex: "", brecha: 86, candidatos: [],
        etiqueta: "Las reservas de su cadena ya están activadas" }),
    ]));
    expect(t).toContain("El banco no tiene cursos-horario de ese nivel");
    expect(t).toContain("Las reservas de su cadena ya están activadas");
  });

  it("con un solo grupo no se colapsa: no hay repetición que evitar", () => {
    const t = texto(html([sinBanco("7", 95)]));
    expect(t).toContain("El banco no tiene cursos-horario de ese nivel");
    expect(t).toContain("faltan 95");
  });

  it("si alguno SI tiene candidatos, la lista entera se queda", () => {
    const t = texto(html([sinBanco("7", 95), celda({ faculty: "6", sex: "" })]));
    expect(t).toContain("R 7");
  });
});
