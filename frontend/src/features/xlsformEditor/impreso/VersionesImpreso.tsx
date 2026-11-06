// «Versiones» de la parte Formato de Impreso (L36 · DOC.4, D-L36-17): instantáneas con nombre de las opciones del
// papel, guardadas en el .pulso. «Usar» restaura una como opciones actuales sin borrarla. Arriba, dónde están las
// opciones respecto del proyecto: la causa si no se pudieron guardar.

import { useState } from "react";
import type { ImpresoVersion } from "../../../api/xlsformImpreso";
import { PulsoButton } from "../../../components/PulsoButton";
import { PulsoField } from "../../../components/PulsoField";
import { PulsoInput } from "../../../components/PulsoInput";
import { TarjetaImpreso } from "./TarjetaImpreso";
import type { SincroniaImpreso } from "./useEstadoImpreso";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { History } from "../../../vendor/lucide-react";

export function momentoImpreso(iso: string): string {
  const fecha = new Date(iso);
  if (!iso || Number.isNaN(fecha.getTime())) return "";
  return fecha.toLocaleString("es-PE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function textoSincronia(s: SincroniaImpreso): string {
  switch (s.fase) {
    case "local": return "Opciones de este equipo: se guardan en el proyecto al cambiar algo.";
    case "guardando": return "Guardando en el proyecto…";
    case "guardado": {
      const cuando = momentoImpreso(s.en);
      return cuando ? `Guardadas en el proyecto (${cuando})` : "Guardadas en el proyecto.";
    }
    case "error": return `No se guardaron en el proyecto (${s.causa}); quedan en este equipo.`;
  }
}

export function VersionesImpreso({ sincronia, versiones, puedeGuardar, onGuardar, onUsar }: {
  sincronia: SincroniaImpreso;
  versiones: readonly ImpresoVersion[];
  /** Sin formulario guardado no hay dónde dejar la versión. */
  puedeGuardar: boolean;
  onGuardar: (nombre: string) => Promise<boolean>;
  onUsar: (version: ImpresoVersion) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [guardando, setGuardando] = useState(false);
  const guardar = async () => {
    if (!nombre.trim() || guardando) return;
    setGuardando(true);
    const ok = await onGuardar(nombre);
    setGuardando(false);
    if (ok) setNombre("");
  };
  return (
    <TarjetaImpreso id="imp-versiones" titulo="Versiones" ayuda={textoSincronia(sincronia)}>
      <form className="pulso-xf-imp-versiones-nueva" onSubmit={(e) => { e.preventDefault(); void guardar(); }}>
        <PulsoField label="Nombre de la versión">
          <PulsoInput
            value={nombre}
            maxLength={80}
            placeholder="Piloto, campo, versión del cliente…"
            disabled={!puedeGuardar}
            onChange={(e) => setNombre(e.target.value)}
          />
        </PulsoField>
        <PulsoButton type="submit" variant="secondary" size="sm" disabled={!puedeGuardar || !nombre.trim() || guardando}>
          {guardando ? "Guardando…" : "Guardar versión"}
        </PulsoButton>
      </form>
      {versiones.length ? (
        <ul className="pulso-xf-imp-versiones-lista" aria-label="Versiones guardadas">
          {versiones.map((v) => (
            <li key={v.nombre} className="pulso-xf-imp-versiones-item">
              <span className="pulso-xf-imp-versiones-nombre">{v.nombre}</span>
              <span className="pulso-xf-imp-versiones-fecha">{momentoImpreso(v.guardado_en)}</span>
              <PulsoButton variant="ghost" size="sm" onClick={() => onUsar(v)}>Usar</PulsoButton>
            </li>
          ))}
        </ul>
      ) : (
        <EstadoVacio icono={<History size={14} />} titulo="Aún no hay versiones guardadas" />
      )}
    </TarjetaImpreso>
  );
}
