/**
 * E5 · «Titulares y cadenas» — la segunda pasada sobre el goo (dirección
 * 2026-08-07): cada slot titular es una bola de la estructura y su primera
 * tanda de reemplazos cuelga como cadena (`selection_slot_id` /
 * `replacement_order` / `chain_depth`), visualmente distinta porque la reserva
 * es CONDICIONAL (`activation_weight_status`): su peso solo se activa si
 * reemplaza.
 */
import type { CSSProperties } from "react";
import { fmtInt } from "../../../../sharedCore";
import { RELATO_SLOTS_MAX, type RelatoEscenaTitulares } from "../relatoModel";
import { RelatoCifra, RelatoHuecos } from "./relatoPartes";

export function EscenaTitulares({ escena }: { escena: RelatoEscenaTitulares }) {
  const maxElegibles = Math.max(1, ...escena.slots.map((slot) => slot.elegibles ?? 0));
  return (
    <div className="cmv2-relato-escena-cuerpo">
      <div className="cmv2-relato-cifras">
        <RelatoCifra label="Titulares (M1)" valor={fmtInt(escena.titulares)} realce />
        <RelatoCifra label="Reservas encadenadas (M2+)" valor={fmtInt(escena.reservas)} />
        <RelatoCifra label="Bolsa extra" valor={fmtInt(escena.extras)} />
      </div>

      {escena.slots.length > 0 && (
        <>
          <ul
            className="cmv2-relato-cadenas"
            aria-label={`Cadenas de reemplazo por slot titular (${fmtInt(Math.min(escena.slots.length, RELATO_SLOTS_MAX))} visibles)`}
          >
            {escena.slots.map((slot, index) => {
              const escala = slot.elegibles == null
                ? 0.55
                : 0.55 + 0.45 * Math.sqrt(Math.min(1, slot.elegibles / maxElegibles));
              return (
                <li
                  key={slot.slot}
                  className="cmv2-relato-cadena"
                  style={{ ["--relato-i" as string]: String(Math.min(index, 24)) } as CSSProperties}
                >
                  <span
                    className="cmv2-relato-cadena-titular"
                    style={{ ["--relato-escala" as string]: escala.toFixed(2) } as CSSProperties}
                    title={`${slot.titularCode} · ${slot.facultad}${slot.elegibles != null ? ` · ${fmtInt(slot.elegibles)} elegibles` : ""}`}
                  >
                    {slot.titularCode}
                  </span>
                  {slot.reservas.map((reserva) => (
                    <span
                      key={`${slot.slot}-${reserva.code}-${reserva.orden}`}
                      className="cmv2-relato-cadena-reserva"
                      title={`${reserva.code} · orden ${fmtInt(reserva.orden)}${reserva.estado ? ` · ${reserva.estado.replace(/_/g, " ")}` : ""}`}
                    >
                      {reserva.code}
                    </span>
                  ))}
                  {slot.reservas.length === 0 && (
                    <span className="cmv2-relato-cadena-vacia">sin cadena</span>
                  )}
                </li>
              );
            })}
          </ul>
          {escena.slotsOcultos > 0 && (
            <p className="cmv2-relato-nota">
              +{fmtInt(escena.slotsOcultos)} slots titulares más; sus totales están en la tabla.
            </p>
          )}
        </>
      )}

      {escena.porFacultad.length > 0 && (
        <table className="cmv2-relato-tabla">
          <thead>
            <tr>
              <th scope="col">Facultad</th>
              <th scope="col" className="is-num">Titulares</th>
              <th scope="col" className="is-num">Reservas</th>
              <th scope="col" className="is-num">Profundidad máx.</th>
              <th scope="col" className="is-num">Extras</th>
            </tr>
          </thead>
          <tbody>
            {escena.porFacultad.map((item) => (
              <tr key={item.facultad}>
                <th scope="row">{item.facultad}</th>
                <td className="is-num">{fmtInt(item.titulares)}</td>
                <td className="is-num">{fmtInt(item.reservas)}</td>
                <td className="is-num">{item.profundidadMax == null ? "—" : fmtInt(item.profundidadMax)}</td>
                <td className="is-num">{fmtInt(item.extras)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {escena.estadosActivacion.length > 0 && (
        <div className="cmv2-relato-activacion">
          <p className="cmv2-relato-nota">
            La reserva es condicional: su peso se activa solo si reemplaza a su titular.
          </p>
          <ul className="cmv2-relato-chips" aria-label="Estado de activación de las reservas">
            {escena.estadosActivacion.map((item) => (
              <li key={item.estado} className="cmv2-relato-chip is-reserva">
                <span className="cmv2-relato-chip-code">{item.estado.replace(/_/g, " ")}</span>
                <span className="cmv2-relato-chip-cifra">{fmtInt(item.reservas)} reservas</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <RelatoHuecos huecos={escena.huecos} />
    </div>
  );
}
