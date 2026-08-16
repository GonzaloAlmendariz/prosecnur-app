import { describe, expect, it } from "vitest";

import { conDivisorDelMarco } from "../divisorDelMarco";
import type { CalcMuestraEstrato } from "../../../../../api/calcMuestra";
import type { FacultadDatos } from "../../../dominio";

function estrato(label: string, extra: Partial<CalcMuestraEstrato> = {}): CalcMuestraEstrato {
  return {
    id: label.toLowerCase(),
    label,
    N: 1000,
    N_a: 600,
    N_b: 400,
    sub_a_label: "Mujeres",
    sub_b_label: "Hombres",
    promedio_conglomerado: 28,
    tau: 0.5,
    ...extra,
  };
}

function facultad(nombre: string, mediana: number | null, media: number | null): FacultadDatos {
  return {
    id: nombre.toLowerCase(),
    nombre,
    N: 1000,
    mujeres: 600,
    hombres: 400,
    estAulaMediana: mediana,
    estAulaMedia: media,
    estAulaLo95: null,
    estAulaHi95: null,
    estAulaNCh: null,
    alcanzables: null,
    pExito: null,
  };
}

describe("conDivisorDelMarco", () => {
  it("trae la mediana y la media que mide el marco", () => {
    // El caso de siempre: el estrato traía 28 de un mapa de referencia y el
    // marco cargado dice otra cosa. Manda el marco.
    const [salida] = conDivisorDelMarco(
      [estrato("Derecho")],
      [facultad("Derecho", 33, 26.7)],
    );
    expect(salida.promedio_conglomerado).toBe(26.7);
    expect(salida.mediana_conglomerado).toBe(33);
  });

  it("empareja aunque cambien tildes, mayúsculas o separadores", () => {
    const [salida] = conDivisorDelMarco(
      [estrato("GASTRONOMÍA, HOTELERÍA Y TURISMO")],
      [facultad("Gastronomia Hoteleria y Turismo", 16, 18)],
    );
    expect(salida.mediana_conglomerado).toBe(16);
  });

  it("una facultad que el marco no conoce conserva su divisor", () => {
    // «El marco no dice nada» no es «el marco dice cero». Pisar con null
    // dejaría al motor dividiendo por cero.
    const [salida] = conDivisorDelMarco(
      [estrato("Psicología", { promedio_conglomerado: 22.1 })],
      [facultad("Derecho", 33, 26.7)],
    );
    expect(salida.promedio_conglomerado).toBe(22.1);
    expect(salida.mediana_conglomerado).toBeUndefined();
  });

  it("un tamaño no utilizable no borra el que había", () => {
    // Una facultad sin ningún curso-horario elegible llega con 0 o null. Se
    // ignora ese lado y se conserva el otro.
    const [soloMedia] = conDivisorDelMarco(
      [estrato("Educación", { promedio_conglomerado: 16 })],
      [facultad("Educación", 0, 15.4)],
    );
    expect(soloMedia.promedio_conglomerado).toBe(15.4);
    expect(soloMedia.mediana_conglomerado).toBeUndefined();

    const [ninguno] = conDivisorDelMarco(
      [estrato("Educación", { promedio_conglomerado: 16, mediana_conglomerado: 14 })],
      [facultad("Educación", null, Number.NaN)],
    );
    expect(ninguno.promedio_conglomerado).toBe(16);
    expect(ninguno.mediana_conglomerado).toBe(14);
  });

  it("sin estratos o sin perfil devuelve lo que entró", () => {
    const entrada = [estrato("Derecho")];
    expect(conDivisorDelMarco(entrada, [])).toBe(entrada);
    expect(conDivisorDelMarco([], [facultad("Derecho", 33, 26.7)])).toHaveLength(0);
    // Un perfil cuyas facultades no tienen nombre no puede emparejar nada.
    expect(conDivisorDelMarco(entrada, [facultad("", 33, 26.7)])).toBe(entrada);
  });

  it("no toca el resto del estrato", () => {
    const entrada = estrato("Derecho", { cuota_fija: 347, tau: 0.6, e_facultad: 0.05 });
    const [salida] = conDivisorDelMarco([entrada], [facultad("Derecho", 33, 26.7)]);
    expect(salida.cuota_fija).toBe(347);
    expect(salida.tau).toBe(0.6);
    expect(salida.e_facultad).toBe(0.05);
    expect(salida.N).toBe(entrada.N);
  });
});
