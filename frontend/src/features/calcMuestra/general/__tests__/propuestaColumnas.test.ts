import { describe, expect, it } from "vitest";

import { archivoDesdeInspeccion, archivoMarcoReducer, ARCHIVO_MARCO_INICIAL, puedeDeclarar } from "../modelo";
import { normalizarNombreColumna, proponerColumnas } from "../propuestaColumnas";

describe("propuesta de columnas del marco", () => {
  it("el padrón del recorrido (codigo, distrito, personas) sale con los tres roles", () => {
    expect(proponerColumnas(["codigo", "distrito", "personas"])).toEqual({ id: "codigo", estrato: "distrito", tamano: "personas" });
  });

  it("acepta cada nombre de id sin distinguir mayúsculas ni tildes", () => {
    for (const nombre of ["codigo", "Código", "CÓDIGO", "cod", "ID", "dni", "Folio", "clave", "CUI", "ruc"]) {
      expect(proponerColumnas(["nombre", nombre, "edad"]).id).toBe(nombre);
    }
  });

  it("acepta nombres compuestos por palabras y el BOM de un CSV", () => {
    expect(proponerColumnas(["nombre", "cod_hogar"]).id).toBe("cod_hogar");
    expect(proponerColumnas(["hogar-id", "zona"]).id).toBe("hogar-id");
    expect(proponerColumnas(["﻿codigo", "zona"]).id).toBe("﻿codigo");
    expect(normalizarNombreColumna("  Región ")).toBe("region");
  });

  it("no confunde palabras que sólo contienen las letras", () => {
    expect(proponerColumnas(["nombre", "idioma", "codificador", "rucksack"])).toEqual({ id: "", estrato: "", tamano: "" });
  });

  it("el nombre exacto gana al compuesto y, a igual puntaje, la primera columna", () => {
    expect(proponerColumnas(["cod_hogar", "id"]).id).toBe("id");
    expect(proponerColumnas(["dni", "codigo"]).id).toBe("dni");
  });

  it("el código de un grupo es estrato, no id de la unidad", () => {
    expect(proponerColumnas(["cod_distrito", "personas"])).toEqual({ id: "", estrato: "cod_distrito", tamano: "personas" });
    expect(proponerColumnas(["folio", "cod_distrito"])).toEqual({ id: "folio", estrato: "cod_distrito", tamano: "" });
  });

  it("estrato y tamaño con cada nombre pedido", () => {
    for (const e of ["distrito", "provincia", "Región", "zona", "estrato", "facultad", "sede"]) {
      expect(proponerColumnas(["id", e]).estrato).toBe(e);
    }
    for (const t of ["personas", "tamano", "Tamaño", "hogares", "n_personas", "Población", "N personas"]) {
      expect(proponerColumnas(["id", t]).tamano).toBe(t);
    }
  });

  it("un rol nunca repite la columna de otro", () => {
    const p = proponerColumnas(["id"]);
    expect(p).toEqual({ id: "id", estrato: "", tamano: "" });
    // Un nombre que dice id y tamaño a la vez es ambiguo: no se propone para ninguno.
    expect(proponerColumnas(["id_personas", "zona"])).toEqual({ id: "", estrato: "zona", tamano: "" });
  });

  it("el formulario arranca con la propuesta y la deja declarar", () => {
    const { archivo, hoja } = archivoDesdeInspeccion("f1", "padron_2000.csv", {
      type: "table",
      sheets: [{ name: "datos", columns_sample: ["codigo", "distrito", "personas"] }],
    });
    const e = archivoMarcoReducer(ARCHIVO_MARCO_INICIAL, { tipo: "subido", archivo, hoja });
    expect(e.columnas).toEqual({ id: "codigo", estrato: "distrito", tamano: "personas" });
    expect(puedeDeclarar(e)).toBe(true);
    const sinEstrato = archivoMarcoReducer(e, { tipo: "columna", rol: "estrato", valor: "" });
    expect(sinEstrato.columnas.estrato).toBe("");
    expect(sinEstrato.propuestas.estrato).toBe("distrito");
  });
});
