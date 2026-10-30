import { useState } from "react";
import { Link } from "react-router-dom";
import { PulsoButton } from "../../../../components/PulsoButton";
import { Sideover } from "../../../../components/Sideover";
import { ApiError } from "../../../../api/core";
import { useSeccion } from "../../../../lib/navegacion/useDireccion";
import { apiHojasRutaCuotasPorFicha, apiHojasRutaEnviar, muestraConCuotasRepartidas, type HojasRutaWorkspaceOutputs } from "../../../../api/hojasRuta";
import type { EnvioMeta } from "../../../../api/materialTerritorial";
import { Send } from "../../../../vendor/lucide-react";
import { PANEL_SALIDAS_SELECCION } from "../../seleccion/panelesSeleccion";
import { BitacoraSeccion } from "./BitacoraSeccion";
import { InformeDiseno } from "./InformeDiseno";
import { muestraV1 } from "../manzanas/sorteoV1";
import { useProjectModules } from "../../../project/ProjectModulesContext";

/**
 * «Entrega» de Selección (ADR 0118 §2, F3), en el sideover direccionable `?panel=salidas`
 * (conserva su id: está declarado y lo recorre el QA). Hojas de ruta diseña y Material de
 * campo produce: aquí sólo se envía la muestra (una foto con huella), se ve si quedó
 * desactualizada, se enlaza la campaña territorial y viven lo que es del diseño —el
 * informe y la bitácora—. Fichas, hojas de zona, paquete, plan por encuestador y
 * reemplazos puntuales se generan en Material.
 */

export const HREF_CAMPANA_TERRITORIAL = "/material-campo?modo=territorial&campana=territorial.principal&seccion=unidades&pestana=lista";

const fmt = (n: number) => new Intl.NumberFormat("es-PE").format(Math.round(Number(n) || 0));
const fecha = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()} ${dos(d.getHours())}:${dos(d.getMinutes())}`;
};

type Props = {
  salidas: HojasRutaWorkspaceOutputs | null | undefined;
  /** `envio_meta` de la fase activa (F1): null si nunca se envió. */
  envio: EnvioMeta | null;
  /** Tras enviar o repartir cuotas, la página relee el estado. */
  onCambio?: () => Promise<void>;
};

export function SalidasPanel({ salidas, envio, onCambio }: Props) {
  const nav = useSeccion("hojas-ruta");
  // Checklist I2: un estudio que envió su muestra a Material de campo no puede tenerlo fuera de la barra.
  const { addModule } = useProjectModules();
  const [ocupado, setOcupado] = useState<"" | "envio" | "cuotas">("");
  const [error, setError] = useState("");
  const [codigo, setCodigo] = useState("");
  const muestra = salidas?.sample ?? null;

  async function correr(trabajo: "envio" | "cuotas", f: () => Promise<unknown>) {
    setOcupado(trabajo);
    setError("");
    setCodigo("");
    try {
      await f();
      await onCambio?.();
    } catch (err: unknown) {
      setCodigo(err instanceof ApiError ? err.code : "");
      setError(err instanceof Error ? err.message.replace(/ · E_[A-Z_]+$/, "") : "No se pudo completar");
    } finally {
      setOcupado("");
    }
  }

  const estado = !envio ? "nunca" : envio.desactualizado ? "desactualizado" : "al-dia";
  // F13: una muestra del reparto v1 no se envía (el backend también lo rechaza: E_HOJAS_RUTA_ENVIO_SORTEO_V1).
  const v1 = muestraV1(muestra?.alerts);

  return (
    <Sideover
      panel={PANEL_SALIDAS_SELECCION}
      title="Entrega"
      subtitle="Envía la muestra a Material de campo, que produce las fichas, las hojas de zona y el paquete"
      icon={<Send size={16} />}
      trigger={
        <PulsoButton variant="primary" disabled={!muestra}>
          <Send size={14} aria-hidden="true" /> Entrega
        </PulsoButton>
      }
    >
      <div className="hr-salidas">
        {error ? (
          <div className="hr-mapa-aviso" role="alert">
            <p className="hr-salidas-error">{error}</p>
            {codigo === "E_COVERAGE_DECISION_REQUIRED" ? (
              <PulsoButton variant="secondary" size="sm" onClick={() => nav.irA("seccion", "manzanas")}>
                Ir al marco elegible
              </PulsoButton>
            ) : null}
          </div>
        ) : null}

        {muestra && !muestraConCuotasRepartidas(muestra.blocks) ? (
          <div className="hr-mapa-aviso" role="status">
            <p className="hr-salidas-error">
              Las hojas de esta muestra piden la mitad de hombres y la mitad de mujeres, y la misma edad en todos los distritos. Repártelas según la cuota de cada distrito antes de enviar: las manzanas y su orden no cambian.
            </p>
            <PulsoButton variant="secondary" size="sm" disabled={ocupado !== ""} onClick={() => void correr("cuotas", () => apiHojasRutaCuotasPorFicha())}>
              {ocupado === "cuotas" ? "Repartiendo…" : "Repartir cuotas por distrito"}
            </PulsoButton>
          </div>
        ) : null}

        <section className="hr-muestra-grupo hr-entrega" aria-label="Envío a Material de campo" data-estado={estado}>
          <h3>Envío a Material de campo</h3>
          {estado === "nunca" ? (
            <p className="hr-mapa-nota">
              La muestra todavía no se envió. Al enviarla, Material de campo recibe una foto de las {muestra ? fmt(muestra.blocks.length) : "—"} titulares y sus reemplazos, y desde ahí se generan las fichas, las hojas de zona, el paquete y el plan por encuestador.
            </p>
          ) : (
            <div className="hr-entrega-estado">
              <strong>{estado === "desactualizado" ? "La muestra cambió desde el envío" : "Enviada"}</strong>
              <span>
                {fmt(envio?.n_titulares ?? 0)} titulares y {fmt(envio?.n_reemplazos ?? 0)} reemplazos{envio?.enviado_at ? ` · ${fecha(envio.enviado_at)}` : ""}
              </span>
              {estado === "desactualizado" ? <span>Material no genera material mientras no la reenvíes: saldría de una muestra distinta de la enviada.</span> : null}
            </div>
          )}
          {v1 ? (
            <div className="hr-mapa-aviso" role="alert">
              <p className="hr-salidas-error">Esta muestra se sorteó con el reparto por zonas anterior y deja manzanas sin probabilidad de salir: vuelve a sortear en Manzanas antes de enviarla.</p>
              <PulsoButton variant="secondary" size="sm" onClick={() => nav.irA("seccion", "manzanas")}>Ir a Manzanas</PulsoButton>
            </div>
          ) : null}
          <div className="hr-salidas-acciones">
            <PulsoButton variant={estado === "al-dia" ? "secondary" : "primary"} disabled={!muestra || ocupado !== "" || Boolean(v1)} onClick={() => void correr("envio", async () => { await apiHojasRutaEnviar(); addModule("material-campo"); })}>
              <Send size={14} aria-hidden /> {ocupado === "envio" ? "Enviando…" : estado === "nunca" ? "Enviar a Material" : "Reenviar a Material"}
            </PulsoButton>
            {envio ? (
              <Link className="hr-entrega-enlace" to={HREF_CAMPANA_TERRITORIAL}>
                Abrir en Material de campo
              </Link>
            ) : null}
          </div>
        </section>

        <InformeDiseno deshabilitado={!muestra} />
        <BitacoraSeccion conDecisionesPrevias={Boolean(muestra)} />
      </div>
    </Sideover>
  );
}
