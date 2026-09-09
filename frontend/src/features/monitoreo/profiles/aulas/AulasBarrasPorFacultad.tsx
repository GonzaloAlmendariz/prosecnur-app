import type { ReactNode } from "react";

import { barrasPorFacultad, type FilaDeFacultad } from "./barrasPorFacultad";
import type { FocoDeCuota } from "./AulasCuotasResumen";
import { fmt, pctPerfil } from "./kpisDeAulas";
import type { MonitoreoRow } from "../../../../api/monitoreo";
import "./aulasBarrasPorFacultad.css";

/**
 * «Hombres y mujeres por facultad»: dos carriles por facultad, cada uno contra
 * su propia meta.
 *
 * Sustituye a la proyección «Va a llegar, con margen / sin medir», que Gonzalo
 * cortó el 2026-09-08 por dos motivos a la vez: anunciaba un desenlace sin
 * haber calculado el avance real —«pone que va a llegar con margen cuando ni
 * siquiera has calculado el avance»— y era predicción, que pertenece a otra
 * pestaña. Aquí sólo hay dos estados: lo conseguido y lo que falta.
 *
 * La geometría es la que dictó, literal: filas alineadas, barra rectangular
 * ancha, apilada, del mismo largo en todas, verde lo avanzado y gris suave lo
 * que queda, bordes definidos, y **todo el ancho disponible** — el panel que
 * sustituye dejaba media pantalla vacía a la derecha.
 */
export function AulasBarrasPorFacultad({
  filas, foco, onFoco,
}: {
  filas: MonitoreoRow[] | undefined;
  foco: FocoDeCuota;
  onFoco: (foco: FocoDeCuota) => void;
}): ReactNode {
  const facultades = barrasPorFacultad(filas);
  if (!facultades.length) {
    // El vacío se declara y dice qué falta para llenarlo (C3 del contrato de
    // superficie): un panel en blanco se lee como avería.
    return (
      <p className="mon-profile-muted aulas-bpf-vacio">
        Todavía no hay metas por facultad y sexo que mostrar. Aparecen cuando el
        estudio declara su cuota del diseño.
      </p>
    );
  }
  const total = totalizar(facultades);
  return (
    <div className="aulas-bpf">
      <div className="aulas-bpf-cabecera">
        <span className="aulas-bpf-cabecera-meta">
          Meta del estudio: <strong>{fmt(total.metaTotal)}</strong>
          {total.carriles.map((carril) => (
            <span key={carril.clave} className="aulas-bpf-cabecera-sexo">
              {/* La palabra tal cual la trae el view-model: `toLowerCase()`
                  sobre un campo de sexo está prohibido en el perfil —el guard
                  de `sexoEnPalabras` lo caza— porque es como se acababa
                  publicando la LETRA cruda del payload en minúscula. */}
              {carril.sexo} <strong>{fmt(carril.meta)}</strong>
            </span>
          ))}
        </span>
        <span className="aulas-bpf-leyenda" aria-hidden="true">
          <i className="aulas-bpf-swatch" data-tramo="logrado" /> conseguido
          <i className="aulas-bpf-swatch" data-tramo="falta" /> falta
        </span>
      </div>
      <ul className="aulas-bpf-lista">
        {facultades.map((fila) => (
          <li
            key={fila.facultad}
            className="aulas-bpf-fila"
            data-enfocada={
              foco && foco.tipo === "facultad" && foco.valor === fila.facultad ? "si" : undefined
            }
          >
            <div className="aulas-bpf-fila-head">
              <button
                type="button"
                className="aulas-bpf-nombre"
                onClick={() => onFoco(
                  foco && foco.tipo === "facultad" && foco.valor === fila.facultad
                    ? null
                    : { tipo: "facultad", valor: fila.facultad },
                )}
                title={`Ver sólo ${fila.facultad}`}
              >
                {fila.facultad}
              </button>
              {/* El chip sólo cuando algo cambia: quince chips iguales no
                  informan de nada. */}
              {fila.chip ? (
                <span className="aulas-bpf-chip" data-estado={fila.chip}>
                  {fila.chip === "cumplida" ? "Meta cumplida" : "Le falta poco"}
                </span>
              ) : null}
            </div>
            <div className="aulas-bpf-carriles">
              {fila.carriles.map((carril) => (
                <div key={carril.clave} className="aulas-bpf-carril" data-sexo={carril.clave}>
                  <span className="aulas-bpf-carril-sexo">{carril.sexo}</span>
                  <div
                    className="aulas-bpf-barra"
                    role="img"
                    aria-label={`${fila.facultad}, ${carril.sexo}: ${fmt(carril.logrado)} de ${fmt(carril.meta)}${
                      carril.avance === null ? "" : `, ${pct(carril.avance)}`
                    }`}
                  >
                    {/* **El avance es un depósito que se llena, y no lleva rojo**
                        (dictado de Gonzalo del 2026-09-08, corrigiéndose a sí
                        mismo: «rojo da a entender que es algo malo cuando puede
                        ser sólo que recién esté empezando»). Gris muy claro
                        mientras se llena, verde al cubrir la meta y celeste al
                        pasarse. El rojo se reserva para las diferencias contra
                        lo esperado, que es donde sí hay veredicto. */}
                    <span
                      className="aulas-bpf-barra-logrado"
                      style={{ width: `${carril.anchoPct}%` }}
                      data-lleno={carril.falta === 0 ? "si" : undefined}
                      data-pasada={carril.sobra > 0 ? "si" : undefined}
                    />
                  </div>
                  <span className="aulas-bpf-cifras">
                    <strong>{fmt(carril.logrado)}</strong>
                    <span className="aulas-bpf-de"> de {fmt(carril.meta)}</span>
                    <span className="aulas-bpf-pct">
                      {carril.avance === null ? "sin meta" : pct(carril.avance)}
                    </span>
                    {/* «Faltan» y «sobran», nunca «faltarán»: lo que se dice es
                        lo que hay, no lo que se espera que pase. */}
                    <span className="aulas-bpf-resto" data-signo={carril.sobra > 0 ? "sobra" : "falta"}>
                      {carril.sobra > 0
                        ? `sobran ${fmt(carril.sobra)}`
                        : carril.falta > 0
                          ? `faltan ${fmt(carril.falta)}`
                          : "al día"}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * El porcentaje del perfil, no uno propio.
 *
 * Tenía `toFixed(1).replace(".0", "")`, que se comía el decimal cuando era cero:
 * este panel publicaba «28 %» y «0 %» mientras «Cumplimiento de la cuota»,
 * tres centímetros más arriba en la MISMA pestaña, publicaba «28.0 %» y
 * «0.0 %». La misma magnitud escrita de dos formas en una pantalla.
 *
 * `pctPerfil` recibe de 0 a 100 y no multiplica; aquí el avance viene como
 * proporción, así que se escala en la llamada.
 */
function pct(avance: number): string {
  return pctPerfil(avance * 100);
}

/** La fila «Total» de la cabecera: suma de metas y de logrados, por sexo. */
function totalizar(facultades: FilaDeFacultad[]): FilaDeFacultad {
  const porSexo = new Map<string, { sexo: string; meta: number; logrado: number }>();
  for (const fila of facultades) {
    for (const carril of fila.carriles) {
      const acc = porSexo.get(carril.clave) ?? { sexo: carril.sexo, meta: 0, logrado: 0 };
      acc.meta += carril.meta;
      acc.logrado += carril.logrado;
      porSexo.set(carril.clave, acc);
    }
  }
  const carriles = [...porSexo.entries()].map(([clave, acc]) => {
    const avance = acc.meta > 0 ? acc.logrado / acc.meta : null;
    return {
      clave,
      sexo: acc.sexo,
      meta: acc.meta,
      logrado: acc.logrado,
      falta: Math.max(0, acc.meta - acc.logrado),
      sobra: Math.max(0, acc.logrado - acc.meta),
      avance,
      anchoPct: avance === null ? 0 : Math.min(1, Math.max(0, avance)) * 100,
    };
  });
  return {
    facultad: "Total",
    metaTotal: carriles.reduce((acc, c) => acc + c.meta, 0),
    logradoTotal: carriles.reduce((acc, c) => acc + c.logrado, 0),
    carriles,
    chip: null,
  };
}
