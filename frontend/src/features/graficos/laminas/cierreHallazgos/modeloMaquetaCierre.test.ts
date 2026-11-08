// La maqueta del cierre (modeloMaquetaCierre.ts): las tarjetas que dibuja la lámina, la cifra viva en cada una y el
// marcador «Hallazgo N» en las que no tienen cifra. Y el aviso de la cifra que cambió desde que se eligió.
import { describe, expect, it } from "vitest";
import { avisoCifraCambio, conCifraDe, hallazgoNuevo, type HallazgoCierre } from "./modeloCierre";
import { marcadorDeLugar, tarjetasDelCierre } from "./modeloMaquetaCierre";

const fila = (clave: string, extra: Partial<HallazgoCierre> = {}): HallazgoCierre => ({ ...hallazgoNuevo(clave), ...extra });
const VIVAS = { s3: { cifras: [{ clave: "diferencia:Biblioteca", rotulo: "Biblioteca: diferencia", texto: "+9", valor: 9, unidad: "pts" }], cargando: false, error: null } };

describe("las tarjetas de la maqueta", () => {
  it("sin hallazgos, una tarjeta por fila del editor con su marcador de lugar", () => {
    const t = tarjetasDelCierre([fila("a"), fila("b"), fila("c"), fila("d")], {});
    expect(t.map(marcadorDeLugar)).toEqual(["Hallazgo 1", "Hallazgo 2", "Hallazgo 3", "Hallazgo 4"]);
  });

  it("C4: sin filas, tres marcadores sin fila detrás; nunca cero tarjetas", () => {
    const t = tarjetasDelCierre([], {});
    expect(t.map((x) => [x.fila, marcadorDeLugar(x)])).toEqual([[null, "Hallazgo 1"], [null, "Hallazgo 2"], [null, "Hallazgo 3"]]);
    expect(tarjetasDelCierre([fila("a")], {}).map((x) => x.fila)).toEqual(["a", null, null]);
  });

  it("C4: elegir la primera cifra no cambia cuántas tarjetas hay", () => {
    const antes = tarjetasDelCierre([fila("a"), fila("b"), fila("c")], {});
    const despues = tarjetasDelCierre([fila("a", { lamina: "s3", cifra: "diferencia:Biblioteca" }), fila("b"), fila("c")], VIVAS);
    expect(despues).toHaveLength(antes.length);
    expect(despues.map(marcadorDeLugar)).toEqual([null, "Hallazgo 2", "Hallazgo 3"]);
  });

  it("una tarjeta por fila, numerada como su fila; la vacía lleva su marcador", () => {
    const filas = [
      fila("a", { lamina: "s3", cifra: "diferencia:Biblioteca", texto: "La biblioteca divide", cifraAlEscribir: "+12" }),
      fila("b"),
      fila("c", { texto: "Falta su cifra" }),
    ];
    const t = tarjetasDelCierre(filas, VIVAS);
    expect(t.map((x) => [x.numero, x.cifra?.texto ?? null, marcadorDeLugar(x)])).toEqual([[1, "+9", null], [2, null, "Hallazgo 2"], [3, null, "Hallazgo 3"]]);
    expect(t[2].texto).toBe("Falta su cifra");
  });

  it("mientras la lámina no responde, la cifra que se leyó al elegirla; si ya no está, el marcador", () => {
    const h = fila("a", { lamina: "s3", cifra: "diferencia:Comedor", cifraAlEscribir: "+4" });
    expect(tarjetasDelCierre([h], {})[0].cifra?.texto).toBe("+4");
    expect(marcadorDeLugar(tarjetasDelCierre([h], VIVAS)[0])).toBe("Hallazgo 1");
  });
});

describe("la cifra elegida y su cambio", () => {
  it("elegir fija la lámina, la clave y cómo se leía la cifra", () => {
    const h = conCifraDe(fila("a", { lamina: "s1", cifra: "mediana:Docentes", texto: "Mi frase" }), "s3", VIVAS.s3.cifras[0]);
    expect(h).toMatchObject({ lamina: "s3", cifra: "diferencia:Biblioteca", cifraAlEscribir: "+9", texto: "Mi frase" });
  });

  it("avisa, como el motor, la cifra que cambió desde que se eligió", () => {
    const h = fila("a", { lamina: "s3", cifra: "diferencia:Biblioteca", cifraAlEscribir: "+12" });
    expect(avisoCifraCambio(h, { texto: "+9" })).toBe("La cifra cambió desde que se escribió el texto: era +12 y hoy es +9.");
    expect(avisoCifraCambio(h, { texto: "+12" })).toBeNull();
    expect(avisoCifraCambio(h, null)).toBeNull();
    expect(avisoCifraCambio({ ...h, cifraAlEscribir: "" }, { texto: "+9" })).toBeNull();
  });
});
