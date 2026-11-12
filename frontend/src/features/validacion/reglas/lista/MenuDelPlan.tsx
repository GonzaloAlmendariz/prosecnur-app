/**
 * "Más acciones" de la cabecera de Reglas (D-F7a): el plan del formulario.
 * Volver a leer el formulario (lo que era "Reconstruir plan"), exportar el plan
 * a Excel e importar el plan editado. Cada acción manda lo mismo que mandaba
 * `instrumento/PlanDelFormulario.tsx`.
 */
import { useRef, useState, type KeyboardEvent } from "react";
import { Download, MoreHorizontal, RefreshCcw, Upload } from "../../../../vendor/lucide-react";
import { Dialog } from "../../../../components/Dialog";
import { Popover } from "../../../../components/Popover";
import { PulsoButton } from "../../../../components/PulsoButton";

export function MenuDelPlan({
  planConstruido,
  hayAuditoria,
  controlesSinAplicar,
  controlesValidos,
  ocupado,
  onReleer,
  onExportar,
  onImportar,
}: {
  planConstruido: boolean;
  hayAuditoria: boolean;
  controlesSinAplicar: boolean;
  controlesValidos: boolean;
  ocupado: boolean;
  onReleer: () => void;
  onExportar: () => void;
  onImportar: (archivo: File) => void;
}) {
  const [cierres, setCierres] = useState(0);
  const [confirmar, setConfirmar] = useState(false);
  const archivo = useRef<HTMLInputElement>(null);
  const cerrarY = (accion: () => void) => () => {
    setCierres((n) => n + 1);
    accion();
  };
  // Flechas arriba y abajo recorren el menú.
  const navegar = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)'));
    if (!items.length) return;
    const actual = items.indexOf(document.activeElement as HTMLButtonElement);
    const siguiente = e.key === "ArrowDown" ? (actual + 1) % items.length : (actual - 1 + items.length) % items.length;
    e.preventDefault();
    items[siguiente]?.focus();
  };

  return (
    <>
      <Popover
        side="bottom"
        align="end"
        maxWidth={300}
        ariaLabel="Más acciones de Reglas"
        cerrarAlCambiar={cierres}
        trigger={(
          <PulsoButton variant="icon" size="md" aria-label="Más acciones" aria-haspopup="menu" title="Más acciones">
            <MoreHorizontal size={16} aria-hidden="true" />
          </PulsoButton>
        )}
      >
        <div className="pulso-rl-menu" role="menu" aria-label="Más acciones de Reglas" onKeyDown={navegar}>
          <button type="button" role="menuitem" disabled={ocupado || !controlesValidos} onClick={cerrarY(() => setConfirmar(true))}>
            <RefreshCcw size={14} aria-hidden="true" />
            <span>Volver a leer el formulario</span>
          </button>
          <button type="button" role="menuitem" disabled={ocupado || !planConstruido} onClick={cerrarY(onExportar)}>
            <Download size={14} aria-hidden="true" />
            <span>Exportar el plan a Excel</span>
          </button>
          <button type="button" role="menuitem" disabled={ocupado || !planConstruido} onClick={cerrarY(() => archivo.current?.click())}>
            <Upload size={14} aria-hidden="true" />
            <span>Importar el plan editado</span>
          </button>
        </div>
      </Popover>
      <input
        ref={archivo}
        type="file"
        accept=".xlsx"
        hidden
        aria-label="Plan editado en Excel"
        onChange={(e) => {
          const elegido = e.target.files?.[0];
          if (elegido) onImportar(elegido);
          e.target.value = "";
        }}
      />
      <Dialog
        open={confirmar}
        onOpenChange={setConfirmar}
        size="sm"
        tono="aviso"
        title="Volver a leer el formulario"
        closeLabel="Cerrar la confirmación"
        footer={(
          <>
            <PulsoButton variant="secondary" onClick={() => setConfirmar(false)}>Cancelar</PulsoButton>
            <PulsoButton
              variant="primary"
              onClick={() => {
                setConfirmar(false);
                onReleer();
              }}
            >
              Volver a leer
            </PulsoButton>
          </>
        )}
      >
        <p className="pulso-rl-confirmar">
          {controlesSinAplicar
            ? "El plan se rehace con el formulario y con los controles del operativo que cambiaste."
            : "El plan se rehace con el formulario y los controles del operativo."}
          {hayAuditoria ? " Si las reglas cambian, la última auditoría queda desactualizada hasta que vuelvas a auditar." : ""}
        </p>
      </Dialog>
    </>
  );
}
