// Guía de la primera visita al editor de correos (criterio 1 del editor
// intuitivo): una línea que dice que el correo se toca, descartable y
// recordada en este equipo (localStorage; no es un dato del proyecto).

import { useState } from "react";

import { MousePointer2, X } from "../../../vendor/lucide-react";

const CLAVE = "pulso.correos.guia-vista";

function yaVista(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(CLAVE) === "1";
  } catch {
    return false;
  }
}

export function GuiaDelEditor() {
  const [visible, setVisible] = useState(() => !yaVista());
  if (!visible) return null;
  const cerrar = () => {
    try {
      localStorage.setItem(CLAVE, "1");
    } catch {
      // Sin almacenamiento: la guía se cierra en esta vista.
    }
    setVisible(false);
  };
  return (
    <p className="rec-guia" role="note">
      <MousePointer2 size={15} aria-hidden />
      <span>
        <b>Haz clic en un texto para editarlo.</b> El «+» inserta un bloque; la manija lo mueve.
      </span>
      <button type="button" className="rec-guia-cerrar" onClick={cerrar}>
        <X size={13} aria-hidden /> Entendido
      </button>
    </p>
  );
}
