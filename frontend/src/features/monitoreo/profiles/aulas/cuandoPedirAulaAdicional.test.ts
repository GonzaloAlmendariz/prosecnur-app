import { describe, expect, it } from "vitest";

import { cuandoPedirAulaAdicional, MINIMO_PARA_COMPARAR } from "./cuandoPedirAulaAdicional";
import type { MonitoreoAulasEfectividadSeguimiento } from "../../../../api/monitoreo";

/**
 * Ítems 8 y 9 del dictado: cuándo pedir un aula adicional, y desde cuándo el
 * aviso tiene base. La condición de base la calcula el motor con el intervalo
 * de cada facultad; lo que este helper añade es no dejar que el silencio de una
 * facultad sin medir se lea como una buena noticia.
 */
const fila = (f: Record<string, unknown>) => f as never;

const bloque = (facultades: Array<Record<string, unknown>>) =>
  ({ total: {}, facultades } as unknown as MonitoreoAulasEfectividadSeguimiento);

describe("cuándo pedir un aula adicional", () => {
  it("separa la que no cierra ni en el mejor caso de la que todavía puede", () => {
    const a = cuandoPedirAulaAdicional(bloque([
      fila({ facultad: "DERECHO", riesgo: "riesgo_firme", aulas_aplicadas: 6, margen_restante: -188 }),
      fila({ facultad: "LETRAS", riesgo: "riesgo", aulas_aplicadas: 5, margen_restante: -1 }),
      fila({ facultad: "ARTES", riesgo: "holgado", aulas_aplicadas: 4, margen_restante: 121 }),
    ]))!;
    expect(a.pedirYa.map((f) => f.facultad)).toEqual(["DERECHO"]);
    expect(a.vigilar.map((f) => f.facultad)).toEqual(["LETRAS"]);
    expect(a.alumnosQueFaltan).toBe(188);
    expect(a.frase).toContain("hay que pedirles aula adicional");
    expect(a.frase).toContain("vigilar antes de pedir");
  });

  it("la facultad sin base no cuenta como que va bien: se dice que no se sabe", () => {
    // «Con una o dos aulas eso no es suficiente base» (Gonzalo).
    const a = cuandoPedirAulaAdicional(bloque([
      fila({ facultad: "DERECHO", riesgo: "holgado", aulas_aplicadas: 1 }),
      fila({ facultad: "LETRAS", riesgo: "holgado", aulas_aplicadas: 9 }),
    ]))!;
    expect(a.sinBase.map((f) => f.facultad)).toEqual(["DERECHO"]);
    expect(a.frase).toContain("no se sabe, no es que vayan bien");
    expect(MINIMO_PARA_COMPARAR).toBeGreaterThan(1);
  });

  it("una facultad que YA avisa no se manda a «sin base» por tener pocas aulas", () => {
    // El aviso vale igual: si con dos aulas ni el extremo optimista cierra su
    // cuota, el problema es de tamaño y no de ruido.
    const a = cuandoPedirAulaAdicional(bloque([
      fila({ facultad: "DERECHO", riesgo: "riesgo_firme", aulas_aplicadas: 2, margen_restante: -400 }),
    ]))!;
    expect(a.pedirYa).toHaveLength(1);
    expect(a.sinBase).toHaveLength(0);
  });

  it("sin ninguna en riesgo lo dice, en vez de callar", () => {
    const a = cuandoPedirAulaAdicional(bloque([
      fila({ facultad: "DERECHO", riesgo: "holgado", aulas_aplicadas: 9 }),
    ]))!;
    expect(a.frase).toContain("Ninguna facultad necesita aula adicional");
  });

  it("sin bloque no inventa una lectura", () => {
    expect(cuandoPedirAulaAdicional(null)).toBeNull();
    expect(cuandoPedirAulaAdicional({ facultades: [] } as never)).toBeNull();
  });
});

describe("sin nadie a quien evaluar, no hay buenas noticias que dar", () => {
  /**
   * **Un cero en riesgo dice dos cosas opuestas.** «Las medí todas y ninguna
   * está en riesgo» y «no pude medir ninguna» producen el mismo cero, y la
   * frase elegía siempre la primera — encima del panel que existe para decidir
   * si se piden aulas.
   *
   * Medido el 2026-09-22, primer día de campo de CCSS Perfil 2026-II: la cuota
   * entra por el eje declarado (nivel) y este bloque agrupa por la facultad del
   * aula, así que los dos lados del cruce no se encuentran. El motor publicaba
   * `facultades_evaluadas: 0` y `facultades_sin_cuota: 1`, y la pantalla daba
   * dos buenas noticias seguidas.
   *
   * No es lo mismo que `sinBase`: aquélla tiene contra qué medirse y le faltan
   * aulas; ésta tiene las aulas y no tiene cuota.
   */
  it("con todas sin cuota NO afirma, y lo dice con su causa", () => {
    const a = cuandoPedirAulaAdicional(bloque([
      fila({ facultad: "CIENCIAS SOCIALES", riesgo: "sin_cumplimiento", aulas_aplicadas: 4, cuota: null }),
    ]))!;
    expect(a.sinEvaluar.map((f) => f.facultad)).toEqual(["CIENCIAS SOCIALES"]);
    expect(a.frase).not.toContain("Ninguna facultad necesita aula adicional");
    expect(a.frase).toContain("No se pudo evaluar ninguna");
    // Y dice que el silencio no es una buena noticia, igual que hace `sinBase`.
    expect(a.frase).toContain("no es que no haga falta");
  });

  /**
   * Con la cuota por NIVEL la facultad no tiene la suya, pero el diseño sí la
   * trazó: «no hay cuota contra la que proyectar» mandaba a revisar un diseño
   * que está bien. Se dice por qué eje va y dónde se lee.
   */
  it("con la cuota en otro eje dice cuál y dónde se lee, sin afirmar nada", () => {
    const a = cuandoPedirAulaAdicional({
      total: {},
      eje: { clave: "nivel", etiqueta: "Nivel" },
      facultades: [fila({ facultad: "CIENCIAS SOCIALES", riesgo: "cuota_en_otro_eje",
                          riesgo_agendado: "cuota_en_otro_eje", aulas_aplicadas: 10, cuota: null })],
    } as unknown as MonitoreoAulasEfectividadSeguimiento)!;
    expect(a.sinEvaluar).toHaveLength(1);
    expect(a.frase).toContain("La cuota se reparte por nivel");
    expect(a.frase).toContain("Metas");
    expect(a.frase).not.toContain("No se pudo evaluar ninguna");
    expect(a.frase).not.toContain("Ninguna facultad necesita aula adicional");
  });

  it("`sin_campo` y `sin_cuota` cuentan igual: ninguna se pudo proyectar", () => {
    const a = cuandoPedirAulaAdicional(bloque([
      fila({ facultad: "A", riesgo: "sin_campo", aulas_aplicadas: 0 }),
      fila({ facultad: "B", riesgo: "sin_cuota", aulas_aplicadas: 7 }),
    ]))!;
    expect(a.sinEvaluar).toHaveLength(2);
    expect(a.frase).toContain("No se pudo evaluar ninguna");
  });

  it("manda `riesgo_agendado` cuando viene: es la cifra operativa", () => {
    const a = cuandoPedirAulaAdicional(bloque([
      fila({ facultad: "A", riesgo: "holgado", riesgo_agendado: "sin_cuota", aulas_aplicadas: 7 }),
    ]))!;
    expect(a.sinEvaluar).toHaveLength(1);
  });

  it("con algunas evaluadas la frase se ACOTA en vez de callarse", () => {
    // Lo que se midió vale: callarlo por lo que no se pudo medir sería el
    // defecto contrario.
    const a = cuandoPedirAulaAdicional(bloque([
      fila({ facultad: "A", riesgo: "holgado", aulas_aplicadas: 7 }),
      fila({ facultad: "B", riesgo: "sin_cuota", aulas_aplicadas: 7 }),
    ]))!;
    expect(a.frase).toContain("De las 1 que se pudieron evaluar, ninguna necesita aula adicional");
  });

  it("sin filas sin evaluar la frase de siempre no cambia ni una coma", () => {
    // La prueba de identidad para HSVG, cuyo eje es la facultad y evalúa sus
    // quince filas: ahí este cambio no puede mover nada.
    const a = cuandoPedirAulaAdicional(bloque([
      fila({ facultad: "DERECHO", riesgo: "holgado", aulas_aplicadas: 9 }),
      fila({ facultad: "LETRAS", riesgo: "ajustado", aulas_aplicadas: 9 }),
    ]))!;
    expect(a.sinEvaluar).toEqual([]);
    expect(a.frase).toBe("Ninguna facultad necesita aula adicional con lo que tiene agendado.");
  });
});
