import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type KeyboardEvent, type MouseEvent } from "react";

import { isOpaqueMailBlock, type MailBlock, type MailTemplate } from "../../../api/materialMail";
import { ArrowDown, ArrowUp, CircleAlert, GripVertical, ImagePlus, Plus, Trash2, TriangleAlert } from "../../../vendor/lucide-react";
import { ARRASTRE_DE_BLOQUE, BibliotecaDeBloques } from "./BibliotecaDeBloques";
import { admiteEnlaces } from "./comoSaleEnLaPlataforma";
import { EditorEnLinea, type MotivoDeFin } from "./EditorEnLinea";
import {
  APERTURA,
  editableEnElSitio,
  esMovible,
  esMultilinea,
  huecoMasCercano,
  huecoMueve,
  huecosEntreZonas,
  indiceDesdeHueco,
  logosDeLaCabecera,
  propConIndice,
  propEnElPunto,
  textoDeZona,
  tipoDisponible,
  zonasDeLaVista,
  type ChequeosDeZona,
  type Hueco,
  type LogoMedido,
  type Rect,
  type ZonaMedida,
} from "./estructuraCorreo";
import { anchoDelChip, lugarDelChip, type LugarDelChip } from "./chipDeApertura";
import { useTopeDeLaBarra } from "./topeDeLaBarra";
import { anchoDeLasAcciones, areaVisibleDeLaCapa, lugarDeLasAcciones, type AreaVisible } from "./lugarDeLasAcciones";
import type { CampoDelMenu } from "./MenuDeCampos";
import { CABECERA, DESCRIPCION_DE_BLOQUE, ROTULO_DE_PROP, puedeMover, rotuloDeBloque, rotuloDeChequeo, type PropDeTexto } from "./modeloCorreo";
import { esInsertable, ladosDelPar, type LadoDelPar, type LadoMedido, type TipoInsertable } from "./piezasGraficas";
import type { OpcionesDeTexto } from "./serializarTexto";
import { nombreDeImagen } from "./nombresDeImagen";
import type { EdicionEnLinea } from "./store";
import "./correosCapa.css";
import "./correosIdentidad.css";

/** Tipo MIME del arrastre de un bloque que ya está en el correo. */
const ARRASTRE_DE_MOVER = "application/x-pulso-mover";
const ANCHO_DE_BIBLIOTECA = 560;

type Props = {
  /** Documento del iframe de la vista previa (sin scripts, mismo origen). */
  doc: Document | null;
  /** Sube con cada carga del iframe o cambio de tamaño: hay que volver a medir. */
  medida: number;
  escala: number;
  /** Tamaño de la hoja ya a escala. */
  ancho: number;
  alto: number;
  template: MailTemplate;
  seleccion: string;
  edicion: EdicionEnLinea | null;
  explicaciones: boolean;
  chequeos: Record<string, ChequeosDeZona>;
  campos: readonly CampoDelMenu[];
  textoDeCampo: Pick<OpcionesDeTexto, "rotuloDeCampo" | "ayudaDeCampo" | "campoValido">;
  /** Apertura del envío elegido (`send.opening`); `null` si no se edita aquí. */
  apertura: string | null;
  /** Rótulo del envío dueño de la apertura, para su chip («Sólo en Recordatorio 1»). */
  envioDeApertura?: string;
  onSeleccionar: (id: string) => void;
  onEditar: (edicion: EdicionEnLinea | null) => void;
  onTexto: (zona: string, prop: string, valor: string) => void;
  onSiguientePunto: (zona: string, prop: string) => void;
  onQuitarPunto: (zona: string, prop: string) => void;
  onTerminar: (zona: string, prop: string) => void;
  onMover: (blockId: string, indice: number) => void;
  onInsertar: (type: TipoInsertable, hueco: number) => void;
  onQuitar: (blockId: string) => void;
  /** Con `lado`, el archivo es de un lado de un par de imágenes. */
  onArchivoDeImagen: (blockId: string, file: File, lado?: LadoDelPar) => void;
  /** Sube el logo de la franja con su id, igual que en Identidad. */
  onArchivoDeLogo?: (logoId: string, file: File) => void;
  onDeshacer: () => void;
  onRehacer: () => void;
  /** Abre la Revisión con lo que marca el punto de la zona. */
  onVerRevision?: (zona: string) => void;
};

/** Lo que dice el punto de la zona, en palabras: «1 por corregir», «2 avisos». */
function textoDelPunto(cuenta: ChequeosDeZona): string {
  const partes: string[] = [];
  if (cuenta.errores) partes.push(`${cuenta.errores} por corregir`);
  if (cuenta.avisos) partes.push(`${cuenta.avisos} ${cuenta.avisos === 1 ? "aviso" : "avisos"}`);
  return partes.join(" y ");
}

function estiloDeZona(r: Rect): CSSProperties {
  return { left: r.x, top: r.y, width: r.w, height: r.h };
}

function rotuloDeZona(zona: ZonaMedida, block: MailBlock | undefined): string {
  if (zona.id === CABECERA) return "Cabecera";
  if (zona.id === APERTURA) return "Apertura del envío";
  return block ? rotuloDeBloque(block) : zona.tipo;
}

function descripcionDeZona(zona: ZonaMedida, block: MailBlock | undefined): string {
  if (zona.id === CABECERA) return "Logos o banner del estudio, siempre arriba.";
  if (zona.id === APERTURA) return "Un párrafo que sólo lleva este envío.";
  if (!block || isOpaqueMailBlock(block)) return "Se conserva tal cual.";
  return DESCRIPCION_DE_BLOQUE[block.type];
}

/** Color de fondo efectivo de un elemento del iframe (sube hasta uno que no sea transparente). */
function fondoDe(el: Element, ventana: Window): string {
  let actual: Element | null = el;
  while (actual) {
    const bg = ventana.getComputedStyle(actual).backgroundColor;
    if (bg && bg !== "transparent" && !/rgba\(\s*0,\s*0,\s*0,\s*0\s*\)/.test(bg)) return bg;
    actual = actual.parentElement;
  }
  return "#ffffff";
}

function elementoDeProp(doc: Document, zona: string, prop: string): HTMLElement | null {
  const fila = doc.querySelector<HTMLElement>(`[data-pulso-block="${CSS.escape(zona)}"]`);
  if (!fila) return null;
  if (fila.getAttribute("data-pulso-prop") === prop) return (fila as HTMLTableRowElement).cells?.[0] ?? fila;
  return fila.querySelector<HTMLElement>(`[data-pulso-prop="${CSS.escape(prop)}"]`);
}

/** La tipografía del texto del correo, copiada al editor y llevada a escala. */
function tipografiaDe(el: HTMLElement, escala: number): CSSProperties {
  const ventana = el.ownerDocument.defaultView;
  if (!ventana) return {};
  const cs = ventana.getComputedStyle(el);
  const px = (v: string) => (Number.isFinite(parseFloat(v)) ? `${parseFloat(v) * escala}px` : undefined);
  return {
    fontFamily: cs.fontFamily,
    fontSize: px(cs.fontSize),
    lineHeight: cs.lineHeight === "normal" ? "normal" : px(cs.lineHeight),
    fontWeight: cs.fontWeight as CSSProperties["fontWeight"],
    color: cs.color,
    textAlign: cs.textAlign as CSSProperties["textAlign"],
    letterSpacing: px(cs.letterSpacing),
    paddingTop: px(cs.paddingTop),
    paddingRight: px(cs.paddingRight),
    paddingBottom: px(cs.paddingBottom),
    paddingLeft: px(cs.paddingLeft),
    background: fondoDe(el, ventana),
  };
}

/**
 * Capa de edición sobre el correo (E1g §1).
 *
 * Vive en el documento padre, dentro de `.rec-mail-hoja`, sobre el iframe de
 * la vista previa. Cada zona que el render marca (`data-pulso-block`) es un
 * botón medido con `getBoundingClientRect()` × escala; se vuelve a medir en
 * cada carga del iframe, al cambiar de tamaño y al cambiar de vista. El
 * HTML que se exporta lo sigue escribiendo sólo el render: la capa nunca toca
 * el documento salvo para ocultar el texto que se está editando.
 */
export function CapaDeEdicion({
  doc,
  medida,
  escala,
  ancho,
  alto,
  template,
  seleccion,
  edicion,
  explicaciones,
  chequeos,
  campos,
  textoDeCampo,
  apertura,
  envioDeApertura,
  onSeleccionar,
  onEditar,
  onTexto,
  onSiguientePunto,
  onQuitarPunto,
  onTerminar,
  onMover,
  onInsertar,
  onQuitar,
  onArchivoDeImagen,
  onArchivoDeLogo,
  onDeshacer,
  onRehacer,
  onVerRevision,
}: Props) {
  const raiz = useRef<HTMLDivElement | null>(null);
  const archivo = useRef<HTMLInputElement | null>(null);
  const imagenPedida = useRef<{ tipo: "bloque" | "logo"; id: string; lado?: LadoDelPar } | null>(null);
  const [zonas, setZonas] = useState<ZonaMedida[]>([]);
  const [logos, setLogos] = useState<LogoMedido[]>([]);
  const [pares, setPares] = useState<{ id: string; lados: LadoMedido[] }[]>([]);
  const [biblioteca, setBiblioteca] = useState<Hueco | null>(null);
  const [destino, setDestino] = useState<(Hueco & { tipo: "mover" | "insertar" }) | null>(null);
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const templateRef = useRef(template);
  templateRef.current = template;

  const porId = useMemo(() => new Map(template.blocks.map((b) => [b.block_id, b])), [template.blocks]);

  // Medir: al cargar el iframe, al cambiar de escala o de vista.
  const logoIds = template.header.kind === "logos" ? template.header.logo_ids : null;
  useLayoutEffect(() => {
    if (!doc) {
      setZonas([]);
      setLogos([]);
      setPares([]);
      return;
    }
    setZonas(zonasDeLaVista(doc, templateRef.current, escala));
    // Cada lado sin archivo de un par de imágenes ofrece subirlo ahí mismo.
    setPares(templateRef.current.blocks.filter((b) => b.type === "two_images").map((b) => ({ id: b.block_id, lados: ladosDelPar(doc, b.block_id, escala) })));
    // H3: cada logo sin archivo de la franja ofrece subirlo ahí mismo.
    setLogos(logoIds ? logosDeLaCabecera(doc, logoIds, escala) : []);
  }, [doc, medida, escala, logoIds]);

  const huecos = useMemo(() => huecosEntreZonas(zonas, template), [template, zonas]);

  // El chip de la apertura va donde no tape el texto (chipDeApertura.ts).
  const textoDelChip = envioDeApertura ? `Sólo en ${envioDeApertura}` : "Sólo en este envío";
  const [primeraLinea, setPrimeraLinea] = useState<Rect | null>(null);
  useLayoutEffect(() => {
    const el = doc?.querySelector(`[data-pulso-block="${APERTURA}"]`);
    if (!doc || !el) {
      setPrimeraLinea(null);
      return;
    }
    const rango = doc.createRange();
    rango.selectNodeContents(el);
    const linea = Array.from(rango.getClientRects()).find((r) => r.width > 0 && r.height > 0);
    setPrimeraLinea(linea ? { x: linea.left * escala, y: linea.top * escala, w: linea.width * escala, h: linea.height * escala } : null);
  }, [apertura, doc, escala, medida]);
  const lugarDelChipDeApertura = useMemo((): LugarDelChip => {
    const at = zonas.findIndex((z) => z.id === APERTURA);
    if (at < 0) return null;
    const previa = at > 0 ? zonas[at - 1].rect : null;
    return lugarDelChip({
      zona: zonas[at].rect,
      primeraLinea,
      bordeDeArriba: previa ? previa.y + previa.h : null,
      anchoChip: anchoDelChip(textoDelChip),
    });
  }, [primeraLinea, textoDelChip, zonas]);

  // El texto que se edita se oculta en el iframe: el editor ocupa su lugar.
  useEffect(() => {
    if (!doc || !edicion) return;
    const el = elementoDeProp(doc, edicion.zona, edicion.prop);
    if (!el) return;
    const previo = el.style.visibility;
    el.style.visibility = "hidden";
    return () => { el.style.visibility = previo; };
  }, [doc, edicion, medida]);

  const puntoLocal = useCallback((clientX: number, clientY: number) => {
    const r = raiz.current?.getBoundingClientRect();
    return r ? { x: clientX - r.left, y: clientY - r.top } : { x: 0, y: 0 };
  }, []);

  const empezar = (zona: ZonaMedida, prop: string | null) => {
    const block = porId.get(zona.id);
    const id = zona.id === APERTURA ? null : zona.id;
    if (id && id !== seleccion) onSeleccionar(id);
    if (prop && (zona.id === APERTURA ? apertura !== null : editableEnElSitio(block, prop))) onEditar({ zona: zona.id, prop });
    else if (edicion) onEditar(null);
  };

  const alPulsarZona = (zona: ZonaMedida) => (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (event.detail === 0) {
      // Teclado: el primer Enter elige; el segundo edita el primer texto.
      // La apertura no es un bloque que se elija: su único texto se edita al primer Enter.
      const yaElegida = zona.id === seleccion || zona.id === APERTURA;
      const primero = zona.props.find((p) => (zona.id === APERTURA ? apertura !== null : editableEnElSitio(porId.get(zona.id), p.prop)));
      empezar(zona, yaElegida && primero ? primero.prop : null);
      return;
    }
    const { x, y } = puntoLocal(event.clientX, event.clientY);
    empezar(zona, propEnElPunto(zona, x, y));
  };

  const alTeclaEnZona = (zona: ZonaMedida) => (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
    const delta = event.key === "ArrowUp" ? -1 : 1;
    if (!esMovible(template, zona.id) || !puedeMover(template, zona.id, delta)) return;
    event.preventDefault();
    const i = template.blocks.findIndex((b) => b.block_id === zona.id);
    onMover(zona.id, i + delta);
  };

  // ---- arrastre ----------------------------------------------------------------

  const tipoDeArrastre = (event: DragEvent): "mover" | "insertar" | null => {
    const tipos = Array.from(event.dataTransfer.types);
    if (tipos.includes(ARRASTRE_DE_MOVER)) return "mover";
    if (tipos.includes(ARRASTRE_DE_BLOQUE)) return "insertar";
    return null;
  };

  const alArrastrarEncima = (event: DragEvent<HTMLDivElement>) => {
    const tipo = tipoDeArrastre(event);
    if (!tipo) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = tipo === "mover" ? "move" : "copy";
    const { y } = puntoLocal(event.clientX, event.clientY);
    const h = huecoMasCercano(huecos, y);
    if (!h) return;
    if (tipo === "mover" && arrastrando && !huecoMueve(template, arrastrando, h.hueco)) {
      setDestino(null);
      return;
    }
    if (!destino || destino.hueco !== h.hueco || destino.tipo !== tipo) setDestino({ ...h, tipo });
  };

  const alSoltar = (event: DragEvent<HTMLDivElement>) => {
    const tipo = tipoDeArrastre(event);
    if (!tipo) return;
    event.preventDefault();
    const { y } = puntoLocal(event.clientX, event.clientY);
    const h = destino ?? huecoMasCercano(huecos, y);
    setDestino(null);
    setArrastrando(null);
    if (!h) return;
    if (tipo === "mover") {
      const id = event.dataTransfer.getData(ARRASTRE_DE_MOVER);
      if (id && huecoMueve(template, id, h.hueco)) onMover(id, indiceDesdeHueco(template, id, h.hueco));
    } else {
      const type = event.dataTransfer.getData(ARRASTRE_DE_BLOQUE);
      if (esInsertable(type) && tipoDisponible(template, type)) {
        setBiblioteca(null);
        onInsertar(type, h.hueco);
      }
    }
  };

  const alSalir = (event: DragEvent<HTMLDivElement>) => {
    if (event.relatedTarget instanceof Node && raiz.current?.contains(event.relatedTarget)) return;
    setDestino(null);
  };

  // ---- editor ------------------------------------------------------------------

  const zonaEditada = edicion ? zonas.find((z) => z.id === edicion.zona) : undefined;
  const bloqueEditado = edicion ? porId.get(edicion.zona) : undefined;
  const rectDelEditor = useMemo((): Rect | null => {
    if (!edicion || !zonaEditada) return null;
    const propia = zonaEditada.props.find((p) => p.prop === edicion.prop);
    if (propia) return propia.rect;
    // Un punto recién creado todavía no está en la vista previa: va bajo el anterior.
    const { base, indice } = propConIndice(edicion.prop);
    if (indice !== null) {
      const previo = [...zonaEditada.props].reverse().find((p) => {
        const x = propConIndice(p.prop);
        return x.base === base && x.indice !== null && x.indice < indice;
      });
      if (previo) return { ...previo.rect, y: previo.rect.y + previo.rect.h + 2 };
    }
    return zonaEditada.rect;
  }, [edicion, zonaEditada]);

  const estiloDelEditor = useMemo((): CSSProperties => {
    if (!doc || !edicion) return {};
    let el = elementoDeProp(doc, edicion.zona, edicion.prop);
    if (!el) {
      const { base } = propConIndice(edicion.prop);
      el = doc.querySelector<HTMLElement>(`[data-pulso-block="${CSS.escape(edicion.zona)}"] [data-pulso-prop^="${CSS.escape(base)}."]`);
    }
    return el ? tipografiaDe(el, escala) : {};
    // `medida`: con cada carga del iframe el elemento es otro.
  }, [doc, edicion, escala, medida]);

  const valorEditado = useMemo(() => {
    if (!edicion) return "";
    if (edicion.zona === APERTURA) return apertura ?? "";
    return bloqueEditado ? textoDeZona(bloqueEditado, edicion.prop) : "";
  }, [apertura, bloqueEditado, edicion]);

  const opcionesDelEditor = useMemo((): OpcionesDeTexto | null => {
    if (!edicion) return null;
    const type = edicion.zona === APERTURA ? "paragraph" : bloqueEditado?.type ?? "";
    const { base } = propConIndice(edicion.prop);
    const enlaces = edicion.zona === APERTURA ? true : bloqueEditado ? admiteEnlaces(bloqueEditado.type, base) : false;
    return { ...textoDeCampo, enlaces, multilinea: esMultilinea(type, edicion.prop) };
  }, [bloqueEditado, edicion, textoDeCampo]);

  // Si el bloque editado desapareció (deshacer, quitar), el editor se cierra.
  useEffect(() => {
    if (edicion && edicion.zona !== APERTURA && !porId.has(edicion.zona)) onEditar(null);
  }, [edicion, onEditar, porId]);

  const terminar = (motivo: MotivoDeFin) => {
    if (!edicion) return;
    const actual = edicion;
    onTerminar(actual.zona, actual.prop);
    onEditar(null);
    if (motivo !== "fuera") {
      requestAnimationFrame(() => raiz.current?.querySelector<HTMLButtonElement>(`[data-zona="${CSS.escape(actual.zona)}"]`)?.focus({ preventScroll: true }));
    }
  };

  const etiquetaDelEditor = (() => {
    if (!edicion) return "";
    const { base, indice } = propConIndice(edicion.prop);
    const prop = (ROTULO_DE_PROP as Record<string, string>)[base as PropDeTexto] ?? base;
    const bloque = edicion.zona === APERTURA ? "Apertura" : bloqueEditado ? rotuloDeBloque(bloqueEditado) : "";
    return `${bloque}: ${prop}${indice !== null ? ` ${indice + 1}` : ""}`;
  })();

  const pedirImagen = (blockId: string, lado?: LadoDelPar) => {
    imagenPedida.current = { tipo: "bloque", id: blockId, lado };
    archivo.current?.click();
  };

  const pedirLogo = (logoId: string) => {
    imagenPedida.current = { tipo: "logo", id: logoId };
    archivo.current?.click();
  };

  const abrirBiblioteca = (h: Hueco) => {
    if (edicion) onEditar(null);
    setBiblioteca(h);
  };

  // Un clic fuera de la biblioteca la cierra.
  useEffect(() => {
    if (!biblioteca) return;
    const alPulsar = (event: globalThis.MouseEvent) => {
      const t = event.target as Element | null;
      if (t?.closest?.(".rec-bib, .rec-capa-hueco-btn")) return;
      setBiblioteca(null);
    };
    document.addEventListener("mousedown", alPulsar, true);
    return () => document.removeEventListener("mousedown", alPulsar, true);
  }, [biblioteca]);

  const anchoBib = Math.min(ANCHO_DE_BIBLIOTECA, Math.max(320, ancho - 16));
  const topeBib = useTopeDeLaBarra(raiz, Boolean(biblioteca));
  const bibArriba = biblioteca ? biblioteca.y > alto - 460 && biblioteca.y > 460 : false;
  const elegida = zonas.find((z) => z.id === seleccion && !edicion);
  const bloqueElegido = elegida ? porId.get(elegida.id) : undefined;
  const conAcciones = Boolean(elegida && bloqueElegido && elegida.id !== CABECERA && elegida.id !== APERTURA);
  const nombreElegido = bloqueElegido ? rotuloDeBloque(bloqueElegido) : "";
  const anchoAcciones = anchoDeLasAcciones(nombreElegido, elegida && esMovible(template, elegida.id) ? 4 : 1);

  // N2/N3: la barra del bloque elegido va encima de su borde superior; si ahí
  // no se ve, pegada a lo más alto visible del bloque. El área visible se
  // vuelve a medir al desplazar y al cambiar el tamaño de la ventana.
  const [visible, setVisible] = useState<AreaVisible | null>(null);
  useLayoutEffect(() => {
    const el = raiz.current;
    if (!el || !conAcciones) return;
    let cuadro = 0;
    const medir = () => {
      cuadro = 0;
      const area = areaVisibleDeLaCapa(el, document.querySelector(".rec-mail-barra"));
      setVisible((v) => (v && Math.abs(v.arriba - area.arriba) < 0.5 && Math.abs(v.abajo - area.abajo) < 0.5 ? v : area));
    };
    const pedir = () => { if (!cuadro) cuadro = requestAnimationFrame(medir); };
    medir();
    document.addEventListener("scroll", pedir, true);
    window.addEventListener("resize", pedir);
    return () => {
      if (cuadro) cancelAnimationFrame(cuadro);
      document.removeEventListener("scroll", pedir, true);
      window.removeEventListener("resize", pedir);
    };
  }, [conAcciones, medida, seleccion]);
  const acciones = elegida ? lugarDeLasAcciones({ zona: elegida.rect, ancho: anchoAcciones, visible }) : null;
  const lugarAcciones = acciones?.lugar ?? "arriba";
  const rectAcciones = acciones?.rect ?? null;

  return (
    <div
      ref={raiz}
      className={`rec-capa${explicaciones ? " is-explicando" : ""}${arrastrando ? " is-arrastrando" : ""}`}
      style={{ width: ancho, height: alto }}
      // El grupo se declara cuando sus zonas ya están medidas: antes de cargar el
      // iframe la capa no tiene miembros y el QA lo leía como grupo vacío.
      data-qa-geometry-group={zonas.length ? "material-campo/correo/zonas" : undefined}
      data-qa-geometry-contract={zonas.length ? "intrinsic" : undefined}
      onDragOver={alArrastrarEncima}
      onDrop={alSoltar}
      onDragLeave={alSalir}
    >
      {zonas.map((zona) => {
        const block = porId.get(zona.id);
        const rotulo = rotuloDeZona(zona, block);
        const cuenta = chequeos[zona.id];
        const esElegida = zona.id === seleccion;
        const sinArchivo = block?.type === "image" && !zona.conImagen;
        const editandoAqui = edicion?.zona === zona.id;
        const soloDelEnvio = zona.id === APERTURA && apertura === null;
        return (
          <div
            key={zona.id}
            // La apertura es sólo de este envío: el marco lo dice aunque el chip no quepa.
            className={`rec-capa-zona-marco${zona.id === APERTURA ? " is-solo-del-envio" : ""}`}
            style={estiloDeZona(zona.rect)}
            data-qa-geometry-member
          >
            <button
              type="button"
              className={[
                "rec-capa-zona",
                esElegida ? "is-elegida" : "",
                editandoAqui ? "is-editando" : "",
                arrastrando === zona.id ? "is-origen" : "",
                cuenta?.errores ? "is-error" : cuenta?.avisos ? "is-aviso" : "",
              ].filter(Boolean).join(" ")}
              data-zona={zona.id}
              data-qa-geometry-capacity="owned"
              aria-label={`${rotulo}${zona.id === APERTURA ? ` (${textoDelChip.toLocaleLowerCase("es-PE")})` : ""}${cuenta ? `, ${cuenta.errores + cuenta.avisos} por revisar` : ""}`}
              title={zona.id === APERTURA && !lugarDelChipDeApertura ? textoDelChip : undefined}
              aria-current={esElegida ? "true" : undefined}
              aria-describedby={explicaciones && !(esElegida && conAcciones) ? `rec-capa-desc-${zona.id}` : undefined}
              disabled={soloDelEnvio}
              onClick={alPulsarZona(zona)}
              onKeyDown={alTeclaEnZona(zona)}
            />
            {/* Una sola etiqueta: el bloque elegido ya se nombra en su barra (#7). */}
            {explicaciones && !(esElegida && conAcciones) ? (
              <span className="rec-capa-zona-rotulo" id={`rec-capa-desc-${zona.id}`} aria-hidden>
                <b>{rotulo}</b>
                <span>{descripcionDeZona(zona, block)}</span>
              </span>
            ) : null}
            {zona.id === APERTURA && lugarDelChipDeApertura ? (
              <span className={`rec-capa-zona-chip${lugarDelChipDeApertura === "arriba" ? " is-arriba" : ""}`}>{textoDelChip}</span>
            ) : null}
            {cuenta ? (
              <button
                type="button"
                className={`rec-capa-zona-cuenta${cuenta.errores ? " is-error" : " is-aviso"}`}
                title={`${textoDelPunto(cuenta)}: ${cuenta.chequeos.map((c) => rotuloDeChequeo(c)).join(" · ")}. Ver en Revisión`}
                aria-label={`${textoDelPunto(cuenta)} en ${rotulo}. Ver en Revisión`}
                onClick={() => onVerRevision?.(zona.id)}
              >
                {cuenta.errores ? <CircleAlert size={11} aria-hidden /> : <TriangleAlert size={11} aria-hidden />}
                {cuenta.errores + cuenta.avisos}
              </button>
            ) : null}
            {sinArchivo && !editandoAqui ? (
              <button type="button" className="rec-capa-subir" onClick={() => { onSeleccionar(zona.id); pedirImagen(zona.id); }}>
                <ImagePlus size={14} aria-hidden /> Subir imagen
              </button>
            ) : null}
          </div>
        );
      })}

      {onArchivoDeLogo && edicion?.zona !== CABECERA ? logos.filter((l) => !l.conImagen).map((l) => {
        const nombre = nombreDeImagen(template, l.id);
        return (
          <div key={`logo-${l.id}`} className="rec-capa-logo" style={estiloDeZona(l.rect)}>
            <button
              type="button"
              className="rec-capa-subir rec-capa-subir-logo"
              aria-label={`Subir el logo ${nombre}`}
              title={`Subir el logo ${nombre} (PNG o JPEG)`}
              onClick={() => { onSeleccionar(CABECERA); pedirLogo(l.id); }}
            >
              <ImagePlus size={13} aria-hidden /> Subir logo
            </button>
          </div>
        );
      }) : null}

      {pares.flatMap((par) => (edicion?.zona === par.id ? [] : par.lados.filter((l) => !l.conImagen).map((l) => (
        <div key={`par-${par.id}-${l.lado}`} className="rec-capa-logo" style={estiloDeZona(l.rect)}>
          <button
            type="button"
            className="rec-capa-subir rec-capa-subir-logo"
            aria-label={`Subir la imagen ${l.lado === "left" ? "izquierda" : "derecha"}`}
            title="Subir la imagen (PNG o JPEG)"
            onClick={() => { onSeleccionar(par.id); pedirImagen(par.id, l.lado); }}
          >
            <ImagePlus size={13} aria-hidden /> Subir imagen
          </button>
        </div>
      ))))}

      {elegida && conAcciones && rectAcciones ? (
        <div
          className={`rec-capa-acciones is-${lugarAcciones}`}
          // Anclada por su borde derecho: el ancho real puede diferir de la estimación.
          style={{ left: rectAcciones.x + rectAcciones.w, top: rectAcciones.y }}
          role="toolbar"
          aria-label={`Acciones de ${rotuloDeZona(elegida, bloqueElegido)}`}
        >
          <span className="rec-capa-acciones-rotulo" title={descripcionDeZona(elegida, bloqueElegido)}>{nombreElegido}</span>
          {esMovible(template, elegida.id) ? (
            <>
              <button
                type="button"
                className="rec-capa-accion rec-capa-manija"
                draggable
                aria-label="Arrastrar para mover (o Alt + flechas)"
                title="Arrastra para mover"
                onDragStart={(event) => {
                  event.dataTransfer.setData(ARRASTRE_DE_MOVER, elegida.id);
                  event.dataTransfer.setData("text/plain", elegida.id);
                  event.dataTransfer.effectAllowed = "move";
                  setArrastrando(elegida.id);
                }}
                onDragEnd={() => { setArrastrando(null); setDestino(null); }}
              >
                <GripVertical size={14} aria-hidden />
              </button>
              <button type="button" className="rec-capa-accion" aria-label="Subir el bloque" title="Subir" disabled={!puedeMover(template, elegida.id, -1)} onClick={() => onMover(elegida.id, template.blocks.findIndex((b) => b.block_id === elegida.id) - 1)}>
                <ArrowUp size={14} aria-hidden />
              </button>
              <button
                type="button"
                className="rec-capa-accion"
                aria-label="Bajar el bloque"
                title="Bajar"
                disabled={!puedeMover(template, elegida.id, 1) || template.blocks[template.blocks.findIndex((b) => b.block_id === elegida.id) + 1]?.type === "footer_legal"}
                onClick={() => onMover(elegida.id, template.blocks.findIndex((b) => b.block_id === elegida.id) + 1)}
              >
                <ArrowDown size={14} aria-hidden />
              </button>
            </>
          ) : null}
          <button type="button" className="rec-capa-accion is-peligro" aria-label="Quitar el bloque" title="Quitar" disabled={template.blocks.length <= 1} onClick={() => onQuitar(elegida.id)}>
            <Trash2 size={14} aria-hidden />
          </button>
        </div>
      ) : null}

      {!arrastrando && !edicion ? huecos.map((h) => (
        <div key={`hueco-${h.hueco}`} className={`rec-capa-hueco${biblioteca?.hueco === h.hueco ? " is-abierto" : ""}`} style={{ top: h.y, left: h.x, width: h.w }}>
          <button
            type="button"
            className="rec-capa-hueco-btn"
            aria-label="Insertar un bloque aquí"
            aria-expanded={biblioteca?.hueco === h.hueco}
            title="Insertar un bloque aquí"
            onClick={() => abrirBiblioteca(h)}
          >
            <Plus size={13} aria-hidden />
          </button>
        </div>
      )) : null}

      {destino ? (
        <div className={`rec-capa-destino is-${destino.tipo}`} style={{ top: destino.y, left: destino.x, width: destino.w }} aria-hidden>
          <span>{destino.tipo === "mover" ? "Soltar aquí" : "Insertar aquí"}</span>
        </div>
      ) : null}

      {edicion && rectDelEditor && opcionesDelEditor ? (
        <EditorEnLinea
          key={`${edicion.zona}:${edicion.prop}`}
          valor={valorEditado}
          opciones={opcionesDelEditor}
          campos={campos}
          rect={rectDelEditor}
          estilo={estiloDelEditor}
          anchoDeLaCapa={ancho}
          etiqueta={etiquetaDelEditor}
          esPunto={propConIndice(edicion.prop).indice !== null}
          onCambio={(valor) => onTexto(edicion.zona, edicion.prop, valor)}
          onTerminar={terminar}
          onSiguientePunto={() => onSiguientePunto(edicion.zona, edicion.prop)}
          onQuitarPunto={() => onQuitarPunto(edicion.zona, edicion.prop)}
          onDeshacer={onDeshacer}
          onRehacer={onRehacer}
        />
      ) : null}

      {biblioteca ? (
        <BibliotecaDeBloques
          template={template}
          titulo="Insertar aquí"
          arriba={bibArriba}
          // #17: su cabecera pegada queda bajo la barra del correo, no debajo de ella.
          estilo={{ left: Math.max(8, (ancho - anchoBib) / 2), top: bibArriba ? biblioteca.y - 14 : biblioteca.y + 14, width: anchoBib, "--rec-bib-tope": `${topeBib}px` } as CSSProperties}
          onElegir={(type) => {
            const h = biblioteca.hueco;
            setBiblioteca(null);
            onInsertar(type, h);
          }}
          onCerrar={() => {
            const h = biblioteca.hueco;
            setBiblioteca(null);
            requestAnimationFrame(() => raiz.current?.querySelectorAll<HTMLButtonElement>(".rec-capa-hueco-btn")[huecos.findIndex((x) => x.hueco === h)]?.focus());
          }}
        />
      ) : null}

      <input
        ref={archivo}
        type="file"
        accept="image/png,image/jpeg"
        className="pulso-sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          const pedida = imagenPedida.current;
          event.target.value = "";
          if (!file || !pedida) return;
          if (pedida.tipo === "logo") onArchivoDeLogo?.(pedida.id, file);
          else onArchivoDeImagen(pedida.id, file, pedida.lado);
        }}
      />
    </div>
  );
}
