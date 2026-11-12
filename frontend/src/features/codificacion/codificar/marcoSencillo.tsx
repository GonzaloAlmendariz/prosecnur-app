import type { MarcoDeCodificar } from "./marcoDeCodificar";

/**
 * El marco de la mesa fuera de la pestaña Codificar (la ruta vieja de una pregunta, `PreguntaDetalle`):
 * las acciones arriba y las dos columnas lado a lado, sin la cabecera ni la lista de preguntas de la
 * pestaña. La ruta se retira según el plan 5.3; mientras exista, sigue funcionando.
 */
export const marcoSencillo: MarcoDeCodificar = ({ acciones, columnas }) => (
  <div className="pulso-cc-sencillo">
    {acciones ? <div className="pulso-cc-sencillo-acciones">{acciones}</div> : null}
    <div className="pulso-cc-sencillo-mesa" data-qa-geometry-group="codificacion/detalle-mesa" data-qa-geometry-contract="intrinsic">
      {columnas}
    </div>
  </div>
);
