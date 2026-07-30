/**
 * La cadena de las tres fuentes del monitoreo telefónico.
 *
 * Es lo único que se pinta en «Fuentes activas», y responde la pregunta que esa
 * pestaña tiene por nombre: de dónde salen los números. Antes esa pestaña era la
 * unión literal de las otras dos —las mismas tarjetas de configuración, otra
 * vez— más una tira de tres cajas planas y, cuando faltaba algo, una lista de
 * pasos. Tres piezas para el mismo hecho, ninguna mostrando lo que importa: que
 * las fuentes dependen una de otra.
 *
 * Aquí la dependencia es el dibujo. Los eslabones van en su orden, unidos por un
 * conector que se corta donde la cadena se corta, y cada uno lleva el volumen
 * que aporta al monitoreo. Con las tres conectadas se lee el flujo completo
 * —2.726 por llamar → 2.726 registrados → 1 formulario—; con una suelta se ve
 * dónde y qué hacer.
 */

import { ArrowRight, Check, ExternalLink } from "../../../../../vendor/lucide-react";

import { eslabonQueCorta } from "./modeloDeCadena";
import type { ClaveDeEslabon, EslabonDeFuente } from "./modeloDeCadena";
import "./cadenaDeFuentes.css";

/**
 * Sin encabezado propio: lo pone el panel que la contiene, que ya declara qué
 * es esta superficie y cómo está el contrato. Dárselo aquí también producía dos
 * títulos y dos veces «Listo para monitoreo» pegados uno encima del otro.
 */
export function CadenaDeFuentes({
  eslabones,
  onIr,
}: {
  eslabones: readonly EslabonDeFuente[];
  /** Lleva a la pestaña donde ese eslabón se decide. */
  onIr?: (clave: ClaveDeEslabon) => void;
}) {
  const corte = eslabonQueCorta(eslabones);

  return (
    <section
      className={`mon-tel-cadena${corte ? " has-corte" : " is-completa"}`}
      aria-label="Las tres fuentes del monitoreo telefónico"
    >
      {/* Grupo par: tres hermanas del mismo papel. La que menos trae resuelve su
        * vacío dentro, no encogiendo la caja. */}
      <ol data-qa-geometry-group="monitoreo/telefonico/cadena-fuentes" data-qa-geometry-contract="equal">
        {eslabones.map((eslabon, index) => (
          <li
            key={eslabon.clave}
            className={eslabon.lista ? "is-lista" : eslabon === corte ? "is-corte" : "is-pendiente"}
          >
            <article>
              <div className="mon-tel-cadena-titulo">
                <b aria-hidden="true">{eslabon.lista ? <Check size={12} /> : index + 1}</b>
                <div>
                  <strong>{eslabon.titulo}</strong>
                  <em>{eslabon.aporta}</em>
                </div>
              </div>

              {eslabon.lista ? (
                <>
                  {/* Sin cifra no hay bloque.
                    *
                    * No todo eslabón conoce su volumen —el barrido y la encuesta
                    * de un estudio recién sincronizado suelen no traerlo— y
                    * rellenar ese hueco con «Sin filas» convierte un dato que la
                    * app no tiene en un problema que el usuario no tiene. */}
                  {eslabon.cifra ? (
                    <span className="mon-tel-cadena-cifra"><strong>{eslabon.cifra}</strong></span>
                  ) : <span />}
                  <div className="mon-tel-cadena-pie">
                    {eslabon.origen ? (
                      eslabon.origen.href ? (
                        <a
                          href={eslabon.origen.href}
                          target="_blank"
                          rel="noreferrer"
                          title={eslabon.origen.titulo}
                        >
                          {eslabon.origen.texto}
                          <ExternalLink size={11} />
                        </a>
                      ) : (
                        <span title={eslabon.origen.titulo}>{eslabon.origen.texto}</span>
                      )
                    ) : null}
                    {eslabon.actualizada ? <i>{eslabon.actualizada}</i> : null}
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  className="mon-tel-cadena-accion"
                  onClick={() => onIr?.(eslabon.clave)}
                >
                  {eslabon.accion}
                </button>
              )}
            </article>
            {index < eslabones.length - 1 ? (
              <span className="mon-tel-cadena-nexo" aria-hidden="true"><ArrowRight size={13} /></span>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
