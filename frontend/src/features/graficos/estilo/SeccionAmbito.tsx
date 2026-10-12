// ¿Dónde vive el estilo del cliente? Decisión 14 de Gonzalo: «Por base o por proyecto, depende del usuario». Radios
// nativos: flechas para moverse, espacio para elegir, nombre accesible con su explicación.

import { ESTILO_AMBITOS, type EstiloAmbito } from "../../../api/graficosEstilo";
import { ETIQUETA_AMBITO } from "./modeloEstilo";

export function SeccionAmbito({
  ambito,
  ambitoDefault,
  onCambiar,
}: {
  ambito: EstiloAmbito;
  ambitoDefault: EstiloAmbito | undefined;
  onCambiar: (ambito: EstiloAmbito) => void;
}) {
  return (
    <section className="pulso-f6-estilo-seccion" aria-labelledby="f6-estilo-ambito-titulo" data-qa-geometry-member>
      <header className="pulso-f6-estilo-seccion-cabecera">
        <h3 id="f6-estilo-ambito-titulo">Dónde se guarda</h3>
      </header>
      <p className="pulso-f6-estilo-ayuda">
        En un estudio con varias bases, el estilo puede ser uno para todas o uno por base. Al cambiar, el estilo que ves
        ahora pasa al lugar nuevo y el anterior se conserva por si vuelves.
      </p>
      <fieldset className="pulso-f6-estilo-opciones" data-qa-geometry-group="graficos/f6-estilo-ambitos" data-qa-geometry-contract="equal">
        <legend className="pulso-sr-only">Dónde se guarda el estilo del cliente</legend>
        {ESTILO_AMBITOS.map((id) => (
          <label key={id} className={`pulso-f6-estilo-opcion${ambito === id ? " is-activa" : ""}`} data-qa-geometry-member>
            <input
              type="radio"
              name="f6-estilo-ambito"
              value={id}
              checked={ambito === id}
              onChange={() => onCambiar(id)}
              aria-describedby={`f6-estilo-ambito-${id}`}
            />
            <span className="pulso-f6-estilo-opcion-texto">
              <strong>
                {ETIQUETA_AMBITO[id].titulo}
                {ambitoDefault === id ? <span className="pulso-f6-estilo-por-defecto">Por defecto</span> : null}
              </strong>
              <span id={`f6-estilo-ambito-${id}`}>{ETIQUETA_AMBITO[id].explicacion}</span>
            </span>
          </label>
        ))}
      </fieldset>
    </section>
  );
}
