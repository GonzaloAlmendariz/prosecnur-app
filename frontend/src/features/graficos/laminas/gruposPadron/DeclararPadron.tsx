// X5: el enlace «Declarar en Cálculo de muestra» bajo los públicos cuando alguno se queda sin padrón (la lámina va sólo
// con los n). Se monta sólo entonces, así que el tipo del estudio (usePlannerModos) se pide sólo cuando hace falta;
// mientras llega, el enlace a Cálculo de muestra ya está y Monitoreo se suma si el estudio es de acreditación.

import { Link } from "react-router-dom";
import { usePlannerModos } from "../../../estudio/usePlannerModos";
import { dondeDeclararPadron } from "./dondeDeclarar";

export function DeclararPadron() {
  const { modos } = usePlannerModos();
  const destinos = dondeDeclararPadron(modos ? { calc: modos.calc.modo, monitoreo: modos.monitoreo.modos } : null);
  return (
    <span className="pulso-f6-publicos-declarar" data-qa="declarar-padron">
      {destinos.map((d) => (
        <Link key={d.clave} className="pulso-f6-enlace-ayuda" to={d.href} aria-label={d.nombre}>{d.texto}</Link>
      ))}
    </span>
  );
}
