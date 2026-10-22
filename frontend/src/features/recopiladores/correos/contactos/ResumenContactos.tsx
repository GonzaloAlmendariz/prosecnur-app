// Las cifras de la lista, arriba del tablero. Cinco tarjetas pares: mismo
// marco pase lo que pase con sus cifras (C2, grupo `equal`).

import type { ResumenDeContactos } from "../../../../api/mailContactos";
import { tarjetasDeResumen } from "./modeloContactos";

type Props = {
  resumen: ResumenDeContactos;
  respuestasLeidas: boolean;
};

export function ResumenContactos({ resumen, respuestasLeidas }: Props) {
  const tarjetas = tarjetasDeResumen(resumen, respuestasLeidas);
  return (
    <ul
      className="rec-contactos-resumen"
      aria-label="Resumen de la lista"
      data-qa-geometry-group="material-campo/correo/contactos/resumen"
      data-qa-geometry-contract="equal"
    >
      {tarjetas.map((t) => (
        <li key={t.id} className={`rec-contactos-cifra is-${t.tono}`} data-testid={`contactos-cifra-${t.id}`}>
          <span className="rec-contactos-cifra-titulo">{t.titulo}</span>
          <strong className="rec-contactos-cifra-valor">{t.valor}</strong>
          <span className="rec-contactos-cifra-detalle">{t.detalle}</span>
        </li>
      ))}
    </ul>
  );
}
