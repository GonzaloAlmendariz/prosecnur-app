import { Dialog } from "../../../components/Dialog";
import { PulsoButton } from "../../../components/PulsoButton";
import { Link2Off } from "../../../vendor/lucide-react";

/** Desemparejar pide confirmación: deshace la pareja y los códigos de la pregunta se revisan después. */
export function ConfirmarDesemparejar({ pregunta, abierto, onCancelar, onConfirmar }: {
  pregunta: string;
  abierto: boolean;
  onCancelar: () => void;
  onConfirmar: () => void;
}) {
  return (
    <Dialog
      size="sm"
      open={abierto}
      onOpenChange={(v) => {
        if (!v) onCancelar();
      }}
      icon={<Link2Off size={16} aria-hidden="true" />}
      title={`Desemparejar ${pregunta}`}
      subtitle="La pregunta y su texto vuelven a la lista por separado."
      footer={(
        <>
          <PulsoButton variant="ghost" size="sm" onClick={onCancelar}>Cancelar</PulsoButton>
          <PulsoButton variant="primary" size="sm" onClick={onConfirmar}>Desemparejar</PulsoButton>
        </>
      )}
    >
      <p className="pulso-preg-insp-ayuda">Si la pregunta ya tenía códigos, revisa en Codificar a qué columna quedan asignados.</p>
    </Dialog>
  );
}
