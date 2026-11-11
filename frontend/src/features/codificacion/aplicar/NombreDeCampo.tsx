// El nombre de un campo de la base, que puede partir de línea solo después de "/" o de "_": un nombre
// como `D1_information/*_recod` no se corta a media palabra.

import { Fragment } from "react";

type Props = { nombre: string; className?: string };

export function NombreDeCampo({ nombre, className }: Props) {
  const tramos = nombre.split(/(?<=[/_])/);
  return (
    <code className={className} title={nombre}>
      {tramos.map((tramo, i) => (
        <Fragment key={i}>
          {i > 0 ? <wbr /> : null}
          {tramo}
        </Fragment>
      ))}
    </code>
  );
}
