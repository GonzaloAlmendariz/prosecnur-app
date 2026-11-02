import { TIPO_ETIQUETA, type TipoVariable } from "./tiposVariable";

/** Etiqueta del tipo de variable, en el tono de su tipo (tokens, no hex). */
export default function InsigniaTipo({ tipo, larga = false }: { tipo: TipoVariable; larga?: boolean }) {
  const etiqueta = TIPO_ETIQUETA[tipo] ?? TIPO_ETIQUETA.mixto;
  return (
    <span className={`vx-insignia vx-tipo-${tipo}${larga ? " is-larga" : ""}`} title={etiqueta.larga}>
      {larga ? etiqueta.larga : etiqueta.corta}
    </span>
  );
}
