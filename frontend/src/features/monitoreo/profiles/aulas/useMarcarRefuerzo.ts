import { useState } from "react";

import { apiMonitoreoAulasMarcarRefuerzo } from "../../../../api/monitoreo";
import { fmt } from "./kpisDeAulas";

/**
 * **Marcar un curso-horario como refuerzo, de uno en uno o de quince en quince.**
 *
 * Vive aparte porque lo llaman dos superficies —el popover de candidatos y el
 * reparto del techo— y la llamada tiene tres cosas que no conviene escribir dos
 * veces: cuál está en curso (para bloquear su botón), qué contestó el motor
 * (que es la única confirmación que ve quien pulsa) y, en el lote, **cuántas
 * entraron y cuáles no**.
 *
 * El lote va en SERIE a propósito. Cada marca reescribe el plan en el estado de
 * sesión; quince peticiones en paralelo pelean por la misma escritura. En serie
 * tardan más y se puede decir «7 de 15» mientras avanza.
 */
export type FalloDeMarca = { codigo: string; motivo: string };

export type PedidoDeMarca = {
  codigo: string;
  tipo: "complemento" | "refuerzo";
  /** A quién ayuda: un curso-horario en B, una facultad en C. */
  para: string;
  motivo?: string;
};

export function useMarcarRefuerzo(onGuardado?: () => void) {
  /** El código que se está marcando ahora, para apagar SU botón y no todos. */
  const [marcando, setMarcando] = useState("");
  const [progreso, setProgreso] = useState<{ hechas: number; total: number } | null>(null);
  const [aviso, setAviso] = useState("");
  const [fallos, setFallos] = useState<ReadonlyArray<FalloDeMarca>>([]);

  const limpiar = () => { setAviso(""); setFallos([]); setProgreso(null); };

  const marcar = async (codigo: string, tipo: "complemento" | "refuerzo", para: string, motivo?: string) => {
    setMarcando(codigo);
    setAviso("");
    setFallos([]);
    try {
      const res = await apiMonitoreoAulasMarcarRefuerzo({ operational_code: codigo, tipo, para, motivo });
      setAviso(res.mensaje);
      onGuardado?.();
      return true;
    } catch (e) {
      setFallos([{ codigo, motivo: e instanceof Error ? e.message : "No se pudo marcar." }]);
      setAviso("");
      return false;
    } finally {
      setMarcando("");
    }
  };

  const marcarVarias = async (pedidos: ReadonlyArray<PedidoDeMarca>) => {
    if (!pedidos.length) return;
    setAviso("");
    setFallos([]);
    setProgreso({ hechas: 0, total: pedidos.length });
    const caidas: FalloDeMarca[] = [];
    let hechas = 0;
    for (const p of pedidos) {
      setMarcando(p.codigo);
      try {
        await apiMonitoreoAulasMarcarRefuerzo({
          operational_code: p.codigo, tipo: p.tipo, para: p.para, motivo: p.motivo,
        });
        hechas += 1;
      } catch (e) {
        caidas.push({ codigo: p.codigo, motivo: e instanceof Error ? e.message : "No se pudo marcar." });
      }
      setProgreso({ hechas, total: pedidos.length });
    }
    setMarcando("");
    setFallos(caidas);
    // El aviso dice las dos cifras y su base: «14 de 15» no se confunde con
    // «14», que es lo que haría creer que entraron todas.
    setAviso(hechas === pedidos.length
      ? `Quedaron marcados los ${fmt(hechas)} que pediste.`
      : `Quedaron marcados ${fmt(hechas)}; se pidieron ${fmt(pedidos.length)}.`);
    // Una sola recarga al final: quince recargas seguidas dejan la pantalla
    // parpadeando y cada una vuelve a pedir el tablero entero.
    if (hechas > 0) onGuardado?.();
  };

  return { marcando, progreso, aviso, fallos, marcar, marcarVarias, limpiar };
}
