// Capa de guías encima de la lámina rasterizada (plan F6 §8). Sólo dibuja: nunca intercepta un clic (las ranuras de
// abajo siguen seleccionables) y es invisible para el lector de pantalla, que lee lo mismo en la lista del panel de
// guías. El nombre de cada caja al pasar el mouse se resuelve con la posición del puntero sobre la hoja
// (`formaBajoPunto`), no con eventos de la capa.

import { useEffect, useState, type CSSProperties, type RefObject } from "react";
import { formaBajoPunto, LIENZO_ESTANDAR, ROTULO_ROL, type CajaGuia, type ModeloGuias, type Porcentaje } from "./modeloGuias";
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
  const hover = useHoverCaja(hojaRef, modelo.cajas);
  const senalada = resaltada ? modelo.elementos.find((e) => e.id === resaltada) ?? null : null;
  const bajoPuntero = hover ? modelo.cajas.find((e) => e.id === hover) ?? null : null;
  if (!modelo.activa && !senalada) return null;

  return (
    <div
      className="pulso-f6-guias-capa"
      aria-hidden="true"
      data-qa-geometry-group="graficos/f6-guias-capa"
      data-qa-geometry-contract="intrinsic"
    >
      {modelo.recetario.map((r, i) => (
        <span key={r.id} className="pulso-f6-guia-ranura" style={caja(r.pos, i)}>
          <span className="pulso-f6-guia-rotulo is-ranura">{r.rotulo}</span>
        </span>
      ))}
      {modelo.cajas.map((e, i) => (
        <span
          key={e.id}
          className={`pulso-f6-guia-caja${e.grupo ? " is-anidada" : ""}${hover === e.id ? " is-hover" : ""}`}
          style={caja(e.pos, i)}
        />
      ))}
      {modelo.espacios.map((s, i) => <Cota key={s.id} espacio={s} i={i} />)}
      {modelo.tipografia.map((e, i) => (
        <span
          key={`t-${e.id}`}
          className={`pulso-f6-guia-rotulo is-pt${e.ptFuera ? " is-fuera" : ""}`}
          style={{ left: `${e.pos.left}%`, top: `${e.pos.top}%`, "--pulso-f6-guia-i": Math.min(i, 12) } as CSSProperties}
        >
          {e.pt}
          {e.recortado && <span className="pulso-f6-guia-recorte"> · recortado</span>}
        </span>
      ))}
      {modelo.medidas.map((e, i) => (
        <span
          key={`m-${e.id}`}
          className="pulso-f6-guia-rotulo is-medida"
          style={{ left: `${e.pos.left + e.pos.width}%`, top: `${e.pos.top + e.pos.height}%`, "--pulso-f6-guia-i": Math.min(i, 12) } as CSSProperties}
        >
          {e.medidas}
        </span>
      ))}
      {senalada && <span className="pulso-f6-guia-caja is-senalada" style={caja(senalada.pos)} />}
      {bajoPuntero && <Etiqueta elemento={bajoPuntero} />}
      {!bajoPuntero && senalada && <Etiqueta elemento={senalada} />}
    </div>
  );
}

function Etiqueta({ elemento }: { elemento: CajaGuia }) {
  const arriba = elemento.pos.top > 6;
  return (
    <span
      className={`pulso-f6-guia-nombre${arriba ? "" : " is-dentro"}`}
      style={{ left: `${Math.min(elemento.pos.left, 80)}%`, top: `${elemento.pos.top}%` }}
    >
      <strong>{elemento.nombre}</strong>
      <span>{ROTULO_ROL[elemento.rol]}{elemento.grupo ? ` · en ${elemento.grupo}` : ""}</span>
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
    <span className={`pulso-f6-guia-cota is-${s.eje} is-${s.tipo}`} style={style}>
      <span className="pulso-f6-guia-rotulo is-cota">{s.rotulo}</span>
    </span>
  );
}

/** Id de la caja bajo el puntero mientras la capa Cajas está encendida. Escucha en la hoja: la capa no recibe eventos. */
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
