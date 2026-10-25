import { useEffect, useId, useRef, useState } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import {
  apiMonitoreoTerritorialProductionAnnulmentApply,
  apiMonitoreoTerritorialProductionAnnulmentPreview,
  type MonitoreoState,
  type MonitoreoTerritorialPhase,
  type MonitoreoTerritorialProductionAnnulmentImpact,
} from "../../../../../api/client";
import type { PanelDeclarado } from "../../../../../lib/navegacion/paneles";
import { cuerpoDelPedido, impactoEnFrases, textoDelBoton, type PedidoDeAnulacion } from "./anulacionModel";
import "./dialogo.css";

/** `panel=anular`: el diálogo es enlazable; el `foco` dice qué se anula. */
export const PANEL_ANULAR: PanelDeclarado = { id: "anular", label: "Anular", clase: "dialogo" };

type Paso =
  | { tipo: "calculando" }
  | { tipo: "listo"; impacto: MonitoreoTerritorialProductionAnnulmentImpact }
  | { tipo: "aplicando"; impacto: MonitoreoTerritorialProductionAnnulmentImpact }
  | { tipo: "error"; mensaje: string; impacto: MonitoreoTerritorialProductionAnnulmentImpact | null };

/**
 * P2 · Anular (territorial.md §3.6 y §3.8): diálogo modal con el impacto en
 * cifras con base, motivo obligatorio y el botón de peligro. Escape o
 * «Cancelar» cierran y devuelven el foco a quien lo abrió (lo hace el
 * `<dialog>` nativo). La anulación queda auditada y se puede revertir en
 * Control › Anulaciones.
 */
export function DialogoDeAnulacion({
  pedido,
  phase,
  panel,
  onCerrar,
  onAplicada,
}: {
  pedido: PedidoDeAnulacion;
  phase: MonitoreoTerritorialPhase;
  panel: { "data-pulso-panel": string };
  onCerrar: () => void;
  onAplicada: (state: MonitoreoState) => void;
}) {
  const dialogo = useRef<HTMLDialogElement | null>(null);
  const tituloId = useId();
  const [paso, setPaso] = useState<Paso>({ tipo: "calculando" });
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    const nodo = dialogo.current;
    if (nodo && !nodo.open && typeof nodo.showModal === "function") nodo.showModal();
    return () => {
      if (nodo?.open) nodo.close();
    };
  }, []);

  // La vista previa depende de QUÉ se anula, no de la identidad del objeto: un
  // corte nuevo con el diálogo abierto no debe recalcularla.
  const clave = JSON.stringify(cuerpoDelPedido(pedido));
  useEffect(() => {
    let cancelado = false;
    setPaso({ tipo: "calculando" });
    apiMonitoreoTerritorialProductionAnnulmentPreview({ phase, ...(JSON.parse(clave) as ReturnType<typeof cuerpoDelPedido>) })
      .then((resultado) => {
        if (!cancelado) setPaso({ tipo: "listo", impacto: resultado.impact });
      })
      .catch((error: unknown) => {
        if (!cancelado) setPaso({ tipo: "error", mensaje: error instanceof Error ? error.message : String(error), impacto: null });
      });
    return () => {
      cancelado = true;
    };
  }, [clave, phase]);

  const impacto = paso.tipo === "calculando" ? null : paso.impacto;
  const { casos, lineas } = impactoEnFrases(impacto);
  const puedeAplicar = (paso.tipo === "listo" || (paso.tipo === "error" && paso.impacto != null)) && motivo.trim().length > 0;

  const aplicar = async () => {
    if (!impacto || !puedeAplicar) return;
    setPaso({ tipo: "aplicando", impacto });
    try {
      const resultado = await apiMonitoreoTerritorialProductionAnnulmentApply({ phase, ...cuerpoDelPedido(pedido), reason: motivo.trim() });
      onAplicada(resultado.state);
      onCerrar();
    } catch (error) {
      setPaso({ tipo: "error", mensaje: error instanceof Error ? error.message : String(error), impacto });
    }
  };

  return (
    <dialog ref={dialogo} className="mon-dlg" aria-labelledby={tituloId} onClose={onCerrar} {...panel}>
      <form method="dialog" className="mon-dlg-cuerpo" onSubmit={(event) => { event.preventDefault(); void aplicar(); }}>
        <header className="mon-dlg-cabecera">
          <TriangleAlert size={18} aria-hidden="true" />
          <h2 id={tituloId}>{pedido.alcance === "caso" ? "Anular un caso" : "Anular la producción"}</h2>
        </header>
        <p className="mon-dlg-sujeto">{pedido.rotulo}</p>

        <section className="mon-dlg-impacto" aria-label="Qué cambia">
          {paso.tipo === "calculando" ? (
            <p className="mon-dlg-base"><Loader2 size={14} className="pulso-spin" aria-hidden="true" /> Calculando qué cambia…</p>
          ) : lineas.length ? (
            <ul>
              {lineas.map((linea) => <li key={linea.clave}>{linea.texto}</li>)}
            </ul>
          ) : (
            <p className="mon-dlg-base">La anulación no cambia lo que cuenta para la meta.</p>
          )}
        </section>

        <label className="mon-dlg-motivo">
          <span>Motivo (obligatorio)</span>
          <textarea value={motivo} rows={3} required onChange={(event) => setMotivo(event.currentTarget.value)} />
        </label>
        <p className="mon-dlg-base">Queda en el historial con autor y fecha, y se puede revertir en Control › Anulaciones.</p>

        {paso.tipo === "error" ? <p className="mon-dlg-error" role="alert">{paso.mensaje}</p> : null}

        <footer className="mon-dlg-pie">
          <button type="button" className="mon-dlg-boton" onClick={() => dialogo.current?.close()}>Cancelar</button>
          <button type="submit" className="mon-dlg-boton is-peligro" disabled={!puedeAplicar}>
            {paso.tipo === "aplicando" ? <Loader2 size={14} className="pulso-spin" aria-hidden="true" /> : null}
            {textoDelBoton(pedido, casos)}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
