// Franja de recorrido de Procesamiento (ADR 0142, etapa P1): una línea que lleva de
// lo que entra a lo que sale. Grupos con rótulo, cada uno con sus cifras; un conector
// entre grupos; al final, el destino (botón, enlace o dato); debajo, avisos opcionales.
//
// Todo llega por props: ni HTML en cadenas ni hijos sueltos. Una cifra numérica se
// escribe con lib/formatoNumero; una cadena ("8 nov") se pinta tal cual.

import { Fragment, type ReactNode } from "react";

import { ChevronRight } from "../../vendor/lucide-react";
import { cifraVisible } from "./cifraVisible";
import { FranjaDestino, type DestinoDeFranja } from "./FranjaDestino";
import "./piezas-procesamiento.css";

export type { DestinoDeFranja } from "./FranjaDestino";

export type CifraDeFranja = {
  id: string;
  cifra: number | string;
  /** Lo que cuenta la cifra: "del formulario", "casos a revisar". */
  texto: string;
  /** Punto de estado delante de la cifra. Sin tono no hay punto. */
  tono?: "inconsistencia" | "aviso";
};

export type GrupoDeFranja = {
  id: string;
  rotulo: string;
  cifras: readonly CifraDeFranja[];
  /** No continúa el recorrido: va sin conector y al extremo de la franja. */
  aparte?: boolean;
};

export type AvisoDeFranja = {
  id: string;
  texto: string;
  /** `aviso`: conviene mirarlo antes de seguir. Por defecto, conforme. */
  tono?: "aviso" | "conforme";
};

export type FranjaRecorridoProps = {
  /** Nombre accesible de la franja: "De las reglas a los hallazgos". */
  etiqueta: string;
  grupos: readonly GrupoDeFranja[];
  destino?: DestinoDeFranja;
  avisos?: readonly AvisoDeFranja[];
  /** Acción al extremo del pie de avisos. */
  accionDeAvisos?: ReactNode;
  className?: string;
};

export function FranjaRecorrido({ etiqueta, grupos, destino, avisos, accionDeAvisos, className }: FranjaRecorridoProps) {
  const conPie = Boolean(avisos?.length) || Boolean(accionDeAvisos);
  return (
    <div
      className={["pulso-franja-recorrido", className].filter(Boolean).join(" ")}
      role="group"
      aria-label={etiqueta}
      data-destino={destino ? "" : undefined}
    >
      <div className="pulso-franja-fila">
        {grupos.map((grupo, i) => (
          <Fragment key={grupo.id}>
            {i > 0 && !grupo.aparte ? (
              <span className="pulso-franja-conector" aria-hidden="true">
                <ChevronRight size={16} />
              </span>
            ) : null}
            <div className="pulso-franja-grupo" data-aparte={grupo.aparte ? "" : undefined}>
              <span className="pulso-franja-rotulo">{grupo.rotulo}</span>
              <div className="pulso-franja-cifras">
                {grupo.cifras.map((c) => (
                  <span key={c.id} className="pulso-franja-cifra" data-tono={c.tono}>
                    {c.tono ? <span className="pulso-franja-punto" aria-hidden="true" /> : null}
                    <b>{cifraVisible(c.cifra)}</b>
                    <span>{c.texto}</span>
                  </span>
                ))}
              </div>
            </div>
          </Fragment>
        ))}
        {destino ? <FranjaDestino destino={destino} /> : null}
      </div>
      {conPie ? (
        <div className="pulso-franja-pie">
          {avisos?.length ? (
            <ul className="pulso-franja-avisos">
              {avisos.map((a) => (
                <li key={a.id} className="pulso-franja-aviso" data-tono={a.tono ?? "conforme"}>
                  <span className="pulso-franja-aviso-punto" aria-hidden="true" />
                  <span>{a.texto}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {accionDeAvisos ? <div className="pulso-franja-pie-accion">{accionDeAvisos}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
