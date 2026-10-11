// Editor del índice (A5 rebanada 2b, W2; contrato docs/qa/contrato-vista-general-2b-f6-2026-10-11.md, tests W2-1..W2-7).
// La forma persistida no cambia: `secciones/subtemas/subindices` en el payload e íconos en `meta.iconos`. Cada caso nombra
// el mutante que lo vuelve rojo.
import { describe, expect, it } from "vitest";
import type { Slide } from "../../../api/graficos";
import { construirEstructura } from "../laminas/modeloEstructura";
import {
  avisosIndice,
  composicionIndiceEfectiva,
  firmaIndice,
  indiceDesdeEstructura,
  indiceDesfasado,
  leerIndice,
  MAX_CAPITULOS_RECETARIO,
  moverCapitulo,
  serializarIndice,
  SIN_ICONO,
  type IndiceEditable,
} from "./modeloIndice";

const indice = (payload: Record<string, unknown>) => ({ tipo: "p_slide_indice" as const, payload });
const caps = (...titulos: string[]): IndiceEditable => ({
  capitulos: titulos.map((titulo) => ({ titulo, subcapitulos: [], icono: "" })),
  huerfanos: [],
});
const lamina = (id: string, tipo: Slide["tipo"], payload: Record<string, unknown> = {}): Slide => ({ id, tipo, payload });

describe("W2-1 lectura de íconos: meta.iconos gana a iconos_focos", () => {
  it("cada capítulo toma meta.iconos[k] y, si falta o está vacío, iconos_focos[k]", () => {
    // Mutante «invertir» (iconos_focos antes que meta.iconos): el capítulo 1 leería «target-arrow».
    const ix = leerIndice({
      secciones: "Objetivo\nMetodología\nResultados",
      iconos_focos: "target-arrow\nclipboard-list\nchart-column",
      meta: { iconos: ["lightbulb", "", "none"] },
    });
    expect(ix.capitulos.map((c) => c.icono)).toEqual(["lightbulb", "clipboard-list", SIN_ICONO]);
  });

  it("lee las tres formas en que llegan los íconos (texto por líneas, vector y lista de objetos)", () => {
    expect(leerIndice({ secciones: ["A", "B"], iconos_focos: ["x", "y"] }).capitulos.map((c) => c.icono)).toEqual(["x", "y"]);
    expect(leerIndice({ secciones: "A\nB", iconos_focos: [{ icono: "x" }, { name: "y" }] }).capitulos.map((c) => c.icono)).toEqual(["x", "y"]);
    expect(leerIndice({ secciones: "A", estilo: { iconos_focos: "z" } }).capitulos[0].icono).toBe("z");
  });
});

describe("W2-2 serialización: nunca emite iconos_focos y todo automático quita la clave", () => {
  it("escribe meta.iconos alineado a los capítulos y borra iconos_focos (y el de estilo)", () => {
    const slide = indice({ secciones: "A\nB", iconos_focos: "x\ny", estilo: { iconos_focos: "x", otro: 1 }, meta: { composicion: "facetas" } });
    const r = serializarIndice(slide, leerIndice(slide.payload));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect("iconos_focos" in r.patch && r.patch.iconos_focos !== undefined).toBe(false);
    expect(r.patch.estilo).toEqual({ otro: 1 });
    expect(r.patch.meta).toEqual({ composicion: "facetas", iconos: ["x", "y"] });
    const salida = JSON.stringify({ ...slide.payload, ...r.patch });
    expect(salida).not.toContain("iconos_focos");
  });

  it("con todos los capítulos en «Automático» no queda meta.iconos", () => {
    // Mutante «escribir [\"\", \"\"]»: el motor leería huecos y el payload crecería sin decir nada.
    const slide = indice({ secciones: "A\nB", meta: { iconos: ["x", ""], composicion: "bloques" } });
    const ix = leerIndice(slide.payload);
    ix.capitulos[0].icono = "";
    const r = serializarIndice(slide, ix);
    expect(r.ok && r.patch.meta).toEqual({ composicion: "bloques" });
    const sinMeta = serializarIndice(indice({ secciones: "A" }), caps("A"));
    expect(sinMeta.ok && sinMeta.patch.meta).toBeUndefined();
  });

  it("escribe secciones, subíndices «Capítulo: sub» y subtemas sin capítulos vacíos", () => {
    const ix: IndiceEditable = {
      capitulos: [
        { titulo: " Perfil ", subcapitulos: ["Edad", " ", "Sexo"], icono: "" },
        { titulo: "", subcapitulos: ["Perdido"], icono: "x" },
        { titulo: "Resultados", subcapitulos: [], icono: "chart-column" },
      ],
      huerfanos: [],
    };
    const r = serializarIndice(indice({}), ix);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.patch.secciones).toBe("Perfil\nResultados");
    expect(r.patch.subindices).toBe("Perfil: Edad\nPerfil: Sexo");
    expect(r.patch.subtemas).toBe("Edad\nSexo");
    expect(r.patch.meta).toEqual({ iconos: ["", "chart-column"] });
  });

  it("ida y vuelta: leer lo que escribe da el mismo índice", () => {
    const ix: IndiceEditable = {
      capitulos: [
        { titulo: "Perfil", subcapitulos: ["Edad", "Sexo"], icono: "user-round" },
        { titulo: "Resultados", subcapitulos: ["Satisfacción"], icono: "" },
      ],
      huerfanos: [],
    };
    const r = serializarIndice(indice({}), ix);
    if (!r.ok) throw new Error("debía serializar");
    expect(leerIndice(r.patch)).toEqual(ix);
  });
});

describe("W2-3 migración de iconos_focos: composición explícita", () => {
  it("la primera edición escribe composicion=\"circulos\" si no estaba declarada (la salida no cambia)", () => {
    // Mutante «no escribirla»: sin iconos_focos el motor volvería a «arcos».
    const slide = indice({ secciones: "A\nB", iconos_focos: "target-arrow\nlightbulb" });
    expect(composicionIndiceEfectiva(slide)).toBe("circulos");
    const r = serializarIndice(slide, leerIndice(slide.payload));
    if (!r.ok) throw new Error("debía serializar");
    const despues = { ...slide, payload: { ...slide.payload, ...r.patch } };
    expect(r.patch.meta).toEqual({ composicion: "circulos", iconos: ["target-arrow", "lightbulb"] });
    expect(composicionIndiceEfectiva(despues)).toBe("circulos");
  });

  it("respeta la composición ya declarada y no la inventa sin focos", () => {
    const declarada = indice({ secciones: "A", iconos_focos: "x", meta: { composicion: "bloques" } });
    const r = serializarIndice(declarada, leerIndice(declarada.payload));
    expect(r.ok && r.patch.meta).toEqual({ composicion: "bloques", iconos: ["x"] });
    const sinFocos = serializarIndice(indice({ secciones: "A", iconos_focos: "" }), caps("A"));
    expect(sinFocos.ok && sinFocos.patch.meta).toBeUndefined();
  });
});

describe("W2-4 composicionIndiceEfectiva replica .lam_indice_composicion", () => {
  it("declarada manda; sin declarar, círculos si el plan pide focos y arcos si no", () => {
    expect(composicionIndiceEfectiva(indice({}))).toBe("arcos");
    expect(composicionIndiceEfectiva(indice({ iconos_focos: "" }))).toBe("arcos");
    expect(composicionIndiceEfectiva(indice({ iconos_focos: ["", " "] }))).toBe("arcos");
    expect(composicionIndiceEfectiva(indice({ iconos_focos: "x" }))).toBe("circulos");
    expect(composicionIndiceEfectiva(indice({ iconos_focos_fill: "#123456" }))).toBe("circulos");
    expect(composicionIndiceEfectiva(indice({ iconos_focos_objeto_unico: false }))).toBe("arcos");
    expect(composicionIndiceEfectiva(indice({ iconos_focos_objeto_unico: true }))).toBe("circulos");
    expect(composicionIndiceEfectiva(indice({ redibujar_focos: true }))).toBe("circulos");
    expect(composicionIndiceEfectiva(indice({ estilo: { iconos_focos: "x" } }))).toBe("circulos");
    expect(composicionIndiceEfectiva(indice({ iconos_focos: "x", meta: { composicion: "arcos" } }))).toBe("arcos");
    expect(composicionIndiceEfectiva(indice({ meta: { composicion: "Facetas" } }))).toBe("facetas");
    expect(composicionIndiceEfectiva(indice({ meta: { composicion: "focos" } }))).toBe("focos");
    // Una declarada que el motor no conoce sale como «arcos» (`.lam_laminas_indice`), con o sin focos.
    expect(composicionIndiceEfectiva(indice({ iconos_focos: "x", meta: { composicion: "espiral" } }))).toBe("arcos");
  });
});

describe("W2-5 «:» o «|» en un título con subcapítulos: aviso y no se serializa", () => {
  it("bloquea con «:» y con «|», sólo si el capítulo tiene subcapítulos", () => {
    // Mutante «validar sólo “:”»: el caso de «|» pasaría y el motor perdería los subcapítulos.
    for (const titulo of ["Resultados: parte 1", "Resultados | parte 1"]) {
      const ix: IndiceEditable = { capitulos: [{ titulo, subcapitulos: ["Satisfacción"], icono: "" }], huerfanos: [] };
      const r = serializarIndice(indice({}), ix);
      expect(r.ok, titulo).toBe(false);
      expect(avisosIndice(ix).find((a) => a.codigo === "separador_en_titulo")?.bloquea, titulo).toBe(true);
    }
    const sinSubs = serializarIndice(indice({}), caps("Resultados: parte 1"));
    expect(sinSubs.ok).toBe(true);
  });

  it("lee los subíndices como el motor: corta en el primer «:» o «|»", () => {
    const ix = leerIndice({ secciones: "Perfil\nResultados", subindices: "Perfil | Edad\nresultados: Satisfacción: general\nOtro: suelto" });
    expect(ix.capitulos.map((c) => c.subcapitulos)).toEqual([["Edad"], ["Satisfacción: general"]]);
    expect(ix.huerfanos).toEqual(["Otro: suelto"]);
  });

  it("subtemas sueltos cuelgan del último capítulo sólo si no hay subíndices", () => {
    expect(leerIndice({ secciones: "A\nB", subtemas: "x\ny" }).capitulos[1].subcapitulos).toEqual(["x", "y"]);
    expect(leerIndice({ secciones: "A\nB", subtemas: "x", subindices: "A: z" }).capitulos.map((c) => c.subcapitulos)).toEqual([["z"], []]);
  });

  it("conserva las líneas huérfanas al escribir (nunca se borran en silencio)", () => {
    const slide = indice({ secciones: "A", subindices: "A: x\nOtro: y" });
    const r = serializarIndice(slide, leerIndice(slide.payload));
    expect(r.ok && r.patch.subindices).toBe("A: x\nOtro: y");
  });
});

describe("W2-6 indiceDesdeEstructura e indiceDesfasado", () => {
  const plan: Slide[] = [
    lamina("p", "p_slide_portada", { titulo: "Informe" }),
    lamina("i", "p_slide_indice"),
    lamina("s1", "p_slide_seccion", { titulo: "Perfil" }),
    lamina("s1a", "p_slide_seccion", { titulo: "Edad", meta: { nivel: "subcapitulo" } }),
    lamina("g1", "p_slide_1_grafico", { titulo: "Edad por sexo" }),
    lamina("s1b", "p_slide_seccion", { titulo: "Territorio", meta: { nivel: "subcapitulo" } }),
    lamina("s2", "p_slide_seccion", { titulo: "Resultados" }),
    lamina("g2", "p_slide_1_grafico"),
    lamina("c", "p_slide_cierre"),
  ];
  const estructura = construirEstructura(plan);

  it("los capítulos del informe son los capítulos; sus subcapítulos, subcapítulos", () => {
    // Mutante «contar subcapítulos como capítulos»: saldrían cuatro capítulos.
    const ix = indiceDesdeEstructura(estructura);
    expect(ix.capitulos.map((c) => c.titulo)).toEqual(["Perfil", "Resultados"]);
    expect(ix.capitulos.map((c) => c.subcapitulos)).toEqual([["Edad", "Territorio"], []]);
  });

  it("conserva el ícono de un capítulo que sigue llamándose igual", () => {
    const anterior: IndiceEditable = { capitulos: [{ titulo: "resultados", subcapitulos: [], icono: "lightbulb" }], huerfanos: ["X: y"] };
    const ix = indiceDesdeEstructura(estructura, anterior);
    expect(ix.capitulos.map((c) => c.icono)).toEqual(["", "lightbulb"]);
    expect(ix.huerfanos).toEqual([]);
  });

  it("avisa el desfase y no lo hay cuando el índice ya refleja los capítulos", () => {
    expect(indiceDesfasado(indiceDesdeEstructura(estructura), estructura)).toBe(false);
    expect(indiceDesfasado(caps("Perfil", "Resultados"), estructura)).toBe(true);
    expect(indiceDesfasado(caps("Perfil"), estructura)).toBe(true);
    const sinCapitulos = construirEstructura([lamina("i", "p_slide_indice")]);
    expect(indiceDesfasado(caps("Lo que sea"), sinCapitulos)).toBe(false);
  });
});

describe("W2-7 más de 13 capítulos: aviso de ruta anterior", () => {
  it("avisa desde el capítulo 14, no antes (el tope de 5 focos ya no rige)", () => {
    // Mutante «tope 5 heredado»: seis capítulos avisarían.
    const titulos = (n: number) => Array.from({ length: n }, (_, i) => `Capítulo ${i + 1}`);
    expect(MAX_CAPITULOS_RECETARIO).toBe(13);
    expect(avisosIndice(caps(...titulos(6))).map((a) => a.codigo)).not.toContain("demasiados_capitulos");
    expect(avisosIndice(caps(...titulos(13))).map((a) => a.codigo)).not.toContain("demasiados_capitulos");
    const catorce = avisosIndice(caps(...titulos(14))).find((a) => a.codigo === "demasiados_capitulos");
    expect(catorce?.bloquea).toBe(false);
    expect(catorce?.texto).toMatch(/ruta anterior/);
    expect(serializarIndice(indice({}), caps(...titulos(14))).ok).toBe(true);
  });

  it("un título vacío avisa sin bloquear y no cuenta para el tope", () => {
    const ix = caps(...Array.from({ length: 13 }, (_, i) => `C${i}`), "");
    const avisos = avisosIndice(ix);
    expect(avisos.find((a) => a.codigo === "titulo_vacio")).toMatchObject({ capitulo: 14, bloquea: false });
    expect(avisos.map((a) => a.codigo)).not.toContain("demasiados_capitulos");
  });
});

describe("orden y firma", () => {
  it("mueve capítulos sin mutar el original", () => {
    const ix = caps("A", "B", "C");
    expect(moverCapitulo(ix, 0, 2).capitulos.map((c) => c.titulo)).toEqual(["B", "C", "A"]);
    expect(ix.capitulos.map((c) => c.titulo)).toEqual(["A", "B", "C"]);
    expect(moverCapitulo(ix, 0, -1)).toBe(ix);
  });

  it("la firma cambia con lo que el editor escribe y no con otros campos", () => {
    const a = firmaIndice({ secciones: "A", titulo: "Índice" });
    expect(firmaIndice({ secciones: "A", titulo: "Otro" })).toBe(a);
    expect(firmaIndice({ secciones: "B", titulo: "Índice" })).not.toBe(a);
    expect(firmaIndice({ secciones: "A", iconos_focos: undefined })).toBe(a);
  });
});
