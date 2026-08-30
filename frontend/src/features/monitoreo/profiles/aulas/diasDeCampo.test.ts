import { describe, expect, it } from "vitest";
import { comparaCodigos } from "./aulasPresentation";
import { diasDeCampoEntre, restarDiasDeCampo } from "./pronosticoDeCierre";

/**
 * Los días de campo saltan domingos, y de ellos cuelga el pronóstico de cierre:
 * cuántos quedan hasta el corte y en qué fecha caería lo que falta.
 *
 * Ninguna de las dos tenía prueba —salieron de barrer los 249 símbolos
 * exportados del perfil contra sus tests, el 2026-08-30—. Las dos son
 * aritmética de calendario, que es donde el error no se ve hasta que alguien
 * cuenta a mano.
 *
 * Fechas de referencia, comprobadas: **2026-09-01 martes · 09-06 y 09-13
 * domingos · 09-07 y 09-14 lunes**.
 */
describe("los días de campo saltan domingos", () => {
  it("cuenta el tramo sin domingo de por medio", () => {
    // Del martes 1 al sábado 5: miércoles, jueves, viernes y sábado.
    expect(diasDeCampoEntre("2026-09-01", "2026-09-05")).toBe(4);
  });

  it("descuenta el domingo que cae dentro", () => {
    // Del martes 1 al lunes 7 hay seis días naturales y uno es domingo.
    expect(diasDeCampoEntre("2026-09-01", "2026-09-07")).toBe(5);
  });

  it("dos domingos se descuentan los dos", () => {
    // Del martes 1 al lunes 14: trece naturales, dos domingos.
    expect(diasDeCampoEntre("2026-09-01", "2026-09-14")).toBe(11);
  });

  it("no cuenta hacia atrás ni el mismo día: son cero, no un negativo", () => {
    expect(diasDeCampoEntre("2026-09-07", "2026-09-01")).toBe(0);
    expect(diasDeCampoEntre("2026-09-07", "2026-09-07")).toBe(0);
  });

  it("una fecha ilegible da cero y no NaN, que se pintaría como número", () => {
    expect(diasDeCampoEntre("no-es-fecha", "2026-09-07")).toBe(0);
    expect(diasDeCampoEntre("2026-09-01", "")).toBe(0);
  });

  it("restar salta domingos igual que contar", () => {
    // Un día de campo antes del lunes 7 es el sábado 5, no el domingo 6.
    expect(restarDiasDeCampo("2026-09-07", 1)).toBe("2026-09-05");
    expect(restarDiasDeCampo("2026-09-07", 5)).toBe("2026-09-01");
  });

  it("restar cero o menos devuelve el mismo día, sin moverlo", () => {
    expect(restarDiasDeCampo("2026-09-07", 0)).toBe("2026-09-07");
    expect(restarDiasDeCampo("2026-09-07", -3)).toBe("2026-09-07");
  });

  it("ida y vuelta: restar lo que se contó devuelve el punto de partida", () => {
    // La propiedad que las ata: son inversas, y su comentario lo declara.
    const desde = "2026-09-01", hasta = "2026-09-14";
    expect(restarDiasDeCampo(hasta, diasDeCampoEntre(desde, hasta))).toBe(desde);
  });
});

/**
 * `comparaCodigos` ordena «CH 1, CH 2, … CH 10», no «CH 1, CH 10, CH 2».
 *
 * Ya usa `numeric: true`, así que el clásico está resuelto; lo que faltaba era la
 * prueba que lo fije, porque quitar esa opción no rompe nada más y el orden malo
 * sólo se nota mirando una lista larga.
 *
 * **Se comprueba el ORDEN, no el signo ni el locale.** `Intl` puede degradar en
 * el runner —ya pasó en este repo con `toLocaleString("es-PE")`, que se fue a
 * inglés— y un test que afirme la comparación de acentos daría rojo por el
 * entorno y no por el código.
 */
describe("los códigos de curso-horario ordenan por número, no por letra", () => {
  it("CH 10 va después de CH 2", () => {
    const orden = ["CH 10", "CH 2", "CH 1"].sort(comparaCodigos);
    expect(orden).toEqual(["CH 1", "CH 2", "CH 10"]);
  });

  it("aguanta la escala real del estudio, que llega a tres cifras", () => {
    const orden = ["CH 174", "CH 9", "CH 100", "CH 21"].sort(comparaCodigos);
    expect(orden).toEqual(["CH 9", "CH 21", "CH 100", "CH 174"]);
  });

  it("los reemplazos con decimal caen junto a su titular", () => {
    // «R 89.1» es la reserva de CH 89: entre CH 89 y CH 90, no al final.
    const orden = ["CH 90", "CH 89", "CH 9"].sort(comparaCodigos);
    expect(orden).toEqual(["CH 9", "CH 89", "CH 90"]);
  });
});
