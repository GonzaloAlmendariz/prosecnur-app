// Aviso de la tarjeta de datos cuando la pregunta no trae base en el informe compartido (H9; baseEnCompartido.ts).

import { Info } from "../../../../vendor/lucide-react";
import { NOTA_BASE_COMPARTIDO } from "./baseEnCompartido";
import "./datosBase.css";

export function NotaBaseCompartido() {
  return (
    <p className="pulso-f6-dato pulso-f6-nota-base" role="note">
      <Info size={13} aria-hidden="true" />
      <span>{NOTA_BASE_COMPARTIDO}</span>
    </p>
  );
}
