import { useState } from "react";
import {
  apiAnaliticaDimensionesValidarJson,
  ValidacionReporte,
} from "../../../../api/client";

// Hook para el flujo "Confirmar contra instrumento": el usuario sube un
// JSON, lo parseamos en el cliente, lo enviamos al backend para
// validar contra `rp_inst`, y devolvemos el reporte estructurado para
// que la UI lo muestre como ✓/⚠/✗.
//
// El JSON original se conserva en `parsedJson` para poder pasarlo al
// store del wizard cuando el usuario decide "Continuar con coincidencias".

export type ResultadoValidacion =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; reporte: ValidacionReporte; parsedJson: unknown }
  | { kind: "error"; message: string };

export function useValidacionJson() {
  const [estado, setEstado] = useState<ResultadoValidacion>({ kind: "idle" });

  async function validar(file: File) {
    setEstado({ kind: "loading" });
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const r = await apiAnaliticaDimensionesValidarJson(parsed);
      setEstado({ kind: "ok", reporte: r.reporte, parsedJson: parsed });
    } catch (e) {
      setEstado({ kind: "error", message: (e as Error).message });
    }
  }

  function reset() {
    setEstado({ kind: "idle" });
  }

  return { estado, validar, reset };
}
