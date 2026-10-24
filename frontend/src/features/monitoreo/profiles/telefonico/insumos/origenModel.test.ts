import { describe, expect, it } from "vitest";
import type { MonitoreoAcreditacionReports, MonitoreoProfile } from "../../../../../api/client";
import {
  borradorInicial,
  clavesDelPerfil,
  columnaSugerida,
  columnasOfrecidas,
  filasDeOrigen,
  lecturaDeOrigen,
  mismoBorrador,
  rolSugerido,
  siSugerido,
  valoresParaElegir,
} from "./origenModel";

const MARCA = "¿Se reemplaza con el Backup?";

function reportes(rows: Array<Record<string, unknown>>): MonitoreoAcreditacionReports {
  return {
    sheets: [{ id: "monitoreo_telefonico", blocks: [{ id: "origen_de_la_muestra", rows }] }],
  } as unknown as MonitoreoAcreditacionReports;
}

// La forma de RMS: 400 Muestra, 400 Backup; la marca, 400 «No» y 400 vacías.
const RMS = reportes([
  { Columna: "Origen", Valor: "Muestra", Rol: "sin_declarar", Casos: 400 },
  { Columna: "Origen", Valor: "Backup", Rol: "sin_declarar", Casos: 400 },
  { Columna: MARCA, Valor: "No", Rol: "sin_declarar", Casos: 400 },
  { Columna: MARCA, Valor: "Sin dato", Rol: "sin_declarar", Casos: 400 },
]);

describe("sugerencias por nombre", () => {
  it("la columna de origen no es la marca aunque la marca diga «Backup»", () => {
    expect(columnaSugerida([MARCA, "Origen"], "origen")).toBe("Origen");
    expect(columnaSugerida([MARCA, "Origen"], "marca")).toBe(MARCA);
  });

  it("cada valor recibe el rol que su nombre sugiere; el vacío no tiene rol", () => {
    expect(rolSugerido("Muestra")).toBe("titular");
    expect(rolSugerido("Backup")).toBe("reserva");
    expect(rolSugerido("Sin dato")).toBe("sin_rol");
    expect(rolSugerido("Lista C")).toBe("sin_rol");
    expect(siSugerido(["No", "Sí", "SI", "Sin dato"])).toEqual(["Sí", "SI"]);
  });
});

describe("borrador y lectura", () => {
  it("sin declarar, RMS propone Origen con Muestra titular y Backup reserva, sin reemplazos", () => {
    const filas = filasDeOrigen(RMS);
    const { borrador, declarado } = borradorInicial(undefined, filas);
    expect(declarado).toBe(false);
    expect(borrador.origen).toEqual({ columna: "Origen", roles: { Muestra: "titular", Backup: "reserva" } });
    expect(borrador.marca).toEqual({ columna: MARCA, si: [] });
    expect(lecturaDeOrigen(borrador, filas)).toEqual({
      titular: 400, reserva: 400, sinRol: 0, reemplazos: 0, conConteoOrigen: true, conConteoMarca: true,
    });
  });

  it("lo declarado manda sobre la sugerencia y se guarda sin el «Sin dato»", () => {
    const perfil = {
      sample_origin: { column: "Origen", titular_values: ["muestra"], reserva_values: [] },
      replacement_flag: { column: MARCA, yes_values: ["No"] },
    } as unknown as MonitoreoProfile;
    const filas = filasDeOrigen(RMS);
    const { borrador, declarado } = borradorInicial(perfil, filas);
    expect(declarado).toBe(true);
    expect(borrador.origen.roles).toEqual({ Muestra: "titular", Backup: "sin_rol" });
    expect(lecturaDeOrigen(borrador, filas)).toMatchObject({ titular: 400, sinRol: 400, reemplazos: 400 });
    expect(clavesDelPerfil(borrador)).toEqual({
      sample_origin: { column: "Origen", titular_values: ["Muestra"], reserva_values: [] },
      replacement_flag: { column: MARCA, yes_values: ["No"] },
    });
  });

  it("una columna sin conteo publicado lo dice en vez de sumar cero", () => {
    const filas = filasDeOrigen(RMS);
    const { borrador } = borradorInicial(undefined, filas);
    const otra = { ...borrador, origen: { columna: "Tipo de lista", roles: {} } };
    expect(lecturaDeOrigen(otra, filas).conConteoOrigen).toBe(false);
    expect(clavesDelPerfil({ ...otra, marca: { columna: "", si: [] } }).replacement_flag).toBeUndefined();
    expect(mismoBorrador(borrador, borrador)).toBe(true);
    expect(mismoBorrador(borrador, otra)).toBe(false);
  });

  it("sin bloque no hay columnas ni sugerencias", () => {
    const { borrador } = borradorInicial(undefined, filasDeOrigen(reportes([])));
    expect(borrador.origen.columna).toBe("");
    expect(borrador.marca.columna).toBe("");
  });
});

describe("columnas y valores para elegir", () => {
  it("ofrece las columnas con conteo y las de pocos valores; sin conteo, los valores sin cifra", () => {
    const filas = filasDeOrigen(RMS);
    const variables = [
      { name: "Código proGres", n_unique: 800 },
      { name: "Tipo de lista", n_unique: 2, values: ["A", "B"] },
      { name: "dim_origen", n_unique: 2 },
    ];
    expect(columnasOfrecidas(filas, variables)).toEqual(["Origen", MARCA, "Tipo de lista"]);
    expect(valoresParaElegir(filas, variables, "Tipo de lista")).toEqual([{ valor: "A", casos: null }, { valor: "B", casos: null }]);
    expect(valoresParaElegir(filas, variables, "Origen")[0]).toEqual({ valor: "Muestra", casos: 400 });
  });
});

describe("corte anterior al bloque (RMS)", () => {
  it("sugiere desde las columnas de la base: Origen y la marca de reemplazo", () => {
    const variables = [
      { name: "Código proGres", n_unique: 800 },
      { name: "Origen", n_unique: 2, values: ["Backup", "Muestra"] },
      { name: MARCA, n_unique: 2, values: ["No"] },
      { name: "Periodo de Llegada", n_unique: 4, values: ["A", "B", "C", "D"] },
    ];
    const { borrador, declarado, sugerido } = borradorInicial(undefined, [], variables);
    expect(declarado).toBe(false);
    expect(sugerido).toBe(true);
    expect(borrador.origen).toEqual({ columna: "Origen", roles: { Backup: "reserva", Muestra: "titular" } });
    expect(borrador.marca.columna).toBe(MARCA);
    // Sin bloque no hay casos: la lectura lo dice en vez de sumar cero.
    expect(lecturaDeOrigen(borrador, []).conConteoOrigen).toBe(false);
  });

  it("sin nada que sugerir no se marca como sugerido", () => {
    const { sugerido, borrador } = borradorInicial(undefined, [], [{ name: "Periodo de Llegada", n_unique: 4 }]);
    expect(sugerido).toBe(false);
    expect(borrador.origen.columna).toBe("");
  });
});
