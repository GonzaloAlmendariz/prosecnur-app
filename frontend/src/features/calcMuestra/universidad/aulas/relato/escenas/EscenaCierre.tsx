/**
 * E6 · «El cierre»: pesos 1/π publicados por la corrida, sus advertencias
 * metodológicas y la firma de reproducibilidad (`selection_run_id` + semilla):
 * dos personas con esta dirección ven la misma película (ADR 0067 §3).
 */
import { fmtDec, fmtPct } from "../../../../sharedCore";
import type { RelatoEscenaCierre } from "../relatoModel";
import { RelatoCifra, RelatoHuecos } from "./relatoPartes";

export function EscenaCierre({ escena }: { escena: RelatoEscenaCierre }) {
  return (
    <div className="cmv2-relato-escena-cuerpo">
      <div className="cmv2-relato-cifras">
        <RelatoCifra label="Corrida" valor={escena.runId || "—"} realce />
        <RelatoCifra label="Semilla" valor={escena.semilla ?? "—"} />
        <RelatoCifra label="Motor" valor={escena.motor || "—"} />
      </div>
      {escena.pesoEjemplo && (
        <p className="cmv2-relato-nota">
          Peso de análisis = 1/π publicado por curso-horario. Ejemplo de la corrida:{" "}
          <strong>{escena.pesoEjemplo.code}</strong> con π {fmtPct(escena.pesoEjemplo.pi)} recibe
          peso {fmtDec(escena.pesoEjemplo.peso, 2)}.
        </p>
      )}
      {escena.advertencias.length > 0 && (
        <ul className="cmv2-relato-huecos is-ajuste" aria-label="Advertencias metodológicas de la corrida">
          {escena.advertencias.map((texto) => (
            <li key={texto}>{texto}</li>
          ))}
        </ul>
      )}
      <dl className="cmv2-relato-firma">
        {escena.generadoEn ? (
          <div>
            <dt>Generada</dt>
            <dd>{escena.generadoEn}</dd>
          </div>
        ) : null}
        {escena.frameHash ? (
          <div>
            <dt>Firma del marco</dt>
            <dd>{escena.frameHash}</dd>
          </div>
        ) : null}
      </dl>
      <RelatoHuecos huecos={escena.huecos} />
    </div>
  );
}
