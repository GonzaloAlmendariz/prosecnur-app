// Los chips de una caja (Top o Bottom Two Box) en la tarjeta de un gráfico de escala, con lo que la lámina va a sacar:
// si la columna está encendida y no tiene categorías, el motor la omite, y la tarjeta lo dice junto a los chips
// (`avisoSinCategorias`, twoBox.ts). Presentación pura: el estado y el patch viven en `TwoBoxGrafico`/`twoBox.ts`.

import { Top2BoxSelector } from "../../Top2BoxSelector";
import { avisoSinCategorias, type Caja } from "./twoBox";

type Props = {
  caja: Caja;
  nombre: "Top Two Box" | "Bottom Two Box";
  categorias: string[];
  onChange: (etiquetas: string[]) => void;
};

export function ChipsTwoBox({ caja, nombre, categorias, onChange }: Props) {
  const aviso = avisoSinCategorias(caja, nombre);
  return (
    <>
      <Top2BoxSelector nombre={nombre} categorias={categorias} seleccion={caja.etiquetas} onChange={onChange} />
      {aviso && (
        <p className="pulso-f6-twobox-estado is-pendiente" role="status" data-qa="twobox-sin-categorias">
          {aviso}
        </p>
      )}
      {caja.delInforme && <span className="pulso-f6-dato-ayuda">Las categorías vienen del estilo del informe; elegir otras las cambia sólo en este gráfico.</span>}
    </>
  );
}
