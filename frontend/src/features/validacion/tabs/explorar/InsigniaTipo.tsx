import { Sello } from "../../../xlsformEditor/kit/Sello";
import { TIPO_ETIQUETA, TIPO_XLSFORM, type TipoVariable } from "./tiposVariable";

/**
 * Tipo de la variable con el sello del editor de formularios: el mismo glifo
 * y el mismo tono de familia que la pregunta tiene en Formularios. Corto, sólo
 * el sello (con su nombre accesible); largo, sello y nombre.
 */
export default function InsigniaTipo({ tipo, larga = false }: { tipo: TipoVariable; larga?: boolean }) {
  const etiqueta = TIPO_ETIQUETA[tipo] ?? TIPO_ETIQUETA.mixto;
  const base = TIPO_XLSFORM[tipo] ?? TIPO_XLSFORM.mixto;
  if (!larga) {
    return (
      <span className="vx-insignia" title={etiqueta.larga}>
        <Sello baseType={base} size={20} title={etiqueta.larga} />
      </span>
    );
  }
  return (
    <span className="vx-insignia is-larga" title={etiqueta.larga}>
      <Sello baseType={base} size={18} />
      {etiqueta.larga}
    </span>
  );
}
