import { useId, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import type { PreguntaAbierta } from "../../api/codificacion";
import { FichaPregunta } from "../../components/procesamiento/FichaPregunta";
import { PulsoButton } from "../../components/PulsoButton";
import { textoPlano } from "../../lib/textoPlano";
import { Link2, X } from "../../vendor/lucide-react";
import { esCerrada, tipoDeFicha } from "./preguntas/modeloUnidades";

// Emparejar dos preguntas cuando no se sabe cuál recibe los códigos.
//
// Un texto con una pregunta cerrada no pasa por aquí: se empareja de inmediato, al soltarlo o al
// elegirlo en el selector. Este diálogo queda para las combinaciones ambiguas (una cerrada sobre un
// texto, dos del mismo tipo, una numérica sobre una cerrada) y pregunta una sola cosa: cuál de las dos
// recibe los códigos. La otra aporta las respuestas que se codifican.
//
// Lo demás se decide después en el inspector de la pareja: el modo de una pregunta de opción única
// (aquí se guarda el de siempre, codificar la pregunta original) y la opción "Otros" de una múltiple.

type Sentido = "recibe-destino" | "recibe-origen";

export type RelationResult = {
  parent: string;      // la pregunta que recibe los códigos
  child_col: string;   // la columna de la que aporta las respuestas
  modo_so?: "padre" | "hijo";
  dummy_col?: string;
};

function ficha(p: PreguntaAbierta) {
  const etiqueta = textoPlano(p.parent_label);
  return <FichaPregunta tipo={tipoDeFicha(p.tipo)} codigo={etiqueta ? p.parent : undefined} etiqueta={etiqueta || p.parent} />;
}

export function RelationDialog({
  source, target, onConfirm, onCancel,
}: {
  source: PreguntaAbierta;
  target: PreguntaAbierta;
  onConfirm: (result: RelationResult) => void;
  onCancel: () => void;
}) {
  // `target` es la pregunta sobre la que se soltó (o la que se eligió): por defecto recibe los códigos.
  const [sentido, setSentido] = useState<Sentido>("recibe-destino");
  const grupo = useId();

  const recibe = sentido === "recibe-destino" ? target : source;
  const aporta = sentido === "recibe-destino" ? source : target;
  const columna = aporta.col_efectiva || aporta.parent;
  const listo = Boolean(recibe.parent && columna);

  function emparejar() {
    if (!listo) return;
    const resultado: RelationResult = { parent: recibe.parent, child_col: columna };
    if (recibe.tipo === "select_one") resultado.modo_so = "padre";
    onConfirm(resultado);
  }

  const opciones: Array<{ valor: Sentido; recibe: PreguntaAbierta; aporta: PreguntaAbierta }> = [
    { valor: "recibe-destino", recibe: target, aporta: source },
    { valor: "recibe-origen", recibe: source, aporta: target },
  ];

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="pulso-cv2-overlay pulso-preg-velo" />
        <Dialog.Content className="pulso-cv2-dialog pulso-codificacion-relation-target-dialog">
          <header className="pulso-codificacion-relation-target-head">
            <span className="pulso-codificacion-import-icon" aria-hidden="true"><Link2 size={18} /></span>
            <div>
              <Dialog.Title asChild>
                <h2>Emparejar preguntas</h2>
              </Dialog.Title>
              <Dialog.Description>
                Elige cuál de las dos recibe los códigos. La otra aporta las respuestas que se codifican.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" className="pulso-icon" aria-label="Cerrar">
                <X size={14} aria-hidden="true" />
              </button>
            </Dialog.Close>
          </header>

          <div className="pulso-preg-sentidos" role="radiogroup" aria-label="Pregunta que recibe los códigos">
            {opciones.map((opcion) => (
              <label key={opcion.valor} className="pulso-preg-sentido" data-elegido={sentido === opcion.valor ? "" : undefined}>
                <input
                  type="radio"
                  name={grupo}
                  checked={sentido === opcion.valor}
                  onChange={() => setSentido(opcion.valor)}
                />
                <span className="pulso-preg-sentido-texto">
                  <span className="pulso-preg-sentido-rotulo">Recibe los códigos</span>
                  <span>{ficha(opcion.recibe)}</span>
                  <span className="pulso-preg-sentido-rotulo">Aporta las respuestas</span>
                  <span>{ficha(opcion.aporta)}</span>
                </span>
              </label>
            ))}
          </div>

          {esCerrada(recibe) ? null : (
            <p className="pulso-preg-sentido-nota" role="note">
              {recibe.parent} no es una pregunta cerrada: la pareja se guarda y {recibe.parent} se sigue codificando
              como pregunta abierta.
            </p>
          )}

          <footer className="pulso-preg-dialogo-pie">
            <Dialog.Close asChild>
              <PulsoButton variant="secondary">Cancelar</PulsoButton>
            </Dialog.Close>
            <PulsoButton variant="primary" disabled={!listo} onClick={emparejar}>
              Emparejar
            </PulsoButton>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
