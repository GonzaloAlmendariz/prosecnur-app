import { Switch } from "../../../../components/Switch";
import { PanelDeMesa } from "../../../../components/procesamiento/PanelDeMesa";

/**
 * La marca "ya viene codificada" de la base (prototipo "carga-variables",
 * contenedor "Roles de la base"). El motor no publica los roles de la base
 * (identidad del caso, recopilador, fecha de respuesta), así que el
 * contenedor lleva solo el interruptor y se nombra por él.
 */
export function CodificacionDeLaBase({
  yaCodificada,
  ocupado,
  error,
  onCambiar,
}: {
  yaCodificada: boolean;
  ocupado: boolean;
  error: string;
  onCambiar: (ya: boolean) => void;
}) {
  return (
    <PanelDeMesa zona="codificada" titulo="Codificación de la base">
      <div className="pulso-variables-ajuste">
        <div className="pulso-variables-ajuste-texto">
          <b>La base ya viene codificada</b>
          <span>Codificación no se aplica sobre ella</span>
        </div>
        <Switch
          checked={yaCodificada}
          disabled={ocupado}
          ariaLabel="La base ya viene codificada"
          onToggle={() => onCambiar(!yaCodificada)}
        />
      </div>
      {error ? <p className="pulso-variables-aviso is-error" role="alert">{error}</p> : null}
    </PanelDeMesa>
  );
}
