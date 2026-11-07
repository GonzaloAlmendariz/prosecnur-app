import { useCallback, useRef, useState } from "react";
import { apiJobCancel } from "../../api/jobs";
import { PulsoButton } from "../../components/PulsoButton";
import { X } from "../../vendor/lucide-react";

/**
 * Cancelar un import en segundo plano (L9): la base integrada y el paquete
 * .sav ya corrían como job con progreso, pero no había forma de pararlos. El
 * job se cancela en el backend; el poll de `esperarResultadoImport` ve el
 * estado `cancelled` y rechaza, y el estudio queda como estaba. Si el job ya
 * había terminado, el resultado llega igual: cancelar no deshace una base.
 */
export function useCancelarImport() {
  const jobRef = useRef<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState(false);

  const registrar = useCallback((id: string) => {
    jobRef.current = id;
    setJobId(id);
    setCancelando(false);
  }, []);

  const limpiar = useCallback(() => {
    jobRef.current = null;
    setJobId(null);
    setCancelando(false);
  }, []);

  const cancelar = useCallback(async () => {
    const id = jobRef.current;
    if (!id) return;
    setCancelando(true);
    // Si el POST falla, el poll sigue y el job termina por su cuenta.
    await apiJobCancel(id).catch(() => undefined);
  }, []);

  return { jobId, cancelando, registrar, limpiar, cancelar };
}

export function BotonCancelarImport({
  cancelando,
  onCancelar,
}: {
  cancelando: boolean;
  onCancelar: () => void;
}) {
  return (
    <PulsoButton variant="secondary" size="sm" onClick={onCancelar} disabled={cancelando}>
      <X size={13} aria-hidden="true" />
      {cancelando ? "Cancelando…" : "Cancelar"}
    </PulsoButton>
  );
}
