import { describe, expect, test } from "vitest";
import { PROSECNUR_MODULES } from "../../lib/modules";
import {
  DIRECCION_INICIAL,
  PESTANAS_POR_SECCION,
  SECCIONES,
  esDireccionCanonica,
  resolverDireccion,
} from "./navegacion";

describe("direcciones de Material de campo", () => {
  test("aterriza en Unidades cuando la URL no dice nada", () => {
    expect(resolverDireccion()).toEqual(DIRECCION_INICIAL);
    expect(resolverDireccion(null, null)).toEqual({ seccion: "unidades", pestana: "lista" });
    expect(resolverDireccion("", "")).toEqual({ seccion: "unidades", pestana: "lista" });
  });

  test("respeta una dirección canónica completa", () => {
    expect(resolverDireccion("paquetes", "armado")).toEqual({ seccion: "paquetes", pestana: "armado" });
    expect(resolverDireccion("catalogo", "editor")).toEqual({ seccion: "catalogo", pestana: "editor" });
    expect(resolverDireccion("catalogo", "tipos")).toEqual({ seccion: "catalogo", pestana: "tipos" });
    expect(resolverDireccion("entrega", "traspaso")).toEqual({ seccion: "entrega", pestana: "traspaso" });
    expect(resolverDireccion("accesos", "vinculacion")).toEqual({ seccion: "accesos", pestana: "vinculacion" });
  });

  test("Correos es una pestaña de Catálogo (ADR 0110 §2) y sus alias a mano llegan ahí", () => {
    expect(resolverDireccion("catalogo", "correos")).toEqual({ seccion: "catalogo", pestana: "correos" });
    expect(esDireccionCanonica("catalogo", "correos")).toBe(true);
    expect(resolverDireccion(null, "mailchimp")).toEqual({ seccion: "catalogo", pestana: "correos" });
    expect(resolverDireccion("catalogo", "correo")).toEqual({ seccion: "catalogo", pestana: "correos" });
    const catalogo = PROSECNUR_MODULES.find((m) => m.slug === "material-campo")!.sections.find((s) => s.id === "catalogo");
    expect(catalogo?.tabs?.map((t) => t.id)).toEqual(["tipos", "editor", "correos"]);
  });

  test("una sección sin pestaña cae en su primera pestaña", () => {
    expect(resolverDireccion("accesos")).toEqual({ seccion: "accesos", pestana: "canales" });
    // Tipos es el aterrizaje de Catálogo (ADR 0109 §3).
    expect(resolverDireccion("catalogo")).toEqual({ seccion: "catalogo", pestana: "tipos" });
    expect(resolverDireccion("paquetes")).toEqual({ seccion: "paquetes", pestana: "armado" });
    expect(resolverDireccion("entrega")).toEqual({ seccion: "entrega", pestana: "traspaso" });
  });

  // Tabla de redirecciones del ADR 0108 §5 (sin `modo=`: el módulo todavía no
  // declara modos).
  test("lee las direcciones de Recopiladores como alias", () => {
    expect(resolverDireccion("plan-recoleccion")).toEqual({ seccion: "unidades", pestana: "lista" });
    expect(resolverDireccion("plan-recoleccion", "unidades")).toEqual({ seccion: "unidades", pestana: "lista" });
    expect(resolverDireccion("accesos", "canales")).toEqual({ seccion: "accesos", pestana: "canales" });
    expect(resolverDireccion("materiales")).toEqual({ seccion: "catalogo", pestana: "editor" });
    expect(resolverDireccion("materiales", "vista")).toEqual({ seccion: "catalogo", pestana: "editor" });
    expect(resolverDireccion("materiales", "paquetes")).toEqual({ seccion: "paquetes", pestana: "armado" });
    expect(resolverDireccion("entrega-campo")).toEqual({ seccion: "entrega", pestana: "traspaso" });
    expect(resolverDireccion("entrega-campo", "traspaso")).toEqual({ seccion: "entrega", pestana: "traspaso" });
  });

  test("lee las claves de Fichas QR como alias", () => {
    expect(resolverDireccion("preparacion", "agenda")).toEqual({ seccion: "unidades", pestana: "lista" });
    expect(resolverDireccion("preparacion", "enlaces")).toEqual({ seccion: "accesos", pestana: "canales" });
    expect(resolverDireccion("fichas", "vista")).toEqual({ seccion: "catalogo", pestana: "editor" });
    // Fichas aterrizaba en el editor: el enlace guardado sigue llevando ahí.
    expect(resolverDireccion("fichas")).toEqual({ seccion: "catalogo", pestana: "editor" });
    expect(resolverDireccion(null, "vista")).toEqual({ seccion: "catalogo", pestana: "editor" });
    expect(resolverDireccion("paquete", "salida")).toEqual({ seccion: "paquetes", pestana: "armado" });
    expect(resolverDireccion("paquete")).toEqual({ seccion: "paquetes", pestana: "armado" });
    expect(resolverDireccion("paquete", "retorno")).toEqual({ seccion: "entrega", pestana: "traspaso" });
    // `listado` cambió de dueño: era pestaña de Fichas y hoy es vinculación.
    expect(resolverDireccion("fichas", "listado")).toEqual({ seccion: "accesos", pestana: "vinculacion" });
    // La sección única con la que el módulo se registraba antes.
    expect(resolverDireccion("recopiladores")).toEqual({ seccion: "unidades", pestana: "lista" });
    expect(resolverDireccion("plan")).toEqual({ seccion: "unidades", pestana: "lista" });
    expect(resolverDireccion(null, "monitoreo")).toEqual({ seccion: "entrega", pestana: "traspaso" });
    expect(resolverDireccion(null, "validacion")).toEqual({ seccion: "entrega", pestana: "traspaso" });
  });

  test("una sección válida no queda arrastrada por una pestaña ajena", () => {
    expect(resolverDireccion("catalogo", "agenda")).toEqual({ seccion: "catalogo", pestana: "tipos" });
    expect(resolverDireccion("unidades", "paquetes")).toEqual({ seccion: "unidades", pestana: "lista" });
  });

  test("ignora basura sin romperse", () => {
    expect(resolverDireccion("no-existe", "tampoco")).toEqual(DIRECCION_INICIAL);
    expect(resolverDireccion("  CATALOGO  ", "  EDITOR  ")).toEqual({ seccion: "catalogo", pestana: "editor" });
  });

  test("esDireccionCanonica distingue la forma nueva de los alias", () => {
    expect(esDireccionCanonica("catalogo", "editor")).toBe(true);
    expect(esDireccionCanonica("catalogo", "tipos")).toBe(true);
    expect(esDireccionCanonica("paquetes", "armado")).toBe(true);
    expect(esDireccionCanonica("materiales", "vista")).toBe(false);
    expect(esDireccionCanonica("catalogo", null)).toBe(false);
  });
});

describe("contrato con el manifiesto de módulos", () => {
  const modulo = PROSECNUR_MODULES.find((m) => m.slug === "material-campo");

  test("el módulo declara exactamente las cinco secciones canónicas", () => {
    expect(modulo).toBeTruthy();
    expect(modulo?.sections?.map((s) => s.id)).toEqual([...SECCIONES]);
    // El modo entra cuando exista un segundo juego de secciones (ADR 0108 §5).
    expect(modulo?.modos).toBeUndefined();
  });

  test("cada sección del manifiesto declara las mismas pestañas que el resolvedor", () => {
    for (const seccion of SECCIONES) {
      const declaradas = modulo?.sections?.find((s) => s.id === seccion)?.tabs?.map((t) => t.id) ?? [];
      expect(declaradas).toEqual([...PESTANAS_POR_SECCION[seccion]]);
    }
  });

  test("el módulo se llama Material de campo", () => {
    expect(modulo?.title).toBe("Material de campo");
    expect(modulo?.shortLabel).toBe("Material");
    expect(modulo?.to).toBe("/material-campo");
  });

  test("ninguna dirección publicada del módulo usa la ruta vieja", () => {
    const hrefs = (modulo?.sections ?? []).flatMap((s) => [s.to, ...(s.tabs ?? []).map((t) => t.to)]);
    for (const href of hrefs) expect(href.startsWith("/material-campo")).toBe(true);
  });
});
