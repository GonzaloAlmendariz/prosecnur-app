import { useCallback, useEffect, useState } from "react";
import { Inbox } from "lucide-react";

import {
  apiMonitoreoAulasEntrega,
  apiMonitoreoAulasTraerEntrega,
  type EntregaDeMaterial as Entrega,
} from "../../../../../api/monitoreoAulasEntrega";
import { fmt } from "../kpisDeAulas";
import { fechaCorta } from "./fuentesModelo";
import { EstadoChip } from "../../../../../components/EstadoChip";
import { tonoDeEstadoChip, type TonoDeAulas } from "../tonoDeEstadoChip";

const TEXTO: Record<Entrega["estado"], { estado: string; tono: TonoDeAulas; nota: string }> = {
  sin_entrega: { estado: "Sin entrega", tono: "neutro", nota: "Material todavía no entregó los cursos-horario a Monitoreo." },
  desactualizada: { estado: "Cambió", tono: "aviso", nota: "La entrega cambió después de su recibo: se vuelve a entregar desde Material." },
  por_traer: { estado: "Por traer", tono: "aviso", nota: "Hay una entrega nueva: traerla actualiza los accesos y agrega lo nuevo sin tocar lo operativo." },
  aplicada: { estado: "Al día", tono: "ok", nota: "El plan tiene la entrega vigente." },
};

/**
 * La fila «Entrega de Material» de Insumos › Fuentes (X8, ADR 0122 §11).
 * Material entrega; Monitoreo la trae a su plan con un clic. Al traerla se
 * conserva lo operativo de cada fila (estado, agenda, parte, refuerzos).
 */
export function EntregaDeMaterial({ ocupado, onTraida }: { ocupado: boolean; onTraida?: () => void }) {
  const [entrega, setEntrega] = useState<Entrega | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [trayendo, setTrayendo] = useState(false);
  const leer = useCallback(() => {
    apiMonitoreoAulasEntrega().then(setEntrega).catch(() => setEntrega(null));
  }, []);
  useEffect(() => { leer(); }, [leer]);
  if (!entrega) return null;
  const t = TEXTO[entrega.estado];

  async function traer() {
    setTrayendo(true);
    setMensaje("");
    try {
      const r = await apiMonitoreoAulasTraerEntrega();
      setMensaje(`Traída: ${fmt(r.actualizadas)} actualizadas, ${fmt(r.agregadas)} nuevas; ${fmt(r.conservadas)} filas propias se conservan.`);
      leer();
      onTraida?.();
    } catch (e) {
      setMensaje((e as Error).message);
    } finally {
      setTrayendo(false);
    }
  }

  return (
    <tr>
      <th scope="row">
        <span className="aulas-ins-fuente">
          <Inbox size={15} aria-hidden="true" />
          <span>
            <b>Entrega de Material</b>
            <small>{mensaje || t.nota}</small>
          </span>
        </span>
      </th>
      <td className="is-trae">cursos-horario con su acceso</td>
      <td className="is-num">{entrega.unidades ? `${fmt(entrega.unidades)} cursos-horario` : "—"}</td>
      <td className="is-num">{fechaCorta(entrega.entregadaEn) || "—"}</td>
      <td>
        {entrega.estado === "por_traer" ? (
          <button type="button" className="pulso-button is-primary pulso-button--sm" disabled={ocupado || trayendo} onClick={() => { void traer(); }}>
            {trayendo ? "Trayendo…" : "Traer la entrega"}
          </button>
        ) : (
          <EstadoChip label={t.estado} tone={tonoDeEstadoChip(t.tono)} />
        )}
      </td>
    </tr>
  );
}
