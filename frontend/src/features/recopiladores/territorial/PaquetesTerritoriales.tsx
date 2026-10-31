// Territorial › Paquetes › Armado (ADR 0118 §1): el ZIP del paquete, el Excel
// operativo y los reemplazos puntuales, con los mismos endpoints y la misma
// lógica pura que Selección › Salidas en Hojas de ruta (`salidas.ts`). Ninguno
// cambia el sorteo: sólo producen archivos.
//
// Contrato de Superficie:
// - C1: `material-campo/territorial/paquetes` (intrinsic): paquete y reemplazos
//   puntuales, una tarjeta por miembro.
// - C3/C4: cada tarjeta contiene su vacío; la lista de titulares tiene tope y
//   dice cuántas quedan fuera, el scroll es del panel de la sección.

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { ApiError, downloadUrl } from "../../../api/core";
import {
  apiHojasRutaGenerate,
  apiHojasRutaManualReplacementsPdf,
  apiHojasRutaRouteWorkbook,
  muestraConCuotasRepartidas,
  type HojasRutaJobResult,
  type HojasRutaManualReplacementResult,
  type HojasRutaReplacementPolicy,
  type HojasRutaState,
  type HojasRutaWorkbookResult,
} from "../../../api/hojasRuta";
import type { UnidadesTerritoriales } from "../../../api/materialTerritorial";
import { GlidingRadioGroup } from "../../../components/GlidingRadioGroup";
import { JobProgress } from "../../../components/JobProgress";
import { PulsoButton } from "../../../components/PulsoButton";
import { PulsoInput } from "../../../components/PulsoInput";
import { PulsoSwitch } from "../../../components/PulsoSwitch";
import { Archive, FileSpreadsheet, Shuffle } from "../../../vendor/lucide-react";
import { PulsoTable, type PulsoTableColumna } from "../../../components/PulsoTable";
import { revisarUnidades } from "./revisionUnidades";
import {
  alternarId,
  candidatasDeReemplazo,
  conteosDelPaquete,
  conteosPorDistrito,
  listoParaEntregar,
  pasosDeEntrega,
  pesoLegible,
  sugeridasParaReemplazo,
} from "../../hojasRuta/mapa/seleccion/salidas";
import { nombreDistrito } from "../../hojasRuta/mapa/nombres";
import { codigoDeUmp } from "../../hojasRuta/seleccion/revisionMarco";
import { HojasDelPaquete } from "./HojasDeCampo";
import { AvisoDesactualizada, HREF_REENVIO, VacioSinFuente } from "./UnidadesTerritoriales";

const fmt = (n: number) => new Intl.NumberFormat("es-PE").format(Math.round(Number(n) || 0));
type FilaPaquete = { ubigeo: string; distrito: string; titulares: number; reemplazos: number; zonas: number };
const COLUMNAS_PAQUETE: PulsoTableColumna<FilaPaquete>[] = [
  { id: "distrito", encabezado: "Distrito", ancho: 220, celda: (f) => (f.ubigeo === "total" ? <strong>Total</strong> : nombreDistrito(f.distrito)) },
  { id: "titulares", encabezado: "Fichas titulares", ancho: 130, tipo: "cifra", celda: (f) => fmt(f.titulares) },
  { id: "reemplazos", encabezado: "Fichas de reemplazo", ancho: 150, tipo: "cifra", celda: (f) => fmt(f.reemplazos) },
  { id: "zonas", encabezado: "Hojas por zona", ancho: 130, tipo: "cifra", celda: (f) => fmt(f.zonas) },
];
const POLITICAS = [["alternate_zone_same_district", "Otra zona"], ["paired_by_titular_zone", "Misma zona"]] as const;

type Trabajo = "" | "zip" | "excel" | "puntuales";
type Estado = {
  ocupado: Trabajo;
  error: string;
  jobZip: string | null;
  jobPuntuales: string | null;
  zip: HojasRutaJobResult | null;
  excel: HojasRutaWorkbookResult | null;
  puntuales: HojasRutaManualReplacementResult | null;
};
const INICIAL: Estado = { ocupado: "", error: "", jobZip: null, jobPuntuales: null, zip: null, excel: null, puntuales: null };

type Props = {
  campaignId: string;
  unidades: UnidadesTerritoriales | null;
  hojas: HojasRutaState | null;
  onRecargar: () => Promise<void>;
  /** Titular que llega marcada desde la ficha de Selección de Hojas de ruta (`?foco=<id_manzana>`). */
  focoInicial?: string | null;
};

export function PaquetesTerritoriales({ campaignId, unidades, hojas, onRecargar, focoInicial = null }: Props) {
  const [e, setE] = useState<Estado>(INICIAL);
  const [busqueda, setBusqueda] = useState("");
  const [elegidas, setElegidas] = useState<string[]>(() => (focoInicial ? [focoInicial] : []));
  const [porTitular, setPorTitular] = useState(1);
  const config = hojas?.integrated_config ?? null;
  const [politica, setPolitica] = useState<HojasRutaReplacementPolicy>(config?.replacement_policy ?? "alternate_zone_same_district");
  const salidas = hojas?.workspace_outputs ?? null;
  const muestra = salidas?.sample ?? null;
  const pasos = pasosDeEntrega(config?.territorios.length ?? 0, salidas);
  const listo = listoParaEntregar(pasos);
  const corriendo = Boolean(e.jobZip || e.jobPuntuales) || e.ocupado !== "";
  const { filas, coincidencias } = useMemo(() => candidatasDeReemplazo(muestra?.blocks ?? [], busqueda, elegidas), [busqueda, elegidas, muestra]);
  const paquete = conteosDelPaquete(muestra?.blocks ?? [], muestra?.replacement_blocks ?? []);
  const porDistrito = useMemo(() => conteosPorDistrito(muestra?.blocks ?? [], muestra?.replacement_blocks ?? []), [muestra]);
  // M14: las titulares por revisar (mismo criterio que Unidades y Selección) se sugieren primero, con su motivo.
  const ss = config?.sample_size;
  const revision = useMemo(() => revisarUnidades(unidades?.units ?? [], ss ? { respuesta: ss.response_rate, ocupacion: ss.ocupacion ?? 1 } : undefined), [unidades, ss]);
  const sugeridas = useMemo(() => {
    const titulares = (unidades?.units ?? []).filter((u) => u.role === "titular");
    const conMotivo = titulares.filter((u) => { const e = revision.porUnidad.get(u.unit_id); return e && (e.tono === "error" || e.tono === "aviso"); });
    return conMotivo.length ? conMotivo.map((u) => u.unit_id) : sugeridasParaReemplazo(muestra?.blocks ?? []);
  }, [unidades, revision, muestra]);

  if (!unidades) {
    return (
      <div className="rec-terr-seccion" data-qa-geometry-capacity="owned">
        <VacioSinFuente mensaje={null} />
      </div>
    );
  }

  async function correr<T>(trabajo: Trabajo, f: () => Promise<T>, alTerminar: (r: T) => Partial<Estado>) {
    setE((s) => ({ ...s, ocupado: trabajo, error: "" }));
    try {
      const r = await f();
      setE((s) => ({ ...s, ocupado: "", ...alTerminar(r) }));
    } catch (err: unknown) {
      const texto = err instanceof Error ? err.message.replace(/ · E_[A-Z_]+$/, "") : "No se pudo generar el archivo";
      const codigo = err instanceof ApiError ? err.code : "";
      setE((s) => ({ ...s, ocupado: "", error: codigo === "E_COVERAGE_DECISION_REQUIRED" ? `${texto} Resuélvelo en Hojas de ruta › Manzanas.` : texto }));
    }
  }

  return (
    <div className="rec-terr-seccion">
      {unidades.stale ? <AvisoDesactualizada enviadoAt={unidades.enviado_at} /> : null}
      {e.error ? <p className="rec-terr-error" role="alert">{e.error}</p> : null}
      {muestra && !muestraConCuotasRepartidas(muestra.blocks) ? (
        <div className="rec-terr-aviso" role="status">
          <p>
            Las hojas de esta muestra piden la mitad de hombres y la mitad de mujeres en todos los distritos. Reparte las cuotas por
            distrito en Hojas de ruta antes de armar el paquete. <Link to={HREF_REENVIO}>Ir a Hojas de ruta</Link>
          </p>
        </div>
      ) : null}

      <div className="rec-terr-tarjetas" data-qa-geometry-group="material-campo/territorial/paquetes" data-qa-geometry-contract="intrinsic">
        <article className="rec-terr-tarjeta" data-qa-geometry-member aria-label="Paquete de entrega">
          <h3><Archive size={15} aria-hidden /> Paquete de entrega</h3>
          {!listo ? (
            <p className="rec-terr-aviso" role="status">
              Falta en Hojas de ruta: {pasos.filter((p) => !p.ok).map((p) => p.label.toLocaleLowerCase("es-PE")).join(", ")}. <Link to={HREF_REENVIO}>Ir a Hojas de ruta</Link>
            </p>
          ) : null}
          {muestra ? (
            <>
              <p className="rec-terr-nota">Qué incluye, distrito por distrito: una carpeta con sus fichas, las hojas por zona, el Excel operativo y los metadatos del marco.</p>
              <PulsoTable
                columnas={COLUMNAS_PAQUETE}
                filas={[...porDistrito, { ubigeo: "total", distrito: "Total", titulares: paquete.titulares, reemplazos: paquete.reemplazos, zonas: paquete.zonas }]}
                idDeFila={(f) => f.ubigeo}
                ariaLabel="Contenido del paquete por distrito"
                densidad="compacta"
                altoMaximo={100000}
              />
            </>
          ) : (
            <p className="rec-terr-nota">Hojas de ruta no tiene una muestra guardada con la que armar el paquete.</p>
          )}
          <div className="rec-terr-fila">
            <PulsoButton variant="primary" size="sm" disabled={!config || !listo || corriendo || unidades.stale} onClick={() => config && void correr("zip", () => apiHojasRutaGenerate(config, muestra), (r) => ({ jobZip: r.job_id, zip: null }))}>
              <Archive size={14} aria-hidden /> {e.ocupado === "zip" ? "Preparando…" : "Generar ZIP"}
            </PulsoButton>
            <PulsoButton
              variant="secondary"
              size="sm"
              disabled={!config || !listo || corriendo || unidades.stale}
              onClick={() => config && void correr("excel", () => apiHojasRutaRouteWorkbook(config, muestra), (r) => {
                window.open(downloadUrl(r.file_id), "_blank", "noopener,noreferrer");
                return { excel: r };
              })}
            >
              <FileSpreadsheet size={14} aria-hidden /> {e.ocupado === "excel" ? "Creando…" : "Excel operativo"}
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
            <a className="rec-terr-archivo" href={downloadUrl(e.zip.file_id)}>
              <strong>Descargar ZIP</strong>
              <small>{fmt(e.zip.n_pdfs)} PDF · {fmt(e.zip.total_entrevistas)} entrevistas · {pesoLegible(e.zip.size)}</small>
            </a>
          ) : null}
          {e.excel ? (
            <a className="rec-terr-archivo" href={downloadUrl(e.excel.file_id)}>
              <strong>Descargar Excel</strong>
              <small>{fmt(e.excel.n_blocks)} titulares · {fmt(e.excel.n_replacement_blocks)} reemplazos · {pesoLegible(e.excel.size)}</small>
            </a>
          ) : null}
          <p className="rec-terr-nota">
            Se arman con la muestra vigente de Hojas de ruta. Si cambia el sorteo, estos archivos quedan desactualizados: vuelve a generarlos.
          </p>
          {!muestra ? (
            <PulsoButton variant="ghost" size="sm" onClick={() => { void onRecargar(); }}>Volver a leer Hojas de ruta</PulsoButton>
          ) : null}
        </article>

        <HojasDelPaquete campaignId={campaignId} unidades={unidades} />

        <article className="rec-terr-tarjeta" data-qa-geometry-member aria-label="Reemplazos puntuales">
          <h3><Shuffle size={15} aria-hidden /> Reemplazos puntuales</h3>
          <p className="rec-terr-nota">Para las titulares que fallaron en campo: un PDF con reemplazos nuevos, sin tocar el sorteo.</p>
          {sugeridas.length ? (
            <div className="rec-terr-sugeridas">
              <small>Por revisar en la muestra: conviene mirarlas primero</small>
              <div className="rec-terr-chips">
                {sugeridas.slice(0, 8).map((id) => {
                  const b = muestra?.blocks.find((x) => x.id_manzana === id);
                  return (
                    <button key={id} type="button" className="rec-terr-chip" aria-pressed={elegidas.includes(id)} disabled={corriendo} onClick={() => setElegidas((l) => alternarId(l, id))}>
                      {b ? codigoDeUmp(b) : id}{revision.porUnidad.get(id)?.motivo ? ` · ${revision.porUnidad.get(id)?.motivo}` : ""}
                    </button>
                  );
                })}
                {sugeridas.length > 8 ? <span className="rec-terr-nota">y {fmt(sugeridas.length - 8)} más</span> : null}
              </div>
            </div>
          ) : null}
          <PulsoInput type="search" size="sm" aria-label="Buscar titular" placeholder="Buscar UMP, distrito o zona" value={busqueda} disabled={!muestra || corriendo} onChange={(ev) => setBusqueda(ev.target.value)} />
          {filas.length ? (
            <ul className="rec-terr-filas">
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
            <p className="rec-terr-nota">{busqueda.trim() ? `Ninguna titular coincide con «${busqueda}».` : "Busca la titular que falló para pedirle reemplazos."}</p>
          )}
          {coincidencias > 12 ? <p className="rec-terr-nota">Se muestran 12 de {fmt(coincidencias)}: afina la búsqueda.</p> : null}
          <div className="rec-terr-fila">
            <label className="rec-terr-campo">
              <span>Reemplazos por titular</span>
              <PulsoInput type="number" size="sm" min={1} max={10} value={porTitular} disabled={corriendo} onChange={(ev) => setPorTitular(Math.min(10, Math.max(1, Math.round(Number(ev.target.value) || 1))))} />
            </label>
            <div className="rec-terr-campo">
              <span aria-hidden>Dónde buscarlos</span>
              <GlidingRadioGroup value={politica} options={POLITICAS} getOptionValue={(o) => o[0]} onValueChange={setPolitica} className="rec-terr-opciones" aria-label="Dónde buscar los reemplazos puntuales" getOptionProps={() => ({ disabled: corriendo })}>
                {(o) => <span>{o[1]}</span>}
              </GlidingRadioGroup>
            </div>
          </div>
          <PulsoButton
            variant="secondary"
            size="sm"
            disabled={!config || !muestra || !elegidas.length || corriendo || unidades.stale}
            onClick={() => config && muestra && void correr("puntuales", () => apiHojasRutaManualReplacementsPdf({ ...config, replacement_policy: politica }, muestra, elegidas, porTitular), (r) => ({ jobPuntuales: r.job_id, puntuales: null }))}
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
            <a className="rec-terr-archivo" href={downloadUrl(e.puntuales.file_id)}>
              <strong>Descargar PDF</strong>
              <small>{fmt(e.puntuales.n_replacement_blocks)} reemplazos para {fmt(e.puntuales.n_titulars)} titulares</small>
            </a>
          ) : null}
        </article>
      </div>
    </div>
  );
}
