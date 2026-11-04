import { describe, expect, it } from "vitest";
import type { ModeloConexiones, TarjetaDeFuente } from "./conexionesModel";
import { construirTableroDeConexiones, tiraDeLecturas } from "./conexionesTablero";

const CAMPO: TarjetaDeFuente = {
  clave: "field",
  titulo: "Kobo de Campo",
  fase: "field",
  activa: true,
  estado: "Al día",
  tono: "ok",
  formulario: "ACNUR Campo",
  cifras: [
    { id: "respuestas", rotulo: "Respuestas", valor: "1,697" },
    { id: "en-fase", rotulo: "En la fase", valor: "1,693", nota: "4 antes del inicio" },
    { id: "preguntas", rotulo: "Preguntas", valor: "79" },
    { id: "opciones", rotulo: "Opciones", valor: "61" },
    { id: "ultima-lectura", rotulo: "Última lectura", valor: "09/07 07:24" },
    { id: "ficha-leida", rotulo: "Ficha leída", valor: "18/06 15:53" },
    { id: "fase-desde", rotulo: "Fase desde", valor: "12/06 05:00" },
  ],
  serie: [216, 900, 1697],
};

const PILOTO: TarjetaDeFuente = {
  ...CAMPO,
  clave: "pilot",
  titulo: "Kobo de Piloto",
  fase: "pilot",
  activa: false,
  estado: "Fase no activa, al día",
  tono: "inactiva",
  formulario: "ACNUR Piloto",
  cifras: [
    { id: "respuestas", rotulo: "Respuestas", valor: "35" },
    { id: "ultima-lectura", rotulo: "Última lectura", valor: "25/06 18:01" },
    { id: "ficha-leida", rotulo: "Ficha leída", valor: "—" },
    { id: "fase-desde", rotulo: "Fase desde", valor: "—" },
  ],
  serie: [35, 35, 35, 35, 35, 35, 35],
};

const OCURRENCIAS: TarjetaDeFuente = {
  clave: "ocurrencias",
  titulo: "Kobo de ocurrencias de campo",
  fase: null,
  activa: false,
  estado: "Al día",
  tono: "ok",
  formulario: "OCURRENCIAS DE TRABAJO DE CAMPO",
  cifras: [
    { id: "partes", rotulo: "Partes", valor: "57" },
    { id: "ump-citadas", rotulo: "UMP citadas", valor: "31" },
    { id: "ultima-lectura", rotulo: "Última lectura", valor: "09/07 07:20" },
  ],
  serie: [],
};

const MODELO: ModeloConexiones = {
  conFuenteDeCampo: true,
  tarjetas: [CAMPO, PILOTO, OCURRENCIAS],
  muestra: [{ id: "meta", rotulo: "Meta", valor: "1,200" }],
};

describe("Insumos › Conexiones, presentación", () => {
  const tablero = construirTableroDeConexiones(MODELO);

  it("la fase activa va primero, luego las fuentes que la acompañan y al final la fase que no corre", () => {
    expect(tablero.fuentes.map((f) => f.clave)).toEqual(["field", "ocurrencias", "pilot"]);
  });

  it("las cifras que cuentan van en tarjeta y la ficha y la ventana pasan a la línea de metadatos, con los mismos valores", () => {
    const campo = tablero.fuentes[0];
    expect(campo.cifras.map((c) => c.id)).toEqual(["respuestas", "en-fase", "ultima-lectura", "ficha-leida"]);
    expect(campo.cifras[1]).toEqual({ id: "en-fase", rotulo: "En la fase", valor: "1,693", nota: "4 antes del inicio" });
    expect(campo.metadatos).toBe("79 preguntas, 61 opciones y fase desde 12/06 05:00");
    expect(campo).toMatchObject({ traer: true, administrar: true, discreta: false, tono: "success", icono: "kobo" });
  });

  it("la fase que no corre no lleva acción principal y dice que no tiene fecha de inicio", () => {
    const piloto = tablero.fuentes[2];
    expect(piloto).toMatchObject({ traer: false, administrar: true, discreta: true, tono: "neutral", metadatos: "fase sin fecha de inicio" });
  });

  it("ocurrencias no tiene acciones de fase y su formulario en mayúsculas se marca sin reescribirlo", () => {
    const ocurrencias = tablero.fuentes[1];
    expect(ocurrencias).toMatchObject({ traer: false, administrar: false, discreta: false, icono: "ocurrencias", metadatos: "" });
    expect(ocurrencias.formulario).toBe("OCURRENCIAS DE TRABAJO DE CAMPO");
    expect(ocurrencias.formularioEnMayusculas).toBe(true);
    expect(tablero.fuentes[0].formularioEnMayusculas).toBe(false);
  });

  it("la tira de lecturas dice de dónde a dónde, o que todas trajeron lo mismo", () => {
    expect(tiraDeLecturas([216, 900, 1697])).toEqual({ alturas: [216 / 1697, 900 / 1697, 1], resumen: "De 216 a 1,697 en 3 lecturas" });
    expect(tiraDeLecturas(PILOTO.serie)?.resumen).toBe("35 en cada una de las 7 lecturas");
    expect(tiraDeLecturas([35])).toBeNull();
    expect(tiraDeLecturas([0, 0])?.alturas).toEqual([0, 0]);
  });

  it("la muestra de campo pasa tal cual", () => {
    expect(tablero.muestra).toBe(MODELO.muestra);
  });
});
