import { describe, expect, it } from "vitest";
import type { PreviewSlideResponse } from "../../../api/graficos";
import { estadoDeLamina, leerLaminaVisor, motivoDeEstado } from "./estadoLamina";

const png = (n: number) => `data:image/png;base64,${n}`;
const base = { ok: true as const, file_id: "f", size: 1, type: "pptx" as const, images: [] };

describe("leerLaminaVisor", () => {
  it("empareja partes y sus imágenes por índice", () => {
    const r: PreviewSlideResponse = {
      ...base,
      partes: { n: 2, partes: [
        { indice: 1, titulo: "A", estado: "nativa", continuacion: false },
        { indice: 2, titulo: "A (cont.)", estado: "nativa", continuacion: true },
      ] },
      slide_previews: [
        { png_base64: png(1), width: 1280, height: 720, renderer: "soffice+pdftools", indice: 1 },
        { png_base64: png(2), width: 1280, height: 720, renderer: "soffice+pdftools", indice: 2 },
      ],
      avisos: ["Se omitió una columna", "Se omitió una columna"],
    };
    const l = leerLaminaVisor(r);
    expect(l.partes.map((p) => [p.indice, p.imagen, p.continuacion])).toEqual([[1, png(1), false], [2, png(2), true]]);
    expect(l.avisos).toEqual(["Se omitió una columna"]);
    expect(l.renderer).toBe("soffice+pdftools");
    expect(l.sinImagen).toBe(false);
    expect(l.fileId).toBe("f");
  });

  it("acepta escalares de auto_unbox y huecos vacíos", () => {
    const r = {
      ...base,
      partes: { n: 2, partes: { indice: 1, titulo: "A", estado: "ruta_anterior", continuacion: false } },
      slide_previews: [{ png_base64: png(1), width: null, height: null, renderer: "x", indice: 1 }, {}],
      avisos: "Ruta anterior: no cabe",
    } as unknown as PreviewSlideResponse;
    const l = leerLaminaVisor(r);
    expect(l.partes).toHaveLength(2);
    expect(l.partes[1].imagen).toBeNull();
    expect(l.avisos).toEqual(["Ruta anterior: no cabe"]);
    expect(estadoDeLamina(l)).toBe("ruta_anterior");
  });

  it("backend sin partes: usa slide_preview como parte 1", () => {
    const l = leerLaminaVisor({ ...base, slide_preview: { png_base64: png(9), width: 1, height: 1, renderer: "r" } });
    expect(l.partes).toHaveLength(1);
    expect(l.partes[0].imagen).toBe(png(9));
    expect(estadoDeLamina(l)).toBeNull();
  });

  it("sin ninguna imagen declara sinImagen (no hay renderer)", () => {
    const l = leerLaminaVisor({ ...base, slide_preview: null });
    expect(l.sinImagen).toBe(true);
    expect(l.partes).toHaveLength(1);
  });
});

describe("estado y motivo", () => {
  it("la peor parte manda", () => {
    const l = leerLaminaVisor({ ...base, partes: { n: 2, partes: [
      { indice: 1, titulo: "", estado: "nativa", continuacion: false },
      { indice: 2, titulo: "", estado: "ruta_anterior", continuacion: true },
    ] } });
    expect(estadoDeLamina(l)).toBe("ruta_anterior");
  });
  it("«marco» es un estado propio: ni error ni ruta anterior", () => {
    const l = leerLaminaVisor({ ...base, partes: { n: 1, partes: [{ indice: 1, titulo: "", estado: "marco", continuacion: false }] } });
    expect(estadoDeLamina(l)).toBe("marco");
    expect(motivoDeEstado("marco", false)).toMatch(/aparte/);
  });
  it("distingue la ruta anterior elegida de la impuesta", () => {
    expect(motivoDeEstado("ruta_anterior", true)).toMatch(/Elegiste/);
    expect(motivoDeEstado("ruta_anterior", false, true)).toMatch(/Los avisos dicen por qué/);
    // Sin avisos no se manda a leerlos.
    expect(motivoDeEstado("ruta_anterior", false, false)).toMatch(/No dejó un aviso/);
  });
});
