// Contratos del re-QA visual e10 (rechazo 18/7): lo corregido que no debe volver.
// N1 íconos sin deformar · N4 cursor tras volverse chip · N5 campo no declarado
// · N6 deshacer por palabra · #8 el punto de la cabecera lleva a sus logos.
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { MailCheck, MailTemplate } from "../../../api/materialMail";
import { CampoConCampos } from "./CampoConCampos";
import { avisoDeCampoNoDeclarado, avisoDeVistaRetenida, camposNoDeclarados, clavesDeclaradas, rotuloDeClave } from "./camposDeclarados";
import { indiceDelChequeoDeLaZona } from "./chequeoDeLaZona";
import { domDePrueba, type NodoDePrueba } from "./domDePrueba.test-util";
import { HISTORIAL_VACIO, deshacer, edicionEntre, registrarCambio, type HistorialCorreo } from "./historialCorreo";
import { CABECERA } from "./modeloCorreo";
import { htmlDelChip, htmlDelTexto, puntoDelDesplazamiento, type OpcionesDeTexto } from "./serializarTexto";
import { ChequeosDelBloque } from "./TarjetaDidactica";
import { procesarEntrada } from "./volcadoDelCampo";

const AQUI = dirname(fileURLToPath(import.meta.url));
const leer = (archivo: string) => readFileSync(join(AQUI, archivo), "utf8");

const PLANTILLA: MailTemplate = {
  schema: "collection_mail_template/v2",
  template_id: "correo",
  revision: 1,
  subject: "Asunto",
  preheader: "",
  theme: { accent: "#0b1f54" },
  header: { kind: "logos", logo_ids: ["pulso"], background: "dark" },
  images: { pulso: { alt: "Pulso PUCP" } },
  fields: [{ key: "enlace", label: "Enlace a la encuesta", tag: "ENLACE" }],
  blocks: [
    { block_id: "saludo", type: "greeting", text: "Hola {{nombre}}", fallback: "Hola:" },
    { block_id: "texto", type: "paragraph", text: "Tu carrera: {{carrera}}." },
  ],
};

const ROTULO = (k: string) => (k === "nombre" ? "Nombre" : PLANTILLA.fields.find((f) => f.key === k)?.label ?? rotuloDeClave(k));
const DECLARADAS = clavesDeclaradas(PLANTILLA);
const OPCIONES: OpcionesDeTexto = { enlaces: false, multilinea: false, rotuloDeCampo: ROTULO, campoValido: (k) => DECLARADAS.has(k) };

describe("N1 · ningún ícono del editor se encoge", () => {
  it("la hoja de íconos fija flex-shrink: 0 y proporción cuadrada a todo svg.lucide del editor", () => {
    const css = leer("correosIconos.css");
    expect(css).toMatch(/svg\.lucide\s*\{[^}]*flex-shrink:\s*0;/);
    expect(css).toMatch(/svg\.lucide\s*\{[^}]*aspect-ratio:\s*1 \/ 1;/);
    for (const prefijo of ["rec-mail", "rec-capa", "rec-trato", "rec-bib", "rec-camp"]) expect(css).toContain(`[class*="${prefijo}"]`);
    expect(leer("CorreosEditor.tsx")).toContain('import "./correosIconos.css";');
    expect(leer("../campanas/ListaDeCampanas.tsx")).toContain('import "../correos/correosIconos.css";');
  });

  it("ninguna regla del editor le da a un svg permiso para encogerse o estirarse", () => {
    const hojas = readdirSync(AQUI).filter((f) => f.endsWith(".css"));
    for (const hoja of hojas) {
      const reglas = leer(hoja).match(/[^{}]*svg[^{}]*\{[^}]*\}/g) ?? [];
      for (const regla of reglas) {
        expect(regla, `${hoja}: ${regla.trim().slice(0, 80)}`).not.toMatch(/flex(-shrink)?:\s*(?!none|0\b)[1-9]/);
        expect(regla, `${hoja}: ${regla.trim().slice(0, 80)}`).not.toMatch(/\bwidth:\s*(auto|\d+%)/);
      }
    }
  });

  it("el aviso del saludo con texto largo dibuja su ícono cuadrado", () => {
    const largo: MailCheck = { code: "greeting_trato", status: "warning", value: 0, detail: "El saludo dirá «Estimado(a)» a todos los destinatarios de la lista, sin importar el sexo de cada persona registrada.", items: [], targets: [{ block_id: "saludo" }] };
    const html = renderToStaticMarkup(<ChequeosDelBloque chequeos={[largo]} />);
    const svgs = [...html.matchAll(/<svg[^>]*>/g)].map((m) => m[0]);
    expect(svgs.length).toBe(1);
    for (const svg of svgs) {
      expect(svg).toMatch(/class="lucide/);
      const w = svg.match(/width="(\d+)"/)?.[1];
      const h = svg.match(/height="(\d+)"/)?.[1];
      expect(w).toBeTruthy();
      expect(w).toBe(h);
    }
  });
});

describe("N4 · una llave tecleada se vuelve chip y el cursor sigue tras lo escrito", () => {
  it("monta con «Hola {{nombre}}», muestra el chip «Nombre» y repone el cursor al volcar", () => {
    const raiz = domDePrueba(htmlDelTexto("Hola {{nombre}}", OPCIONES));
    const chip = raiz.querySelector("[data-campo]");
    expect(chip?.textContent).toBe("Nombre");
    expect(chip?.getAttribute("class")).toBe("rec-capa-chip");

    // Lo que deja el navegador al teclear « {{enlace}}» después del chip: un nodo de texto nuevo.
    const escrito = domDePrueba(" {{enlace}}").childNodes[0];
    escrito.parentNode = raiz;
    raiz.childNodes.push(escrito);
    const onCambio = vi.fn();
    const out = procesarEntrada({
      raiz: raiz as unknown as Node,
      cursor: { nodo: escrito as unknown as Node, offset: (escrito.nodeValue ?? "").length },
      opciones: OPCIONES,
      ultimo: "Hola {{nombre}}",
      onCambio,
    });

    expect(onCambio).toHaveBeenCalledTimes(1);
    expect(onCambio).toHaveBeenCalledWith("Hola {{nombre}} {{enlace}}");
    expect(out.repintar).not.toBeNull();
    // «Hola » (5) + chip + « » + chip: el cursor queda después del segundo chip, no al principio.
    expect(out.repintar!.cursor).toBe(8);
    const repintado = domDePrueba(out.repintar!.html);
    const punto = puntoDelDesplazamiento(repintado as unknown as Node, out.repintar!.cursor!);
    const nodo = punto.nodo as unknown as NodoDePrueba;
    const antes = nodo.childNodes.slice(0, punto.offset);
    expect(antes.at(-1)?.getAttribute("data-campo")).toBe("enlace");
  });

  it("en medio del texto, el cursor queda justo después del chip nuevo («ZEstimado…» no vuelve)", () => {
    const raiz = domDePrueba(htmlDelTexto("Hola {{nombre}}, qué tal", OPCIONES));
    // Se teclea «{{enlace}}» tras «Hola »: el primer nodo de texto pasa a «Hola {{enlace}}».
    const primero = raiz.childNodes[0];
    primero.nodeValue = "Hola {{enlace}}";
    const onCambio = vi.fn();
    const out = procesarEntrada({ raiz: raiz as unknown as Node, cursor: { nodo: primero as unknown as Node, offset: 15 }, opciones: OPCIONES, ultimo: null, onCambio });
    expect(onCambio).toHaveBeenCalledWith("Hola {{enlace}}{{nombre}}, qué tal");
    expect(out.repintar!.cursor).toBe(6);
    expect(out.repintar!.cursor).not.toBe(0);
  });

  it("sin llave escrita no se repinta: el cursor del navegador manda", () => {
    const raiz = domDePrueba(htmlDelTexto("Hola {{nombre}}", OPCIONES));
    const onCambio = vi.fn();
    const out = procesarEntrada({ raiz: raiz as unknown as Node, cursor: null, opciones: OPCIONES, ultimo: "Hola {{nombre}}", onCambio });
    expect(out.repintar).toBeNull();
    expect(onCambio).not.toHaveBeenCalled();
  });
});

describe("N5 · un campo que la campaña no declara", () => {
  it("se detecta en los bloques y en el envío; «nombre» y los campos declarados valen", () => {
    expect(camposNoDeclarados(PLANTILLA)).toEqual(["carrera"]);
    expect(camposNoDeclarados({ ...PLANTILLA, blocks: [PLANTILLA.blocks[0]] }, { subject: "Hola {{facultad}}" })).toEqual(["facultad"]);
    expect(camposNoDeclarados({ ...PLANTILLA, blocks: [PLANTILLA.blocks[0]] })).toEqual([]);
  });

  it("el chip sale en tono de error, con su rótulo y sin llaves", () => {
    const chip = htmlDelChip("carrera", OPCIONES);
    expect(chip).toContain('class="rec-capa-chip is-invalido"');
    expect(chip).toContain(">Carrera<");
    expect(chip).not.toMatch(/\{\{|\}\}/);
    expect(htmlDelChip("nombre", OPCIONES)).toContain('class="rec-capa-chip"');
  });

  it("el campo del inspector dice cuál falta y lleva a Personas, sin llaves", () => {
    const html = renderToStaticMarkup(
      <CampoConCampos label="Texto" valor="Hola {{carrera}}" opciones={OPCIONES} onCambio={() => {}} onIrAPersonas={() => {}}
        problemas={[{ path: "blocks[0].text", code: "unknown_field", detail: "{{carrera}} no es un campo declarado." }]} />,
    );
    expect(html).toContain("Carrera no es un campo de esta campaña: agrégalo en ");
    expect(html).toMatch(/<button[^>]*class="rec-mail-link"[^>]*>Personas<\/button> o quítalo\./);
    expect(html).toContain('role="alert"');
    expect(html).not.toMatch(/\{\{|\}\}/);
    expect(avisoDeCampoNoDeclarado("Carrera")).toBe("Carrera no es un campo de esta campaña: agrégalo en Personas o quítalo.");
  });

  it("el lienzo dice por qué la vista previa no cambió", () => {
    expect(avisoDeVistaRetenida(["Carrera"])).toMatch(/última versión.*Carrera no es un campo de esta campaña\.$/);
    expect(avisoDeVistaRetenida(["Carrera", "Facultad"])).toMatch(/Carrera y Facultad no son campos/);
  });

  it("la vista previa y la revisión no se piden con un campo no declarado", () => {
    const hook = leer("useCorreos.ts");
    const guardas = hook.match(/if \(camposNoDeclarados\(template, envioElegido\(s\.getState\(\)\)\)\.length\)/g) ?? [];
    expect(guardas.length).toBe(2);
    // La guarda va antes del pedido: la vista previa queda con la última buena.
    expect(hook.indexOf("vistaPreviaRetenida()")).toBeLessThan(hook.indexOf('apiMailPreview({ mode: "preview"'));
  });
});

describe("N6 · deshacer quita la última palabra, no el campo entero", () => {
  const conTexto = (texto: string): MailTemplate => ({ ...PLANTILLA, blocks: [{ ...PLANTILLA.blocks[0], text: texto } as MailTemplate["blocks"][number]] });
  const escribir = (h: HistorialCorreo, previo: string, siguiente: string, ahora: number) =>
    registrarCambio(h, conTexto(previo), { texto: "saludo.text", ahora, antes: JSON.stringify(conTexto(previo)), despues: JSON.stringify(conTexto(siguiente)) });

  it("qué cambió entre dos textos", () => {
    expect(edicionEntre("Hola", "Hola a")).toEqual({ clase: "escribir", puesto: " a" });
    expect(edicionEntre("Hola a", "Hola")).toEqual({ clase: "borrar", puesto: "" });
    expect(edicionEntre("Hola", "Hela").clase).toBe("reemplazar");
  });

  it("escribir de corrido dos palabras deja dos entradas; un clic deshace sólo la última", () => {
    const pasos = ["Hola", "Hola ", "Hola m", "Hola mu", "Hola mun", "Hola mund", "Hola mundo"];
    let h = HISTORIAL_VACIO;
    let previo = "Hol";
    pasos.forEach((t, i) => { h = escribir(h, previo, t, i * 100); previo = t; });
    expect(h.pasado.length).toBe(2);
    const atras = deshacer(h, conTexto("Hola mundo"))!;
    const texto = (t: MailTemplate) => (t.blocks[0] as { text: string }).text;
    expect(texto(atras.presente)).toBe("Hola ");
  });

  it("pasar de escribir a borrar abre otra entrada aunque no haya pausa", () => {
    let h = escribir(HISTORIAL_VACIO, "Hol", "Hola", 0);
    h = escribir(h, "Hola", "Hol", 100);
    h = escribir(h, "Hol", "Ho", 200);
    expect(h.pasado.length).toBe(2);
  });
});

describe("#8 · el punto de la cabecera lleva a «Logos e imágenes subidos»", () => {
  const chk = (code: MailCheck["code"], ...zonas: string[]): MailCheck => ({ code, status: "error", value: 1, detail: "", items: [], targets: zonas.map((block_id) => ({ block_id })) });
  const fallas = [chk("placeholders_pending", CABECERA, "texto"), chk("images_available", CABECERA)];

  it("prioriza el chequeo propio del tipo de la zona", () => {
    expect(indiceDelChequeoDeLaZona(fallas, CABECERA, CABECERA)).toBe(1);
  });

  it("si la zona no tiene uno propio, el primero que la nombra", () => {
    expect(indiceDelChequeoDeLaZona(fallas, "texto", "paragraph")).toBe(0);
    expect(indiceDelChequeoDeLaZona(fallas, "otro", "paragraph")).toBe(-1);
  });
});
