/**
 * E1 · «El marco»: población del archivo → elegibles → cursos-horario, con la
 * lectura de elegibles por facultad (números ya calculados por el motor). El
 * detalle criterio a criterio NO se duplica aquí: se enlaza a la matriz de
 * cascada de Marco (ADR 0058).
 */
import type { CSSProperties } from "react";
import { fmtInt } from "../../../../sharedCore";
import type { AulasNavigate } from "../../aulasSurfaceState";
import type { RelatoEscenaMarco } from "../relatoModel";
import { RelatoCifra, RelatoHuecos } from "./relatoPartes";

export function EscenaMarco({
  escena,
  onNavigate,
}: {
  escena: RelatoEscenaMarco;
  onNavigate?: AulasNavigate;
}) {
  const maxElegibles = Math.max(1, ...escena.porFacultad.map((item) => item.elegibles));
  return (
    <div className="cmv2-relato-escena-cuerpo">
      <div className="cmv2-relato-cifras">
        <RelatoCifra label="Filas del archivo" valor={fmtInt(escena.filasArchivo)} />
        <span className="cmv2-relato-flecha" aria-hidden="true">→</span>
        <RelatoCifra label="Estudiantes elegibles" valor={fmtInt(escena.elegibles)} realce />
        <span className="cmv2-relato-flecha" aria-hidden="true">→</span>
        <RelatoCifra label="Cursos-horario seleccionables" valor={fmtInt(escena.cursosHorario)} />
      </div>
      {escena.porFacultad.length > 0 && (
        <ul className="cmv2-relato-barras" aria-label="Elegibles por facultad">
          {escena.porFacultad.map((item, index) => (
            <li
              key={item.facultad}
              className={`cmv2-relato-barra${item.enFoco ? " is-foco" : ""}`}
              style={{ "--relato-i": String(Math.min(index, 24)) } as CSSProperties}
            >
              <span className="cmv2-relato-barra-nombre">{item.facultad}</span>
              <span className="cmv2-relato-barra-pista" aria-hidden="true">
                <span
                  className="cmv2-relato-barra-valor"
                  style={{ width: `${Math.max(2, Math.round((item.elegibles / maxElegibles) * 100))}%` }}
                />
              </span>
              <span className="cmv2-relato-barra-cifra">{fmtInt(item.elegibles)}</span>
            </li>
          ))}
        </ul>
      )}
      {onNavigate && (
        <button
          type="button"
          className="cmv2-ghost cmv2-relato-enlace"
          onClick={() => onNavigate("marco", "marco-ch-radiografia")}
        >
          Cascada criterio a criterio en Marco
        </button>
      )}
      <RelatoHuecos huecos={escena.huecos} />
    </div>
  );
}
