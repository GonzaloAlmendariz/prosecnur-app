/**
 * Pide el motivo antes de algo que silencia reglas (vara V5): desactivar una
 * regla del formulario o del operativo, o dejar una pregunta fuera de la
 * auditoría. Sin motivo no se confirma.
 */
import { useState } from "react";
import { Dialog } from "../../../../components/Dialog";
import { PulsoButton } from "../../../../components/PulsoButton";
import { PulsoInput } from "../../../../components/PulsoInput";

export function DialogoConMotivo({
  abierto,
  titulo,
  etiqueta,
  detalle,
  confirmar,
  onCerrar,
  onConfirmar,
}: {
  abierto: boolean;
  titulo: string;
  /** Nombre accesible del campo: "Motivo para desactivar la regla". */
  etiqueta: string;
  /** Qué se silencia, en una oración. */
  detalle: string;
  /** El botón que confirma: "Desactivar", "Excluir". */
  confirmar: string;
  onCerrar: () => void;
  onConfirmar: (motivo: string) => void;
}) {
  const [motivo, setMotivo] = useState("");
  const limpio = motivo.trim();
  const cerrar = () => {
    setMotivo("");
    onCerrar();
  };
  const aceptar = () => {
    if (!limpio) return;
    setMotivo("");
    onConfirmar(limpio);
  };
  return (
    <Dialog
      open={abierto}
      onOpenChange={(siguiente) => {
        if (!siguiente) cerrar();
      }}
      size="sm"
      tono="aviso"
      title={titulo}
      closeLabel="Cerrar el motivo"
      footer={(
        <>
          <PulsoButton variant="secondary" onClick={cerrar}>Cancelar</PulsoButton>
          <PulsoButton variant="primary" disabled={!limpio} onClick={aceptar}>{confirmar}</PulsoButton>
        </>
      )}
    >
      <div className="pulso-rl-motivo">
        <p>{detalle}</p>
        <PulsoInput
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") aceptar();
          }}
          aria-label={etiqueta}
          placeholder="Motivo"
          autoFocus
        />
      </div>
    </Dialog>
  );
}
