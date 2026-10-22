// Contratos del rechazo visual e10 del editor de correos: lo que se corrigió
// y no debe volver (#4, #6, #7, #9, #11, #12, #13, #14).
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { MailCheck, MailRecipientsTrato, MailTrato, MailTwoImagesBlock } from "../../../api/materialMail";
import { CUANDO_USARLO, DESCRIPCION_CORTA } from "./BibliotecaDeBloques";
import { CampoConCampos } from "./CampoConCampos";
import { causaDelChequeo } from "./comoArreglar";
import { lugarDeLasAcciones, rectDeLasAcciones } from "./lugarDeLasAcciones";
import { notasDeLectura } from "./modeloCorreo";
import { fraseDelTrato, lineaDelTrato } from "./modeloTrato";
import { fraseDeNitidez } from "./nitidez";
import { VerLosPuntos } from "./VerLosPuntos";

const JERGA = /\*\||\|\*|\{\{|\}\}/;

describe("#7 · la barra del bloque elegido no tapa texto ni imágenes", () => {
  const zona = { x: 0, y: 200, w: 600, h: 300 };
  const ancho = 200;

  it("encima, si el renglón anterior no llega hasta ella", () => {
    const renglonCorto = { x: 40, y: 170, w: 200, h: 18 };
    expect(lugarDeLasAcciones({ zona, ocupados: [renglonCorto], ancho, altoDeLaHoja: 1000 })).toBe("arriba");
  });

  it("si el renglón anterior llega al borde, prueba dentro y después abajo", () => {
    const renglonLargo = { x: 40, y: 170, w: 540, h: 18 };
    expect(lugarDeLasAcciones({ zona, ocupados: [renglonLargo], ancho, altoDeLaHoja: 1000 })).toBe("dentro");
    const primeraLinea = { x: 40, y: 210, w: 540, h: 18 };
    expect(lugarDeLasAcciones({ zona, ocupados: [renglonLargo, primeraLinea], ancho, altoDeLaHoja: 1000 })).toBe("abajo");
  });

  it("nunca se sale de la hoja: arriba del primer bloque no cuenta", () => {
    const primera = { x: 0, y: 10, w: 600, h: 100 };
    expect(lugarDeLasAcciones({ zona: primera, ocupados: [], ancho, altoDeLaHoja: 1000 })).toBe("dentro");
    expect(rectDeLasAcciones(zona, "arriba", ancho).y + 32).toBeLessThanOrEqual(zona.y);
  });

  it("si todo está ocupado, el lugar que menos tapa", () => {
    const todo = { x: 0, y: 0, w: 600, h: 1000 };
    const poco = { x: 0, y: 500, w: 600, h: 40 };
    expect(lugarDeLasAcciones({ zona, ocupados: [todo, poco], ancho, altoDeLaHoja: 1000 })).toBe("arriba");
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
