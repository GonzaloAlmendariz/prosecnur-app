import { Maximize2 } from "../../../../vendor/lucide-react";
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import "../../../../app/tokens-datos.css";
import "./lienzoMapa.css";
import {
  aMundo,
  aPantalla,
  acotarACaja,
  arrastre,
  cajaVisible,
  debeVolar,
  DURACION_VUELO_MS,
  encuadre,
  escalaGrafica,
  interpolar,
  zoomRueda,
  type Caja,
  type Camara,
  type Tamano,
} from "./camara";
import { nivelDensidad, visibles, type Pieza, type PiezaManzana, type PiezasDistrito } from "./piezas";

/**
 * Lienzo cartográfico de Hojas de ruta (ADR 0114 §1). Dibuja en Canvas los
 * distritos que recibe (manzanas, zonas, vías mayores) y deja que la sección
 * pinte encima lo suyo (titulares, reemplazos, rótulos) con `dibujarMundo` y
 * `dibujarPantalla`.
 *
 * Rendimiento, medido en el prototipo: un trazo por pieza, recorte a lo
 * visible y una capa base en un lienzo aparte. Mientras se arrastra, se hace
 * zoom o la cámara vuela, la capa base se reutiliza escalada si dibujarla
 * costó más de 18 ms, y se repinta nítida al detenerse.
 */

export type CapaLienzo = "manzanas" | "viviendas" | "nse";

export type ColoresLienzo = {
  fondo: string;
  /** El mar bajo el relieve sombreado. */
  mar: string;
  distrito: string;
  distritoBorde: string;
  manzana: string;
  manzanaLejos: string;
  manzanaBorde: string;
  zona: string;
  via: string;
  viaBorde: string;
  reemplazo: string;
  reemplazoBorde: string;
  /** Contexto OSM (P9): parques y plazas, agua. */
  verde: string;
  agua: string;
  texto: string;
  suave: string;
  acento: string;
  aviso: string;
  error: string;
  densidad: string[];
  nse: string[];
  /** Identidad por distrito (B9), en el orden de confirmación. */
  tonos: string[];
};

export type UtilLienzo = {
  camara: Camara;
  tamano: Tamano;
  colores: ColoresLienzo;
  /** Un píxel de pantalla, en metros del mundo: para grosores constantes. */
  px: number;
  aPantalla: (x: number, y: number) => [number, number];
  trazo: (pieza: Pieza) => Path2D;
};

/** `tapadoAbajo`: fracción del alto que tapa algo superpuesto (el cajón de Selección). */
export type EncuadreLienzo = { caja: Caja; pad?: number; clave: string; animar?: boolean; tapadoAbajo?: number };

type Props = {
  distritos: readonly PiezasDistrito[];
  capa: CapaLienzo;
  /** Cada vez que cambia `clave`, la cámara vuela a la caja. */
  encuadreObjetivo?: EncuadreLienzo | null;
  /** Relleno de una manzana según el estado de la sección; `null` deja el de la capa. */
  colorManzana?: (manzana: PiezaManzana, lejos: boolean) => string | null;
  /** Lo que va debajo de las manzanas, dentro de la capa base (contornos de distritos). */
  dibujarFondo?: (ctx: CanvasRenderingContext2D, util: UtilLienzo) => void;
  /** Lo que la sección dibuja en coordenadas de mundo (metros). */
  dibujarMundo?: (ctx: CanvasRenderingContext2D, util: UtilLienzo) => void;
  /** Lo que la sección dibuja en coordenadas de pantalla (rótulos, pastillas). */
  dibujarPantalla?: (ctx: CanvasRenderingContext2D, util: UtilLienzo) => void;
  alClic?: (mundo: [number, number], util: UtilLienzo) => void;
  alMover?: (mundo: [number, number] | null, util: UtilLienzo) => void;
  /** Súbelo para que la capa base se vuelva a dibujar (cambió un color de la sección). */
  version?: number;
  ariaLabel: string;
  className?: string;
  /** Cápsula arriba a la izquierda: dónde está el usuario y qué puede hacer (brecha B6). */
  miga?: ReactNode;
  /** Leyenda abajo a la izquierda: qué significa cada color de la sección (brecha B8). */
  leyenda?: ReactNode;
  /** Controles arriba a la derecha (selector de capas, brecha B7). */
  controles?: ReactNode;
  /**
   * Lo que se muestra junto al cursor (el distrito bajo el mouse). Va sobre el mapa y no en el
   * inspector, que saltaba con cada distrito al pasar el mouse (revisión de UI, 2 nov 2026).
   */
  rotuloCursor?: ReactNode;
  /** Punto del mundo al que se acercan «+» y «−» (la UMP enfocada); sin él, el centro. */
  anclaZoom?: readonly [number, number] | null;
  /** Ficha flotante bajo la miga (la del distrito en la vista nacional). */
  ficha?: ReactNode;
  /** Caja de la que la cámara no sale ni se aleja (la ciudad abierta); `null`, sin límite. */
  limiteCamara?: { caja: Caja; pad?: number } | null;
};

const COSTO_PARA_REUTILIZAR_MS = 18;
const REPOSO_MS = 170;

function leerColores(): ColoresLienzo {
  const css = getComputedStyle(document.documentElement);
  const v = (nombre: string) => css.getPropertyValue(nombre).trim();
  return {
    fondo: v("--pulso-mapa-fondo"),
    mar: v("--pulso-mapa-mar"),
    distrito: v("--pulso-mapa-distrito"),
    distritoBorde: v("--pulso-mapa-distrito-borde"),
    manzana: v("--pulso-mapa-manzana"),
    manzanaLejos: v("--pulso-mapa-manzana-lejos"),
    manzanaBorde: v("--pulso-mapa-manzana-borde"),
    zona: v("--pulso-mapa-zona"),
    via: v("--pulso-mapa-via"),
    viaBorde: v("--pulso-mapa-via-borde"),
    reemplazo: v("--pulso-mapa-reemplazo"),
    reemplazoBorde: v("--pulso-mapa-reemplazo-borde"),
    verde: v("--pulso-success-bg"),
    agua: v("--pulso-info-bg"),
    texto: v("--pulso-text"),
    suave: v("--pulso-text-soft"),
    acento: v("--pulso-module-routes"),
    aviso: v("--pulso-warn-accent"),
    error: v("--pulso-danger-fg"),
    // la densidad arranca en blanco para «sin viviendas» y sigue la intensidad de un tono; el NSE es divergente
    densidad: ["--pulso-surface", "--pulso-mapa-viv-1", "--pulso-mapa-viv-2", "--pulso-mapa-viv-3", "--pulso-mapa-viv-4", "--pulso-mapa-viv-5", "--pulso-mapa-viv-6"].map(v),
    nse: ["--pulso-nse-0", "--pulso-nse-1", "--pulso-nse-2", "--pulso-nse-3", "--pulso-nse-4", "--pulso-nse-5"].map(v),
    tonos: ["--pulso-mapa-tono-0", "--pulso-mapa-tono-1", "--pulso-mapa-tono-2", "--pulso-mapa-tono-3", "--pulso-mapa-tono-4", "--pulso-mapa-tono-5", "--pulso-mapa-tono-6", "--pulso-mapa-tono-7"].map(v),
  };
}

function trazar(p: Path2D, anillo: number[], cerrar: boolean) {
  p.moveTo(anillo[0], anillo[1]);
  for (let i = 2; i < anillo.length - 1; i += 2) p.lineTo(anillo[i], anillo[i + 1]);
  if (cerrar) p.closePath();
}

function trazoDe(pieza: Pieza, cerrar = true): Path2D {
  if (!pieza.trazo) {
    const p = new Path2D();
    for (const r of pieza.anillos) trazar(p, r, cerrar);
    pieza.trazo = p;
  }
  return pieza.trazo;
}

/** La marca de QA del vuelo: «false» mientras la cámara vuela, «lienzo» cuando se detiene o la corta el usuario. */
const marcarVuelo = (nodo: HTMLSpanElement | null, volando: boolean) => nodo?.setAttribute("data-audit-ready", volando ? "false" : "lienzo");

export function LienzoMapa({
  distritos,
  capa,
  encuadreObjetivo,
  colorManzana,
  dibujarFondo,
  dibujarMundo,
  dibujarPantalla,
  alClic,
  alMover,
  rotuloCursor,
  version = 0,
  ariaLabel,
  className,
  miga,
  leyenda,
  controles,
  anclaZoom = null,
  ficha,
  limiteCamara = null,
}: Props) {
  const lienzoRef = useRef<HTMLCanvasElement | null>(null);
  const limiteRef = useRef(limiteCamara);
  limiteRef.current = limiteCamara;
  const escalaRef = useRef<HTMLDivElement | null>(null);
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const estado = useRef({
    camara: { x: 0, y: 0, s: 0.02 } as Camara,
    tamano: { w: 0, h: 0 } as Tamano,
    dpr: 1,
    colores: null as ColoresLienzo | null,
    snap: null as (Camara & Tamano) | null,
    baseSucia: true,
    costoBase: 0,
    interactuando: 0,
    vuelo: 0,
    pedido: 0,
    reposo: 0 as ReturnType<typeof setTimeout> | 0,
    arrastre: null as null | { x: number; y: number; camara: Camara; movio: boolean },
    /** El último encuadre pedido y si el usuario movió la cámara después. */
    objetivo: null as EncuadreLienzo | null,
    manual: false,
    /** Si la cámara ya miró algo: el primer encuadre salta en vez de volar (`debeVolar`). */
    encuadrado: false,
  });
  // Lo que cambia con cada render se lee por referencia desde el bucle de dibujo.
  // El rótulo del cursor se mueve por ref: re-renderizar en cada pointermove sería pagar React por píxel.
  const rotuloRef = useRef<HTMLDivElement | null>(null);
  // Marca de QA: en «false» mientras la cámara vuela, para que ninguna captura salga a medio camino.
  const vueloRef = useRef<HTMLSpanElement | null>(null);
  const cursorRef = useRef<[number, number] | null>(null);
  const moverRotulo = useCallback((x: number | null, y: number | null) => {
    cursorRef.current = x === null || y === null ? null : [x, y];
    const el = rotuloRef.current;
    // Con rótulo hay algo que se puede cliquear bajo el cursor: la mano de arrastrar pasa a puntero.
    const lienzo = lienzoRef.current;
    if (lienzo) {
      if (el && cursorRef.current) lienzo.dataset.sobre = "true";
      else delete lienzo.dataset.sobre;
    }
    if (!el) return;
    if (!cursorRef.current) { el.style.visibility = "hidden"; return; }
    const caja = el.parentElement?.getBoundingClientRect();
    const w = el.offsetWidth, h = el.offsetHeight;
    // A la derecha y abajo del cursor; si no cabe, del otro lado.
    const izq = caja && x! + 16 + w > caja.width ? x! - 16 - w : x! + 16;
    const arr = caja && y! + 16 + h > caja.height ? y! - 16 - h : y! + 16;
    el.style.transform = `translate(${Math.max(4, izq)}px, ${Math.max(4, arr)}px)`;
    el.style.visibility = "visible";
  }, []);
  // Al aparecer (o cambiar de distrito) se ubica donde está el cursor, sin esperar otro movimiento.
  useEffect(() => {
    const c = cursorRef.current;
    moverRotulo(c ? c[0] : null, c ? c[1] : null);
  }, [rotuloCursor, moverRotulo]);
  const props = useRef({ distritos, capa, colorManzana, dibujarFondo, dibujarMundo, dibujarPantalla, alClic, alMover });
  props.current = { distritos, capa, colorManzana, dibujarFondo, dibujarMundo, dibujarPantalla, alClic, alMover };

  const util = useCallback((): UtilLienzo => {
    const e = estado.current;
    return {
      camara: e.camara,
      tamano: e.tamano,
      colores: e.colores ?? leerColores(),
      px: 1 / e.camara.s,
      aPantalla: (x, y) => aPantalla(e.camara, e.tamano, x, y),
      trazo: (pieza) => trazoDe(pieza),
    };
  }, []);

  const dibujarBase = useCallback(() => {
    const e = estado.current;
    const lienzo = lienzoRef.current;
    if (!lienzo) return;
    const base = (baseRef.current ??= document.createElement("canvas"));
    if (base.width !== lienzo.width || base.height !== lienzo.height) {
      base.width = lienzo.width;
      base.height = lienzo.height;
    }
    const ctx = base.getContext("2d");
    if (!ctx) return;
    const t0 = performance.now();
    const { camara: c, tamano: t, dpr } = e;
    const col = (e.colores ??= leerColores());
    const px = 1 / c.s;
    const lejos = c.s < 0.08;
    const { distritos: ds, capa: k, colorManzana: tinte } = props.current;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = col.fondo;
    ctx.fillRect(0, 0, t.w, t.h);
    ctx.setTransform(dpr * c.s, 0, 0, dpr * c.s, dpr * (t.w / 2 - c.x * c.s), dpr * (t.h / 2 - c.y * c.s));
    const vista = cajaVisible(c, t);
    props.current.dibujarFondo?.(ctx, util());

    const manzanasVisibles = ds.flatMap((d) => visibles(d.manzanas, vista));
    for (const m of manzanasVisibles) {
      ctx.fillStyle =
        tinte?.(m, lejos) ??
        (k === "viviendas" ? col.densidad[nivelDensidad(m.viviendas)] : k === "nse" ? col.nse[m.nse] : lejos ? col.manzanaLejos : col.manzana);
      ctx.fill(trazoDe(m));
    }
    if (c.s > 0.25) {
      ctx.strokeStyle = k === "manzanas" ? col.manzanaBorde : col.fondo;
      // Borde de 1 px: con 0,6 el negro se antialiasa a gris y la manzana no se recorta.
      ctx.lineWidth = (k === "manzanas" ? 1 : 0.6) * px;
      for (const m of manzanasVisibles) ctx.stroke(trazoDe(m));
    } else if (k === "manzanas" && manzanasVisibles.length <= 20000) {
      // La manzana es blanca sobre fondo blanco: sin borde, un distrito entero (Lima Cercado, 1,901 manzanas) se veía
      // vacío al abrir «Ver sus manzanas». De lejos va un borde fino y tenue, que se aclara cuanto más lejos.
      ctx.strokeStyle = col.manzanaBorde;
      ctx.globalAlpha = Math.max(0.18, Math.min(0.45, c.s / 0.25 * 0.45));
      ctx.lineWidth = 0.6 * px;
      for (const m of manzanasVisibles) ctx.stroke(trazoDe(m));
      ctx.globalAlpha = 1;
    }
    if (c.s > 0.12) {
      ctx.strokeStyle = col.zona;
      ctx.lineWidth = px;
      ctx.setLineDash([4 * px, 3 * px]);
      for (const d of ds) for (const z of visibles(d.zonas, vista)) ctx.stroke(trazoDe(z));
      ctx.setLineDash([]);
    }
    if (!lejos) {
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const vias = ds.flatMap((d) => visibles(d.vias, vista));
      const ancho = (rango: 1 | 2) => Math.max(rango === 2 ? 2.4 : 1.6, (rango === 2 ? 22 : 14) * c.s) * px;
      for (const rango of [1, 2] as const) {
        ctx.strokeStyle = col.viaBorde;
        ctx.lineWidth = ancho(rango) + 1.6 * px;
        for (const via of vias) if (via.rango === rango) ctx.stroke(trazoDe(via, false));
      }
      for (const rango of [1, 2] as const) {
        ctx.strokeStyle = col.via;
        ctx.lineWidth = ancho(rango);
        for (const via of vias) if (via.rango === rango) ctx.stroke(trazoDe(via, false));
      }
    }
    e.snap = { ...c, ...t };
    e.baseSucia = false;
    e.costoBase = performance.now() - t0;
  }, [util]);

  const dibujar = useCallback(() => {
    const e = estado.current;
    const lienzo = lienzoRef.current;
    const ctx = lienzo?.getContext("2d");
    if (!lienzo || !ctx || !e.tamano.w) return;
    const moviendo = (performance.now() - e.interactuando < REPOSO_MS || e.vuelo !== 0) && e.costoBase > COSTO_PARA_REUTILIZAR_MS;
    if (e.baseSucia || !e.snap || e.snap.w !== e.tamano.w || e.snap.h !== e.tamano.h || !moviendo) dibujarBase();
    const snap = e.snap;
    const base = baseRef.current;
    if (!snap || !base) return;
    const { camara: c, tamano: t, dpr } = e;
    const k = c.s / snap.s;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = e.colores?.fondo ?? "";
    ctx.fillRect(0, 0, t.w, t.h);
    ctx.setTransform(k, 0, 0, k, dpr * ((t.w / 2) * (1 - k) + (snap.x - c.x) * c.s), dpr * ((t.h / 2) * (1 - k) + (snap.y - c.y) * c.s));
    ctx.drawImage(base, 0, 0);
    const u = util();
    if (props.current.dibujarMundo) {
      ctx.setTransform(dpr * c.s, 0, 0, dpr * c.s, dpr * (t.w / 2 - c.x * c.s), dpr * (t.h / 2 - c.y * c.s));
      props.current.dibujarMundo(ctx, u);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    props.current.dibujarPantalla?.(ctx, u);
    if (escalaRef.current) {
      const g = escalaGrafica(c.s);
      escalaRef.current.style.setProperty("--lienzo-escala", `${g.px}px`);
      escalaRef.current.dataset.rotulo = g.rotulo;
    }
  }, [dibujarBase, util]);

  // El panel oculto del navegador pausa requestAnimationFrame: el setTimeout
  // asegura que el último cuadro se pinte igual.
  const pintar = useCallback(() => {
    const e = estado.current;
    if (e.pedido) return;
    const hacer = () => {
      if (!e.pedido) return;
      e.pedido = 0;
      dibujar();
    };
    e.pedido = requestAnimationFrame(hacer);
    setTimeout(hacer, 60);
  }, [dibujar]);

  const marcarInteraccion = useCallback(() => {
    const e = estado.current;
    e.interactuando = performance.now();
    if (e.reposo) clearTimeout(e.reposo);
    e.reposo = setTimeout(pintar, REPOSO_MS);
  }, [pintar]);

  const volar = useCallback(
    (destino: Camara, animar: boolean) => {
      const e = estado.current;
      const reducido = Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
      const vuela = debeVolar({ animar, reducido, ancho: e.tamano.w, encuadrado: e.encuadrado });
      if (e.tamano.w) e.encuadrado = true;
      if (!vuela) {
        e.vuelo = 0;
        marcarVuelo(vueloRef.current, false);
        e.camara = destino;
        pintar();
        return;
      }
      const desde = { ...e.camara };
      const t0 = performance.now();
      const id = (e.vuelo = (e.vuelo % 1_000_000) + 1);
      const paso = (ahora: number) => {
        if (e.vuelo !== id) return;
        const k = Math.min(1, (ahora - t0) / DURACION_VUELO_MS);
        e.camara = interpolar(desde, destino, k);
        dibujar();
        if (k < 1) requestAnimationFrame(paso);
        else {
          e.vuelo = 0;
          marcarVuelo(vueloRef.current, false);
          dibujar();
        }
      };
      marcarVuelo(vueloRef.current, true);
      requestAnimationFrame(paso);
    },
    [dibujar, pintar],
  );

  // Tamaño del lienzo con la densidad de píxeles del equipo
  useEffect(() => {
    const lienzo = lienzoRef.current;
    if (!lienzo) return;
    const medir = () => {
      const r = lienzo.getBoundingClientRect();
      const e = estado.current;
      e.dpr = window.devicePixelRatio || 1;
      e.tamano = { w: r.width, h: r.height };
      lienzo.width = Math.max(1, Math.round(r.width * e.dpr));
      lienzo.height = Math.max(1, Math.round(r.height * e.dpr));
      e.baseSucia = true;
      if (e.objetivo && !e.manual) e.camara = encuadre(e.objetivo.caja, e.tamano, e.objetivo.pad ?? 0.1, e.objetivo.tapadoAbajo);
      pintar();
    };
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(lienzo);
    return () => obs.disconnect();
  }, [pintar]);

  // Datos, capa o colores de la sección cambiaron: la capa base se rehace
  useEffect(() => {
    estado.current.baseSucia = true;
    pintar();
  }, [distritos, capa, colorManzana, dibujarFondo, version, pintar]);

  // Lo dibujado encima depende de la sección: basta repintar
  useEffect(() => {
    pintar();
  }, [dibujarMundo, dibujarPantalla, pintar]);

  const claveEncuadre = encuadreObjetivo?.clave;
  useEffect(() => {
    if (!encuadreObjetivo) return;
    const e = estado.current;
    e.objetivo = encuadreObjetivo;
    e.manual = false;
    const hacer = () => volar(encuadre(encuadreObjetivo.caja, e.tamano, encuadreObjetivo.pad ?? 0.1, encuadreObjetivo.tapadoAbajo), encuadreObjetivo.animar !== false);
    if (e.tamano.w) hacer();
    else requestAnimationFrame(hacer);
    // la caja viaja con la clave: re-encuadrar por cada render la haría saltar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveEncuadre, volar]);

  // Puntero: arrastre, clic y movimiento; rueda con zoom anclado al cursor
  useEffect(() => {
    const lienzo = lienzoRef.current;
    if (!lienzo) return;
    const e = estado.current;
    const local = (ev: PointerEvent | WheelEvent): [number, number] => {
      const r = lienzo.getBoundingClientRect();
      return [ev.clientX - r.left, ev.clientY - r.top];
    };
    const abajo = (ev: PointerEvent) => {
      const [x, y] = local(ev);
      e.arrastre = { x, y, camara: { ...e.camara }, movio: false };
      lienzo.setPointerCapture(ev.pointerId);
    };
    const mover = (ev: PointerEvent) => {
      const [x, y] = local(ev);
      if (e.arrastre) {
        const dx = x - e.arrastre.x, dy = y - e.arrastre.y;
        if (Math.hypot(dx, dy) > 3) {
          e.arrastre.movio = true;
          lienzo.dataset.arrastrando = "true";
          e.vuelo = 0;
          marcarVuelo(vueloRef.current, false);
          e.manual = true;
          e.camara = acotarACaja(arrastre(e.arrastre.camara, dx, dy), e.tamano, limiteRef.current);
          marcarInteraccion();
          pintar();
        }
        return;
      }
      props.current.alMover?.(aMundo(e.camara, e.tamano, x, y), util());
      moverRotulo(x, y);
    };
    const arriba = (ev: PointerEvent) => {
      const a = e.arrastre;
      e.arrastre = null;
      delete lienzo.dataset.arrastrando;
      if (!a || a.movio) return;
      const [x, y] = local(ev);
      props.current.alClic?.(aMundo(e.camara, e.tamano, x, y), util());
    };
    const salir = () => {
      props.current.alMover?.(null, util());
      moverRotulo(null, null);
    };
    const rueda = (ev: WheelEvent) => {
      ev.preventDefault();
      e.vuelo = 0;
      marcarVuelo(vueloRef.current, false);
      const [x, y] = local(ev);
      e.manual = true;
      e.camara = acotarACaja(zoomRueda(e.camara, e.tamano, x, y, ev.deltaY, ev.deltaMode, ev.ctrlKey), e.tamano, limiteRef.current);
      marcarInteraccion();
      pintar();
    };
    lienzo.addEventListener("pointerdown", abajo);
    lienzo.addEventListener("pointermove", mover);
    lienzo.addEventListener("pointerup", arriba);
    lienzo.addEventListener("pointerleave", salir);
    lienzo.addEventListener("wheel", rueda, { passive: false });
    return () => {
      lienzo.removeEventListener("pointerdown", abajo);
      lienzo.removeEventListener("pointermove", mover);
      lienzo.removeEventListener("pointerup", arriba);
      lienzo.removeEventListener("pointerleave", salir);
      lienzo.removeEventListener("wheel", rueda);
    };
  }, [marcarInteraccion, pintar, util, moverRotulo]);

  const zoomBoton = (factor: number) => {
    const e = estado.current;
    e.manual = true;
    // Con una UMP enfocada, «+» acerca a ella y no al centro del lienzo (B12).
    volar(acotarACaja({ ...e.camara, ...(anclaZoom ? { x: anclaZoom[0], y: anclaZoom[1] } : {}), s: e.camara.s * factor }, e.tamano, limiteRef.current), true);
  };

  return (
    <div className={["hr-lienzo", className].filter(Boolean).join(" ")}>
      <canvas ref={lienzoRef} className="hr-lienzo-canvas" role="img" aria-label={ariaLabel} />
      <span ref={vueloRef} hidden data-audit-ready="lienzo" />
      {miga ? <div className="hr-lienzo-capsula hr-lienzo-miga">{miga}</div> : null}
      {ficha ? <div className="hr-lienzo-ficha">{ficha}</div> : null}
      {rotuloCursor ? <div ref={rotuloRef} className="hr-lienzo-cursor" role="status" aria-live="polite">{rotuloCursor}</div> : null}
      {leyenda ? <div className="hr-lienzo-capsula hr-lienzo-leyenda">{leyenda}</div> : null}
      {controles ? <div className="hr-lienzo-capsula hr-lienzo-controles">{controles}</div> : null}
      <div className="hr-lienzo-pie">
        <div ref={escalaRef} className="hr-lienzo-escala" aria-hidden="true" />
        <div className="hr-lienzo-zoom" role="group" aria-label="Zoom del mapa">
          <button type="button" onClick={() => zoomBoton(1.8)} aria-label="Acercar">+</button>
          <button type="button" onClick={() => zoomBoton(1 / 1.8)} aria-label="Alejar">−</button>
          {encuadreObjetivo ? (
            <button
              type="button"
              aria-label="Encuadrar"
              onClick={() => volar(encuadre(encuadreObjetivo.caja, estado.current.tamano, encuadreObjetivo.pad ?? 0.1, encuadreObjetivo.tapadoAbajo), true)}
              title="Encuadrar lo que importa en esta sección"
            >
              <Maximize2 size={13} aria-hidden />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
