// Capa de guías encima de la lámina rasterizada (plan F6 §8). Sólo dibuja: nunca intercepta un clic (las ranuras de
// abajo siguen seleccionables) y es invisible para el lector de pantalla, que lee lo mismo en la lista del panel de
// guías. El nombre de cada caja al pasar el mouse se resuelve con la posición del puntero sobre la hoja
// (`formaBajoPunto`), no con eventos de la capa. Qué rótulos se pintan y dónde lo decide `colocarRotulos` (un rótulo por
// caja, umbral de tamaño, dentro de la hoja y sin choques) con el tamaño en px de la hoja.

import { useEffect, useMemo, useState, type CSSProperties, type RefObject } from "react";
import { formaBajoPunto, LIENZO_ESTANDAR, ROTULO_ROL, type CajaGuia, type ModeloGuias, type Porcentaje } from "./modeloGuias";
import { clasesDeRotulo, colocarRotulos, datoDeForma, type HojaPx, type RotuloColocado } from "./rotulosGuias";
import "./guias.css";

type Props = {
  modelo: ModeloGuias;
  /** Elemento señalado desde la lista del panel (se resalta aunque la capa Cajas esté apagada). */
  resaltada: string | null;
  /** La hoja sobre la que se mide el puntero. */
  hojaRef: RefObject<HTMLElement>;
};

const caja = (p: Porcentaje, i = 0): CSSProperties => ({
  left: `${p.left}%`,
  top: `${p.top}%`,
  width: `${p.width}%`,
  height: `${p.height}%`,
  "--pulso-f6-guia-i": Math.min(i, 12),
} as CSSProperties);

export function GuiasSobreLamina({ modelo, resaltada, hojaRef }: Props) {
  // El nombre al pasar el mouse vale para toda capa que mira formas (Cajas, Tipografía, Medidas): es la vía al dato de
  // una caja demasiado chica para rotularla en línea.
  const miraFormas = modelo.cajas.length > 0 || modelo.tipografia.length > 0 || modelo.medidas.length > 0;
  const objetivos = useMemo(() => (miraFormas ? modelo.elementos : []), [miraFormas, modelo.elementos]);
  const hover = useHoverCaja(hojaRef, objetivos);
  const hoja = useTamanoHoja(hojaRef);
  const rotulos = useMemo(() => colocarRotulos(modelo, hoja), [modelo, hoja]);
  const senalada = resaltada ? modelo.elementos.find((e) => e.id === resaltada) ?? null : null;
  const bajoPuntero = hover ? objetivos.find((e) => e.id === hover) ?? null : null;
  if (!modelo.activa && !senalada) return null;
  const etiqueta = bajoPuntero ?? senalada;

  return (
    <div
      className="pulso-f6-guias-capa"
      aria-hidden="true"
      data-qa-geometry-group="graficos/f6-guias-capa"
      data-qa-geometry-contract="intrinsic"
      data-guias-rotulos={rotulos.length}
    >
      {modelo.recetario.map((r, i) => (
        <span key={r.id} className="pulso-f6-guia-ranura" style={caja(r.pos, i)} />
      ))}
      {modelo.cajas.map((e, i) => (
        <span
          key={e.id}
          className={`pulso-f6-guia-caja${e.grupo ? " is-anidada" : ""}${hover === e.id ? " is-hover" : ""}`}
          style={caja(e.pos, i)}
        />
      ))}
      {modelo.espacios.map((s, i) => <Cota key={s.id} espacio={s} i={i} />)}
      {rotulos.map((r, i) => <Rotulo key={r.id} rotulo={r} i={i} />)}
      {senalada && <span className="pulso-f6-guia-caja is-senalada" style={caja(senalada.pos)} />}
      {etiqueta && <Etiqueta elemento={etiqueta} dato={datoDeForma(modelo, etiqueta.id)} />}
    </div>
  );
}

function Rotulo({ rotulo: r, i }: { rotulo: RotuloColocado; i: number }) {
  return (
    <span
      className={clasesDeRotulo(r)}
      style={{ left: `${r.pct.left}%`, top: `${r.pct.top}%`, maxWidth: `${r.pct.maxWidth}%`, "--pulso-f6-guia-i": Math.min(i, 12) } as CSSProperties}
    >
      {r.partes.map((p, k) => (
        <span key={k} className={`pulso-f6-guia-parte is-${p.tono}`}>{k > 0 ? ` · ${p.texto}` : p.texto}</span>
      ))}
    </span>
  );
}

function Etiqueta({ elemento, dato }: { elemento: CajaGuia; dato: string | null }) {
  const arriba = elemento.pos.top > 6;
  return (
    <span
      className={`pulso-f6-guia-nombre${arriba ? "" : " is-dentro"}`}
      style={{ left: `${Math.min(elemento.pos.left, 60)}%`, top: `${elemento.pos.top}%` }}
    >
      <strong>{elemento.nombre}</strong>
      <span>{ROTULO_ROL[elemento.rol]}{elemento.grupo ? ` · en ${elemento.grupo}` : ""}</span>
      {dato && <span className="pulso-f6-guia-nombre-dato">{dato}</span>}
    </span>
  );
}

function Cota({ espacio: s, i }: { espacio: ModeloGuias["espacios"][number]; i: number }) {
  const h = s.eje === "h";
  const left = Math.min(s.desdePct.left, s.hastaPct.left);
  const top = Math.min(s.desdePct.top, s.hastaPct.top);
  const largo = h ? Math.abs(s.hastaPct.left - s.desdePct.left) : Math.abs(s.hastaPct.top - s.desdePct.top);
  const style = {
    left: `${left}%`,
    top: `${top}%`,
    [h ? "width" : "height"]: `${largo}%`,
    "--pulso-f6-guia-i": Math.min(i, 12),
  } as CSSProperties;
  return (
    <span className={`pulso-f6-guia-cota is-${s.eje} is-${s.tipo}`} style={style} />
  );
}

/** Tamaño en px de la hoja: los rótulos se colocan contra él (umbral, bordes y choques se miden en pantalla). */
function useTamanoHoja(hojaRef: RefObject<HTMLElement>): HojaPx {
  const [hoja, setHoja] = useState<HojaPx>({ ancho: 0, alto: 0 });
  useEffect(() => {
    const el = hojaRef.current;
    if (!el) return;
    const medir = () => {
      const ancho = Math.round(el.clientWidth);
      const alto = Math.round(el.clientHeight);
      setHoja((h) => (h.ancho === ancho && h.alto === alto ? h : { ancho, alto }));
    };
    medir();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [hojaRef]);
  return hoja;
}

/** Id de la forma bajo el puntero mientras alguna capa que mira formas está encendida. Escucha en la hoja: la capa no recibe eventos. */
function useHoverCaja(hojaRef: RefObject<HTMLElement>, cajas: readonly CajaGuia[]): string | null {
  const [hover, setHover] = useState<string | null>(null);
  useEffect(() => {
    const hoja = hojaRef.current;
    if (!hoja || !cajas.length) { setHover(null); return; }
    const mover = (e: PointerEvent) => {
      const r = hoja.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const x = ((e.clientX - r.left) / r.width) * LIENZO_ESTANDAR.ancho;
      const y = ((e.clientY - r.top) / r.height) * LIENZO_ESTANDAR.alto;
      setHover(formaBajoPunto(cajas, x, y));
    };
    const salir = () => setHover(null);
    hoja.addEventListener("pointermove", mover, { passive: true });
    hoja.addEventListener("pointerleave", salir);
    return () => {
      hoja.removeEventListener("pointermove", mover);
      hoja.removeEventListener("pointerleave", salir);
    };
  }, [hojaRef, cajas]);
  return hover;
}
