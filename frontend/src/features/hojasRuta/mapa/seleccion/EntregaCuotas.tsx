import { useState } from "react";
import { Link } from "react-router-dom";

import { apiHojasRutaEnviarCuotas } from "../../../../api/hojasRuta";
import type { EnvioMeta } from "../../../../api/materialTerritorial";
import { PulsoButton } from "../../../../components/PulsoButton";
import { EstadoChip } from "../../../../components/EstadoChip";
import { useProjectModules } from "../../../project/ProjectModulesContext";
import { Send } from "../../../../vendor/lucide-react";
import { asegurarCampanaTerritorial } from "./campanaTerritorial";
import { envioVigente } from "./envioVigente";
import { HREF_CAMPANA_TERRITORIAL } from "./SalidasPanel";

/**
 * «Entrega» de un estudio por cuotas (ADR 0125 §2). No hay sorteo de manzanas: lo que Hojas deja definido son
 * las zonas (hoy los distritos) con su N y su cuota por sexo y edad, y eso es lo que se envía. Material arma con
 * ello la hoja de conteo por zona y el Excel encuestador ↔ zona; Monitoreo lee las metas por celda.
 */

const fmt = (n: number) => new Intl.NumberFormat("es-PE").format(Math.round(Number(n) || 0));

type Props = {
  envio: EnvioMeta | null;
  /** Distritos confirmados en Territorio: sin ellos no hay zonas. */
  distritos: number;
  /** El N guardado en Muestra; null si aún no se fijó. */
  nObjetivo: number | null;
  fase: "pilot" | "field";
  onCambio?: () => Promise<void>;
};

export function EntregaCuotas({ envio: envioDelEstado, distritos, nObjetivo, fase, onCambio }: Props) {
  const { addModule } = useProjectModules();
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [envioRecien, setEnvioRecien] = useState<EnvioMeta | null>(null);
  const envio = envioVigente(envioDelEstado, envioRecien);
  // Un envío por UMP de antes de cambiar el diseño no cuenta como el de cuotas.
  const deCuotas = envio?.kind === "cuotas" ? envio : null;
  const estado = !deCuotas ? "nunca" : deCuotas.desactualizado ? "desactualizado" : "al-dia";
  const listo = distritos > 0 && (nObjetivo ?? 0) > 0;

  const enviar = async () => {
    setOcupado(true);
    setError("");
    try {
      setEnvioRecien(await apiHojasRutaEnviarCuotas(fase));
      addModule("material-campo");
      await asegurarCampanaTerritorial();
      setOcupado(false);
      await onCambio?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message.replace(/, E_[A-Z_]+$/, "") : "No se pudo enviar");
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="hr-salidas">
      <section className="hr-muestra-grupo hr-entrega" aria-label="Envío a Material de campo" data-estado={estado}>
        <h3>Envío a Material de campo</h3>
        {estado === "nunca" ? (
          <p className="hr-mapa-nota">
            {listo
              ? `Se envían ${fmt(distritos)} ${distritos === 1 ? "zona" : "zonas"} con su cuota por sexo y edad, para ${fmt(nObjetivo ?? 0)} entrevistas. Material arma con ellas la hoja de conteo de cada zona y el Excel que asigna encuestadores a zonas.`
              : "Para enviar, confirma los distritos en Territorio y fija el N en Muestra: de ahí salen las zonas y su cuota."}
          </p>
        ) : (
          <div className="hr-entrega-estado">
            <EstadoChip label={estado === "desactualizado" ? "Desactualizado" : "Al día"} tone={estado === "desactualizado" ? "warn" : "success"} />
              {estado === "desactualizado" ? <strong>Las cuotas cambiaron desde el envío.</strong> : null}
            <span>
              {fmt(deCuotas?.n_zonas ?? 0)} {deCuotas?.n_zonas === 1 ? "zona" : "zonas"} y {fmt(deCuotas?.n_entrevistas ?? 0)} entrevistas
            </span>
            {estado === "desactualizado" ? <span>Material no genera material mientras no la reenvíes: saldría de cuotas distintas de las enviadas.</span> : null}
          </div>
        )}
        <p className="hr-mapa-nota">
          Se envía la corrida de {fase === "pilot" ? "Piloto" : "Campo real"}.{estado === "nunca" ? " La campaña territorial de Material queda en esa fase." : ""}
        </p>
        {error ? <p className="hr-salidas-error" role="alert">{error}</p> : null}
        <div className="hr-salidas-acciones">
          <PulsoButton variant={estado === "al-dia" ? "secondary" : "primary"} disabled={!listo || ocupado} onClick={() => void enviar()}>
            <Send size={14} aria-hidden /> {ocupado ? "Enviando…" : estado === "nunca" ? "Enviar a Material" : "Reenviar a Material"}
          </PulsoButton>
          {deCuotas ? <Link className="hr-entrega-enlace" to={HREF_CAMPANA_TERRITORIAL}>Abrir en Material de campo</Link> : null}
        </div>
      </section>
    </div>
  );
}
