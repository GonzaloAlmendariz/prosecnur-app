// El nombre de un campo de la base, que puede partir de línea solo después de "/" o de "_": un nombre
// como `D1_information/*_recod` no se corta a media palabra.

import { Fragment } from "react";

type Props = { nombre: string; className?: string; /** Por defecto, el nombre. */ titulo?: string };

export function NombreDeCampo({ nombre, className, titulo }: Props) {
  // Con barra, solo se corta tras ella ("D1_information/" y "9_recod"): cortar también en el guion bajo
  // dejaba "9_" en un renglón y "recod" en otro. Sin barra, el guion bajo es el único corte posible.
  const tramos = nombre.includes("/") ? nombre.split(/(?<=\/)/) : nombre.split(/(?<=_)/);
  return (
    <code className={className} title={titulo ?? nombre}>
      {tramos.map((tramo, i) => (
        <Fragment key={i}>
          {i > 0 ? <wbr /> : null}
          {tramo}
        </Fragment>
      ))}
    </code>
  );
}
