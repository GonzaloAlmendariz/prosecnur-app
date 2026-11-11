import { BarraDeAvance } from "../../../components/BarraDeAvance";
import { formatoConteo } from "../../../lib/formatoNumero";
import type { AvanceRespuestas } from "../avanceRespuestas";
import type { CifraDeCasos } from "./modeloDeCodificar";

export type CifrasDeCodificarProps = {
  /** Respuestas de la lista con código, sobre las de la lista (`avanceRespuestas.ts`). */
  avance: AvanceRespuestas;
  /** Solo en una pregunta múltiple con "Otros, especifique": las mismas cuentas en casos. */
  casos: readonly CifraDeCasos[];
};

/**
 * Las cifras de la pregunta en una línea, cada una una sola vez: el avance en respuestas distintas y, en
 * una múltiple con "Otros", los casos con código sobre los que marcaron la opción y los que escribieron.
 * Las pendientes van en el filtro "Por codificar" y la cantidad de códigos en la cabecera de su panel.
 */
export function CifrasDeCodificar({ avance, casos }: CifrasDeCodificarProps) {
  return (
    <div className="pulso-cc-cifras" data-qa-geometry-group="codificacion/cifras" data-qa-geometry-contract="intrinsic">
      <span className="pulso-cc-cifra pulso-cc-cifra--avance" data-qa-geometry-member="">
        <span>
          <strong>
            {formatoConteo(avance.codificadas)} de {formatoConteo(avance.total)}
          </strong>{" "}
          {avance.total === 1 ? "respuesta con código" : "respuestas con código"}
        </span>
        <BarraDeAvance valor={avance.codificadas} total={avance.total} etiqueta="Respuestas con código" />
      </span>
      {casos.map((cifra) => {
        // Con base, el plural lo decide la base: "1 de 2 casos con código".
        const cuenta = cifra.de ?? cifra.valor;
        return (
          <span key={cifra.id} className="pulso-cc-cifra" data-aviso={cifra.aviso ? "" : undefined} title={cifra.detalle} data-qa-geometry-member="">
            <span>
              <strong>{formatoConteo(cifra.valor)}</strong>
              {cifra.de !== undefined ? (
                <>
                  {" de "}
                  <strong>{formatoConteo(cifra.de)}</strong>
                </>
              ) : null}{" "}
              {cuenta === 1 ? cifra.singular : cifra.plural}
            </span>
          </span>
        );
      })}
    </div>
  );
}
