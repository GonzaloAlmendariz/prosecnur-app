import { useState } from "react";
import { GlidingRadioGroup } from "../../../../components/GlidingRadioGroup";
import { JobProgress } from "../../../../components/JobProgress";
import { PulsoButton } from "../../../../components/PulsoButton";
import { PulsoSwitch } from "../../../../components/PulsoSwitch";
import { Sideover } from "../../../../components/Sideover";
import { downloadUrl } from "../../../../api/core";
import {
  apiHojasRutaGenerate,
  apiHojasRutaManualReplacementsPdf,
  apiHojasRutaRandomPdf,
  apiHojasRutaRouteWorkbook,
  type HojasRutaIntegratedConfig,
  type HojasRutaJobResult,
  type HojasRutaManualReplacementResult,
  type HojasRutaRandomPdfResult,
  type HojasRutaRandomPreference,
  type HojasRutaReplacementPolicy,
  type HojasRutaWorkbookResult,
  type HojasRutaPlanSupuestos,
  type HojasRutaWorkspaceOutputs,
} from "../../../../api/hojasRuta";
import { Archive } from "../../../../vendor/lucide-react";
import { PANEL_SALIDAS_SELECCION } from "../../seleccion/panelesSeleccion";
import { nombreDistrito } from "../nombres";
import { PlanCampo } from "./PlanCampo";
import { alternarId, candidatasDeReemplazo, listoParaEntregar, pasosDeEntrega, pesoLegible } from "./salidas";

/**
 * Salidas de Selección en la página del lienzo (U10), en el sideover
 * direccionable `?panel=salidas`: ZIP de fichas con progreso, Excel operativo,
 * reemplazos puntuales (filas con interruptor) y PDF de prueba. Ninguna de las
 * cuatro cambia la selección guardada: sólo producen archivos.
 */

const fmt = (n: number) => new Intl.NumberFormat("es-PE").format(Math.round(Number(n) || 0));
const POLITICAS = [["alternate_zone_same_district", "Otra zona"], ["paired_by_titular_zone", "Misma zona"]] as const;
const PREFERENCIAS = [["balanced", "Balanceado"], ["population", "Alta población"], ["urban", "Urbana compacta"]] as const;

type Trabajo = "" | "zip" | "excel" | "puntuales" | "prueba";
type Estado = {
  ocupado: Trabajo;
  error: string;
  jobZip: string | null;
  jobPuntuales: string | null;
  zip: HojasRutaJobResult | null;
  excel: HojasRutaWorkbookResult | null;
  puntuales: HojasRutaManualReplacementResult | null;
  prueba: HojasRutaRandomPdfResult | null;
};
const INICIAL: Estado = { ocupado: "", error: "", jobZip: null, jobPuntuales: null, zip: null, excel: null, puntuales: null, prueba: null };

type Props = {
  config: HojasRutaIntegratedConfig;
  salidas: HojasRutaWorkspaceOutputs | null | undefined;
  /** U14: supuestos guardados del plan de campo y cómo guardarlos (sin tocar las salidas). */
  planSupuestos?: HojasRutaPlanSupuestos;
  onGuardarPlan?: (s: HojasRutaPlanSupuestos) => Promise<void>;
};

export function SalidasPanel({ config, salidas, planSupuestos, onGuardarPlan }: Props) {
  const [e, setE] = useState<Estado>(INICIAL);
  const [busqueda, setBusqueda] = useState("");
  const [elegidas, setElegidas] = useState<string[]>([]);
  const [porTitular, setPorTitular] = useState(1);
  const [politica, setPolitica] = useState<HojasRutaReplacementPolicy>(config.replacement_policy ?? "alternate_zone_same_district");
  const [preferencia, setPreferencia] = useState<HojasRutaRandomPreference>("balanced");
  const muestra = salidas?.sample ?? null;
  const pasos = pasosDeEntrega(config.territorios.length, salidas);
  const listo = listoParaEntregar(pasos);
  const corriendo = Boolean(e.jobZip || e.jobPuntuales) || e.ocupado !== "";
  const { filas, coincidencias } = candidatasDeReemplazo(muestra?.blocks ?? [], busqueda, elegidas);

  async function correr<T>(trabajo: Trabajo, f: () => Promise<T>, listo: (r: T) => Partial<Estado>) {
    setE((s) => ({ ...s, ocupado: trabajo, error: "" }));
    try {
      const r = await f();
      setE((s) => ({ ...s, ocupado: "", ...listo(r) }));
    } catch (err: unknown) {
      setE((s) => ({ ...s, ocupado: "", error: err instanceof Error ? err.message : "No se pudo generar el archivo" }));
    }
  }

  return (
    <Sideover
      panel={PANEL_SALIDAS_SELECCION}
      title="Salidas de la selección"
      subtitle="ZIP de fichas, Excel operativo, reemplazos puntuales y PDF de prueba"
      icon={<Archive size={16} />}
      trigger={
        <PulsoButton variant="primary" disabled={!muestra}>
          <Archive size={14} aria-hidden="true" /> Salidas
        </PulsoButton>
      }
    >
      <div className="hr-salidas">
        {e.error ? <p className="hr-mapa-aviso">{e.error}</p> : null}

        <section className="hr-muestra-grupo" aria-label="Paquete de entrega">
          <h3>Paquete de entrega</h3>
          <ul className="hr-salidas-pasos">
            {pasos.map((p) => (
              <li key={p.id} data-ok={p.ok || undefined}>
                <i aria-hidden="true" />
                <strong>{p.label}</strong>
                <small>{p.detalle}</small>
              </li>
            ))}
          </ul>
          <p className="hr-mapa-nota">Un PDF por manzana titular separado por distrito, los de reemplazo, la hoja por zona, el Excel operativo y los metadatos del marco.</p>
          <div className="hr-salidas-acciones">
            <PulsoButton variant="primary" disabled={!listo || corriendo} onClick={() => void correr("zip", () => apiHojasRutaGenerate(config, muestra), (r) => ({ jobZip: r.job_id, zip: null }))}>
              {e.ocupado === "zip" ? "Preparando…" : "Generar ZIP"}
            </PulsoButton>
            <PulsoButton
              variant="secondary"
              disabled={!listo || corriendo}
              onClick={() =>
                void correr("excel", () => apiHojasRutaRouteWorkbook(config, muestra), (r) => {
                  window.open(downloadUrl(r.file_id), "_blank", "noopener,noreferrer");
                  return { excel: r };
                })
              }
            >
              {e.ocupado === "excel" ? "Creando…" : "Excel operativo"}
            </PulsoButton>
          </div>
          <JobProgress<HojasRutaJobResult>
            label="Generando las hojas de ruta"
            jobId={e.jobZip}
            onDone={(r) => setE((s) => ({ ...s, zip: r, jobZip: null }))}
            onError={(msg) => setE((s) => ({ ...s, error: msg, jobZip: null }))}
            onCancelled={() => setE((s) => ({ ...s, jobZip: null }))}
          />
          {e.zip ? (
            <a className="hr-salidas-archivo" href={downloadUrl(e.zip.file_id)}>
              <strong>Descargar ZIP</strong>
              <small>{fmt(e.zip.n_pdfs)} PDF · {fmt(e.zip.total_entrevistas)} entrevistas · {pesoLegible(e.zip.size)}</small>
            </a>
          ) : null}
          {e.excel ? (
            <a className="hr-salidas-archivo" href={downloadUrl(e.excel.file_id)}>
              <strong>Descargar Excel</strong>
              <small>{fmt(e.excel.n_blocks)} titulares · {fmt(e.excel.n_replacement_blocks)} reemplazos · {pesoLegible(e.excel.size)}</small>
            </a>
          ) : null}
          <p className="hr-mapa-nota">Si cambias la muestra o el sorteo, estos archivos quedan desactualizados: vuelve a generarlos.</p>
        </section>

        {onGuardarPlan ? <PlanCampo guardados={planSupuestos} deshabilitado={!muestra || corriendo} onGuardar={onGuardarPlan} /> : null}

        <section className="hr-muestra-grupo" aria-label="Reemplazos puntuales">
          <h3>Reemplazos puntuales</h3>
          <p className="hr-mapa-nota">Para las titulares que fallaron en campo: un PDF con reemplazos nuevos, sin tocar el sorteo.</p>
          <input className="hr-mapa-buscar" type="search" aria-label="Buscar titular" placeholder="Buscar UMP, distrito o zona" value={busqueda} disabled={!muestra || corriendo} onChange={(ev) => setBusqueda(ev.target.value)} />
          {filas.length ? (
            <ul className="hr-salidas-filas">
              {filas.map((f) => (
                <li key={f.id}>
                  <span>
                    <strong>{f.codigo}</strong>
                    <small>{nombreDistrito(f.distrito)} · zona {f.zona}</small>
                  </span>
                  <PulsoSwitch size="sm" ariaLabel={`${f.elegida ? "Quitar" : "Pedir reemplazos para"} ${f.codigo}`} checked={f.elegida} disabled={corriendo} onCheckedChange={() => setElegidas((l) => alternarId(l, f.id))} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="hr-mapa-nota">{busqueda.trim() ? `Ninguna titular coincide con «${busqueda}».` : "Busca la titular que falló para pedirle reemplazos."}</p>
          )}
          {coincidencias > 12 ? <p className="hr-mapa-nota">Se muestran 12 de {fmt(coincidencias)}: afina la búsqueda.</p> : null}
          <div className="hr-muestra-campo">
            <small>Reemplazos por titular</small>
            <span className="hr-muestra-pasos">
              <PulsoButton variant="icon" size="sm" aria-label="Uno menos" disabled={corriendo || porTitular <= 1} onClick={() => setPorTitular((n) => Math.max(1, n - 1))}>−</PulsoButton>
              <input type="number" min={1} max={10} aria-label="Reemplazos por titular" value={porTitular} disabled={corriendo} onChange={(ev) => setPorTitular(Math.min(10, Math.max(1, Math.round(Number(ev.target.value) || 1))))} />
              <PulsoButton variant="icon" size="sm" aria-label="Uno más" disabled={corriendo || porTitular >= 10} onClick={() => setPorTitular((n) => Math.min(10, n + 1))}>+</PulsoButton>
            </span>
          </div>
          <div className="hr-muestra-campo">
            <small>Dónde buscarlos</small>
            <GlidingRadioGroup value={politica} options={POLITICAS} getOptionValue={(o) => o[0]} onValueChange={setPolitica} className="hr-muestra-opciones" aria-label="Dónde buscar los reemplazos puntuales" getOptionProps={() => ({ disabled: corriendo })}>
              {(o) => <span>{o[1]}</span>}
            </GlidingRadioGroup>
          </div>
          <PulsoButton
            variant="secondary"
            disabled={!muestra || !elegidas.length || corriendo}
            onClick={() => muestra && void correr("puntuales", () => apiHojasRutaManualReplacementsPdf({ ...config, replacement_policy: politica }, muestra, elegidas, porTitular), (r) => ({ jobPuntuales: r.job_id, puntuales: null }))}
          >
            {elegidas.length ? `PDF de reemplazos para ${elegidas.length} titular${elegidas.length === 1 ? "" : "es"}` : "Elige al menos una titular"}
          </PulsoButton>
          <JobProgress<HojasRutaManualReplacementResult>
            label="Generando los reemplazos puntuales"
            jobId={e.jobPuntuales}
            onDone={(r) => {
              setE((s) => ({ ...s, puntuales: r, jobPuntuales: null }));
              if (r.file_id) window.open(downloadUrl(r.file_id), "_blank", "noopener,noreferrer");
            }}
            onError={(msg) => setE((s) => ({ ...s, error: msg, jobPuntuales: null }))}
            onCancelled={() => setE((s) => ({ ...s, jobPuntuales: null }))}
          />
          {e.puntuales ? (
            <a className="hr-salidas-archivo" href={downloadUrl(e.puntuales.file_id)}>
              <strong>Descargar PDF</strong>
              <small>{fmt(e.puntuales.n_replacement_blocks)} reemplazos para {fmt(e.puntuales.n_titulars)} titulares</small>
            </a>
          ) : null}
        </section>

        <section className="hr-muestra-grupo" aria-label="PDF de prueba">
          <h3>PDF de prueba</h3>
          <p className="hr-mapa-nota">Una hoja al azar para revisar el formato antes de entregar.</p>
          <GlidingRadioGroup value={preferencia} options={PREFERENCIAS} getOptionValue={(o) => o[0]} onValueChange={setPreferencia} className="hr-muestra-opciones" aria-label="Qué manzana sortear para la prueba" getOptionProps={() => ({ disabled: corriendo })}>
            {(o) => <span>{o[1]}</span>}
          </GlidingRadioGroup>
          <PulsoButton
            variant="secondary"
            disabled={corriendo}
            onClick={() =>
              void correr("prueba", () => apiHojasRutaRandomPdf(config, preferencia), (r) => {
                window.open(downloadUrl(r.file_id), "_blank", "noopener,noreferrer");
                return { prueba: r };
              })
            }
          >
            {e.ocupado === "prueba" ? "Generando…" : "Abrir un PDF de prueba"}
          </PulsoButton>
          {e.prueba ? (
            <a className="hr-salidas-archivo" href={downloadUrl(e.prueba.file_id)}>
              <strong>Abrir el último</strong>
              <small>{nombreDistrito(e.prueba.distrito)} · zona {e.prueba.zona} · manzana {e.prueba.manzana}</small>
            </a>
          ) : null}
        </section>
      </div>
    </Sideover>
  );
}
