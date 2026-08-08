/**
 * E2 · «Estratos y cuotas»: cómo se estratificó el sorteo (variables del
 * selector) y qué cuota recibió cada estrato, agregando las filas M1 de la
 * corrida contra su `stratum_eligible_n` publicado.
 */
import type { CSSProperties } from "react";
import { fmtInt } from "../../../../sharedCore";
import type { RelatoEscenaEstratos } from "../relatoModel";
import { RelatoCifra, RelatoHuecos } from "./relatoPartes";

export function EscenaEstratos({ escena }: { escena: RelatoEscenaEstratos }) {
  return (
    <div className="cmv2-relato-escena-cuerpo">
      <div className="cmv2-relato-cifras">
        <RelatoCifra label="Estratos con cuota" valor={fmtInt(escena.estratos.length)} />
        <RelatoCifra label="Cursos-horario titulares" valor={fmtInt(escena.cuotaTotal)} realce />
        <RelatoCifra
          label="Variables de estratificación"
          valor={escena.variablesEstrato.length ? escena.variablesEstrato.join(" × ") : "—"}
        />
      </div>
      {escena.estratos.length > 0 && (
        <table className="cmv2-relato-tabla">
          <thead>
            <tr>
              <th scope="col">Estrato</th>
              <th scope="col" className="is-num">Elegibles del estrato</th>
              <th scope="col" className="is-num">Cuota del sorteo</th>
            </tr>
          </thead>
          <tbody>
            {escena.estratos.map((item, index) => (
              <tr
                key={item.estrato}
                className="cmv2-relato-fila-anim"
                style={{ "--relato-i": String(Math.min(index, 24)) } as CSSProperties}
              >
                <th scope="row">{item.estrato}</th>
                <td className="is-num">{item.elegiblesEstrato == null ? "—" : fmtInt(item.elegiblesEstrato)}</td>
                <td className="is-num">{fmtInt(item.cuota)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <RelatoHuecos huecos={escena.huecos} />
    </div>
  );
}
