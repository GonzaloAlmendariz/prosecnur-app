/**
 * El llenado de las tres fuentes del monitoreo telefónico, como tres pasos.
 *
 * Un estudio telefónico siempre necesita las mismas tres piezas —la base con a
 * quién llamar, la hoja de barrido con qué pasó en cada llamada, y la encuesta
 * de Kobo que decide qué cuenta como efectiva—, y hasta ahora eso se explicaba
 * en un párrafo: «Primero vincula la base de universo; luego el barrido
 * telefónico y Kobo para separar población, operación diaria y avance».
 *
 * El orden y las dependencias se muestran, no se cuentan: quien llega a esta
 * sección con el estudio a medio configurar ve en qué paso está, qué falta y por
 * qué importa, sin leer un texto que describe una secuencia.
 *
 * Solo aparece mientras falte alguna pieza. Con las tres listas, el estado ya lo
 * dicen sus tarjetas y repetirlo aquí sería el mismo dato en dos sitios.
 */

import { AlertCircle, Check } from "../../../../vendor/lucide-react";

import "./llenadoDeFuentes.css";

export type PasoDeLlenado = {
  /** Qué pieza es, en el vocabulario del estudio. */
  titulo: string;
  /** Para qué sirve: la razón por la que el estudio la necesita. */
  aporta: string;
  lista: boolean;
};

/**
 * El paso por el que hay que seguir: el primero que falta, no cualquiera.
 *
 * El orden es una dependencia real, no una preferencia: el barrido sin base no
 * tiene a quién registrar, y la encuesta sin barrido no tiene contra qué cruzar.
 * Devuelve `null` cuando no falta ninguno.
 */
export function siguientePasoDeLlenado(pasos: readonly PasoDeLlenado[]): PasoDeLlenado | null {
  return pasos.find((paso) => !paso.lista) ?? null;
}

export function LlenadoDeFuentes({ pasos }: { pasos: readonly PasoDeLlenado[] }) {
  const siguiente = siguientePasoDeLlenado(pasos);
  if (!siguiente) return null;

  return (
    <section className="mon-tel-llenado" aria-label="Fuentes que falta conectar">
      <header>
        <span><AlertCircle size={14} /> Faltan fuentes</span>
        <strong>Sigue con {siguiente.titulo.toLocaleLowerCase("es")}</strong>
      </header>
      <ol>
        {pasos.map((paso, index) => (
          <li
            key={paso.titulo}
            className={paso.lista ? "is-lista" : paso === siguiente ? "is-siguiente" : "is-pendiente"}
          >
            <b aria-hidden="true">{paso.lista ? <Check size={12} /> : index + 1}</b>
            <div>
              <strong>{paso.titulo}</strong>
              <em>{paso.aporta}</em>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
