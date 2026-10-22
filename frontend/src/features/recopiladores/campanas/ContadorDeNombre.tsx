// «n / 80» bajo el nombre de la campaña (#16 del QA e10): el tope se ve antes
// de chocar con él. Lo lee el lector de pantalla como descripción del campo.

import { LARGO_NOMBRE } from "../correos/modeloCampanas";
import "./nombreUnico.css";

export function ContadorDeNombre({ id, nombre }: { id: string; nombre: string }) {
  const n = nombre.length;
  return (
    <span id={id} className={`rec-nueva-contador${n >= LARGO_NOMBRE ? " is-tope" : ""}`}>
      {n.toLocaleString("es-PE")} / {LARGO_NOMBRE.toLocaleString("es-PE")}
    </span>
  );
}
