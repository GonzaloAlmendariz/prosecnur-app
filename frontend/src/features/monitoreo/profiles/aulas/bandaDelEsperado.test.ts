import { describe, expect, it } from "vitest";
import type { MonitoreoRow } from "../../../../api/monitoreo";
import { bandaDelEsperado, serieDeRendimiento } from "./serieDeRendimiento";

const parte = (f: Partial<MonitoreoRow>) => f as MonitoreoRow;
const dia = (fecha: string, n: number, efectivas: number) =>
  Array.from({ length: n }, () => parte({ faculty: "DERECHO", applied_at: fecha, effective_surveys: efectivas }));

/**
 * El esperado es una MEDIA POSTERIOR y se dibujaba como una línea sola.
 *
 * Es el mismo defecto que la probabilidad de cierre repara en las celdas: un
 * estimador puntual leído como si fuera cierto. Con dos aulas visitadas y con
 * treinta el punteado se ve igual, y no significa lo mismo.
 */
describe("la banda del esperado", () => {
  it("SE ESTRECHA CONFORME LLEGAN AULAS: es el punto entero", () => {
    // Mismo rendimiento cada día; lo único que cambia es cuántas aulas lo
    // respaldan. Si la banda no se estrechara, no estaría midiendo nada.
    const { facultades } = serieDeRendimiento([
      ...dia("2026-08-10", 2, 20),
      ...dia("2026-08-11", 10, 20),
      ...dia("2026-08-12", 30, 20),
    ]);
    const dias = facultades[0]!.dias.filter((d) => d.esperadoBanda !== null);
    expect(dias.length).toBeGreaterThanOrEqual(2);
    const anchos = dias.map((d) => d.esperadoBanda!.alto - d.esperadoBanda!.bajo);
    for (let i = 1; i < anchos.length; i += 1) {
      expect(anchos[i]!).toBeLessThan(anchos[i - 1]!);
    }
  });

  it("la banda CONTIENE al esperado y no al revés", () => {
    const { facultades } = serieDeRendimiento(dia("2026-08-10", 12, 18));
    for (const d of facultades[0]!.dias) {
      if (!d.esperadoBanda) continue;
      expect(d.esperadoBanda.bajo).toBeLessThanOrEqual(d.esperado);
      expect(d.esperadoBanda.alto).toBeGreaterThanOrEqual(d.esperado);
    }
  });

  it("nunca baja de cero: un rendimiento negativo no existe", () => {
    const { facultades } = serieDeRendimiento(dia("2026-08-10", 6, 1));
    for (const d of facultades[0]!.dias) {
      if (d.esperadoBanda) expect(d.esperadoBanda.bajo).toBeGreaterThanOrEqual(0);
    }
  });

  it("con una sola aula la banda SALE, y ancha: la manda el prior", () => {
    // Primera versión de este test: esperaba `null`. Estaba mal, y la
    // comprobación lo dijo. Con `PESO_DEL_PRIOR = 5` la posterior nunca es
    // débil de verdad —el prior aporta su propia alfa—, así que con una sola
    // aula la banda existe y está dominada por el prior. Eso ES lo correcto en
    // un bayesiano: poca evidencia no es «no sé», es «sé lo que traía».
    const { facultades } = serieDeRendimiento(dia("2026-08-10", 1, 20));
    const uno = facultades[0]!.dias[0]!;
    expect(uno.esperadoBanda).not.toBeNull();

    const { facultades: muchas } = serieDeRendimiento(dia("2026-08-10", 40, 20));
    const ancho = (d: { esperadoBanda: { bajo: number; alto: number } | null }) =>
      d.esperadoBanda!.alto - d.esperadoBanda!.bajo;
    // Relativo al esperado, porque las medias no son iguales.
    const conMuchas = muchas[0]!.dias[0]!;
    expect(ancho(uno) / uno.esperado).toBeGreaterThan(ancho(conMuchas) / conMuchas.esperado);
  });

  it("por debajo de la alfa mínima NO da banda, aunque se lo pidan", () => {
    // Wilson-Hilferty se degrada con alfa pequeña, y una banda que no vale es
    // peor que ninguna: la banda ES la promesa de que se conoce la
    // incertidumbre. La serie real nunca llega ahí con `PESO_DEL_PRIOR = 5`,
    // pero la guarda tiene que morder si alguien baja el prior.
    //
    // Primera versión de este test: `expect(String(serieDeRendimiento).length)
    // .toBeGreaterThan(0)`. Eso no comprueba nada; se cambió por la llamada
    // directa al helper.
    expect(bandaDelEsperado(4.9, 3)).toBeNull();
    expect(bandaDelEsperado(5, 3)).not.toBeNull();
    expect(bandaDelEsperado(Number.NaN, 3)).toBeNull();
    expect(bandaDelEsperado(20, 0)).toBeNull();
  });

  it("una alfa mayor con la misma media da una banda más estrecha", () => {
    // La propiedad del estimador, aislada del pipeline.
    const floja = bandaDelEsperado(6, 1)!;
    const firme = bandaDelEsperado(600, 100)!;
    expect(firme.alto - firme.bajo).toBeLessThan(floja.alto - floja.bajo);
    // Y las dos hablan del mismo rendimiento: 6/1 = 600/100 = 6.
    expect(Math.abs((floja.alto + floja.bajo) / 2 - 6)).toBeLessThan(1.5);
  });

  it("no toca el esperado: convive con él", () => {
    const { facultades } = serieDeRendimiento(dia("2026-08-10", 10, 20));
    const d = facultades[0]!.dias[0]!;
    expect(d.esperado).toBeGreaterThan(0);
    expect(d.esperadoBanda).not.toBeNull();
  });
});
