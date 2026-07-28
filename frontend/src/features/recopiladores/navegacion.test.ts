import { describe, expect, test } from "vitest";
import { PROSECNUR_MODULES } from "../../lib/modules";
import {
  DIRECCION_INICIAL,
  PESTANAS_POR_SECCION,
  SECCIONES,
  esDireccionCanonica,
  resolverDireccion,
} from "./navegacion";

describe("direcciones de Recopiladores", () => {
  test("aterriza en Plan cuando la URL no dice nada", () => {
    expect(resolverDireccion()).toEqual(DIRECCION_INICIAL);
    expect(resolverDireccion(null, null)).toEqual({ seccion: "plan-recoleccion", pestana: "unidades" });
    expect(resolverDireccion("", "")).toEqual({ seccion: "plan-recoleccion", pestana: "unidades" });
  });

  test("respeta una dirección canónica completa", () => {
    expect(resolverDireccion("materiales", "paquetes")).toEqual({
      seccion: "materiales",
      pestana: "paquetes",
    });
    expect(resolverDireccion("entrega-campo", "traspaso")).toEqual({
      seccion: "entrega-campo",
      pestana: "traspaso",
    });
  });

  test("una sección sin pestaña cae en su primera pestaña", () => {
    expect(resolverDireccion("accesos")).toEqual({ seccion: "accesos", pestana: "canales" });
    expect(resolverDireccion("entrega-campo")).toEqual({
      seccion: "entrega-campo",
      pestana: "traspaso",
    });
  });

  test("lee las claves viejas como alias", () => {
    expect(resolverDireccion("preparacion", "agenda")).toEqual({
      seccion: "plan-recoleccion",
      pestana: "unidades",
    });
    expect(resolverDireccion("preparacion", "enlaces")).toEqual({
      seccion: "accesos",
      pestana: "canales",
    });
    expect(resolverDireccion("fichas", "vista")).toEqual({
      seccion: "materiales",
      pestana: "vista",
    });
    expect(resolverDireccion("paquete", "salida")).toEqual({
      seccion: "materiales",
      pestana: "paquetes",
    });
    expect(resolverDireccion("paquete", "retorno")).toEqual({
      seccion: "entrega-campo",
      pestana: "traspaso",
    });
    // `listado` cambió de dueño: era pestaña de Fichas y hoy es vinculación.
    expect(resolverDireccion("fichas", "listado")).toEqual({
      seccion: "accesos",
      pestana: "vinculacion",
    });
    // La sección única con la que el módulo se registraba antes.
    expect(resolverDireccion("recopiladores")).toEqual({ seccion: "plan-recoleccion", pestana: "unidades" });
  });

  test("una sección válida no queda arrastrada por una pestaña ajena", () => {
    expect(resolverDireccion("materiales", "agenda")).toEqual({
      seccion: "materiales",
      pestana: "vista",
    });
    expect(resolverDireccion("plan-recoleccion", "paquetes")).toEqual({
      seccion: "plan-recoleccion",
      pestana: "unidades",
    });
  });

  test("ignora basura sin romperse", () => {
    expect(resolverDireccion("no-existe", "tampoco")).toEqual(DIRECCION_INICIAL);
    expect(resolverDireccion("  MATERIALES  ", "  VISTA  ")).toEqual({
      seccion: "materiales",
      pestana: "vista",
    });
  });

  test("esDireccionCanonica distingue la forma nueva de los alias", () => {
    expect(esDireccionCanonica("materiales", "vista")).toBe(true);
    expect(esDireccionCanonica("fichas", "vista")).toBe(false);
    expect(esDireccionCanonica("materiales", null)).toBe(false);
  });
});

describe("contrato con el manifiesto de módulos", () => {
  const modulo = PROSECNUR_MODULES.find((m) => m.slug === "recopiladores");

  test("el módulo declara exactamente las cuatro secciones canónicas", () => {
    expect(modulo).toBeTruthy();
    expect(modulo?.sections?.map((s) => s.id)).toEqual([...SECCIONES]);
  });

  test("cada sección del manifiesto declara las mismas pestañas que el resolvedor", () => {
    for (const seccion of SECCIONES) {
      const declaradas = modulo?.sections?.find((s) => s.id === seccion)?.tabs?.map((t) => t.id) ?? [];
      expect(declaradas).toEqual([...PESTANAS_POR_SECCION[seccion]]);
    }
  });

  test("el módulo ya no se llama Fichas QR", () => {
    expect(modulo?.title).toBe("Recopiladores");
    expect(modulo?.shortLabel).toBe("Recopiladores");
  });
});
