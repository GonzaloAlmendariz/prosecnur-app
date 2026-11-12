// El nombre de una variable con puntos de corte después de cada guion bajo y
// cada punto: "time_consent_start" baja de línea en "time_consent_" y no a
// media palabra. Es dato operativo: no se recorta.

import { Fragment } from "react";

export function CodigoConCortes({ nombre }: { nombre: string }) {
  const partes = nombre.split(/(?<=[_.])/);
  return (
    <>
      {partes.map((parte, i) => (
        <Fragment key={i}>{parte}{i < partes.length - 1 ? <wbr /> : null}</Fragment>
      ))}
    </>
  );
}
