import type { CollectionUnit } from "../../../api/recopiladores";
import type { MaterialPreview } from "../../../api/materialPreview";
import { opcionesDeUnidad } from "./unidadesDePrueba";

type Props = {
  /** Las unidades del plan; `null` si no hay plan. */
  units: readonly CollectionUnit[] | null;
  /** La elegida; `null` = la que elige el backend (primera titular). */
  valor: string | null;
  /** La que la página dibujó, según el backend. */
  usada: MaterialPreview["unit"] | null;
  onCambiar: (unitId: string | null) => void;
  onIrAUnidades?: () => void;
};

/**
 * Con qué unidad se dibuja la página. Vive en el estado del editor y nunca en
 * la URL: es dato del plan. Las unidades se nombran con su código operativo.
 */
export function SelectorDeUnidad({ units, valor, usada, onCambiar, onIrAUnidades }: Props) {
  if (!units || !units.length) {
    return (
      <span className="rec-ed-unidad is-ejemplo">
        <span className="rec-ed-unidad-rotulo">Unidad de ejemplo</span>
        {onIrAUnidades ? (
          <button type="button" className="rec-ed-enlace" onClick={onIrAUnidades}>Ir a Unidades</button>
        ) : null}
      </span>
    );
  }
  const grupos = opcionesDeUnidad(units);
  const primera = usada?.source === "plan" && !valor && usada.label ? `Primera titular (${usada.label})` : "Primera titular";
  return (
    <label className="rec-ed-unidad">
      <span className="rec-ed-unidad-rotulo">Unidad de prueba</span>
      <select
        className="rec-ed-control rec-ed-control--compacto"
        value={valor ?? ""}
        onChange={(event) => onCambiar(event.target.value || null)}
      >
        <option value="">{primera}</option>
        {grupos.map((grupo) => (
          <optgroup key={grupo.rotulo} label={grupo.rotulo}>
            {grupo.opciones.map((opcion) => <option key={opcion.value} value={opcion.value}>{opcion.label}</option>)}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
