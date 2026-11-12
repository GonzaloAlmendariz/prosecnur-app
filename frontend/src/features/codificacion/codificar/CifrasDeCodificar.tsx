import { formatoConteo } from "../../../lib/formatoNumero";
import type { CifraDeCasos } from "./modeloDeCodificar";

export type CifrasDeCodificarProps = {
  /** Las cuentas en casos (personas): con código y con texto (`cifrasDeCasos`). */
  casos: readonly CifraDeCasos[];
};

/**
 * Las cifras en casos de la pregunta, junto a la barra de avance: cuántas personas tienen código y cuántas
 * escribieron algo. El avance en respuestas va en la cabecera de la pestaña; aquí no se repite.
 */
export function CifrasDeCodificar({ casos }: CifrasDeCodificarProps) {
  return (
    <div className="pulso-cc-cifras" data-qa-geometry-group="codificacion/cifras" data-qa-geometry-contract="intrinsic">
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
