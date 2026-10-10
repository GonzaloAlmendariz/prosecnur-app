import { describe, expect, it } from "vitest";
import { normalizarCatalogoIconos, normalizarElecciones, normalizarVisorWord } from "./graficosRecursos";

describe("recursos del editor F6: normalizadores defensivos", () => {
  it("el catálogo acepta un color con un solo ícono como escalar y descarta imágenes que no son data URI", () => {
    const c = normalizarCatalogoIconos({ colores: { navy: ["users", "award"], verde: "circle-check-big" }, iconos: { users: "data:image/png;base64,AA", x: "nope" } });
    expect(c.colores.verde).toEqual(["circle-check-big"]);
    expect(c.colores.coral).toEqual([]);
    expect(Object.keys(c.iconos)).toEqual(["users"]);
  });

  it("una sola elección llega como objeto y se lee como lista; sin palabra clave, palabra es null", () => {
    expect(normalizarElecciones({ elecciones: { texto: "Perfil", icono: "users", palabra: "perfil", motivo: "Elegido por «perfil»" } })).toHaveLength(1);
    expect(normalizarElecciones({ elecciones: [{ texto: "x", icono: "list-checks", palabra: null, motivo: "Ninguna" }] })[0]!.palabra).toBeNull();
    expect(normalizarElecciones(null)).toEqual([]);
  });

  it("el visor normaliza páginas, capítulos y el aviso de índice vacío", () => {
    const v = normalizarVisorWord({
      file_id: "w1", filename: "informe.docx", exportado: "2026-10-10",
      paginas: ["data:image/png;base64,AA", "data:image/png;base64,BB"],
      mapa: { capitulos: { numero: "1", titulo: "Introducción", desde: 3, hasta: 3 }, secciones: [], indice_vacio: true },
    });
    expect(v.paginas).toHaveLength(2);
    expect(v.capitulos).toEqual([{ numero: "1", titulo: "Introducción", desde: 3, hasta: 3 }]);
    expect(v.indiceVacio).toBe(true);
    expect(normalizarVisorWord(undefined).paginas).toEqual([]);
  });
});
