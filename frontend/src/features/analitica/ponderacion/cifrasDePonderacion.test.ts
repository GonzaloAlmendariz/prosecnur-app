import { describe, expect, it } from "vitest";
import type { PonderPreview } from "../../../api/analitica";
import type { PonderacionConfig } from "../store";
import { SIN_CIFRA } from "../../../lib/formatoNumero";
import {
  CIFRAS_DE_LA_BANDA, CIFRAS_DEL_EFECTO, cifrasDeLaBanda, cifrasDelEfecto, formatoPeso, PERDIDA_QUE_SE_AVISA,
  variablesQueAjustan,
} from "./cifrasDePonderacion";

const DIAG = { n: 400, n_eff: 320, deff: 1.25, cv: 0.5, loss_pct: 20, min: 0.4, max: 3, mean: 1, median: 1, ratio_max_min: 7.5 };
/** Cada variable entra con metas, salvo las nombradas en `sinMetas`. */
const pond = (margenes: string[], sinMetas: string[] = []): PonderacionConfig => ({
  enabled: true,
  rake: {
    margins: margenes.map((v) => {
      const targets: Record<string, number> = sinMetas.includes(v) ? {} : { "1": 48, "2": 52 };
      return { var: v, targets };
    }),
  },
});
const preview = (extra: Partial<PonderPreview> = {}): PonderPreview => ({ ok: true, rake_applied: true, diagnostics: DIAG, ...extra });

describe("Ponderación: una cifra, una sola vez", () => {
  it("la banda y el panel del efecto no comparten ninguna cifra", () => {
    const repetidas = CIFRAS_DE_LA_BANDA.filter((c) => (CIFRAS_DEL_EFECTO as readonly string[]).includes(c));
    expect(repetidas).toEqual([]);
    const banda = cifrasDeLaBanda(pond(["sexo"]), preview({ escala: "expansion", total_poblacion: 5000 }));
    const efecto = cifrasDelEfecto(preview({ escala: "expansion", total_poblacion: 5000 }));
    expect(banda.map((c) => c.clave)).toEqual([...CIFRAS_DE_LA_BANDA]);
    expect(efecto.map((c) => c.clave)).toEqual([...CIFRAS_DEL_EFECTO]);
    // El tamaño efectivo y el efecto de diseño vivían en los dos sitios.
    const valoresDeLaBanda = banda.map((c) => String(c.valor));
    expect(valoresDeLaBanda).not.toContain("320");
    expect(valoresDeLaBanda).not.toContain("1.25");
  });

  it("la banda cuenta las variables de ajuste, también cuando no hay ninguna", () => {
    expect(cifrasDeLaBanda(pond([]), null)).toEqual([
      { clave: "variables-de-ajuste", etiqueta: "Variables de ajuste", valor: "0" },
    ]);
    expect(cifrasDeLaBanda(pond(["sexo", "edad"]), null)[0].valor).toBe("2");
  });

  it("una variable declarada sin ninguna meta no ajusta nada y no se cuenta", () => {
    expect(cifrasDeLaBanda(pond(["sexo", "edad"], ["edad"]), null)[0].valor).toBe("1");
    expect(variablesQueAjustan(pond(["sexo", "edad"], ["sexo", "edad"]))).toBe(0);
    // Basta una meta para que ajuste; una meta que no es número no cuenta.
    const config = pond(["sexo"]);
    config.rake.margins[0].targets = { "1": 48 };
    expect(variablesQueAjustan(config)).toBe(1);
    config.rake.margins[0].targets = { "1": Number.NaN };
    expect(variablesQueAjustan(config)).toBe(0);
  });

  it("la suma de pesos solo aparece cuando el motor la entrega, y no se llama población", () => {
    expect(cifrasDeLaBanda(pond(["sexo"]), preview()).map((c) => c.clave)).toEqual(["variables-de-ajuste"]);
    expect(cifrasDeLaBanda(pond(["sexo"]), preview({ total_poblacion: null })).map((c) => c.clave)).toEqual(["variables-de-ajuste"]);
    // Un cálculo que falló no publica población aunque traiga el campo.
    expect(cifrasDeLaBanda(pond(["sexo"]), { ok: false, total_poblacion: 5000 })).toHaveLength(1);
    const con = cifrasDeLaBanda(pond(["sexo"]), preview({ escala: "expansion", total_poblacion: 1234567 }));
    expect(con[1]).toEqual({ clave: "suma-de-pesos", etiqueta: "Suma de pesos", valor: "1,234,567" });
    expect(con.map((c) => c.etiqueta).join(" ")).not.toContain("Población");
  });
});

describe("Ponderación: cada cifra del efecto declara su base", () => {
  it("ninguna base queda vacía", () => {
    for (const c of cifrasDelEfecto(preview())) expect(c.base.trim(), c.clave).not.toBe("");
  });

  it("el tamaño efectivo se lee sobre los casos con peso y dice cuánto pierde", () => {
    const [tamano] = cifrasDelEfecto(preview());
    expect(tamano).toMatchObject({ valor: "320", rotulo: "Tamaño efectivo", base: "de 400 casos, 20 % menos" });
    expect(tamano.tono).toBeUndefined();
  });

  it("concuerda con un solo caso y no escribe una pérdida de cero", () => {
    const [tamano] = cifrasDelEfecto(preview({ diagnostics: { ...DIAG, n: 1, n_eff: 1, loss_pct: 0 } }));
    expect(tamano.base).toBe("de 1 caso");
  });

  it(`la pérdida se marca desde ${PERDIDA_QUE_SE_AVISA} %, no antes`, () => {
    const tono = (loss_pct: number) => cifrasDelEfecto(preview({ diagnostics: { ...DIAG, loss_pct } }))[0].tono;
    expect(tono(PERDIDA_QUE_SE_AVISA - 1)).toBeUndefined();
    expect(tono(PERDIDA_QUE_SE_AVISA)).toBe("aviso");
  });

  it("los pesos mínimo y máximo declaran la media de su escala", () => {
    const media1 = cifrasDelEfecto(preview());
    expect(media1[2]).toMatchObject({ rotulo: "Peso mínimo", valor: "0.40", base: "media 1.00" });
    expect(media1[3]).toMatchObject({ rotulo: "Peso máximo", valor: "3.00", base: "media 1.00" });
    const expansion = cifrasDelEfecto(preview({ diagnostics: { ...DIAG, min: 1234.5, max: 9258.75, mean: 3086.42 } }));
    expect(expansion[2]).toMatchObject({ valor: "1,234.5", base: "media 3,086.4" });
  });

  it("el efecto de diseño dice que es el de la ponderación y conserva su base", () => {
    expect(cifrasDelEfecto(preview())[1]).toMatchObject({
      clave: "efecto-de-diseno", rotulo: "Efecto de diseño por ponderación", base: "casos entre tamaño efectivo",
    });
  });

  it("con recorte, tamaño efectivo y efecto de diseño llevan su valor anterior y dicen de qué es", () => {
    const cifras = cifrasDelEfecto(preview({
      recorte: {
        cap: 4, modo: "recalibrar", ciclos: 3, convergio: true, tol_margen: 0.001, max_desvio_margen: 0.0004,
        antes: { deff: 1.6, n_eff: 250, max_sobre_media: 6.1 },
        despues: { deff: 1.25, n_eff: 320, max_sobre_media: 4 },
      },
    }));
    expect(cifras[0].antes).toBe("tamaño efectivo 250 antes del recorte");
    expect(cifras[1]).toMatchObject({ valor: "1.25", antes: "efecto de diseño 1.60 antes del recorte" });
    expect(cifras[2].antes).toBeUndefined();
    expect(cifrasDelEfecto(preview())[0].antes).toBeUndefined();
  });

  it("sin diagnóstico no inventa cifras", () => {
    expect(cifrasDelEfecto({ ok: true, rake_applied: true })).toEqual([]);
    expect(formatoPeso(null)).toBe(SIN_CIFRA);
    expect(formatoPeso(Number.NaN)).toBe(SIN_CIFRA);
  });
});
