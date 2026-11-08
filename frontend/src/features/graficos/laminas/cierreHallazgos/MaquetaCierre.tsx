// La maqueta del cierre con hallazgos en el editor: las tarjetas en el lugar que ocupan en la lámina (tres en fila; cuatro
// en dos por dos; cinco, tres arriba y dos abajo; lamina_cierre_hallazgos.R `.lam_cierre_hallazgos_filas`), cada una con
// su cifra viva y la frase. Una tarjeta sin cifra muestra «Hallazgo N» atenuado: es un marcador de lugar del editor y no
// sale en la lámina (el motor dibuja la tarjeta vacía, sin texto). Hay una tarjeta por fila del editor y nunca menos de
// tres (C4): las que completan las tres sin fila detrás son marcadores inertes, ocultos al lector de pantalla. Cada
// tarjeta con fila lleva al control de su fila.

import { cifraConUnidad, type HallazgoCierre } from "./modeloCierre";
import { marcadorDeLugar, type TarjetaCierre } from "./modeloMaquetaCierre";

type Props = {
  tarjetas: readonly TarjetaCierre[];
  onIr: (fila: HallazgoCierre["clave"]) => void;
};

export function MaquetaCierre({ tarjetas, onIr }: Props) {
  const cuantas = tarjetas.length;
  return (
    <div className={`pulso-f6-cierre-maqueta is-n${cuantas}`} data-qa="cierre-maqueta"
      data-qa-geometry-group="graficos/f6-cierre-maqueta" data-qa-geometry-contract="equal">
      {tarjetas.map((t) => {
        const marcador = marcadorDeLugar(t);
        const valor = t.cifra ? cifraConUnidad(t.cifra) : "";
        const fila = t.fila;
        if (fila === null) {
          return (
            <div key={`lugar-${t.numero}`} className="pulso-f6-cierre-tarjeta is-vacia is-lugar" aria-hidden="true" data-qa-geometry-member>
              <span className="pulso-f6-cierre-tarjeta-cifra">{marcador}</span>
            </div>
          );
        }
        return (
          <button key={fila} type="button" className={`pulso-f6-cierre-tarjeta${marcador ? " is-vacia" : ""}`} data-qa-geometry-member
            aria-label={`Hallazgo ${t.numero}: ${valor || "sin cifra"}${t.texto ? `. ${t.texto}` : ""}`} onClick={() => onIr(fila)}>
            <span className="pulso-f6-cierre-tarjeta-cifra">{marcador ?? valor}</span>
            {t.texto && <span className="pulso-f6-cierre-tarjeta-frase">{t.texto}</span>}
          </button>
        );
      })}
    </div>
  );
}
