// «Cambiar por» (L8, vara V4): una sección se cambia por otra sin perder su
// texto, su foto ni sus campos; lo que el destino no muestra queda guardado y
// vuelve al regresar.

import { describe, expect, it } from "vitest";

import { normalizeMailBlock, RANGO_DE_ENTRADAS, tieneEntradas, type MailBlock, type MailTemplate } from "../../../api/materialMail";
import { camposNoDeclarados } from "./camposDeclarados";
import { cambiarPor, fraseDeCambio, TIPOS_INTERCAMBIABLES, type TipoIntercambiable } from "./modeloCambiarPor";
import { bloqueNuevo } from "./modeloCorreo";

/** Un Destacado completo, con foto, recorte, forma, caja y un campo de la persona. */
const destacado: MailBlock = {
  block_id: "d", type: "feature", eyebrow: "Sorteo", title: "Participa por unos audífonos, {{nombre}}",
  text: "Sorteamos 5 entre quienes completen la encuesta.", image_ref: "premio", alt: "Audífonos",
  button_text: "Responder", url: "{{enlace}}", layout: "derecha", crop: { ratio: "4:3", x: 0.3 }, box: { bg: "tinte" },
};

const beneficios: MailBlock = {
  block_id: "b", type: "benefits", title: "Por qué responder",
  entries: [{ title: "Confidencial", text: "Nadie la ve.", icon: "candado" }, { title: "Corto", icon: "reloj" }],
};

const entradas = (n: number, conTexto = true) => Array.from({ length: n }, (_, i) => ({ title: `P${i + 1}`, ...(conTexto ? { text: `R${i + 1}` } : {}) }));
/** En los bordes del rango: una pregunta de ocho (no caben en Pasos ni en Beneficios) y un paso solo (falta para Beneficios). */
const preguntas8: MailBlock = { block_id: "q", type: "faq", title: "Dudas", entries: entradas(8) };
const paso1: MailBlock = { block_id: "s", type: "steps", title: "Uno", entries: entradas(1, false) };

/** Lo que se ve y se guarda, sin el orden de las claves. */
const sinGuardado = (b: MailBlock) => {
  const { guardado: _g, ...resto } = b as MailBlock & { guardado?: unknown };
  return resto;
};

describe("cambiar por", () => {
  it("ida y vuelta sin pérdida entre cualquier par de secciones", () => {
    const origenes: MailBlock[] = [destacado, beneficios, preguntas8, paso1, ...TIPOS_INTERCAMBIABLES.map((t) => bloqueNuevo(t, `x-${t}`))];
    for (const a of origenes) {
      for (const tipo of TIPOS_INTERCAMBIABLES) {
        if (tipo === a.type) continue;
        const vuelta = cambiarPor(cambiarPor(a, tipo), a.type as TipoIntercambiable);
        expect(sinGuardado(vuelta), `${a.type} → ${tipo} → ${a.type}`).toEqual(sinGuardado(a));
      }
    }
  });

  it("cada resultado respeta cuántas entradas admite su sección (si no, la vista previa se frena)", () => {
    for (const a of [preguntas8, paso1, beneficios]) {
      for (const tipo of TIPOS_INTERCAMBIABLES) {
        const b = cambiarPor(a, tipo);
        if (!tieneEntradas(b.type)) continue;
        const n = (b as { entries: unknown[] }).entries.length;
        const [minimo, maximo] = RANGO_DE_ENTRADAS[b.type];
        expect(n >= minimo && n <= maximo, `${a.type} → ${tipo}: ${n}`).toBe(true);
      }
    }
    // Las que no caben quedan guardadas y la frase lo dice; vuelven al regresar.
    const ben = cambiarPor(preguntas8, "benefits");
    expect(ben).toMatchObject({ guardado: { entries_extra: entradas(8).slice(4) } });
    expect(fraseDeCambio(preguntas8, "benefits")).toBe("Los elementos que no caben quedan guardados, sin mostrarse");
    expect(cambiarPor(ben, "faq")).toMatchObject({ entries: entradas(8) });
    // Un paso solo se completa con un beneficio de ejemplo, que no vuelve a Pasos.
    expect((cambiarPor(paso1, "benefits") as { entries: unknown[] }).entries).toHaveLength(2);
    expect(cambiarPor(cambiarPor(paso1, "benefits"), "steps")).toMatchObject({ entries: entradas(1, false) });
  });

  it("los íconos de un ejemplo sin tocar no se guardan", () => {
    const vuelta = cambiarPor(cambiarPor(cambiarPor(bloqueNuevo("contact", "c"), "feature"), "benefits"), "contact");
    expect(JSON.stringify((vuelta as { guardado?: unknown }).guardado ?? {})).not.toContain("icons");
  });

  it("un campo que sólo vive en lo guardado no cuenta como usado (la vista previa no se retiene)", () => {
    const pasos = cambiarPor({ ...destacado, text: "Hola {{carrera}}" } as MailBlock, "steps");
    expect(JSON.stringify(pasos)).toContain("{{carrera}}");
    const tpl = { fields: [], subject: "", preheader: "", header: { kind: "logos", logo_ids: [] }, blocks: [pasos] } as unknown as MailTemplate;
    expect(camposNoDeclarados(tpl)).toEqual([]);
  });

  it("lo que pasa, pasa: título, texto, foto y botón de un Destacado a una Fecha límite y a una Cita", () => {
    const fecha = cambiarPor(destacado, "deadline");
    expect(fecha).toMatchObject({ type: "deadline", eyebrow: "Sorteo", title: destacado.title, text: (destacado as { text: string }).text, button_text: "Responder", url: "{{enlace}}", box: { bg: "tinte" } });
    expect(fecha).not.toHaveProperty("image_ref");
    expect(fecha).toMatchObject({ guardado: { image_ref: "premio", alt: "Audífonos", feature_layout: "derecha", feature_crop: { ratio: "4:3", x: 0.3 } } });
    const cita = cambiarPor(destacado, "quote");
    expect(cita).toMatchObject({ type: "quote", text: (destacado as { text: string }).text, image_ref: "premio", alt: "Audífonos" });
    // El nombre es obligatorio en una Cita: viene del ejemplo hasta que se escriba.
    expect(cita).toMatchObject({ name: "[Quién lo dice]" });
    // El encuadre es de cada tipo: la Cita usa el suyo (1:1), no el 4:3 del Destacado.
    expect(cita).not.toHaveProperty("crop");
  });

  it("los íconos de los beneficios vuelven aunque los pasos no los lleven", () => {
    const pasos = cambiarPor(beneficios, "steps");
    expect((pasos as { entries: unknown[] }).entries).toEqual([{ title: "Confidencial", text: "Nadie la ve." }, { title: "Corto" }]);
    expect(cambiarPor(pasos, "benefits")).toMatchObject({ entries: [{ icon: "candado" }, { icon: "reloj" }] });
  });

  it("el bloque cambiado sobrevive al normalizador con lo guardado", () => {
    const fecha = cambiarPor(destacado, "deadline");
    expect(normalizeMailBlock(fecha)).toEqual(fecha);
  });

  it("la frase dice qué queda guardado, como la maqueta", () => {
    expect(fraseDeCambio(destacado, "deadline")).toBe("La imagen queda guardada, sin mostrarse");
    expect(fraseDeCambio(destacado, "quote")).toBe("El antetítulo, el título y el botón quedan guardados, sin mostrarse");
    expect(fraseDeCambio(beneficios, "faq")).toBe("Pasa todo");
  });
});
