// Borrador y guardado de la declaración de estados (familia y color de cada
// status que escribió el cliente). Lo comparten el definidor de Acreditación y
// Insumos › Estados del telefónico: es el mismo dato, guardado igual, en
// `operational_model.state_rules` con las familias de `familiasDeLlamada.ts`.
//
// Las reglas que no son de familia (las del motor: `complete`, `pending`…) se
// conservan intactas al guardar.

import { useMemo, useState } from "react";
import type { MonitoreoConfig, MonitoreoState, MonitoreoStateRule } from "../../../api/client";
import { apiMonitoreoConfig } from "../../../api/client";
import {
  ACREDITACION_ORDEN_FAMILIAS,
  acreditacionColorDeFamilia,
  acreditacionDeclaracionesDesdeReglas,
  acreditacionEstadosDetectados,
  acreditacionEtiquetaDeFamilia,
} from "./familiasDeLlamada";
import type { AcreditacionFamiliaLlamada } from "./familiasDeLlamada";

export type EntradaDeEstado = { label: string; value: number };

function reglasAjenas(reglas: readonly MonitoreoStateRule[]) {
  const familias = new Set<string>(ACREDITACION_ORDEN_FAMILIAS);
  return reglas.filter((regla) => !familias.has(regla.final_state));
}

export function useDeclaracionDeEstados({
  entradas,
  config,
  onStateChange,
}: {
  entradas: EntradaDeEstado[];
  config?: MonitoreoConfig | null;
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const reglas = config?.operational_model.state_rules ?? [];
  const guardadas = useMemo(() => acreditacionDeclaracionesDesdeReglas(reglas), [reglas]);

  // Borrador local: se edita en memoria y se guarda una vez.
  const [asignaciones, setAsignaciones] = useState<Record<string, AcreditacionFamiliaLlamada>>({});
  const [colores, setColores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const declaraciones = useMemo(() => {
    const base = guardadas.map((item) => ({ ...item, color: colores[item.familia] ?? item.color }));
    const porFamilia = new Map(base.map((item) => [item.familia, { ...item, crudos: [...item.crudos] }]));
    for (const [crudo, familia] of Object.entries(asignaciones)) {
      const actual = porFamilia.get(familia)
        ?? { familia, color: colores[familia] ?? "", crudos: [] as string[] };
      actual.crudos = [...actual.crudos.filter((item) => item !== crudo), crudo];
      porFamilia.set(familia, actual);
      // Un crudo pertenece a una sola familia: se retira de las demás.
      for (const [otra, decl] of porFamilia) {
        if (otra !== familia) decl.crudos = decl.crudos.filter((item) => item !== crudo);
      }
    }
    for (const [familia, color] of Object.entries(colores)) {
      const clave = familia as AcreditacionFamiliaLlamada;
      const actual = porFamilia.get(clave) ?? { familia: clave, color: "", crudos: [] as string[] };
      porFamilia.set(clave, { ...actual, color });
    }
    return [...porFamilia.values()];
  }, [asignaciones, colores, guardadas]);

  const detectados = useMemo(
    () => acreditacionEstadosDetectados(entradas, declaraciones),
    [declaraciones, entradas],
  );

  async function guardar() {
    if (!config) return;
    setGuardando(true);
    setError("");
    try {
      const propias: MonitoreoStateRule[] = declaraciones
        .filter((item) => item.crudos.length || item.color)
        .map((item, index) => ({
          id: `estado-${item.familia}`,
          label: acreditacionEtiquetaDeFamilia(item.familia),
          final_state: item.familia,
          priority: 100 + index,
          outcome_values: item.crudos,
          stop_contact: false,
          color: item.color || acreditacionColorDeFamilia(item.familia, []),
        } as MonitoreoStateRule));
      const result = await apiMonitoreoConfig({
        ...config,
        operational_model: {
          ...config.operational_model,
          state_rules: [...reglasAjenas(reglas), ...propias],
        },
      });
      onStateChange?.(result.state);
      setAsignaciones({});
      setColores({});
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  return {
    detectados,
    sinConfirmar: detectados.filter((item) => !item.confirmado).length,
    sucio: Object.keys(asignaciones).length > 0 || Object.keys(colores).length > 0,
    guardando,
    error,
    puedeGuardar: Boolean(config),
    /** Familia elegida para un crudo, con lo que haya en el borrador. */
    familiaDe: (crudo: string, detectada: AcreditacionFamiliaLlamada) => asignaciones[crudo] ?? detectada,
    colorDe: (familia: AcreditacionFamiliaLlamada) => colores[familia] ?? acreditacionColorDeFamilia(familia, guardadas),
    // Reciben el valor ya leído: el evento sintético no se lee dentro de un
    // updater (regresión del 2026-07-28, ver DefinidorDeEstadosEventos.test.ts).
    asignar: (crudo: string, familia: AcreditacionFamiliaLlamada) => setAsignaciones((actual) => ({ ...actual, [crudo]: familia })),
    colorear: (familia: AcreditacionFamiliaLlamada, color: string) => setColores((actual) => ({ ...actual, [familia]: color })),
    guardar,
  };
}
