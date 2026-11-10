// El botón de un Destacado o de una Fecha límite en el inspector: un
// interruptor que lo pone o lo quita entero (texto, enlace, tamaño y color en
// un solo paso) y "Separar como bloque", que lo saca a un bloque Botón propio
// justo encima. Acreditación 2026 (R4): el botón suelto tras los párrafos y,
// debajo, el premio sin botón.

import type { MailBlock, MailTemplate } from "../../../api/materialMail";
import { PulsoButton } from "../../../components/PulsoButton";
import { PulsoSwitch } from "../../../components/PulsoSwitch";
import { Unlink } from "../../../vendor/lucide-react";
import { botonPuesto, conBoton, puedeSepararBoton, separarBoton, sinBoton, tieneBoton } from "./modeloBotonDelBloque";
import "./correosPiezas.css";

type Props = {
  template: MailTemplate;
  block: MailBlock;
  onEditarBloque: (update: (b: MailBlock) => MailBlock) => void;
  onEditar: (update: (t: MailTemplate) => MailTemplate) => void;
  /** Tras separar, el bloque Botón nuevo queda elegido (como desde la barra del lienzo). */
  onSeleccionar?: (blockId: string) => void;
};

export function BotonDelBloque({ template, block, onEditarBloque, onEditar, onSeleccionar }: Props) {
  const con = botonPuesto(block);
  const colorPropio = block.type === "feature" && Boolean(block.button_color);
  return (
    <div className="rec-boton-del-bloque">
      <PulsoSwitch
        size="sm"
        checked={con}
        label="Lleva botón"
        description={con ? "Va dentro de esta sección" : "La sección sale sin botón"}
        onCheckedChange={(encendido) => onEditarBloque((b) => (encendido ? conBoton(b, template) : sinBoton(b)))}
      />
      {tieneBoton(block) ? (
        <PulsoButton
          variant="secondary"
          size="sm"
          disabled={!puedeSepararBoton(template, block.block_id)}
          title={colorPropio
            ? "Lo saca a un bloque Botón justo encima. El color propio no pasa: el bloque Botón usa el del correo."
            : "Lo saca a un bloque Botón justo encima, con el mismo texto, enlace y tamaño"}
          onClick={() => {
            // El id del bloque nuevo sale de esta plantilla; la edición, de la vigente al aplicarse.
            const out = separarBoton(template, block.block_id);
            if (!out) return;
            onEditar((t) => separarBoton(t, block.block_id)?.template ?? t);
            onSeleccionar?.(out.block_id);
          }}
        >
          <Unlink size={13} aria-hidden /> Separar como bloque
        </PulsoButton>
      ) : null}
    </div>
  );
}
