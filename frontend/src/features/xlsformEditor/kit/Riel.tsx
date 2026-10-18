import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import type { LogicScope } from "../logic";
import type { BuilderNode } from "../types";
import { ALCANCE_VACIO } from "./ContextoReglas";
import { CuerpoPanelMarca } from "./CuerpoPanelMarca";
import { GlifoMarca } from "./GlifoMarca";
import { INFO_MARCA, RIEL, claveVisible, tieneCasilla, type CasillaRiel, type MarcasNodo } from "./marcasNodo";
import { PanelMarca } from "./PanelMarca";
import "./riel.css";

// Riel fijo de marcas (identidad «Señales», 2026-10-17): cinco casillas en orden fijo (obligatoria, condición,
// restricción, cálculo y filtro; cabecera OB · CO · RE · CA · FI).
// Una casilla con marca muestra su glifo sobre el tono de la marca; vacía queda como hueco neutro. Tocarla abre el
// panel con lo que el motor sabe decir de esa regla.

const SALIDA_MS = 180;

export type RielProps = {
  nodo: BuilderNode;
  marcas: MarcasNodo;
  scope?: LogicScope | null;
  className?: string;
  /** -1 saca las casillas del recorrido con Tab (la Estructura deja una sola fila en el recorrido a la vez). */
  tabIndex?: number;
};

export function Riel({ nodo, marcas, scope, className, tabIndex }: RielProps) {
  const [abierta, setAbierta] = useState<CasillaRiel | null>(null);
  const [visible, setVisible] = useState(false);
  const botones = useRef<Partial<Record<CasillaRiel, HTMLButtonElement | null>>>({});
  const salida = useRef<number | null>(null);
  const idBase = useId();
  const nombre = nodo.name || nodo.label || `fila ${nodo.rowIndex + 1}`;

  useEffect(() => () => {
    if (salida.current !== null) window.clearTimeout(salida.current);
  }, []);

  useEffect(() => {
    if (!abierta) return;
    const raf = window.requestAnimationFrame(() => setVisible(true));
    return () => window.cancelAnimationFrame(raf);
  }, [abierta]);

  function cerrar(devolverFoco: boolean) {
    const k = abierta;
    if (!k) return;
    setVisible(false);
    if (devolverFoco) botones.current[k]?.focus();
    if (salida.current !== null) window.clearTimeout(salida.current);
    salida.current = window.setTimeout(() => {
      salida.current = null;
      setAbierta(null);
    }, SALIDA_MS);
  }

  function alternar(k: CasillaRiel) {
    if (salida.current !== null) {
      window.clearTimeout(salida.current);
      salida.current = null;
    }
    if (abierta === k && visible) return cerrar(true);
    setVisible(false);
    setAbierta(k);
  }

  const ancla = abierta ? botones.current[abierta] ?? null : null;
  return (
    <span className={className ? `xfk-riel ${className}` : "xfk-riel"} role="group" aria-label={`Marcas de ${nombre}`}>
      {RIEL.map((k) => {
        const on = tieneCasilla(marcas, k);
        const kk = claveVisible(marcas, k);
        const info = INFO_MARCA[kk];
        return (
          <button
            key={k}
            ref={(el) => {
              botones.current[k] = el;
            }}
            type="button"
            className={on ? "xfk-casilla is-on" : "xfk-casilla"}
            style={{ "--xfk-c": info.tono } as CSSProperties}
            tabIndex={tabIndex}
            data-casilla={k}
            data-marca={on ? kk : undefined}
            aria-haspopup="dialog"
            aria-expanded={abierta === k}
            aria-label={`${info.nombre}${on ? "" : ": no"} en ${nombre}`}
            title={on ? info.nombre : `${info.nombre}: no`}
            onClick={(e) => {
              e.stopPropagation();
              alternar(k);
            }}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {on ? <GlifoMarca clave={kk} size={12} /> : null}
          </button>
        );
      })}
      {abierta && ancla ? (
        <PanelMarca
          key={abierta}
          ancla={ancla}
          tono={INFO_MARCA[claveVisible(marcas, abierta)].tono}
          etiquetaId={`${idBase}-titulo`}
          visible={visible}
          onCerrar={cerrar}
        >
          <CuerpoPanelMarca
            clave={abierta}
            marcas={marcas}
            nodo={nodo}
            scope={scope ?? ALCANCE_VACIO}
            idTitulo={`${idBase}-titulo`}
            onCerrar={() => cerrar(true)}
          />
        </PanelMarca>
      ) : null}
    </span>
  );
}
