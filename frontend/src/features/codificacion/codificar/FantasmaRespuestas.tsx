import { formatoConteo } from "../../../lib/formatoNumero";

/** Lo que sigue al puntero mientras se arrastran respuestas: el texto de la primera y cuántas más van con ella. */
export function FantasmaRespuestas({ texto, cuantas }: { texto: string; cuantas: number }) {
  return (
    <div className="pulso-cc-fantasma">
      <span className="pulso-cc-fantasma-texto">{texto}</span>
      {cuantas > 1 ? <span className="pulso-cc-fantasma-mas">+{formatoConteo(cuantas - 1)}</span> : null}
    </div>
  );
}
