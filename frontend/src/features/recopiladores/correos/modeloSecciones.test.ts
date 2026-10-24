// Resto del catálogo de secciones (L6): contrato del cliente, bloques nuevos y
// edición de las entradas, con los mismos rangos que collection_mail_secciones.R.

import { describe, expect, it } from "vitest";

import { MAIL_SECTION_TYPES, normalizeMailBlock, tieneFoto, type MailBlock, type MailTemplate } from "../../../api/materialMail";
import { GRUPOS } from "./BibliotecaDeBloques";
import { bloqueParaInsertar } from "./estructuraCorreo";
import { bloqueNuevo, conTexto, resumenDeBloque } from "./modeloCorreo";
import { recorteDe } from "./modeloRecorte";
import { conEntrada, conEntradaNueva, entradasDe, moverEntrada, puedeAgregar, sinEntrada } from "./modeloSecciones";
import { IMAGEN_Y_TEXTO } from "./piezasGraficas";

describe("contrato de las secciones en el cliente", () => {
  it("cada sección nueva sobrevive al normalizador tal como nace", () => {
    for (const type of MAIL_SECTION_TYPES) {
      const b = bloqueNuevo(type, `${type}-1`);
      expect(normalizeMailBlock(b)).toEqual(b);
      expect(resumenDeBloque(b)).not.toBe("");
    }
  });

  it("el normalizador deja sólo lo válido: entradas con título, ícono sólo en beneficios, forma cerrada", () => {
    const steps = normalizeMailBlock({ block_id: "p", type: "steps", layout: "rejilla", entries: [{ title: "A", icon: "candado", css: "x" }, "basura"] });
    expect(steps).toEqual({ block_id: "p", type: "steps", entries: [{ title: "A" }] });
    const benef = normalizeMailBlock({ block_id: "b", type: "benefits", entries: [{ title: "A", icon: "candado" }, { title: "B", icon: "cohete" }] });
    expect(benef).toMatchObject({ entries: [{ title: "A", icon: "candado" }, { title: "B" }] });
    expect(normalizeMailBlock({ block_id: "c", type: "contact", name: "Ana", email: ["a@b.pe"], crop: { ratio: "1:1" } }))
      .toEqual({ block_id: "c", type: "contact", name: "Ana", email: "a@b.pe", crop: { ratio: "1:1" } });
  });

  it("Destacado, Pasos, Cita y Contacto llevan foto; su recorte nace con la proporción de la maqueta", () => {
    expect(MAIL_SECTION_TYPES.filter((t) => tieneFoto(bloqueNuevo(t, "x")))).toEqual(["steps", "quote", "contact"]);
    expect(recorteDe(bloqueNuevo("steps", "x") as never).ratio).toBe("2:1");
    expect(recorteDe(bloqueNuevo("quote", "x") as never).ratio).toBe("1:1");
    expect(recorteDe(bloqueNuevo("contact", "x") as never).ratio).toBe("1:1");
  });

  it("vaciar un texto opcional lo quita; uno obligatorio se queda", () => {
    const c = bloqueNuevo("contact", "c");
    expect(conTexto(c, "role", "")).not.toHaveProperty("role");
    expect(conTexto(c, "name", "")).toHaveProperty("name", "");
  });
});

describe("biblioteca", () => {
  it("Secciones ofrece el catálogo entero, con «Imagen + texto» como un Destacado 4:3 sin caja", () => {
    const secciones = GRUPOS.find((g) => g.titulo === "Secciones")?.tipos ?? [];
    expect(secciones).toEqual(["feature", IMAGEN_Y_TEXTO, ...MAIL_SECTION_TYPES]);
    const it = bloqueNuevo(IMAGEN_Y_TEXTO, "f");
    expect(it).toMatchObject({ type: "feature", crop: { ratio: "4:3" } });
    expect(it).not.toHaveProperty("box");
  });

  it("«Imagen + texto» nace sin botón y sin enlace aunque el correo tenga uno (visto en vivo: frenaba la vista previa)", () => {
    const conBoton = { blocks: [{ block_id: "b", type: "button", text: "Ir", url: "https://pulso.pe/e" }], images: {}, fields: [] } as unknown as MailTemplate;
    const b = bloqueParaInsertar(conBoton, IMAGEN_Y_TEXTO);
    expect(b).not.toHaveProperty("url");
    expect(b).not.toHaveProperty("button_text");
  });

  it("un botón nuevo nace con el enlace que ya usa el correo, no con el de relleno", () => {
    const conBoton = { blocks: [{ block_id: "b", type: "button", text: "Ir", url: "https://pulso.pe/e" }], images: {}, fields: [] } as unknown as MailTemplate;
    expect(bloqueParaInsertar(conBoton, "button")).toMatchObject({ type: "button", url: "https://pulso.pe/e" });
    const conCampo = { blocks: [], images: {}, fields: [{ key: "enlace", label: "Enlace", destino: "encuesta" }] } as unknown as MailTemplate;
    expect(bloqueParaInsertar(conCampo, "button")).toMatchObject({ url: "{{enlace}}" });
  });

  it("la fecha límite nace con el enlace del correo o, sin ninguno, sin botón", () => {
    const sinEnlace = { blocks: [], images: {}, fields: [] } as unknown as MailTemplate;
    expect(bloqueParaInsertar(sinEnlace, "deadline")).not.toHaveProperty("button_text");
    const conBoton = { ...sinEnlace, blocks: [{ block_id: "b", type: "button", text: "Ir", url: "https://pulso.pe/e" }] } as unknown as MailTemplate;
    expect(bloqueParaInsertar(conBoton, "deadline")).toMatchObject({ url: "https://pulso.pe/e", button_text: "Responder ahora" });
  });
});

describe("entradas", () => {
  const pasos = bloqueNuevo("steps", "p");

  it("se editan, se mueven y un texto vacío se quita", () => {
    expect(entradasDe(conEntrada(pasos, 1, { title: "Otro" }))[1].title).toBe("Otro");
    expect(entradasDe(conEntrada(pasos, 0, { text: "" }))[0]).not.toHaveProperty("text");
    const movido = moverEntrada(pasos, 0, 1);
    expect(entradasDe(movido).map((e) => e.title)).toEqual(["Responde con calma", "Abre tu enlace", "Envía al final"]);
    expect(moverEntrada(pasos, 0, -1)).toBe(pasos);
  });

  it("respetan el rango de su sección: beneficios de 2 a 4, pasos hasta 6", () => {
    let b: MailBlock = bloqueNuevo("benefits", "b");
    b = conEntradaNueva(b);
    expect(entradasDe(b)).toHaveLength(4);
    expect(puedeAgregar(b)).toBe(false);
    expect(conEntradaNueva(b)).toBe(b);
    const dos = sinEntrada(sinEntrada(b, 0), 0);
    expect(entradasDe(dos)).toHaveLength(2);
    expect(sinEntrada(dos, 0)).toBe(dos);
    let p: MailBlock = pasos;
    for (let i = 0; i < 5; i += 1) p = conEntradaNueva(p);
    expect(entradasDe(p)).toHaveLength(6);
  });
});
