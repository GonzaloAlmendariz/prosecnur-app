// Regla «Respuestas «Otros»» (R7 del rediseño, 2026-10-15; decisión D4): el interruptor que vivía en la barra del Informe
// pasa a Reglas. Agrega, después de cada gráfico cuya pregunta tenga campo abierto, sus respuestas «Otros» (lámina en el
// PowerPoint, tabla numerada en el Word). Sólo vale para todo el informe: no hay regla por tipo ni por gráfico.

import { useId } from "react";
import { Segmentado } from "../subpestanas/Segmentado";
import { CabeceraSeccion } from "./CabeceraSeccion";
import { ROTULO_OTROS } from "../vistaGeneral/interruptorOtrosModel";

type Opcion = "no" | "si";
const OPCIONES: readonly { clave: Opcion; rotulo: string }[] = [
  { clave: "no", rotulo: "No agregar" },
  { clave: "si", rotulo: "Después de su gráfico" },
];

export function SeccionOtros({ encendido, ayuda, onCambiar }: { encendido: boolean; ayuda: string; onCambiar: (v: boolean) => void }) {
  const tituloId = useId();
  return (
    <section className="pulso-f6-informe-seccion" aria-labelledby={tituloId} data-qa-geometry-member data-seccion="otros">
      <CabeceraSeccion id={tituloId} titulo="Respuestas Otros" modificado={encendido}
        etiquetaVolver="Volver al valor por defecto de las respuestas Otros" onVolver={() => onCambiar(false)} />
      <Segmentado etiqueta={ROTULO_OTROS} opciones={OPCIONES}
        valor={encendido ? "si" : "no"} onCambiar={(k) => onCambiar(k === "si")} />
      <p className="pulso-f6-informe-ayuda">
        {encendido ? ayuda : "Lo que escribieron en Otro (especifique) no sale en el informe."} Sólo para todo el informe: no hay
        regla por tipo ni por gráfico.
      </p>
    </section>
  );
}
