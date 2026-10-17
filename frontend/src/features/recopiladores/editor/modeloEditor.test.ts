import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { normalizeMaterialPreview } from "../../../api/materialPreview";
import type { CollectionMaterialBlock } from "../../../api/recopiladores";
import { ajustesVisibles } from "./modeloAjustes";
import {
  NOMBRE_DE_TIPO,
  actualizarBloque,
  avisoAntesDeGuardar,
  bloqueElegido,
  caraDelFoco,
  conCara,
  hayCambiosSinGuardar,
  huellaDeReceta,
  ladoDeCara,
  loLlena,
  moverBloque,
  nombreDeReceta,
  nombreDeZona,
  notasDe,
  notasDeLaCara,
  parseFoco,
  procedencia,
  puedeMover,
  puedeQuitar,
  quitarBloque,
  rotuloDeCara,
  semillaDeBloque,
  serializarFoco,
  siFalta,
  tiposQueSePuedenAgregar,
  zonaAEstilo,
  zonasPorBloque,
} from "./modeloEditor";
import { PREVIEW_CROQUIS_JSON, PREVIEW_FRENTE_JSON, TEMPLATE_FICHA_CAMPO } from "./preview.fixture";

const PAGES = TEMPLATE_FICHA_CAMPO.pages;
const aqui = path.dirname(fileURLToPath(import.meta.url));

describe("foco: <page_id>~<block_id>", () => {
  it("ida y vuelta: serializar y leer dan la misma cara y el mismo bloque", () => {
    const foco = serializarFoco({ pageId: "croquis", blockId: "croquis" });
    expect(foco).toBe("croquis~croquis");
    expect(parseFoco(foco, PAGES)).toEqual({ cara: 1, blockId: "croquis", canonico: "croquis~croquis", reescribir: false });
    expect(serializarFoco({ pageId: "ficha", blockId: null })).toBe("ficha");
    expect(parseFoco("ficha", PAGES)).toEqual({ cara: 0, blockId: null, canonico: "ficha", reescribir: false });
  });

  it("el block_id suelto es un alias: va a la primera cara que lo tenga y se reescribe", () => {
    expect(parseFoco("qr", PAGES)).toEqual({ cara: 0, blockId: "qr", canonico: "ficha~qr", reescribir: true });
    // El pie está en las dos caras: manda la primera.
    expect(parseFoco("footer", PAGES)).toMatchObject({ cara: 0, blockId: "footer", canonico: "ficha~footer" });
  });

  it("un page_id gana a un block_id del mismo nombre", () => {
    expect(parseFoco("croquis", PAGES)).toEqual({ cara: 1, blockId: null, canonico: "croquis", reescribir: false });
  });

  it("lo que no resuelve se reescribe: bloque ajeno a la cara, cara inexistente, nada", () => {
    expect(parseFoco("croquis~qr", PAGES)).toEqual({ cara: 1, blockId: null, canonico: "croquis", reescribir: true });
    expect(parseFoco("dorso~qr", PAGES)).toEqual({ cara: 0, blockId: null, canonico: null, reescribir: true });
    expect(parseFoco("nadie", PAGES)).toEqual({ cara: 0, blockId: null, canonico: null, reescribir: true });
    expect(parseFoco(null, PAGES)).toEqual({ cara: 0, blockId: null, canonico: null, reescribir: false });
    expect(caraDelFoco("croquis~croquis", PAGES)).toBe(1);
  });

  it("clic en una zona → foco → bloque elegido: el inspector muestra el mismo bloque", () => {
    const zonas = zonasPorBloque(normalizeMaterialPreview(PREVIEW_FRENTE_JSON), "ficha");
    const zonaDelQr = zonas.get("qr");
    expect(zonaDelQr?.type).toBe("access_qr");
    const foco = serializarFoco({ pageId: "ficha", blockId: zonaDelQr?.block_id ?? null });
    const leido = parseFoco(foco, PAGES);
    expect(bloqueElegido(PAGES[leido.cara], leido.blockId)?.block_id).toBe("qr");
    // Sin bloque en el foco queda elegido el primero de la cara.
    expect(bloqueElegido(PAGES[1], null)?.block_id).toBe("croquis");
  });
});

describe("nombres", () => {
  it("cada cara se nombra por lo que dibuja; doble cara es frente y dorso", () => {
    expect(rotuloDeCara("field_form")).toBe("Ficha de campo");
    expect(rotuloDeCara("croquis_campus")).toBe("Croquis");
    expect(rotuloDeCara("otra")).toBe("Cara");
    expect([ladoDeCara(0, 2), ladoDeCara(1, 2), ladoDeCara(0, 1)]).toEqual(["Frente", "Dorso", null]);
  });

  it("el nombre del tipo es el del catálogo, leído de su fuente", () => {
    const r = fs.readFileSync(path.join(aqui, "../../../../../api/R/collection_material_catalog.R"), "utf8");
    const titulos = Object.fromEntries(
      [...r.matchAll(/^\s{4}(\w+) = list\(\n\s+title = "([^"]+)"/gm)].map((m) => [m[1], m[2]]),
    );
    expect(Object.keys(titulos).length).toBeGreaterThan(0);
    expect(NOMBRE_DE_TIPO).toEqual(titulos);
    expect(nombreDeReceta(TEMPLATE_FICHA_CAMPO)).toBe("Ficha de campo con croquis");
  });
});

describe("zonas sobre la página", () => {
  it("la caja en fracción pasa a % sin redondeos que la corran", () => {
    expect(zonaAEstilo({ x: 0.075, y: 0.04, w: 0.85, h: 0.875 })).toEqual({ left: "7.5%", top: "4%", width: "85%", height: "87.5%" });
  });

  it("el nombre accesible dice qué bloque es y dónde está", () => {
    expect(nombreDeZona("Croquis del campus", { x: 0.075, y: 0.04, w: 0.85, h: 0.875 }))
      .toBe("Croquis del campus, del 4 al 92 % del alto de la página");
  });

  it("sólo las zonas de bloque de ESTA cara, sin las derivadas ni las vacías", () => {
    const vista = normalizeMaterialPreview(PREVIEW_CROQUIS_JSON);
    expect([...zonasPorBloque(vista, "croquis").keys()]).toEqual(["croquis"]);
    expect(zonasPorBloque(vista, "ficha").size).toBe(0);
    expect(zonasPorBloque(null, "croquis").size).toBe(0);
  });

  it("la ficha de campo muestra el dorso con su croquis", () => {
    const vista = normalizeMaterialPreview(PREVIEW_CROQUIS_JSON);
    const parsed = parseFoco("croquis~croquis", PAGES);
    expect(vista.page).toBe(parsed.cara + 1);
    expect(zonasPorBloque(vista, PAGES[parsed.cara].page_id).get("croquis")?.type).toBe("campus_map");
  });
});

describe("de dónde sale el dato", () => {
  const block = (b: Partial<CollectionMaterialBlock> & Pick<CollectionMaterialBlock, "type">) => ({ block_id: "b", ...b }) as CollectionMaterialBlock;

  it("unidad, accesos, proyecto o la receta", () => {
    expect(procedencia(block({ type: "campus_map", binding: "unit.venue" }))).toEqual({ dueno: "Unidades (Cálculo de muestra)", llenaLaUnidad: true });
    expect(procedencia(block({ type: "access_qr", binding: "access.qr_payload" }))).toEqual({ dueno: "Accesos", llenaLaUnidad: false });
    expect(procedencia(block({ type: "footer", binding: "project.name" }))).toEqual({ dueno: "Proyecto", llenaLaUnidad: false });
    expect(procedencia(block({ type: "instructions", text: "Hola" }))).toEqual({ dueno: "Texto de la receta", llenaLaUnidad: false });
  });

  it("lo que dice la vista (fills_from) manda sobre lo que se deduce", () => {
    expect(procedencia(block({ type: "body", text: "x" }), ["unit.course_name"]).llenaLaUnidad).toBe(true);
  });

  it("los renglones y la grilla miran los bindings de cada campo", () => {
    const registro = TEMPLATE_FICHA_CAMPO.pages[0].blocks[3];
    expect(loLlena(registro)).toBe("Facultad · Aula o lugar");
    expect(procedencia(registro).llenaLaUnidad).toBe(true);
    expect(siFalta(registro)).toBe("Queda la raya para llenar a mano");
    expect(loLlena(block({ type: "field_grid", fields: ["unit.teacher", "unit.program", "unit.venue", "unit.schedule"] })))
      .toBe("Docente · Escuela o programa · Aula o lugar y 1 más");
  });

  it("qué pasa si falta", () => {
    expect(siFalta(block({ type: "access_qr", binding: "access.qr_payload" }))).toBe("Sin accesos, la ficha no se genera");
    expect(siFalta(block({ type: "heading", binding: "unit.codigo_ficha" }))).toBe("Queda en blanco");
    expect(siFalta(block({ type: "divider" }))).toBe("No depende de datos");
  });
});

describe("notas por bloque", () => {
  it("el bloque no dibujado, los avisos de esta cara y los problemas del borrador", () => {
    const vista = normalizeMaterialPreview({
      ...PREVIEW_FRENTE_JSON,
      undrawn: [{ block_id: "titulo", type: "heading", reason: "slot_taken" }],
    });
    const { porBloque, generales } = notasDeLaCara({
      cara: PAGES[0],
      indice: 0,
      vista,
      problemas: [
        { path: "p", code: "bad_qr_quiet_zone", detail: "Margen fuera de rango.", page: 1, page_id: "ficha", block_id: "qr" },
        { path: "p", code: "x", detail: "Otro de la otra cara.", page: 2, page_id: "croquis", block_id: "croquis" },
        { path: "template.page", code: "bad", detail: "El papel no es válido.", page: null, page_id: null, block_id: null },
      ],
    });
    expect(notasDe(porBloque, "titulo")).toEqual({
      noDibujado: "No se dibuja: ya hay un bloque «Título» en esta cara",
      avisos: ["El texto no cabe entero y se corta"],
      problemas: [],
    });
    expect(notasDe(porBloque, "qr").problemas).toEqual(["Margen fuera de rango."]);
    expect(notasDe(porBloque, "croquis").problemas).toEqual([]);
    expect(generales).toEqual(["El papel no es válido."]);
  });

  it("un aviso de otra cara no se cuelga en esta", () => {
    const vista = normalizeMaterialPreview(PREVIEW_CROQUIS_JSON);
    const { porBloque } = notasDeLaCara({ cara: PAGES[1], indice: 1, vista, problemas: [] });
    expect(porBloque.size).toBe(0);
  });
});

describe("se edita UNA cara", () => {
  it("cambiar el pie del frente no toca el pie del dorso", () => {
    const siguiente = actualizarBloque(TEMPLATE_FICHA_CAMPO, 0, "footer", { binding: "project.period" });
    expect(siguiente.pages[0].blocks[4].binding).toBe("project.period");
    expect(siguiente.pages[1]).toBe(TEMPLATE_FICHA_CAMPO.pages[1]);
    expect(siguiente.template_sha256).toBeNull();
  });

  it("conCara deja las demás caras idénticas", () => {
    const siguiente = conCara(TEMPLATE_FICHA_CAMPO, 1, (blocks) => blocks.slice(0, 1));
    expect(siguiente.pages[0]).toBe(TEMPLATE_FICHA_CAMPO.pages[0]);
    expect(siguiente.pages[1].blocks.map((b) => b.block_id)).toEqual(["croquis"]);
  });

  it("mover sólo intercambia con el vecino que el layout también apila", () => {
    const blocks = [
      { block_id: "cab", type: "brand_header" },
      { block_id: "grid", type: "field_grid" },
      { block_id: "qr", type: "access_qr" },
      { block_id: "log", type: "application_log" },
    ] as CollectionMaterialBlock[];
    const movibles = new Set(["grid", "log"]);
    expect(moverBloque(blocks, "log", -1, movibles).map((b) => b.block_id)).toEqual(["cab", "log", "qr", "grid"]);
    expect(puedeMover(blocks, "grid", -1, movibles)).toBe(false);
    expect(puedeMover(blocks, "grid", 1, movibles)).toBe(true);
    expect(puedeMover(blocks, "qr", 1, movibles)).toBe(false);
    expect(moverBloque(blocks, "qr", 1, movibles)).toEqual(blocks);
  });

  it("el QR y lo obligatorio no se quitan; al quitar queda elegido el que ocupó su lugar", () => {
    const blocks = PAGES[0].blocks;
    expect(puedeQuitar(blocks[2])).toBe(false);
    expect(quitarBloque(blocks, "qr").blocks).toHaveLength(blocks.length);
    const { blocks: resto, siguiente } = quitarBloque(blocks, "titulo");
    expect(resto.map((b) => b.block_id)).toEqual(["careta", "qr", "registro", "footer"]);
    expect(siguiente).toBe("qr");
  });

  it("añadir ofrece un slot por tipo y siembra un id único en la cara", () => {
    const tipos = tiposQueSePuedenAgregar(PAGES[0].blocks);
    expect(tipos).not.toContain("heading");
    expect(tipos).not.toContain("campus_map");
    expect(tipos).toContain("instructions");
    const semilla = semillaDeBloque("instructions", [...PAGES[0].blocks, { block_id: "instructions-6", type: "instructions" }]);
    expect(semilla.block_id).toBe("instructions-7");
    expect(semilla.text).toBe("Instrucciones");
  });
});

describe("cambios sin guardar", () => {
  it("la huella no depende del sello ni del orden de las claves", () => {
    const reordenada = { ...TEMPLATE_FICHA_CAMPO, template_sha256: null, pages: TEMPLATE_FICHA_CAMPO.pages };
    expect(huellaDeReceta(reordenada)).toBe(huellaDeReceta(TEMPLATE_FICHA_CAMPO));
    expect(hayCambiosSinGuardar(reordenada, TEMPLATE_FICHA_CAMPO)).toBe(false);
    const editada = actualizarBloque(TEMPLATE_FICHA_CAMPO, 0, "titulo", { max_lines: 1 });
    expect(huellaDeReceta(editada)).not.toBe(huellaDeReceta(TEMPLATE_FICHA_CAMPO));
    expect(hayCambiosSinGuardar(editada, TEMPLATE_FICHA_CAMPO)).toBe(true);
  });

  it("guardar avisa que las fichas creadas quedan viejas", () => {
    expect(avisoAntesDeGuardar(0)).toBeNull();
    expect(avisoAntesDeGuardar(1)).toBe("La ficha creada habrá que generarla de nuevo.");
    expect(avisoAntesDeGuardar(2616)).toBe("Las 2,616 fichas creadas habrá que generarlas de nuevo.");
  });
});

describe("ajustes: sólo lo que cambia la tinta", () => {
  it("ordena y nombra lo que la zona declara editable; ignora lo que no sabe editar", () => {
    expect(ajustesVisibles("access_qr", ["quiet_zone", "correction", "min_size_mm"]).map((a) => a.propiedad))
      .toEqual(["correction", "quiet_zone"]);
    expect(ajustesVisibles("application_log", ["rows"])[0].rotulo).toBe("Renglones del registro");
    expect(ajustesVisibles("campus_map", [])).toEqual([]);
  });
});
