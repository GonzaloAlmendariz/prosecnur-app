import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { normalizeMaterialPreview } from "../../../api/materialPreview";
import type { CollectionUnit } from "../../../api/recopiladores";
import { PANELES_POR_MODULO } from "../../../lib/navegacion/manifiesto";
import { AjustesDelBloque } from "./AjustesDelBloque";
import { BarraDelEditor } from "./BarraDelEditor";
import { InspectorDeBloque } from "./InspectorDeBloque";
import { notasDeLaCara, zonasPorBloque } from "./modeloEditor";
import { OutlineDeCara } from "./OutlineDeCara";
import { PANEL_EDITOR_BLOQUE } from "./panelesEditor";
import { PliegoReal, type ZonaDelPliego } from "./PliegoReal";
import { PREVIEW_CROQUIS_JSON, PREVIEW_FRENTE_JSON, TEMPLATE_FICHA_CAMPO } from "./preview.fixture";
import { SelectorDeUnidad } from "./SelectorDeUnidad";

/** Los hooks llamados después del primer `return` (misma sonda que PlanSection.hooks.test.ts). */
function hooksTrasElPrimerReturn(cuerpo: string): string[] {
  const sinComentarios = cuerpo.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const m = /^\s*return\b/m.exec(sinComentarios);
  if (!m) return [];
  return [...sinComentarios.slice(m.index).matchAll(/\b(use[A-Z]\w*)\s*[<(]/g)].map((x) => x[1]);
}

const FRENTE = normalizeMaterialPreview(PREVIEW_FRENTE_JSON);
const DORSO = normalizeMaterialPreview(PREVIEW_CROQUIS_JSON);
const [FICHA, CROQUIS] = TEMPLATE_FICHA_CAMPO.pages;
const noop = () => {};
const SIN_NOTAS = { noDibujado: null, avisos: [], problemas: [] };
const PANEL = { "data-pulso-panel": "bloque" };

function zonasDe(vista = FRENTE, cara = FICHA): ZonaDelPliego[] {
  const zonas = zonasPorBloque(vista, cara.page_id);
  return cara.blocks.flatMap((block) => {
    const zona = zonas.get(block.block_id);
    return zona ? [{ zona, blockId: block.block_id, rotulo: block.type, deLaUnidad: zona.fills_from.some((f) => f.startsWith("unit.")), conProblema: block.block_id === "qr" }] : [];
  });
}

const pliego = (extra: Partial<Parameters<typeof PliegoReal>[0]> = {}) => renderToStaticMarkup(
  <PliegoReal
    vista={FRENTE}
    papel={{ w: 210, h: 297 }}
    zonas={zonasDe()}
    seleccion="titulo"
    onSeleccionar={noop}
    alt="Ficha de campo con croquis, frente, con CH 1"
    cargando={false}
    desactualizada={false}
    fallo={null}
    onReintentar={noop}
    acceso="deployment"
    {...extra}
  />,
);

describe("PliegoReal: la página real con una zona por bloque", () => {
  it("pinta la imagen y un botón por zona de bloque, con su posición en el nombre accesible", () => {
    const html = pliego();
    expect(html).toContain(`data:image/png;base64,${FRENTE.png_base64}`);
    expect(html.match(/class="rec-ed-zona /g)).toHaveLength(5);
    expect(html).toContain('aria-label="access_qr, del 16 al 52 % del alto de la página"');
    expect(html).toContain("left:25%;top:16%;width:50%;height:36%");
    expect(html).toContain('data-qa-geometry-group="material-editor-zonas"');
  });

  it("la zona elegida lleva el borde del acento; la que llena la unidad, su velo", () => {
    const html = pliego();
    expect(html).toMatch(/class="rec-ed-zona is-unidad is-elegida"[^>]*aria-current="true"/);
    expect(html).toMatch(/class="rec-ed-zona is-fijo"/);
    expect(html).toContain("is-problema");
  });

  it("sin accesos, el QR se rotula «enlace de ejemplo»", () => {
    const html = pliego({ acceso: "ejemplo" });
    expect(html).toContain("rec-ed-zona-etiqueta");
    expect(html).toContain("enlace de ejemplo");
    expect(html).toContain(", enlace de ejemplo\"");
  });

  it("un fallo con imagen previa la marca desactualizada; sin imagen dice qué pasó", () => {
    expect(pliego({ desactualizada: true })).toContain("Desactualizada");
    const sinImagen = pliego({ vista: null, fallo: { mensaje: "La página no se puede dibujar ahora.", reintentable: true } });
    expect(sinImagen).toContain("La página no se puede dibujar ahora.");
    expect(sinImagen).toContain("Reintentar");
    expect(sinImagen).not.toContain("rec-ed-zona");
    expect(pliego({ vista: null })).toContain("Dibujando la página…");
  });

  it("la ficha de campo muestra el dorso con su croquis", () => {
    const html = pliego({ vista: DORSO, zonas: zonasDe(DORSO, CROQUIS), seleccion: "croquis" });
    expect(html).toContain('aria-label="campus_map, del 4 al 92 % del alto de la página"');
    expect(html.match(/class="rec-ed-zona /g)).toHaveLength(1);
  });
});

describe("OutlineDeCara", () => {
  const notas = notasDeLaCara({
    cara: FICHA,
    indice: 0,
    vista: FRENTE,
    problemas: [{ path: "p", code: "c", detail: "Margen fuera de rango.", page: 1, page_id: "ficha", block_id: "qr" }],
  }).porBloque;
  const html = renderToStaticMarkup(
    <OutlineDeCara
      titulo="Frente · Ficha de campo"
      blocks={FICHA.blocks}
      seleccion="qr"
      onSeleccionar={noop}
      deLaUnidad={new Set(["titulo", "registro"])}
      notas={notas}
      tiposAgregables={["instructions"]}
      onAgregar={noop}
    />,
  );

  it("declara su grupo C1 equal y una fila por bloque, sin numerales", () => {
    expect(html).toContain('data-qa-geometry-group="material-editor-outline"');
    expect(html).toContain('data-qa-geometry-contract="equal"');
    expect(html.match(/<button type="button" class="rec-ed-fila/g)).toHaveLength(5);
    expect(html).not.toMatch(/rec-outline-num/);
    expect(html).toContain("5 bloques");
  });

  it("la fila elegida y la del problema se marcan; el aviso de truncado se lee", () => {
    expect(html).toMatch(/class="rec-ed-fila is-elegida is-problema"[^>]*aria-current="true"/);
    expect(html).toContain("Margen fuera de rango.");
    expect(html).toContain("El texto no cabe entero y se corta");
    expect(html.match(/rec-ed-procedencia is-unidad/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("añadir ofrece sólo lo que se puede sembrar", () => {
    expect(html).toContain('aria-label="Añadir bloque a esta cara"');
    expect(html).toContain("Instrucciones");
  });
});

describe("InspectorDeBloque", () => {
  const zonas = zonasPorBloque(FRENTE, "ficha");
  const inspector = (blockId: string, extra: Partial<Parameters<typeof InspectorDeBloque>[0]> = {}) => renderToStaticMarkup(
    <InspectorDeBloque
      pageId="ficha"
      block={FICHA.blocks.find((b) => b.block_id === blockId) ?? null}
      zona={zonas.get(blockId) ?? null}
      notas={SIN_NOTAS}
      puedeSubir={false}
      puedeBajar={false}
      onCambiar={noop}
      onMover={noop}
      onQuitar={noop}
      panelProps={PANEL}
      {...extra}
    />,
  );

  it("Tipo dice el rótulo humano, nunca la clave interna", () => {
    const html = inspector("qr");
    expect(html).toContain("QR de acceso");
    expect(html).not.toContain(">access_qr<");
    expect(html).toContain('data-qa-geometry-group="material-editor-inspector-filas"');
    expect(html).toContain("Dueño del dato");
    expect(html).toContain("Accesos");
    expect(html).toContain("Sin accesos, la ficha no se genera");
    expect(html).toContain('data-pulso-panel="bloque"');
  });

  it("sólo ofrece los ajustes que la zona declara editables", () => {
    const qr = inspector("qr");
    expect(qr).toContain("Corrección del QR");
    expect(qr).toContain("Margen blanco del QR");
    expect(qr).not.toContain("Dato que muestra");
    // El título sólo declara `binding`: no hay «Líneas como máximo».
    const titulo = inspector("titulo");
    expect(titulo).toContain("Dato que muestra");
    expect(titulo).not.toContain("Líneas como máximo");
    // Sin zona (el pie no declara nada): sin ajustes.
    expect(inspector("footer")).not.toContain("Ajustes");
  });

  it("las flechas sólo aparecen si el layout apila el bloque", () => {
    expect(inspector("registro")).not.toContain("Subir");
    const movible = inspector("registro", { zona: { ...zonas.get("registro")!, reorderable: true }, puedeBajar: true });
    expect(movible).toContain('aria-label="Subir Renglones para llenar"');
    expect(movible).toContain('aria-label="Bajar Renglones para llenar"');
  });

  it("el QR no se quita de la receta", () => {
    expect(inspector("qr")).toMatch(/<button[^>]*disabled=""[^>]*>.*Quitar de esta receta/);
    expect(inspector("titulo")).not.toMatch(/<button[^>]*disabled=""[^>]*title="El QR/);
  });

  it("el problema del borrador se lee en el inspector", () => {
    const html = inspector("qr", { notas: { noDibujado: null, avisos: [], problemas: ["Margen fuera de rango."] } });
    expect(html).toContain("Margen fuera de rango.");
    expect(html).toContain('role="alert"');
  });
});

describe("AjustesDelBloque", () => {
  // Todo lo que el inspector sabe editar, para que cada control se pinte.
  const TODO = ["binding", "text", "fields", "rows", "labels", "max_lines", "correction", "quiet_zone", "assets", "align", "max_height_mm"];
  const ajustes = (pageId: string) => {
    const footer = (pageId === "ficha" ? FICHA : CROQUIS).blocks.find((b) => b.block_id === "footer")!;
    return renderToStaticMarkup(<AjustesDelBloque pageId={pageId} block={{ ...footer, text: "Pie" }} editable={TODO} onCambiar={noop} />);
  };
  const ids = (html: string) => [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);

  it("los ids son únicos por cara y bloque, y nunca interpolan un objeto", () => {
    // `footer` está en frente y dorso: su block_id sólo es único dentro de la cara.
    const todos = [...ids(ajustes("ficha")), ...ids(ajustes("croquis"))];
    expect(todos.length).toBeGreaterThan(0);
    expect(new Set(todos).size).toBe(todos.length);
    for (const id of todos) expect(id).not.toMatch(/object|\s/);
    expect(todos).toContain("rec-ed-ajuste-ficha-footer-text");
    expect(todos).toContain("rec-ed-ajuste-croquis-footer-text");
  });

  it("cada control tiene nombre accesible: label asociado, aria-label o grupo rotulado", () => {
    const html = ajustes("ficha");
    const conId = new Set(ids(html));
    const controles = [...html.matchAll(/<(textarea|select|input)\b([^>]*)>/g)];
    expect(controles.some((m) => m[1] === "textarea")).toBe(true);
    for (const [, tag, attrs] of controles) {
      const id = /\sid="([^"]+)"/.exec(attrs)?.[1];
      const conLabel = id ? html.includes(`for="${id}"`) : false;
      const conAria = /aria-label="[^"]+"/.test(attrs);
      // Los checkboxes van envueltos en su <label>.
      const envuelto = tag === "input" && /type="checkbox"/.test(attrs);
      expect(conLabel || conAria || envuelto, `${tag} ${attrs}`).toBe(true);
    }
    expect(html).toMatch(/<label[^>]*for="rec-ed-ajuste-ficha-footer-text"[^>]*>Texto<\/label>/);
    for (const [, ref] of html.matchAll(/aria-labelledby="([^"]+)"/g)) expect(conId.has(ref)).toBe(true);
  });
});

describe("SelectorDeUnidad", () => {
  const unidad = (unit_id: string, legacy_ref: string, role: string): CollectionUnit => ({
    unit_id, label: `curso-${unit_id}`, role, dimensions: { legacy_ref },
  });

  it("nombra las unidades con su código operativo, agrupadas por rol", () => {
    const html = renderToStaticMarkup(
      <SelectorDeUnidad
        units={[unidad("u1", "CH 1", "titular"), unidad("u2", "R 1.2", "chain_reserve")]}
        valor={null}
        usada={{ source: "plan", unit_id: "u1", label: "CH 1" }}
        onCambiar={noop}
      />,
    );
    expect(html).toContain("Primera titular (CH 1)");
    expect(html).toContain('<optgroup label="Titulares"><option value="u1">CH 1</option>');
    expect(html).toContain('<optgroup label="Reemplazos"><option value="u2">R 1.2</option>');
    expect(html).not.toContain("curso-u1");
  });

  it("sin plan dice «Unidad de ejemplo» y lleva a Unidades", () => {
    const html = renderToStaticMarkup(<SelectorDeUnidad units={null} valor={null} usada={null} onCambiar={noop} onIrAUnidades={noop} />);
    expect(html).toContain("Unidad de ejemplo");
    expect(html).toContain("Ir a Unidades");
  });
});

describe("BarraDelEditor", () => {
  const barra = (extra: Partial<Parameters<typeof BarraDelEditor>[0]> = {}) => renderToStaticMarkup(
    <BarraDelEditor
      nombre="Ficha de campo con croquis"
      onIrAlCatalogo={noop}
      caras={[{ value: "ficha", label: "Frente" }, { value: "croquis", label: "Dorso" }]}
      caraActiva="croquis"
      onCara={noop}
      unidad={null}
      revision={7}
      conCambios
      puedeDeshacer
      puedeRehacer={false}
      onDeshacer={noop}
      onRehacer={noop}
      guardando={false}
      puedeGuardar
      onGuardar={noop}
      confirmacion={null}
      onConfirmar={noop}
      onCancelar={noop}
      {...extra}
    />,
  );

  it("Catálogo / tipo, las caras, la revisión y la insignia", () => {
    const html = barra();
    expect(html).toContain("Catálogo");
    expect(html).toContain("Ficha de campo con croquis");
    expect(html).toMatch(/role="radio" aria-checked="true"[^>]*>Dorso/);
    expect(html).toContain("revisión 7");
    expect(html).toContain("cambios sin guardar");
    expect(html).toContain("Guardar receta");
  });

  it("sin cambios, «Guardar receta» se apaga y dice por qué", () => {
    const html = barra({ conCambios: false, puedeGuardar: false, motivoSinGuardar: "Sin cambios que guardar" });
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*title="Sin cambios que guardar"[^>]*>.*Guardar receta/);
    expect(barra()).not.toContain("Sin cambios que guardar");
  });

  it("sin cambios no hay insignia; con fichas creadas, guardar avisa antes", () => {
    expect(barra({ conCambios: false })).not.toContain("cambios sin guardar");
    const html = barra({ confirmacion: "Las 193 fichas creadas habrá que generarlas de nuevo." });
    expect(html).toContain("Las 193 fichas creadas habrá que generarlas de nuevo.");
    expect(html).toContain("Guardar igual");
    expect(html).not.toContain("Guardar receta");
  });
});

describe("contratos del editor", () => {
  it("el inspector del bloque está declarado en el manifiesto de Material de campo", () => {
    expect(PANELES_POR_MODULO["material-campo"]).toContainEqual(PANEL_EDITOR_BLOQUE);
    expect(PANEL_EDITOR_BLOQUE).toEqual({ id: "bloque", label: "Bloque de la receta", clase: "inspector" });
  });

  it("el editor no escribe `panel`: el bloque lo elige el foco", () => {
    const fuente = readFileSync(fileURLToPath(new URL("./EditorDeMaterial.tsx", import.meta.url)), "utf8");
    expect(fuente).not.toMatch(/panel\.(abrir|cerrar|alternar)\(/);
    expect(fuente).toMatch(/conNivel\(location\.search, "foco"/);
    // La unidad de prueba nunca viaja en la dirección.
    expect(fuente).not.toMatch(/conNivel\([^)]*unidad/);
  });

  it("ningún hook después del primer return (React #310)", () => {
    const fuente = readFileSync(fileURLToPath(new URL("./EditorDeMaterial.tsx", import.meta.url)), "utf8");
    const ini = fuente.indexOf("export function EditorDeMaterial(");
    const cuerpo = fuente.slice(ini, fuente.indexOf("\n}\n", ini));
    expect(cuerpo).toMatch(/if \(estado\.carga\.estado === "error"\) \{\s*return \(/);
    expect(hooksTrasElPrimerReturn(cuerpo)).toEqual([]);
  });
});
