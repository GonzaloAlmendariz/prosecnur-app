import { memo, useMemo, useState } from "react";
import { ArrowRight, Loader2, Scale } from "lucide-react";
import type { MonitoreoTerritorialDashboard, MonitoreoTerritorialOperationalAdjustment } from "../../../../../api/client";
import { useFocoMonitoreo } from "../../../useMonitoreoDireccion";
import { fmt } from "../rotulos";
import { ajusteParaAplicar, construirSubsanaciones, type PaqueteSugerido } from "./subsanacionesModel";
import "./subsanaciones.css";

type Aviso = { tono: "ok" | "error"; texto: string } | null;

/**
 * Control › Subsanaciones (territorial.md §3.11). A la izquierda las celdas
 * con déficit por UMP; al centro el paquete que sugiere el motor, que el
 * coordinador aplica con una nota (queda en el historial con autor y fecha);
 * a la derecha las activas, las revertidas y el historial, con «Revertir».
 *
 * «Rechazar» el paquete no se dibuja todavía: el motor no tiene dónde guardar
 * un rechazo auditado (ver el plan, T5). `foco=<UMP>` (desde Faltante por UMP)
 * pone primero el paquete de esa UMP.
 */
function SubsanacionesTabImpl({
  reports,
  onApply,
  onRevert,
}: {
  reports: MonitoreoTerritorialDashboard | null;
  onApply?: (adjustment: MonitoreoTerritorialOperationalAdjustment) => Promise<unknown>;
  onRevert?: (id: string, reason?: string) => Promise<unknown>;
}) {
  const modelo = useMemo(() => construirSubsanaciones(reports), [reports]);
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
          <h3 id="mon-sub-deficit">Celdas con déficit</h3>
          <span className="mon-sub-base">{fmt(modelo.celdas)} en {fmt(modelo.umps.length)} UMP</span>
        </header>
        {modelo.umps.length ? (
          <ul className="mon-sub-lista" data-qa-geometry-capacity="owned">
            {modelo.umps.map((item) => (
              <li key={`${item.ump}-${item.manzana}`} className={item.elegible ? "is-elegible" : "is-bloqueada"}>
                <div className="mon-sub-ump">
                  <b>UMP {item.ump}</b>
                  <span>{item.distrito}{item.manzana ? `, manzana ${item.manzana}` : ""}</span>
                  <small>{item.elegible ? "Con excedente compatible" : "Bloqueada"}</small>
                </div>
                <span className="mon-sub-chips">
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
                  <span><b>UMP {paquete.origen.ump}</b> Mz {paquete.origen.manzana} · {paquete.origen.aplicador}</span>
                  <ArrowRight size={14} aria-label="cede a" />
                  <span><b>UMP {paquete.destino.ump}</b> Mz {paquete.destino.manzana} · {paquete.destino.aplicador}</span>
                </div>
                <p className="mon-sub-base">
                  {fmt(paquete.casos)} {paquete.casos === 1 ? "caso" : "casos"}: {paquete.movimientos.map((m) => m.celda).join(", ")} · {paquete.distancia}
                </p>
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
                <button type="button" className="mon-sub-boton is-primario" disabled={!onApply || enCurso != null} onClick={() => { void aplicar(paquete); }}>
                  {enCurso === paquete.id ? <Loader2 size={14} className="pulso-spin" aria-hidden="true" /> : null}
                  Aplicar paquete
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mon-sub-base">El motor no encuentra excedente compatible para las celdas abiertas.</p>
        )}
      </section>

      <section className="mon-sub-panel" aria-labelledby="mon-sub-activas" data-qa-geometry-member="activas">
        <header className="mon-sub-cabecera">
          <h3 id="mon-sub-activas">Subsanaciones aplicadas</h3>
          <span className="mon-sub-base">{fmt(modelo.activas)} activas · {fmt(modelo.revertidas)} revertidas</span>
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
    </section>
  );
}

export const SubsanacionesTab = memo(SubsanacionesTabImpl);
