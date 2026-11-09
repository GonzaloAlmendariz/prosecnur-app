import { describe, expect, it } from "vitest";
import type { EnsayoPestana, EnsayoPublicacion } from "../../../api/monitoreoPublicarEnsayo";
import { accionAplicar, estadoPestana, lineaClave, lineaIntactas, lineaPestana } from "./ensayoPublicacionModelo";

const pestana = (over: Partial<EnsayoPestana> = {}): EnsayoPestana => ({
  pestana: "Avance",
  seCrea: false,
  clave: "Código",
  sinClave: false,
  anadidas: 0,
  cambiadas: 0,
  borradas: 0,
  columnasCambiadas: [],
  filasAntes: 10,
  filasDespues: 10,
  columnasAntes: 4,
  columnasDespues: 4,
  encoge: false,
  destructiva: false,
  sinCambios: true,
  detalle: { anadidas: [], cambiadas: [], borradas: [] },
  detalleTruncado: false,
  ...over,
});

const ensayo = (pestanas: EnsayoPestana[], intactas: string[] = []): EnsayoPublicacion => {
  const suma = (k: "anadidas" | "cambiadas" | "borradas") => pestanas.reduce((n, p) => n + p[k], 0);
  return {
    spreadsheetId: "x",
    spreadsheetUrl: "",
    generadoEn: "",
    firma: "",
    pestanas,
    intactas,
    resumen: {
      anadidas: suma("anadidas"),
      cambiadas: suma("cambiadas"),
      borradas: suma("borradas"),
      pestanasNuevas: pestanas.filter((p) => p.seCrea).length,
      pestanasQueEncogen: pestanas.filter((p) => p.encoge).length,
      destructivo: pestanas.some((p) => p.destructiva),
    },
  };
};

describe("ensayo de publicación", () => {
  it("una pestaña que borra filas es destructiva aunque también añada", () => {
    const p = pestana({ anadidas: 2, borradas: 1, destructiva: true, sinCambios: false });
    expect(estadoPestana(p)).toBe("destructiva");
    expect(lineaPestana(p)).toBe("2 añadidas y 1 borrada.");
  });

  it("encoger se dice con las filas de antes y después", () => {
    const p = pestana({ borradas: 3, encoge: true, destructiva: true, sinCambios: false, filasAntes: 12, filasDespues: 9 });
    expect(lineaPestana(p)).toContain("Pasa de 12 a 9 filas.");
  });

  it("sin clave avisa que una fila editada cuenta como borrada y añadida", () => {
    const p = pestana({ sinClave: true, clave: "", cambiadas: 0, anadidas: 1, borradas: 1, destructiva: true, sinCambios: false });
    expect(lineaClave(p)).toMatch(/borrada y añadida/);
    expect(lineaClave(pestana({ sinCambios: false, cambiadas: 1 }))).toBe('Cada fila se identifica por "Código".');
  });

  it("Aplicar va en rojo y nombra las filas que borra", () => {
    const a = accionAplicar(ensayo([pestana({ borradas: 4, destructiva: true, sinCambios: false })]));
    expect(a.tono).toBe("peligro");
    expect(a.rotulo).toBe("Aplicar y borrar 4 filas");
    expect(a.aviso).toBe("4 filas desaparecen del libro.");
  });

  it("solo añadir o cambiar no es destructivo", () => {
    const a = accionAplicar(ensayo([pestana({ anadidas: 3, cambiadas: 1, sinCambios: false })]));
    expect(a).toEqual({ rotulo: "Aplicar", tono: "primario", aviso: "" });
  });

  it("si nada cambia lo dice en vez de prometer una actualización", () => {
    const a = accionAplicar(ensayo([pestana()]));
    expect(a.rotulo).toBe("Aplicar de todos modos");
    expect(a.aviso).toBe("El libro ya tiene exactamente esto.");
  });

  it("las pestañas ajenas se listan como intactas", () => {
    expect(lineaIntactas(ensayo([pestana()], ["Agenda", "Notas"]))).toBe("2 pestañas del libro no se tocan: Agenda, Notas.");
    expect(lineaIntactas(ensayo([pestana()]))).toBe("");
  });
});
