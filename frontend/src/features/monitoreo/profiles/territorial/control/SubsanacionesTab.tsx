import { memo, useMemo, useState } from "react";
import { ArrowRight, Loader2, Scale } from "lucide-react";
import type { MonitoreoTerritorialDashboard, MonitoreoTerritorialOperationalAdjustment, MonitoreoTerritorialPhase } from "../../../../../api/client";
import { useFocoMonitoreo } from "../../../useMonitoreoDireccion";
import { diaYMes, fmt } from "../rotulos";
import { MapaDeMovimientos } from "./MapaDeMovimientos";
import { ajusteParaAplicar, construirSubsanaciones, lugarDelPaquete, type PaqueteSugerido } from "./subsanacionesModel";
import { useRechazos } from "./useRechazos";
import { RotuloDePestana } from "../navegacion/RotuloDePestana";
import { SiluetaDeDistrito } from "../avance/SiluetaDeDistrito";
import "./subsanaciones.css";

type Aviso = { tono: "ok" | "error"; texto: string } | null;

/**
 * Control › Subsanaciones (territorial.md §3.11). A la izquierda las celdas
 * con déficit por UMP; al centro el paquete que sugiere el motor, que el
 * coordinador aplica con una nota (queda en el historial con autor y fecha);
 * a la derecha las activas, las revertidas y el historial, con «Revertir».
 *
 * «Rechazar» guarda la decisión con su nota, autor y fecha
 * (`monitoreo_territorial_rechazos.R`); si el motor vuelve a sugerir el mismo
 * paquete, se marca como ya rechazado. `foco=<UMP>` (desde Faltante por UMP)
 * pone primero el paquete de esa UMP.
 */
function SubsanacionesTabImpl({
  reports,
  phase,
  onApply,
  onRevert,
}: {
  reports: MonitoreoTerritorialDashboard | null;
  phase: MonitoreoTerritorialPhase;
  onApply?: (adjustment: MonitoreoTerritorialOperationalAdjustment) => Promise<unknown>;
  onRevert?: (id: string, reason?: string) => Promise<unknown>;
}) {
  const { rechazos, rechazar } = useRechazos(phase);
  const modelo = useMemo(() => construirSubsanaciones(reports, rechazos), [rechazos, reports]);
  const [foco] = useFocoMonitoreo();
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [enCurso, setEnCurso] = useState<string | null>(null);
  const [aviso, setAviso] = useState<Aviso>(null);
  const [porRevertir, setPorRevertir] = useState<string | null>(null);
  const sugerencias = useMemo(() => {
    const ump = String(foco ?? "").replace(/^UMP\s*/i, "");
    return [...modelo.sugerencias].sort((a, b) => Number(b.destino.ump === ump) - Number(a.destino.ump === ump));
  }, [foco, modelo.sugerencias]);

  if (!modelo.disponible) {
    return (
      <section className="mon-sub mon-sub--vacio" data-audit-ready="vacio:sin-subsanaciones-en-el-corte" aria-label="Subsanaciones">
        <div className="mon-sub-panel mon-sub-vacio">
          <RotuloDePestana />
          <Scale size={20} aria-hidden="true" />
          <strong>Este corte no trae las subsanaciones del motor</strong>
          <span>Actualiza la vista para pedir el corte de Consultas, que las calcula.</span>
        </div>
      </section>
    );
  }

  const aplicar = async (paquete: PaqueteSugerido) => {
    if (!onApply) return;
    setEnCurso(paquete.id);
    setAviso(null);
    try {
      await onApply(ajusteParaAplicar(paquete, notas[paquete.id] ?? ""));
      setAviso({ tono: "ok", texto: `Paquete aplicado: UMP ${paquete.origen.ump} → UMP ${paquete.destino.ump}. El avance se recalculó.` });
    } catch (error) {
      setAviso({ tono: "error", texto: error instanceof Error ? error.message : String(error) });
    } finally {
      setEnCurso(null);
    }
  };

  const rechazarPaquete = async (paquete: PaqueteSugerido) => {
    setEnCurso(`rechazo:${paquete.id}`);
    setAviso(null);
    try {
      await rechazar(paquete.ajuste, notas[paquete.id] ?? "");
      setAviso({ tono: "ok", texto: `Paquete rechazado: UMP ${paquete.origen.ump} → UMP ${paquete.destino.ump}. Queda en el historial.` });
    } catch (error) {
      setAviso({ tono: "error", texto: error instanceof Error ? error.message : String(error) });
    } finally {
      setEnCurso(null);
    }
  };

  const revertir = async (id: string) => {
    if (!onRevert) return;
    setEnCurso(id);
    setAviso(null);
    try {
      await onRevert(id, "Revertida desde Control › Subsanaciones");
      setAviso({ tono: "ok", texto: "Subsanación revertida. El avance se recalculó." });
      setPorRevertir(null);
    } catch (error) {
      setAviso({ tono: "error", texto: error instanceof Error ? error.message : String(error) });
    } finally {
      setEnCurso(null);
    }
  };

  return (
    <section
      className="mon-sub"
      aria-label="Subsanaciones"
      data-audit-ready="monitoreo-territorial-control-subsanaciones"
      data-qa-geometry-group="territorial-subsanaciones"
      data-qa-geometry-contract="intrinsic"
    >
      <section className="mon-sub-panel" aria-labelledby="mon-sub-deficit" data-qa-geometry-member="deficit">
        <header className="mon-sub-cabecera">
          <RotuloDePestana />
          <h3 id="mon-sub-deficit">Celdas con déficit</h3>
          <span className="mon-sub-base">{fmt(modelo.celdas)} en {fmt(modelo.umps.length)} UMP</span>
        </header>
        {modelo.umps.length ? (
          <ul className="mon-sub-lista" data-qa-geometry-capacity="owned" data-qa-geometry-group="territorial-subsanaciones-deficit" data-qa-geometry-contract="intrinsic">
            {modelo.umps.map((item) => (
              <li key={`${item.ump}-${item.manzana}`} className={item.elegible ? "is-elegible" : "is-bloqueada"}>
                <SiluetaDeDistrito distrito={item.distrito} tono="falta" lado={36} />
                <div className="mon-sub-ump">
                  <b>UMP {item.ump}</b>
                  <span>{item.distrito}{item.manzana ? `, manzana ${item.manzana}` : ""}</span>
                </div>
                <span className="mon-sub-chips">
                  <span className={`mon-ter-chip ${item.elegible ? "is-info" : "is-aviso"}`}>{item.elegible ? "Con excedente compatible" : "Bloqueada"}</span>
                  {item.celdas.map((celda) => <span key={celda.texto} className="mon-sub-chip">Falta {fmt(celda.falta)}: {celda.texto}</span>)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mon-sub-base">Ninguna celda con déficit.</p>
        )}
      </section>

      <section className="mon-sub-panel" aria-labelledby="mon-sub-paquetes" data-qa-geometry-member="paquetes">
        <header className="mon-sub-cabecera">
          <h3 id="mon-sub-paquetes">Paquete sugerido</h3>
          <span className="mon-sub-base">{fmt(sugerencias.length)} del motor</span>
        </header>
        {aviso ? <p className={`mon-sub-aviso is-${aviso.tono}`} role={aviso.tono === "error" ? "alert" : "status"}>{aviso.texto}</p> : null}
        {sugerencias.length ? (
          <ul className="mon-sub-paquetes" data-qa-geometry-capacity="owned">
            {sugerencias.map((paquete) => (
              <li key={paquete.id} className={String(foco ?? "").replace(/^UMP\s*/i, "") === paquete.destino.ump ? "is-enfocado" : ""}>
                <div className="mon-sub-ruta">
                  <span><b>UMP {paquete.origen.ump}</b> {lugarDelPaquete(paquete.origen)}</span>
                  <ArrowRight size={14} aria-label="cede a" />
                  <span><b>UMP {paquete.destino.ump}</b> {lugarDelPaquete(paquete.destino)}</span>
                </div>
                <p className="mon-sub-base">
                  {fmt(paquete.casos)} {paquete.casos === 1 ? "caso" : "casos"}: {paquete.movimientos.map((m) => m.celda).join(", ")}, a {paquete.distancia}
                </p>
                {paquete.rechazo ? (
                  <p className="mon-sub-ya-rechazado">
                    Ya rechazado el {diaYMes(paquete.rechazo.fecha) || "—"} por {paquete.rechazo.autor}
                    {paquete.rechazo.nota ? `: «${paquete.rechazo.nota}»` : "."} El motor lo vuelve a sugerir.
                  </p>
                ) : null}
                <label className="mon-sub-nota">
                  <span>Nota de la decisión</span>
                  <textarea
                    rows={2}
                    value={notas[paquete.id] ?? ""}
                    placeholder="Queda en el historial con autor y fecha"
                    onChange={(event) => {
                      const valor = event.currentTarget.value;
                      setNotas((previas) => ({ ...previas, [paquete.id]: valor }));
                    }}
                  />
                </label>
                <span className="mon-sub-acciones">
                  <button type="button" className="mon-sub-boton" disabled={enCurso != null} onClick={() => { void rechazarPaquete(paquete); }}>
                    {enCurso === `rechazo:${paquete.id}` ? <Loader2 size={14} className="pulso-spin" aria-hidden="true" /> : null}
                    Rechazar
                  </button>
                  <button type="button" className="mon-sub-boton is-primario" disabled={!onApply || enCurso != null} onClick={() => { void aplicar(paquete); }}>
                    {enCurso === paquete.id ? <Loader2 size={14} className="pulso-spin" aria-hidden="true" /> : null}
                    Aplicar paquete
                  </button>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mon-sub-base">Sin excedente compatible</p>
        )}
      </section>

      <div className="mon-sub-derecha" data-qa-geometry-member="derecha">
      <section className="mon-sub-panel mon-sub-movimientos" aria-labelledby="mon-sub-movimientos">
        <header className="mon-sub-cabecera">
          <h3 id="mon-sub-movimientos">Movimientos en el territorio</h3>
        </header>
        <MapaDeMovimientos activos={modelo.ajustesActivos} sugeridos={sugerencias.map((paquete) => paquete.ajuste)} />
      </section>

      <section className="mon-sub-panel mon-sub-aplicadas" aria-labelledby="mon-sub-activas">
        <header className="mon-sub-cabecera">
          <h3 id="mon-sub-activas">Subsanaciones aplicadas</h3>
          <span className="mon-sub-base">{fmt(modelo.activas)} activas, {fmt(modelo.revertidas)} revertidas y {fmt(modelo.rechazadas)} {modelo.rechazadas === 1 ? "paquete rechazado" : "paquetes rechazados"}</span>
        </header>
        {modelo.activasPorDistrito.length ? (
          <ul className="mon-sub-distritos">
            {modelo.activasPorDistrito.map((item) => <li key={item.distrito}><span>{item.distrito}</span><b>{fmt(item.casos)}</b></li>)}
          </ul>
        ) : null}
        <h4 className="mon-sub-subtitulo">Historial</h4>
        {modelo.historial.length ? (
          <ol className="mon-sub-historial" data-qa-geometry-capacity="owned">
            {modelo.historial.map((entrada) => (
              <li key={entrada.id} className={`is-${entrada.estado}`}>
                <small>{entrada.cuando}</small>
                <span>{entrada.texto}</span>
                {entrada.nota ? <em>«{entrada.nota}»</em> : null}
                {entrada.estado === "activa" && onRevert ? (
                  porRevertir === entrada.id ? (
                    <span className="mon-sub-confirmar">
                      <button type="button" className="mon-sub-boton is-peligro" disabled={enCurso != null} onClick={() => { void revertir(entrada.id); }}>
                        {enCurso === entrada.id ? <Loader2 size={14} className="pulso-spin" aria-hidden="true" /> : null}
                        Confirmar reversión
                      </button>
                      <button type="button" className="mon-sub-boton" onClick={() => setPorRevertir(null)}>Cancelar</button>
                    </span>
                  ) : (
                    <button type="button" className="mon-sub-boton" disabled={enCurso != null} onClick={() => setPorRevertir(entrada.id)}>Revertir</button>
                  )
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mon-sub-base">Todavía no se aplicó ninguna subsanación.</p>
        )}
      </section>
      </div>
    </section>
  );
}

export const SubsanacionesTab = memo(SubsanacionesTabImpl);
