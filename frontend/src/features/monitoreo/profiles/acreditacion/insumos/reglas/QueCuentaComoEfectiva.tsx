import { ArrowDown, ArrowUp } from "lucide-react";
import { Alert } from "../../../../../../components/Alert";
import { fmt } from "../../formato";
import { enMinutos } from "./reglasModelo";

/**
 * Tarjeta «Qué cuenta como efectiva» de Insumos › Reglas: las reglas de rechazo
 * y los filtros dichos en frases, la duración válida y qué estado manda cuando
 * una persona respondió más de una vez.
 */
export function QueCuentaComoEfectiva({
  frases,
  duracionMinima,
  duracionMaxima,
  prioridad,
  onDuracionMinima,
  onDuracionMaxima,
  onMover,
  bloqueada,
}: {
  frases: readonly string[];
  duracionMinima: string;
  duracionMaxima: string;
  prioridad: readonly string[];
  onDuracionMinima: (valor: string) => void;
  onDuracionMaxima: (valor: string) => void;
  onMover: (indice: number, paso: -1 | 1) => void;
  bloqueada: boolean;
}) {
  return (
    <section className="acr-av-panel acr-rg-tarjeta" aria-label="Qué cuenta como efectiva" data-qa-geometry-member>
      <header className="acr-av-panel-cabecera"><h3>Qué cuenta como efectiva</h3></header>
      <div className="acr-rg-cuerpo">
        {frases.length ? (
          <ul className="acr-rg-frases">{frases.map((frase) => <li key={frase}>{frase}</li>)}</ul>
        ) : <Alert kind="info">El estudio no declara reglas de rechazo ni filtros: cuenta toda respuesta completa.</Alert>}
        <div>
          <span className="acr-av-antetitulo">Duración válida</span>
          <div className="acr-rg-duracion">
            <label>
              <span>Mínima</span>
              <span className="acr-mo-entrada">
                <input inputMode="numeric" value={duracionMinima} onChange={(event) => onDuracionMinima(event.currentTarget.value)} aria-label="Duración mínima, en segundos" disabled={bloqueada} />
                <span aria-hidden="true">s</span>
              </span>
              <small className="acr-av-tenue">{enMinutos(duracionMinima)}</small>
            </label>
            <label>
              <span>Máxima</span>
              <span className="acr-mo-entrada">
                <input inputMode="numeric" value={duracionMaxima} onChange={(event) => onDuracionMaxima(event.currentTarget.value)} aria-label="Duración máxima, en segundos" disabled={bloqueada} />
                <span aria-hidden="true">s</span>
              </span>
              <small className="acr-av-tenue">{enMinutos(duracionMaxima)}</small>
            </label>
          </div>
        </div>
        <div>
          <span className="acr-av-antetitulo">Si una persona respondió más de una vez, manda</span>
          <ol className="acr-rg-prioridad">
            {prioridad.map((estado, indice) => (
              <li key={estado}>
                <span className="acr-av-tenue acr-av-num">{fmt(indice + 1)}</span>
                <span>{estado}</span>
                <span className="acr-rg-mover">
                  <button type="button" className="acr-av-icono" onClick={() => onMover(indice, -1)} disabled={bloqueada || indice === 0} aria-label={`Subir ${estado}`}><ArrowUp size={14} aria-hidden="true" /></button>
                  <button type="button" className="acr-av-icono" onClick={() => onMover(indice, 1)} disabled={bloqueada || indice === prioridad.length - 1} aria-label={`Bajar ${estado}`}><ArrowDown size={14} aria-hidden="true" /></button>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
