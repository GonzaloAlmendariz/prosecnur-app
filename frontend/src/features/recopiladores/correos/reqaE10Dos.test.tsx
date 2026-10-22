// Contratos del re-QA e10-2 del editor de correos: lo que se corrigió y no
// debe volver (#1 el inspector sin asteriscos ni llaves, #2 la barra del
// bloque no tapa su texto, #3 la cabecera de la biblioteca, #4 la Revisión del
// saludo con columna, #5 la jerga en los mensajes).
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { MailCheck, MailReview, MailTemplate } from "../../../api/materialMail";
import { arregloEnLaRevision } from "./comoArreglar";
import { lugarDeLasAcciones, MARGEN_DE_LAS_ACCIONES } from "./lugarDeLasAcciones";
import { MenuDeCampos } from "./MenuDeCampos";
import { conTexto, enlaceParaLaPersona, insertarToken, repartirProblemas, textoDe } from "./modeloCorreo";
import { PanelDeBloque } from "./PanelDeBloque";
import { PanelRevision, salidaDelChequeo } from "./PanelRevision";
import { htmlDelTexto, textoDelDom, type OpcionesDeTexto } from "./serializarTexto";
import { cabezaSinLugar } from "./topeDeLaBarra";
import { cursorEnElContrato, hayNodoAjeno, procesarEntrada, visibleAntesDelCursor } from "./volcadoDelCampo";
import { domDePrueba } from "./domDePrueba.test-util";

const JERGA = /\*\||\|\*|\{\{|\}\}/;

const CAMPOS = {
  rotuloDeCampo: (k: string) => (k === "nombre" ? "Nombre" : k === "carrera" ? "Carrera" : k),
  ayudaDeCampo: (k: string) => `${k}: cambia con cada persona`,
  campoValido: (k: string) => k === "nombre" || k === "carrera",
};
const PARRAFO: OpcionesDeTexto = { ...CAMPOS, enlaces: true, multilinea: true };
const TITULO: OpcionesDeTexto = { ...CAMPOS, enlaces: false, multilinea: false };

const PLANTILLA: MailTemplate = {
  schema: "collection_mail_template/v1",
  template_id: "correo",
  preset_id: "recuperacion_estudiantes_v1",
  title: "Recuperación",
  revision: 1,
  subject: "Asunto",
  preheader: "",
  theme: { accent: "#0b1f54" },
  header: { kind: "logos", logo_ids: ["pulso"], background: "dark" },
  images: { pulso: { alt: "Pulso PUCP" } },
  fields: [{ key: "carrera", tag: "CARRERA", label: "Carrera", fallback: "su carrera" }],
  blocks: [
    { block_id: "saludo", type: "greeting", text: "Estimado(a) {{nombre}}:", trato: { modo: "por_sexo", columna: "sexo", masculino: "Estimado", femenino: "Estimada", respaldo: "Estimado(a)" } },
    { block_id: "motivo", type: "paragraph", text: "Te escribimos por **tu carrera**, {{carrera}}.\nEs *breve*." },
    { block_id: "titulo", type: "heading", text: "Tu **opinión** cuenta" },
    { block_id: "aviso", type: "callout", title: "Antes de **empezar**", items: ["Dura **10** minutos", "Es anónima para {{carrera}}"] },
    { block_id: "accion", type: "button", text: "Responder **ya**", url: "https://x.org/{{carrera}}", note: ["Hasta el *viernes*"] },
    { block_id: "firma", type: "signature", closing: "Saludos,", name: "**Pulso** PUCP", lines: ["Instituto"] },
  ],
};

const noop = () => {};

function inspector(seleccion: string): string {
  return renderToStaticMarkup(
    <PanelDeBloque
      template={PLANTILLA}
      seleccion={seleccion}
      problemas={repartirProblemas([], PLANTILLA)}
      persona={null}
      onEditar={noop}
      onEditarBloque={noop}
      onDestino={noop}
      onMover={noop}
      onQuitar={noop}
      onAbrirIdentidad={noop}
    />,
  );
}

describe("#1 · el texto de un bloque en el inspector se ve como en el lienzo", () => {
  it("negrita y cursiva son formato, el campo es un chip: ni asteriscos ni llaves a la vista", () => {
    const texto = textoDe(PLANTILLA.blocks[1], "text");
    const dom = domDePrueba(htmlDelTexto(texto, PARRAFO));
    expect(dom.querySelector("strong")?.textContent).toBe("tu carrera");
    expect(dom.querySelector("em")?.textContent).toBe("breve");
    expect(dom.querySelector("[data-campo]")?.textContent).toBe("Carrera");
    expect(dom.querySelectorAll("br")).toHaveLength(1);
    expect(dom.textContent).not.toMatch(/\*|\{\{|\}\}/);
  });

  it("vuelve al contrato con el mismo serializador del lienzo, idéntico, en cada bloque con texto", () => {
    const casos: [string, OpcionesDeTexto][] = [
      [textoDe(PLANTILLA.blocks[1], "text"), PARRAFO],
      [textoDe(PLANTILLA.blocks[2], "text"), TITULO],
      [textoDe(PLANTILLA.blocks[3], "items"), PARRAFO],
      [textoDe(PLANTILLA.blocks[4], "text"), TITULO],
      [textoDe(PLANTILLA.blocks[4], "note"), { ...TITULO, multilinea: true }],
      [textoDe(PLANTILLA.blocks[5], "name"), TITULO],
      ["Un [enlace **fuerte**](https://x.org/{{carrera}}) y 5\\*3", PARRAFO],
    ];
    for (const [texto, opciones] of casos) {
      expect(textoDelDom(domDePrueba(htmlDelTexto(texto, opciones)) as unknown as Node, opciones)).toBe(texto);
    }
  });

  it("Enter en un párrafo es un salto; el `<div>` que deja Chrome se repinta como `<br>` con el cursor en su renglón", () => {
    const raiz = domDePrueba("Uno<div><b>Dos</b> fin</div>");
    const fin = raiz.childNodes[1].childNodes[1];
    const out = procesarEntrada({ raiz: raiz as unknown as Node, cursor: { nodo: fin as unknown as Node, offset: 4 }, opciones: PARRAFO, ultimo: "Uno", onCambio: noop });
    expect(out.texto).toBe("Uno\n**Dos** fin");
    expect(out.repintar?.html).toBe("Uno<br><strong>Dos</strong> fin");
    // «Uno» + salto + «Dos fin»: el cursor queda tras «fin».
    expect(out.repintar?.cursor).toBe(11);
    expect(visibleAntesDelCursor(raiz as unknown as Node, fin as unknown as Node, 4)).toHaveLength(11);
  });

  it("sólo se repinta lo que sale del DOM permitido", () => {
    expect(hayNodoAjeno(domDePrueba(htmlDelTexto("**a** *b* {{carrera}}<", PARRAFO)) as unknown as Node)).toBe(false);
    expect(hayNodoAjeno(domDePrueba("a<span>b</span>") as unknown as Node)).toBe(true);
    expect(hayNodoAjeno(domDePrueba("<b>a<font>b</font></b>") as unknown as Node)).toBe(true);
  });

  it("un campo insertado con el cursor dentro de una negrita queda dentro de ella, sin partir la marca", () => {
    const completo = "Te escribo por **tu carrera** hoy";
    // Lo que hay antes del cursor, dentro de la negrita: «**tu car**».
    const cursor = cursorEnElContrato("Te escribo por **tu car**", completo);
    expect(cursor).toBe("Te escribo por **tu car".length);
    const { valor } = insertarToken(completo, cursor, "carrera");
    const dom = domDePrueba(htmlDelTexto(valor, PARRAFO));
    expect(dom.querySelector("strong")?.querySelector("[data-campo]")?.textContent).toBe("Carrera");
    expect(dom.textContent).not.toMatch(/\*/);
    // En el borde de una marca o tras un asterisco de texto no se parte nada.
    expect(cursorEnElContrato("**a**", "**a** b")).toBe(5);
    expect(cursorEnElContrato("5\\", "5\\*3")).toBe(1);
  });

  it("una lista guarda sin el espacio recién tecleado: lo escrito ya guardado no se repinta", () => {
    const aviso = PLANTILLA.blocks[3];
    const escrito = "Dura **10** minutos \nEs anónima";
    const guardado = textoDe(conTexto(aviso, "items", escrito), "items");
    expect(guardado).toBe("Dura **10** minutos\nEs anónima");
    // El inspector compara con esta misma normalización (PanelDeBloque › normalizar).
    expect(textoDe(conTexto(aviso, "items", escrito), "items")).toBe(guardado);
  });

  it("párrafo, título, aviso, botón y firma usan el campo con chips; la dirección y el respaldo, una caja simple", () => {
    for (const id of ["motivo", "titulo", "aviso", "accion", "firma"]) {
      const html = inspector(id);
      expect(html).not.toContain("<textarea");
      expect(html).toContain('role="textbox"');
      expect(html).toContain('aria-label="Negrita"');
    }
    expect(inspector("motivo")).toContain('aria-multiline="true"');
    expect(inspector("titulo")).not.toContain('aria-multiline="true"');
    expect(inspector("aviso")).toContain('aria-multiline="true"');
    // La dirección del botón: campo con chips, sin formato ni letra de texto corrido.
    expect(inspector("accion")).not.toMatch(/<input[^>]*value="[^"]*\{\{/);
    expect(inspector("accion")).toMatch(/rec-mail-input--campos is-mono/);
  });

  it("la dirección de un enlace conserva sus asteriscos y muestra el campo como chip", () => {
    const url = "https://x.org/r/*abc*?c={{carrera}}";
    const plano: OpcionesDeTexto = { ...TITULO, sinMarcas: true };
    const dom = domDePrueba(htmlDelTexto(url, plano));
    expect(dom.querySelector("em")).toBeNull();
    expect(dom.querySelector("[data-campo]")?.textContent).toBe("Carrera");
    expect(dom.textContent).not.toMatch(/\{\{|\}\}/);
    expect(textoDelDom(dom as unknown as Node, plano)).toBe(url);
  });

  it("el nombre accesible del texto es su rótulo, sin los botones de formato", () => {
    const html = inspector("motivo");
    const id = html.match(/role="textbox" aria-labelledby="([^"]+)"/)?.[1];
    expect(id).toBeTruthy();
    expect(html).toContain(`<span id="${id}">Texto</span>`);
  });
});

describe("#2 · la barra del bloque nunca se queda sobre su texto", () => {
  const ancho = 170;

  it("si encima del bloque no se ve, se oculta (y con el foco dentro baja a lo más alto visible)", () => {
    const zona = { x: 0, y: 100, w: 600, h: 300 };
    const { lugar, rect, respaldo } = lugarDeLasAcciones({ zona, ancho, visible: { arriba: 180, abajo: 700 } });
    expect(lugar).toBe("oculta");
    // Oculta, sigue encima del bloque: se va con él mientras se desvanece.
    expect(rect.y + rect.h + MARGEN_DE_LAS_ACCIONES).toBe(zona.y);
    expect(rect.y + respaldo).toBe(180);
  });

  it("el borde del bloque a la vista pero sin sitio encima también la oculta: no tapa el primer renglón", () => {
    const zona = { x: 0, y: 190, w: 600, h: 300 };
    expect(lugarDeLasAcciones({ zona, ancho, visible: { arriba: 180, abajo: 700 } }).lugar).toBe("oculta");
  });

  it("al subir y haber sitio encima, vuelve sobre el borde del bloque", () => {
    const zona = { x: 0, y: 260, w: 600, h: 300 };
    const { lugar, rect, respaldo } = lugarDeLasAcciones({ zona, ancho, visible: { arriba: 180, abajo: 700 } });
    expect(lugar).toBe("arriba");
    expect(respaldo).toBe(0);
    expect(rect.y + rect.h + MARGEN_DE_LAS_ACCIONES).toBe(zona.y);
  });

  it("un bloque que empieza bajo lo visible tampoco deja la barra encima de otro", () => {
    const zona = { x: 0, y: 900, w: 600, h: 200 };
    expect(lugarDeLasAcciones({ zona, ancho, visible: { arriba: 0, abajo: 700 } }).lugar).toBe("oculta");
  });
});

describe("#3 · la cabecera de la biblioteca no se mete bajo la barra del correo", () => {
  it("se oculta cuando lo que queda de la biblioteca a la vista es más bajo que ella", () => {
    // 1024 × 600 al final del desplazamiento: la caja termina en 161 y la barra en 133.
    expect(cabezaSinLugar({ abajoDeLaCaja: 161, altoDeLaCabeza: 47, arribaVisible: 133 })).toBe(true);
    expect(cabezaSinLugar({ abajoDeLaCaja: 400, altoDeLaCabeza: 47, arribaVisible: 133 })).toBe(false);
    expect(cabezaSinLugar({ abajoDeLaCaja: 180, altoDeLaCabeza: 47, arribaVisible: 133 })).toBe(false);
  });
});

describe("#4 · con la columna de sexo elegida, la Revisión no pide elegirla", () => {
  const aviso: MailCheck = {
    code: "greeting_trato",
    status: "warning",
    value: 1,
    detail: "1 de 6 destinatarios recibirán «Estimado(a)»: 1 sin dato y 0 con un valor que no se reconoce. «Estimado» a 3 y «Estimada» a 2 (M/F).",
    items: [],
    targets: [{ block_id: "saludo" }],
  };
  const revision = (check: MailCheck): MailReview => ({ ok: false, errors: check.status === "error" ? 1 : 0, warnings: check.status === "warning" ? 1 : 0, checks: [check] }) as unknown as MailReview;

  it("el botón va al saludo y el arreglo dice qué completar", () => {
    expect(salidaDelChequeo("greeting_trato", "saludo", undefined, { columnaElegida: true })).toEqual({ texto: "Ir al saludo" });
    expect(arregloEnLaRevision("greeting_trato", { columnaElegida: true })).toMatch(/Completa o corrige el sexo/);
    const html = renderToStaticMarkup(<PanelRevision revision={revision(aviso)} cargando={false} template={PLANTILLA} onIrAlBloque={noop} />);
    expect(html).not.toContain("Elegir columna");
    expect(html).toContain("Ir al saludo");
    expect(html).toContain("1 de 6 destinatarios recibirán «Estimado(a)».");
  });

  it("sin columna, o con una que no está en la lista, sí ofrece elegirla", () => {
    const sinColumna: MailTemplate = { ...PLANTILLA, blocks: [{ block_id: "saludo", type: "greeting", text: "Estimado(a) {{nombre}}:" }] };
    expect(renderToStaticMarkup(<PanelRevision revision={revision(aviso)} cargando={false} template={sinColumna} onIrAlBloque={noop} />)).toContain("Elegir columna");
    const fuera: MailCheck = { ...aviso, status: "error", detail: "La columna «sexo» del saludo no está en la lista importada: elige la columna de sexo de esta lista." };
    expect(renderToStaticMarkup(<PanelRevision revision={revision(fuera)} cargando={false} template={PLANTILLA} onIrAlBloque={noop} />)).toContain("Elegir columna");
  });
});

describe("#5 · sin llaves ni etiquetas de plataforma", () => {
  it("el menú de campos dice que sale con el dato de cada persona, no `*|CARRERA|*`", () => {
    const html = renderToStaticMarkup(
      <MenuDeCampos campos={[{ key: "nombre", label: "Nombre", ejemplo: "Ana" }, { key: "carrera", label: "Carrera" }]} estilo={{}} onElegir={noop} onCerrar={noop} />,
    );
    expect(html).toContain("Sale con el dato de cada persona.");
    expect(html).toContain("Ana");
    expect(html).not.toMatch(JERGA);
  });

  it("el enlace de la persona sin dato ni respaldo muestra el rótulo del campo", () => {
    const e = enlaceParaLaPersona("https://x.org/{{codigo}}", { nombre: "Ana", fields: {} }, [{ key: "codigo", tag: "CODIGO", label: "Código" }]);
    expect(e.tramos[1]).toEqual({ texto: "Código", campo: true });
    expect(e.completo).not.toMatch(JERGA);
  });
});
