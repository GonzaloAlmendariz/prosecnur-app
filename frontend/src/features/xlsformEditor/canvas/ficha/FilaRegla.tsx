// Una regla de la ficha (C15): una fila que se despliega. Activa muestra su lectura del motor; ausente dice qué hace
// y lleva a su pestaña; «no aplica» queda deshabilitada con el porqué. La obligatoria lleva un interruptor en vez de
// desplegarse (un botón no puede contener otro). Sin triángulo: lo pidió Gonzalo (E20, 2026-11-06); la fila se abre
// al clicarla y el borde de color la marca abierta.

import { useId, type CSSProperties, type ReactNode } from "react";
import { GlifoMarca } from "../../kit";
import type { ClaveMarca } from "../../kit/glifosMarca";

export type EstadoRegla = "on" | "off" | "na";

export type FilaReglaProps = {
  glifo: ClaveMarca;
  tono: string;
  nombre: string;
  estado: EstadoRegla;
  resumen: ReactNode;
  /** Texto plano del resumen para el tooltip cuando se recorta. */
  resumenPlano?: string;
  abierta?: boolean;
  onAlternar?: () => void;
  /** Control propio a la derecha (el interruptor de la obligatoria): la fila deja de desplegarse. */
  control?: ReactNode;
  children?: ReactNode;
};

export function FilaRegla({ glifo, tono, nombre, estado, resumen, resumenPlano, abierta = false, onAlternar, control, children }: FilaReglaProps) {
  const idDetalle = useId();
  const estilo = { "--xfh-c": tono } as CSSProperties;
  const partes = (
    <>
      <span className="xfh-regla__ico"><GlifoMarca clave={glifo} size={13} /></span>
      <span className="xfh-regla__nom">{nombre}</span>
      <span className="xfh-regla__lee" title={resumenPlano}>{resumen}</span>
    </>
  );
  if (control) {
    // Con interruptor y además detalle (la obligatoria «sólo si…»): el interruptor sigue siendo el atajo y un botón
    // aparte abre el detalle (E19-1).
    return (
      <li className={`xfh-regla is-${estado}${abierta ? " is-abierta" : ""}`} style={estilo} data-qa-geometry-member="">
        <div className="xfh-regla__fila">
          {partes}
          <span className="xfh-regla__acc">
            {onAlternar ? (
              <button
                type="button"
                className="xfh-regla__mas"
                aria-expanded={abierta}
                aria-controls={abierta ? idDetalle : undefined}
                onClick={onAlternar}
              >
                Opciones
              </button>
            ) : null}
            {control}
          </span>
        </div>
        {abierta && onAlternar ? (
          <div className="xfh-regla__det" id={idDetalle}>
            {children}
          </div>
        ) : null}
      </li>
    );
  }
  return (
    <li className={`xfh-regla is-${estado}${abierta ? " is-abierta" : ""}`} style={estilo} data-qa-geometry-member="">
      <button
        type="button"
        className="xfh-regla__fila"
        disabled={estado === "na"}
        aria-expanded={estado === "na" ? undefined : abierta}
        aria-controls={estado === "na" || !abierta ? undefined : idDetalle}
        onClick={onAlternar}
      >
        {partes}
        <span className="xfh-regla__acc">
          {estado === "off" ? <span className="xfh-regla__agregar">Agregar</span> : null}
        </span>
      </button>
      {abierta && estado !== "na" ? (
        <div className="xfh-regla__det" id={idDetalle}>
          {children}
        </div>
      ) : null}
    </li>
  );
}
