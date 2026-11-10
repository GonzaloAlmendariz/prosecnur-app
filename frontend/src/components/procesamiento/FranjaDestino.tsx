// El destino de una FranjaRecorrido: a dónde lleva el recorrido. Con `href` es un
// enlace, con solo `onClick` un botón (los dos con flecha) y sin ninguno un dato.

import type { MouseEvent } from "react";

import { ArrowRight } from "../../vendor/lucide-react";
import { cifraVisible } from "./cifraVisible";
import "./piezas-procesamiento.css";

export type DestinoDeFranja = {
  rotulo: string;
  cifra?: number | string;
  /** Un dato en palabras en lugar de la cifra: "al cargar la base". */
  texto?: string;
  /** Lo que acompaña a la cifra: "97.4 %". */
  nota?: string;
  /** Con `href` el destino es un enlace; con solo `onClick`, un botón; sin ninguno, un dato. */
  href?: string;
  onClick?: (evento: MouseEvent<HTMLElement>) => void;
};

export function FranjaDestino({ destino }: { destino: DestinoDeFranja }) {
  const contenido = (
    <>
      <span className="pulso-franja-destino-rotulo">{destino.rotulo}</span>
      {destino.cifra !== undefined ? <b className="pulso-franja-destino-cifra">{cifraVisible(destino.cifra)}</b> : null}
      {destino.texto ? <b className="pulso-franja-destino-texto">{destino.texto}</b> : null}
      {destino.nota ? <span className="pulso-franja-destino-nota">{destino.nota}</span> : null}
    </>
  );
  const flecha = <ArrowRight size={16} className="pulso-franja-destino-flecha" aria-hidden="true" />;
  if (destino.href) {
    return (
      <a className="pulso-franja-destino pulso-franja-destino--accion" href={destino.href} onClick={destino.onClick}>
        {contenido}
        {flecha}
      </a>
    );
  }
  if (destino.onClick) {
    return (
      <button type="button" className="pulso-franja-destino pulso-franja-destino--accion" onClick={destino.onClick}>
        {contenido}
        {flecha}
      </button>
    );
  }
  return <div className="pulso-franja-destino pulso-franja-destino--dato">{contenido}</div>;
}
