/**
 * E3 · «Las probabilidades» — el bombo (metáfora goo, dirección 2026-08-07).
 *
 * Cada bola es un curso-horario real del bombo y su tamaño son sus elegibles
 * publicados (`eligible_n`): el PPS hecho visible. Las sorteadas llevan su π
 * (`pi_final`, ADR 0066) y la certeza (π = 1) va rotulada «sin sorteo» con
 * doble contorno. El resto del bombo que no cabe como bola se agrega como masa
 * rotulada — un hecho, nunca tamaños imaginados.
 */
import { fmtInt, fmtPct } from "../../../../sharedCore";
import type { RelatoEscenaProbabilidades } from "../relatoModel";
import { BolaGoo, MasaGoo, maxElegiblesDeBolas } from "./goo";
import { RelatoCifra, RelatoHuecos } from "./relatoPartes";

export function EscenaProbabilidades({ escena }: { escena: RelatoEscenaProbabilidades }) {
  const maxElegibles = maxElegiblesDeBolas(escena.bolas);
  const sorteadas = escena.bolas.filter((bola) => bola.seleccionada).length;
  return (
    <div className="cmv2-relato-escena-cuerpo">
      <div className="cmv2-relato-cifras">
        <RelatoCifra
          label="Bolas en el bombo"
          valor={fmtInt(escena.bolas.length + escena.masa.reduce((total, item) => total + item.aulas, 0))}
          detalle={escena.bomboConocido ? "marco curso a curso" : "sorteadas + masa auditada"}
        />
        <RelatoCifra label="Sorteadas con π" valor={fmtInt(sorteadas)} realce />
        <RelatoCifra
          label="Certezas (π = 100%)"
          valor={fmtInt(escena.certezas)}
          detalle={escena.certezas > 0 ? "entran directo, sin sorteo" : undefined}
        />
        <RelatoCifra label="Procedencia" valor={escena.fuenteCorrida} />
      </div>

      <svg
        className="cmv2-relato-goo"
        viewBox="0 0 100 100"
        role="img"
        aria-label={`Bombo del sorteo: ${fmtInt(escena.bolas.length)} bolas visibles, tamaño = elegibles publicados`}
      >
        {escena.bolas.map((bola, index) => (
          <BolaGoo
            key={`${bola.code}-${index}`}
            bola={bola}
            index={index}
            total={escena.bolas.length}
            maxElegibles={maxElegibles}
          />
        ))}
      </svg>
      <MasaGoo masa={escena.masa} />

      {escena.porFacultad.length > 0 && (
        <table className="cmv2-relato-tabla">
          <thead>
            <tr>
              <th scope="col">Facultad</th>
              <th scope="col" className="is-num">Sorteadas</th>
              <th scope="col" className="is-num">Certezas</th>
              <th scope="col" className="is-num">π mínima</th>
              <th scope="col" className="is-num">π máxima</th>
            </tr>
          </thead>
          <tbody>
            {escena.porFacultad.map((item) => (
              <tr key={item.facultad}>
                <th scope="row">{item.facultad}</th>
                <td className="is-num">{fmtInt(item.aulas)}</td>
                <td className="is-num">{fmtInt(item.certezas)}</td>
                <td className="is-num">{item.piMin == null ? "—" : fmtPct(item.piMin)}</td>
                <td className="is-num">{item.piMax == null ? "—" : fmtPct(item.piMax)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <RelatoHuecos huecos={escena.huecos} />
    </div>
  );
}
