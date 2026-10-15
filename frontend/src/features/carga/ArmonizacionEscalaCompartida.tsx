// Armonizar por escala (G3): llevar la armonización de esta fila a las otras
// preguntas guardadas que usan la misma lista de respuestas en cada base.
//
// Dos piezas del editor de armonización: el aviso que dice cuántas comparten la
// escala y la lista para elegirlas. Qué filas casan y cómo se traduce el mapa
// vive en `escalaCompartidaModel`; aquí sólo hay render y eventos.

import { Copy } from "../../vendor/lucide-react";
import "./ArmonizacionEscalaCompartida.css";
import { PulsoButton } from "../../components/PulsoButton";
import { textoHayCompartidas, textoParciales, type CandidatoEscala } from "./escalaCompartidaModel";

export function EscalaCompartidaAviso({ n, onVer }: { n: number; onVer: () => void }) {
  if (n === 0) return null;
  return (
    <div className="pulso-armon-compartida" data-qa-geometry-member>
      <Copy size={14} aria-hidden="true" />
      <span>{textoHayCompartidas(n)}</span>
      <PulsoButton variant="secondary" size="sm" className="pulso-armon-btn" data-armon-compartir onClick={onVer}>
        Aplicar a otras con la misma escala
      </PulsoButton>
    </div>
  );
}

export type EscalaCompartidaListaProps = {
  candidatos: readonly CandidatoEscala[];
  parciales: number;
  elegidos: ReadonlySet<number>;
  /** Con cambios sin guardar, aplicar también guarda esta fila. */
  guardaOrigen: boolean;
  onAlternar: (indice: number, marcado: boolean) => void;
  onTodas: (marcadas: boolean) => void;
};

export function EscalaCompartidaLista({
  candidatos,
  parciales,
  elegidos,
  guardaOrigen,
  onAlternar,
  onTodas,
}: EscalaCompartidaListaProps) {
  const todas = candidatos.length > 0 && candidatos.every((c) => elegidos.has(c.indice));
  return (
    <section
      className="pulso-armon-seccion"
      aria-labelledby="pulso-armon-compartida-titulo"
      data-qa-geometry-member
    >
      <div className="pulso-armon-seccion-head">
        <div className="pulso-armon-seccion-titulo">
          <h3 id="pulso-armon-compartida-titulo" tabIndex={-1}>Preguntas con la misma escala</h3>
          <p className="pulso-armon-ayuda">
            Reciben esta escala común y, en cada base, el mismo destino para cada respuesta.
            {guardaOrigen ? " Esta pregunta también se guarda." : ""}
          </p>
        </div>
        <label className="pulso-armon-compartida-todas">
          <input type="checkbox" checked={todas} onChange={(e) => onTodas(e.currentTarget.checked)} />
          Todas
        </label>
      </div>
      <ul className="pulso-armon-compartida-lista">
        {candidatos.map((c) => (
          <li key={c.indice} className={elegidos.has(c.indice) ? "is-marcado" : undefined}>
            <label>
              <input
                type="checkbox"
                checked={elegidos.has(c.indice)}
                onChange={(e) => onAlternar(c.indice, e.currentTarget.checked)}
              />
              <span className="pulso-armon-compartida-texto">
                <span className="pulso-armon-compartida-nombre">{c.etiqueta || "Pregunta sin nombre"}</span>
                <small>
                  {c.variables.map((x) => `${x.base} ${x.variable}`).join(" · ")}
                </small>
              </span>
              {c.reemplaza && (
                <span
                  className="pulso-armon-compartida-chip"
                  title="Ya tiene su propia armonización. Si la marcas, se reemplaza."
                >
                  Ya armonizada
                </span>
              )}
            </label>
          </li>
        ))}
      </ul>
      {parciales > 0 && <p className="pulso-armon-nota">{textoParciales(parciales)}</p>}
    </section>
  );
}
