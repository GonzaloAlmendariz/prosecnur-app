import { useState } from "react";

import {
  apiMonitoreoAulasDesmarcarRefuerzo, apiMonitoreoAulasDesmarcarRefuerzos,
  apiMonitoreoAulasMarcarRefuerzo, apiMonitoreoAulasMarcarRefuerzos,
} from "../../../../api/monitoreo";

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
    // **Una sola petición, no N.** Antes iba en serie y cada marca costaba ~2
    // minutos —el endpoint reconstruye el tablero entero de 1.392 filas—, así
    // que quince eran media hora con la pantalla bloqueada. El progreso ya no
    // puede ir por petición: lo que se enseña es cuántas se pidieron.
    setProgreso({ hechas: 0, total: pedidos.length });
    try {
      const res = await apiMonitoreoAulasMarcarRefuerzos({
        pedidos: pedidos.map((p) => ({
          codigo: p.codigo, para: p.para, tipo: p.tipo, motivo: p.motivo,
        })),
      });
      setProgreso({ hechas: res.marcadas?.length ?? 0, total: pedidos.length });
      setAviso(res.mensaje);
      setFallos((res.fallidas ?? []).map((f) => ({
        codigo: f.operational_code, motivo: f.message,
      })));
      if ((res.marcadas?.length ?? 0) > 0) onGuardado?.();
    } catch (e) {
      setFallos([{ codigo: "", motivo: e instanceof Error ? e.message : "No se pudo marcar el lote." }]);
    } finally {
      setProgreso(null);
    }
  };

  /**
   * **Deshacer.** Sin esto el autopicker era una decisión sin vuelta: quince de
   * golpe y ninguna forma de devolver al inventario un lote mal elegido.
   *
   * El motor sólo retira lo que la app marcó y nadie tocó todavía; si el
   * agendador ya lo pasó a EN CONTACTO contesta `E_REFUERZO_YA_EN_MARCHA`, y
   * ese mensaje es justo lo que hay que enseñar: dice por qué no se puede.
   */
  const retirar = async (codigo: string) => {
    setMarcando(codigo);
    setAviso("");
    setFallos([]);
    try {
      const res = await apiMonitoreoAulasDesmarcarRefuerzo({ operational_code: codigo });
      setAviso(res.mensaje);
      onGuardado?.();
      return true;
    } catch (e) {
      setFallos([{ codigo, motivo: e instanceof Error ? e.message : "No se pudo retirar." }]);
      return false;
    } finally {
      setMarcando("");
    }
  };

  /** Deshacer un lote entero, en una sola petición y por el mismo motivo. */
  const retirarVarias = async (codigos: ReadonlyArray<string>) => {
    if (!codigos.length) return;
    setAviso("");
    setFallos([]);
    setProgreso({ hechas: 0, total: codigos.length });
    try {
      const res = await apiMonitoreoAulasDesmarcarRefuerzos({ pedidos: [...codigos] });
      setProgreso({ hechas: res.retiradas?.length ?? 0, total: codigos.length });
      setAviso(res.mensaje);
      setFallos((res.fallidas ?? []).map((f) => ({
        codigo: f.operational_code, motivo: f.message,
      })));
      if ((res.retiradas?.length ?? 0) > 0) onGuardado?.();
    } catch (e) {
      setFallos([{ codigo: "", motivo: e instanceof Error ? e.message : "No se pudo retirar el lote." }]);
    } finally {
      setProgreso(null);
    }
  };

  return { marcando, progreso, aviso, fallos, marcar, marcarVarias, retirar, retirarVarias, limpiar };
}
