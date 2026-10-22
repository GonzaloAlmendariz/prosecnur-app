import { describe, expect, test } from "vitest";
import { PROSECNUR_MODULES } from "../../lib/modules";
import { PESTANAS_DEL_CORREO } from "./campanas/redirecciones";
import {
  DIRECCION_INICIAL,
  PESTANAS_DEL_CORREO_LEGADAS,
  PESTANAS_POR_SECCION,
  SECCIONES,
  esDireccionCanonica,
  resolverDireccion,
} from "./navegacion";

const modoAulas = PROSECNUR_MODULES.find((m) => m.slug === "material-campo")?.modos?.find((m) => m.id === "aulas");

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

  test("Correos ya no es pestaña de Catálogo: el correo es una campaña (ADR 0111 §3)", () => {
    // La pestaña vieja ya no es canónica en el modo aulas; quien la lee para
    // mandar a la campaña de correo es `campanas/redirecciones.ts`.
    expect(esDireccionCanonica("catalogo", "correos")).toBe(false);
    expect(resolverDireccion("catalogo", "correos")).toEqual({ seccion: "catalogo", pestana: "tipos" });
    expect(PESTANAS_DEL_CORREO_LEGADAS).toEqual(["correos", "correo", "mailchimp"]);
    const catalogo = modoAulas?.sections.find((s) => s.id === "catalogo");
    expect(catalogo?.tabs?.map((t) => t.id)).toEqual(["tipos", "editor"]);
  });

  test("una sección sin pestaña cae en su primera pestaña", () => {
    expect(resolverDireccion("accesos")).toEqual({ seccion: "accesos", pestana: "canales" });
    // Tipos es el aterrizaje de Catálogo (ADR 0109 §3).
    expect(resolverDireccion("catalogo")).toEqual({ seccion: "catalogo", pestana: "tipos" });
    expect(resolverDireccion("paquetes")).toEqual({ seccion: "paquetes", pestana: "armado" });
    expect(resolverDireccion("entrega")).toEqual({ seccion: "entrega", pestana: "traspaso" });
  });

  // Tabla de redirecciones del ADR 0108 §5. El `modo` y la campaña los pone la
  // redirección de campañas (ADR 0111); aquí se resuelve sección y pestaña.
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

  test("el modo aulas declara exactamente las cinco secciones canónicas", () => {
    expect(modulo).toBeTruthy();
    // ADR 0111 §3: el módulo aterriza en la lista y el modo es el tipo de la
    // campaña abierta. `territorial` no se declara hasta E2.
    expect(modulo?.sections.map((s) => s.id)).toEqual(["campanas"]);
    expect(modulo?.modos?.map((m) => m.id)).toEqual(["aulas", "correo"]);
    expect(modoAulas?.sections.map((s) => s.id)).toEqual([...SECCIONES]);
  });

  test("cada sección del modo aulas declara las mismas pestañas que el resolvedor", () => {
    for (const seccion of SECCIONES) {
      const declaradas = modoAulas?.sections.find((s) => s.id === seccion)?.tabs?.map((t) => t.id) ?? [];
      expect(declaradas).toEqual([...PESTANAS_POR_SECCION[seccion]]);
    }
  });

  test("el modo correo es una sección con su editor y sus contactos (ADR 0112 §4)", () => {
    const correo = modulo?.modos?.find((m) => m.id === "correo");
    expect(correo?.sections.map((s) => [s.id, (s.tabs ?? []).map((t) => t.id)])).toEqual([["correo", ["editor", "contactos"]]]);
    // El resolvedor de campañas acepta exactamente las mismas pestañas.
    expect(correo?.sections[0]?.tabs?.map((t) => t.id)).toEqual([...PESTANAS_DEL_CORREO]);
  });

  test("el módulo se llama Material de campo", () => {
    expect(modulo?.title).toBe("Material de campo");
    expect(modulo?.shortLabel).toBe("Material");
    expect(modulo?.to).toBe("/material-campo");
  });

  test("ninguna dirección publicada del módulo usa la ruta vieja", () => {
    const secciones = [...(modulo?.sections ?? []), ...(modulo?.modos ?? []).flatMap((m) => m.sections)];
    const hrefs = secciones.flatMap((s) => [s.to, ...(s.tabs ?? []).map((t) => t.to)]);
    for (const href of hrefs) expect(href.startsWith("/material-campo")).toBe(true);
  });
});

describe("Unidades › Origen (E1e)", () => {
  test("es una pestaña canónica y Lista sigue siendo el aterrizaje", () => {
    expect(PESTANAS_POR_SECCION.unidades).toEqual(["lista", "origen"]);
    expect(resolverDireccion("unidades")).toEqual({ seccion: "unidades", pestana: "lista" });
    expect(resolverDireccion("unidades", "origen")).toEqual({ seccion: "unidades", pestana: "origen" });
    expect(esDireccionCanonica("unidades", "origen")).toBe(true);
  });

  test("el manifiesto la publica con su dirección", () => {
    const unidades = modoAulas?.sections.find((s) => s.id === "unidades");
    const origen = unidades?.tabs?.find((t) => t.id === "origen");
    expect(origen?.label).toBe("Origen");
    expect(origen?.to).toBe("/material-campo?modo=aulas&seccion=unidades&pestana=origen");
    expect(origen?.layoutPolicy).toBe("viewport");
  });

  test("un enlace guardado al diálogo de rehacer aterriza en Origen", () => {
    expect(resolverDireccion("unidades", null, "rehacer-plan")).toEqual({ seccion: "unidades", pestana: "origen" });
    expect(resolverDireccion("unidades", "lista", "rehacer-plan")).toEqual({ seccion: "unidades", pestana: "origen" });
    expect(esDireccionCanonica("unidades", "lista", "rehacer-plan")).toBe(false);
    expect(esDireccionCanonica("unidades", "origen", "rehacer-plan")).toBe(true);
  });

  test("el panel no arrastra a Origen desde otra sección", () => {
    expect(resolverDireccion("accesos", "canales", "rehacer-plan")).toEqual({ seccion: "accesos", pestana: "canales" });
    expect(esDireccionCanonica("accesos", "canales", "rehacer-plan")).toBe(true);
  });
});
