// Un correo, varios públicos (GOAL editor, L16): el trato tú/usted con
// `[[tú|usted]]` y lo que «Aplicar a las campañas hermanas» dice de cada una.

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { normalizeMailTemplate, type MailTemplate } from "../../../api/materialMail";
import { normalizeMailHermanas } from "../../../api/materialMailHermanas";
import { domDePrueba } from "./domDePrueba.test-util";
import { frasesDeLaHermana } from "./modeloHermanas";
import { conRegistro, escribirVariantes, registroDe, variante, variantesDelCorreo } from "./modeloRegistro";
import { htmlDelTexto, textoDelDom } from "./serializarTexto";
import { useCorreosStore } from "./store";
import { TratoDeLaCampana } from "./TratoDeLaCampana";
import { simularOAplicarHermanas } from "./useHermanas";

const base = (extra: Record<string, unknown> = {}): MailTemplate => normalizeMailTemplate({
  schema: "collection_mail_template/v2", template_id: "t", revision: 1, subject: "[[Tu|Su]] opinión", preheader: "",
  fields: [], images: {}, theme: { accent: "#004dac" }, header: { kind: "logos", logo_ids: ["pulso"], background: "light" },
  blocks: [{ block_id: "p", type: "paragraph", text: "[[Responde|Responda]] hoy. [[Tus|Sus]] respuestas son confidenciales." }],
  constants: [{ key: "premios", label: "Premios", value: "una tablet[[| para usted]]" }],
  ...extra,
});

describe("trato tú/usted", () => {
  it("el normalizador conserva el trato y descarta lo que no es tu ni usted", () => {
    expect(base({ registro: "tu" }).registro).toBe("tu");
    expect(base({ registro: "vos" })).not.toHaveProperty("registro");
    expect(registroDe(base())).toBe("usted");
  });

  it("usted es el de siempre y no viaja; tú sí", () => {
    expect(conRegistro(base({ registro: "tu" }), "usted")).not.toHaveProperty("registro");
    expect(conRegistro(base(), "tu").registro).toBe("tu");
  });

  it("escribe cada variante en su trato, con formas vacías", () => {
    const t = "[[Responde|Responda]] y gana una tablet[[| para usted]].";
    expect(escribirVariantes(t, "tu")).toBe("Responde y gana una tablet.");
    expect(escribirVariantes(t, "usted")).toBe("Responda y gana una tablet para usted.");
    expect(variante("Re|sponde", "Responda]")).toBe("[[Responde|Responda]]");
  });

  it("cuenta las variantes del asunto, los bloques y los datos", () => {
    expect(variantesDelCorreo(base())).toBe(4);
  });

  it("el editor en línea deja la variante tal cual (ida y vuelta)", () => {
    const opts = { enlaces: true, multilinea: false };
    const texto = "[[Responde|Responda]] [aquí]({{enlace}}) y **[[gana|gane]]**.";
    expect(textoDelDom(domDePrueba(htmlDelTexto(texto, opts)) as unknown as Node, opts)).toBe(texto);
  });

  it("el panel muestra el trato elegido y cuántas frases cambian", () => {
    const html = renderToStaticMarkup(<TratoDeLaCampana template={base({ registro: "tu" })} onEditar={() => {}} />);
    expect(html).toContain("4 frases cambian con el trato.");
    expect(html).toMatch(/aria-checked="true" class="xfk-seg__opt is-on">Tú</);
    expect(html).toMatch(/aria-checked="false" class="xfk-seg__opt">Usted</);
  });
});

describe("aplicar a las campañas hermanas", () => {
  const payload = normalizeMailHermanas({
    state_revision: 9, dry_run: true,
    hermanas: [
      { campaign_id: "pregrado", name: "Estudiantes de pregrado",
        cambios: ["Asunto", "Bloques", "Recordatorio 1: asunto", "Recordatorio 2: se agrega"],
        campos_agregados: ["facultad"], datos_agregados: "duracion", envios_que_quedan: [],
        conserva: { registro: "tu", saludo: true, enlaces: "ENLPRE", datos: 2 }, problemas: [] },
      { campaign_id: "rota", name: "Rota", cambios: [], conserva: { registro: "usted", enlaces: [], datos: 0 },
        problemas: [{ path: "template.constants", detail: "Una variante de trato se escribe…" }] },
      { name: "sin id" },
    ],
  });

  it("el normalizador acepta escalares desempaquetados y descarta lo que no trae id", () => {
    expect(payload.state_revision).toBe(9);
    expect(payload.dry_run).toBe(true);
    expect(payload.hermanas).toHaveLength(2);
    expect(payload.hermanas[0].datos_agregados).toEqual(["duracion"]);
    expect(payload.hermanas[0].conserva.enlaces).toEqual(["ENLPRE"]);
  });

  it("dice qué cambia, qué se agrega y qué conserva cada una", () => {
    const frases = frasesDeLaHermana(payload.hermanas[0]).map((f) => f.texto);
    expect(frases).toContain("Cambia: Asunto, Bloques.");
    expect(frases).toContain("Recordatorio 2: se agrega.");
    expect(frases.some((f) => f.includes("{{duracion}}") && f.includes("revísalos"))).toBe(true);
    expect(frases).toContain("Conserva: su saludo, trato tú, enlace *|ENLPRE|*, 2 datos con su valor.");
    const rota = frasesDeLaHermana(payload.hermanas[1]);
    expect(rota[0]).toMatchObject({ tono: "problema" });
    expect(rota.map((f) => f.texto)).toContain("Ya está igual: no cambia nada.");
  });
});

describe("aplicar no pisa una hermana con cambios sin guardar", () => {
  const vacio = { state_revision: 6, dry_run: false, variantes_origen: 0, hermanas: [] };
  const conCambios = () => useCorreosStore.setState({
    campana: "pregrado", stateRevision: 5, guardada: base(), borrador: base({ subject: "Otro asunto" }),
    envios: [], enviosGuardados: [],
  });

  it("con la hermana cargada y sin guardar, no llama a la API", async () => {
    conCambios();
    const api = vi.fn(async () => vacio);
    const out = await simularOAplicarHermanas({ origen: "profesores", destinos: ["pregrado"], partes: ["cuerpo"], simular: false },
      async () => {}, undefined, api);
    expect(out.ok).toBe(false);
    expect(api).not.toHaveBeenCalled();
  });

  it("simular sí se puede, y aplicar a otra campaña también", async () => {
    conCambios();
    const api = vi.fn(async () => vacio);
    const sim = await simularOAplicarHermanas({ origen: "profesores", destinos: ["pregrado"], partes: ["cuerpo"], simular: true },
      async () => {}, undefined, api);
    expect(sim.ok).toBe(true);
    const otra = await simularOAplicarHermanas({ origen: "profesores", destinos: ["posgrado"], partes: ["cuerpo"], simular: false },
      async () => {}, undefined, api);
    expect(otra.ok).toBe(true);
    expect(api).toHaveBeenCalledTimes(2);
    expect(useCorreosStore.getState().campana).toBe("pregrado");
  });
});
