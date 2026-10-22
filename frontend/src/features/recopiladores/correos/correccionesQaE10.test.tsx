// Contratos del rechazo visual e10 del editor de correos: lo que se corrigió
// y no debe volver (#4, #6, #7, #9, #11, #12, #13, #14).
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { MailCheck, MailRecipientsTrato, MailTrato, MailTwoImagesBlock } from "../../../api/materialMail";
import { CUANDO_USARLO, DESCRIPCION_CORTA } from "./BibliotecaDeBloques";
import { CampoConCampos } from "./CampoConCampos";
import { causaDelChequeo } from "./comoArreglar";
import { MARGEN_DE_LAS_ACCIONES, lugarDeLasAcciones, rectDelPunto } from "./lugarDeLasAcciones";
import { notasDeLectura } from "./modeloCorreo";
import { fraseDelTrato, lineaDelTrato } from "./modeloTrato";
import { fraseDeNitidez } from "./nitidez";
import { VerLosPuntos } from "./VerLosPuntos";

const JERGA = /\*\||\|\*|\{\{|\}\}/;

describe("#7 → N2/N3 · la barra del bloque elegido va encima de su borde superior", () => {
  const ancho = 200;

  it("encima del bloque, pegada a su borde, aunque el bloque sea alto (Dos imágenes)", () => {
    const zona = { x: 0, y: 300, w: 600, h: 620 };
    const { lugar, rect } = lugarDeLasAcciones({ zona, ancho, visible: { arriba: 0, abajo: 600 } });
    expect(lugar).toBe("arriba");
    expect(rect.y + rect.h + MARGEN_DE_LAS_ACCIONES).toBe(zona.y);
  });

  it("si encima no se ve, se oculta (#2 del re-QA e10-2); con el foco dentro, baja a lo más alto visible sin salirse del bloque", () => {
    const zona = { x: 0, y: 100, w: 600, h: 620 };
    const { lugar, rect, respaldo } = lugarDeLasAcciones({ zona, ancho, visible: { arriba: 180, abajo: 700 } });
    expect(lugar).toBe("oculta");
    expect(rect.y + respaldo).toBe(180);
    const fin = lugarDeLasAcciones({ zona, ancho, visible: { arriba: 760, abajo: 1200 } });
    expect(fin.rect.y + fin.respaldo).toBeGreaterThanOrEqual(760);
  });

  it("nunca tapa el punto de aviso de la esquina", () => {
    const zona = { x: 0, y: 300, w: 600, h: 44 };
    const { rect } = lugarDeLasAcciones({ zona, ancho, visible: { arriba: 0, abajo: 900 } });
    const punto = rectDelPunto(zona);
    expect(rect.x + rect.w).toBeLessThan(punto.x);
  });
});

describe("#9 · la nitidez dice cuál imagen y de cuántos px subirla", () => {
  const par: MailTwoImagesBlock = { block_id: "two-images-1", type: "two_images", left: "izq", right: "der", alt_left: "", alt_right: "" };
  const check = (items: MailCheck["items"]): MailCheck => ({ code: "image_width", status: "warning", value: items.length, detail: "Imágenes mostradas a más de la mitad…", items, targets: [] });

  it("un lado", () => {
    expect(fraseDeNitidez(check([{ id: "izq", block_id: "two-images-1", width: 280, natural: 300 }]), par))
      .toBe("La imagen de la izquierda es chica: súbela de al menos 560 px de ancho.");
  });

  it("los dos lados, con el mayor mínimo", () => {
    expect(fraseDeNitidez(check([
      { id: "izq", block_id: "two-images-1", width: 280, natural: 300 },
      { id: "der", block_id: "two-images-1", width: 290, natural: 100 },
    ]), par)).toBe("Las dos imágenes son chicas: súbelas de al menos 580 px de ancho.");
  });

  it("otro bloque u otro chequeo: nada", () => {
    expect(fraseDeNitidez(check([{ id: "x", block_id: "otro", width: 280, natural: 300 }]), par)).toBeNull();
    expect(fraseDeNitidez({ ...check([]), code: "images_alt" }, par)).toBeNull();
  });
});

describe("#11 · el saludo por sexo sin partes en cero ni paréntesis", () => {
  const trato: MailTrato = { modo: "por_sexo", masculino: "Estimado", femenino: "Estimada", respaldo: "Estimado(a)", columna: "sexo" };
  const lista = (counts: NonNullable<MailRecipientsTrato["counts"]>): MailRecipientsTrato => ({
    block_id: "saludo", columna: "sexo", presente: true, lectura: "m_f", counts, no_reconocidos: [], palabras: null,
  });

  it("omite las palabras con 0", () => {
    const t = lista({ efectivos: 4, masculino: 1, femenino: 2, sin_dato: 1, no_reconocido: 0 });
    expect(fraseDelTrato(t, trato)).toBe("«Estimado» a 1, «Estimada» a 2 y «Estimado(a)» a 1 sin dato.");
    expect(lineaDelTrato(lista({ efectivos: 2, masculino: 0, femenino: 2, sin_dato: 0, no_reconocido: 0 }), trato)).toBe("Estimada a 2");
  });

  it("la Revisión se queda con la primera frase del backend", () => {
    const detail = "1 de 4 destinatarios recibirán «Estimado(a)»: 1 sin dato y 0 con un valor que no se reconoce. «Estimado» a 1 y «Estimada» a 2 (la columna trae M y F: M se lee como masculino).";
    expect(causaDelChequeo({ code: "greeting_trato", status: "warning", detail })).toBe("1 de 4 destinatarios recibirán «Estimado(a)».");
  });
});

describe("#4 · #5 · #6 · campos y descripciones sin jerga", () => {
  it("el texto del saludo muestra el chip «Nombre», no la llave", () => {
    const html = renderToStaticMarkup(
      <CampoConCampos label="Texto" valor="Estimado(a) {{nombre}}:" opciones={{ rotuloDeCampo: () => "Nombre", ayudaDeCampo: () => "Nombre: cambia con cada persona" }} onCambio={() => undefined} />,
    );
    // El DOM del chip se pinta al montar; en el servidor queda la caja con su rótulo.
    expect(html).toContain('role="textbox"');
    expect(html).not.toMatch(JERGA);
  });

  it("las descripciones de la biblioteca son una idea de ≤ 48 caracteres, sin llaves", () => {
    for (const [tipo, texto] of Object.entries(DESCRIPCION_CORTA)) {
      expect(texto.length, tipo).toBeLessThanOrEqual(48);
      expect(texto, tipo).not.toMatch(JERGA);
    }
    expect(CUANDO_USARLO.greeting).not.toMatch(JERGA);
  });
});

describe("#12 · #13 · lectura de la lista y salida a la Revisión", () => {
  it("UTF-8 no se dice; otra codificación sí", () => {
    expect(notasDeLectura("utf-8", null)).toEqual([]);
    expect(notasDeLectura("windows-1252", null)).toEqual(["Leído como Windows-1252"]);
  });

  it("«Ver los N puntos ›» en lugar de «están en la pestaña Revisión»", () => {
    const html = renderToStaticMarkup(<VerLosPuntos errores={3} onVer={() => undefined} />);
    expect(html).toContain("Ver los 3 puntos");
    expect(html).not.toContain("pestaña Revisión");
    expect(renderToStaticMarkup(<VerLosPuntos errores={1} onVer={() => undefined} />)).toContain("Ver el punto");
  });
});
