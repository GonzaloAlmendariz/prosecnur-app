// Ícono de una lámina de población u objetivo (arg `icono`, tipo `icono`) en Inspector › Contenido (A10 W-B, C38). Es un
// grupo de radios nativo con los íconos subidos al proyecto y «Sin ícono»: las flechas lo recorren y elegir guarda. Un
// ícono que el plan nombra y ya no está entre los subidos se conserva y se dice. Subir íconos todavía no está en
// Láminas (IconosEditor, pendiente del retiro): sin íconos subidos, lo dice en su sitio.

import { useId } from "react";
import { AlertTriangle, Ban, History } from "../../../../vendor/lucide-react";
import type { ArgMetadata } from "../../../../api/graficos";
import { downloadUrl } from "../../../../api/core";
import type { IconoConfig } from "../../store";
import { iconoElegido, nombreIcono } from "./modeloContenidoEspecial";
import "../selectores/selectores.css";
import "./contenidoEspecial.css";

type Props = {
  arg: ArgMetadata;
  valor: unknown;
  iconos: readonly IconoConfig[];
  onCambio: (id: string | null) => void;
};

export function SelectorIconoSubido({ arg, valor, iconos, onCambio }: Props) {
  const id = useId();
  const idAyuda = `${id}-ayuda`;
  const elegido = iconoElegido(valor, iconos);
  const actual = elegido.estado === "subido" ? elegido.icono.id : elegido.estado === "desconocido" ? elegido.id : null;
  const rotulo = arg.label || "Ícono";

  return (
    <fieldset className="pulso-f6-especial pulso-f6-icono-subido" aria-describedby={idAyuda}
      data-qa-geometry-group="graficos/f6-icono-subido" data-qa-geometry-contract="intrinsic">
      <legend className="pulso-f6-subtitulo">{rotulo}</legend>
      <span id={idAyuda} className="pulso-f6-ayuda">
        {elegido.estado === "subido" ? `Sale «${nombreIcono(elegido.icono)}».`
          : elegido.estado === "desconocido" ? "El plan nombra un ícono que ya no está entre los subidos."
            : "La lámina sale sin ícono."}
      </span>
      <div className="pulso-f6-icono-subido-opciones" data-qa-geometry-group="graficos/f6-icono-subido-opciones" data-qa-geometry-contract="equal">
        <label className="pulso-f6-icono-subido-opcion" data-qa-geometry-member>
          <input type="radio" className="pulso-f6-radio-oculto" name={`${id}-icono`} checked={actual === null}
            onChange={() => onCambio(null)} />
          <span className="pulso-f6-icono-subido-muestra"><Ban size={18} aria-hidden="true" /></span>
          <span className="pulso-f6-icono-subido-nombre">Sin ícono</span>
        </label>
        {elegido.estado === "desconocido" && (
          <label className="pulso-f6-icono-subido-opcion is-desconocido" data-qa-geometry-member>
            <input type="radio" className="pulso-f6-radio-oculto" name={`${id}-icono`} checked
              onChange={() => onCambio(elegido.id)} aria-label={`El actual, que ya no está entre los subidos: ${elegido.id}`} />
            <span className="pulso-f6-icono-subido-muestra"><AlertTriangle size={18} aria-hidden="true" /></span>
            <span className="pulso-f6-icono-subido-nombre" aria-hidden="true">El actual</span>
          </label>
        )}
        {iconos.map((ic) => (
          <label key={ic.id} className="pulso-f6-icono-subido-opcion" title={nombreIcono(ic)} data-qa-geometry-member>
            <input type="radio" className="pulso-f6-radio-oculto" name={`${id}-icono`} checked={actual === ic.id}
              onChange={() => onCambio(ic.id)} aria-label={nombreIcono(ic)} />
            <span className="pulso-f6-icono-subido-muestra"><img src={downloadUrl(ic.file_id)} alt="" /></span>
            <span className="pulso-f6-icono-subido-nombre" aria-hidden="true">{nombreIcono(ic)}</span>
          </label>
        ))}
      </div>
      {iconos.length === 0 && (
        <p className="pulso-f6-pendiente">
          <History size={14} aria-hidden="true" />
          <span>El proyecto no tiene íconos subidos, y subirlos todavía no está en Láminas.</span>
        </p>
      )}
    </fieldset>
  );
}
