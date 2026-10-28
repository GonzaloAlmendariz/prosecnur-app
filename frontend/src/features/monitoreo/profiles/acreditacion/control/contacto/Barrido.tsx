import { useMemo } from "react";
import { CalendarDays, GitMerge, Phone } from "lucide-react";
import type { MonitoreoAcreditacionReports, MonitoreoState } from "../../../../../../api/client";
import { pctConEspacio } from "../../../../core/formatoComun";
import { fmt, normalizeSourceMatch } from "../../formato";
import { AreaAcumulada, BarrasSuperpuestas, fechaCorta } from "../../avance/graficosDeAvance";
import { efectivasPorCanal } from "../../avance/avanceModelo";
import { useResumenDelCorte } from "../../navegacion/resumenDelCorte";
import type { AcreditacionAdvanceCard } from "../../avance/tarjetasDeAvance";
import { barridosAcumulados, construirBarridoDeAcreditacion, type ModeloDeBarrido } from "./barridoModelo";
import "../../avance/avance.css";
import "./contacto.css";
import { CabeceraDeTarjeta } from "../../navegacion/rotuloDePestana";
import { PestanaSinContenido, VacioDeBloque } from "../../piezas/AvisoDeTarjeta";

function porcentaje(parte: number, total: number) {
  return total > 0 ? pctConEspacio((parte / total) * 100) : "—";
}

function FilaDelEmbudo({ etiqueta, valor, base, clase }: { etiqueta: string; valor: number; base: number; clase: string }) {
  return (
    <li className="acr-ct-embudo-fila" data-qa-geometry-member>
      <span>{etiqueta}</span>
      <span className="acr-av-pista is-alta"><i className={clase} style={{ width: `${base > 0 ? Math.min(100, (valor / base) * 100) : 0}%` }} /></span>
      <b className="acr-av-num">{fmt(valor)}</b>
      <span className="acr-av-tenue acr-av-num">{valor === base ? "" : porcentaje(valor, base)}</span>
    </li>
  );
}

/** Por qué la esquina «sin efectiva × sin completa» no lleva cifra (C5). */
const MOTIVO_FUERA_DEL_CRUCE = "La matriz cruza efectivas. Quien no tiene efectiva al teléfono ni completa en la plataforma no se cuenta aquí.";

function Celda({ valor, rotulo, tono }: { valor: number | null; rotulo: string; tono: "acuerdo" | "diferencia" | "fuera" }) {
  if (tono === "fuera" || valor == null) {
    return (
      <div className="acr-ct-matriz-celda is-fuera" title={MOTIVO_FUERA_DEL_CRUCE} data-vacio="legitimo">
        <b className="acr-av-num" aria-hidden="true">—</b>
        <span>{rotulo}</span>
        <span className="pulso-sr-only">{MOTIVO_FUERA_DEL_CRUCE}</span>
      </div>
    );
  }
  return (
    <div className={`acr-ct-matriz-celda is-${tono}`}>
      <b className="acr-av-num">{fmt(valor)}</b>
      <span>{rotulo}</span>
    </div>
  );
}

type PropsDeVista = {
  modelo: ModeloDeBarrido;
  tarjetas: readonly AcreditacionAdvanceCard[];
  fuentes: ReadonlyArray<Record<string, unknown>>;
};

/** La vista, sin leer la memoria del corte: la usa el test de render. */
export function BarridoVista({ modelo, tarjetas, fuentes }: PropsDeVista) {
  const publico = modelo.publicos.length === 1 ? modelo.publicos[0] : null;
  const tarjeta = publico ? tarjetas.find((item) => normalizeSourceMatch(item.actor) === normalizeSourceMatch(publico)) ?? null : null;
  const canales = publico ? efectivasPorCanal(fuentes, publico) : [];
  const maxCanal = Math.max(1, ...canales.map((canal) => canal.efectivas));
  const categorias = [
    ...modelo.porFecha.map((dia) => ({ clave: dia.fecha, rotulo: fechaCorta(dia.fecha), fondo: dia.barridos, frente: dia.efectivos })),
    ...(modelo.sinFecha.barridos ? [{ clave: "sin-fecha", rotulo: "Sin fecha", fondo: modelo.sinFecha.barridos, frente: modelo.sinFecha.efectivos }] : []),
  ];
  const acumulado = barridosAcumulados(modelo.porFecha);
  const enMatriz = modelo.conciliadas != null;

  return (
    <div className="acr-ct" data-qa-geometry-group="acreditacion-control-barrido" data-qa-geometry-contract="intrinsic">
      <div className="acr-ct-izquierda">
        <section className="acr-av-panel" aria-label="Del padrón al cruce">
          <CabeceraDeTarjeta primera><h3>Del padrón al cruce</h3></CabeceraDeTarjeta>
          <ol className="acr-ct-embudo" data-qa-geometry-group="acreditacion-barrido-embudo" data-qa-geometry-contract="equal">
            <FilaDelEmbudo etiqueta="Padrón telefónico" valor={modelo.padron} base={modelo.padron} clase="is-universo" />
            <FilaDelEmbudo etiqueta="Barridos" valor={modelo.barridos} base={modelo.padron} clase="is-respondieron" />
            <FilaDelEmbudo etiqueta="Efectivos al teléfono" valor={modelo.efectivosAlTelefono} base={modelo.padron} clase="is-canal" />
            {modelo.conciliadas != null
              ? <FilaDelEmbudo etiqueta="Conciliados con la plataforma" valor={modelo.conciliadas} base={modelo.padron} clase="is-efectiva" />
              : null}
          </ol>
        </section>
        <div className="acr-ct-fila">
          <section className="acr-av-panel acr-ct-diario" aria-label="Casos por fecha de su último intento">
            <header className="acr-av-panel-cabecera">
              <h3>Casos por fecha de su último intento</h3>
            </header>
            <div className="acr-ct-grafico" data-qa-geometry-capacity="owned">
              {categorias.length
                ? <BarrasSuperpuestas categorias={categorias} tituloEje="Casos" etiqueta="Casos barridos y efectivos por fecha de su último intento" />
                : <VacioDeBloque icono={<CalendarDays size={15} />} titulo="La hoja todavía no trae fechas de intento." descripcion="Se leen de la columna de fecha de la hoja de barrido al actualizar." />}
            </div>
            {categorias.length ? (
              <span className="acr-av-leyenda is-centrada">
                <span><i className="acr-av-punto is-parcial" aria-hidden="true" />Barridos</span>
                <span><i className="acr-av-punto is-efectiva" aria-hidden="true" />Efectivos</span>
              </span>
            ) : null}
          </section>
          <div className="acr-ct-columna">
            <section className="acr-av-panel" aria-label="Barrido y plataforma">
              <header className="acr-av-panel-cabecera"><h3>Barrido y plataforma</h3></header>
              {enMatriz ? (
                <div className="acr-ct-matriz" role="table" aria-label="Efectivas al teléfono frente a respuestas completas en la plataforma">
                  <span />
                  <span className="acr-av-antetitulo" role="columnheader">Completa en plataforma</span>
                  <span className="acr-av-antetitulo" role="columnheader">Sin completa</span>
                  <span className="acr-av-antetitulo" role="rowheader">Efectiva al teléfono</span>
                  <Celda valor={modelo.conciliadas} rotulo="Conciliadas" tono="acuerdo" />
                  <Celda valor={modelo.soloTelefono} rotulo="Solo al teléfono" tono="diferencia" />
                  <span className="acr-av-antetitulo" role="rowheader">Sin efectiva al teléfono</span>
                  <Celda valor={modelo.soloPlataforma} rotulo="Solo en la plataforma" tono="diferencia" />
                  <Celda valor={null} rotulo="Fuera del cruce" tono="fuera" />
                </div>
              ) : <VacioDeBloque icono={<GitMerge size={15} />} titulo="El corte no trae el cruce del barrido con la plataforma." descripcion="Sale de «Operación por responsable» al actualizar." />}
            </section>
            {tarjeta && canales.length ? (
              <section className="acr-av-panel" aria-label={`Efectivas de ${tarjeta.actor} por canal`}>
                <header className="acr-av-panel-cabecera"><h3>Efectivas de {tarjeta.actor} por canal</h3></header>
                <div className="acr-ct-cuerpo">
                  <span className="acr-res-publico-barra">
                    <span className="acr-av-pista is-gruesa"><i style={{ width: `${tarjeta.universe ? Math.min(100, (tarjeta.effective / tarjeta.universe) * 100) : 0}%` }} /></span>
                    {tarjeta.meta && tarjeta.universe ? <span className="acr-av-marca-meta" style={{ left: `${Math.min(100, (tarjeta.meta / tarjeta.universe) * 100)}%` }} aria-hidden="true" /> : null}
                  </span>
                  <p className="acr-ct-linea">
                    <span>{fmt(tarjeta.effective)} efectivas de {fmt(tarjeta.universe)} personas</span>
                    {tarjeta.meta ? <span className="acr-ct-meta">Meta de {fmt(tarjeta.meta)}</span> : null}
                  </p>
                  {canales.map((canal) => (
                    <div key={canal.canal} className="acr-pub-embudo-fila">
                      <span>{canal.canal}</span>
                      <span className="acr-av-pista"><i className="is-canal" style={{ width: `${(canal.efectivas / maxCanal) * 100}%` }} /></span>
                      <b className="acr-av-num">{fmt(canal.efectivas)}</b>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </div>
      <aside className="acr-av-panel acr-ct-derecha" aria-label={`Estado de los ${fmt(modelo.padron)} casos`}>
        <header className="acr-av-panel-cabecera"><h3>Estado de los {fmt(modelo.padron)} casos</h3></header>
        <div className="acr-ct-familias">
          <div className="acr-av-apilada is-alta" role="img" aria-label={modelo.familias.map((grupo) => `${grupo.etiqueta}: ${fmt(grupo.total)}`).join("; ")}>
            {modelo.familias.map((grupo) => <span key={grupo.familia} className={`is-familia-${grupo.familia}`} style={{ flexGrow: grupo.total }} />)}
          </div>
          <ul>
            {modelo.familias.map((grupo) => (
              <li key={grupo.familia}>
                <p className="acr-ct-familia">
                  <i className={`acr-av-punto is-familia-${grupo.familia}`} aria-hidden="true" />
                  <b>{grupo.etiqueta}</b>
                  <b className="acr-av-num">{fmt(grupo.total)}</b>
                  <span className="acr-av-tenue acr-av-num">{porcentaje(grupo.total, modelo.padron)}</span>
                </p>
                {grupo.items.length > 1 || grupo.items[0]?.status !== grupo.etiqueta ? (
                  <ul className="acr-ct-status">
                    {grupo.items.map((item) => (
                      <li key={item.status}>
                        <span>{item.status}</span>
                        <span className="acr-av-num">{fmt(item.casos)}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
        {acumulado.length > 1 ? (
          <div className="acr-ct-acumulado" data-qa-geometry-capacity="owned">
            <span className="acr-av-antetitulo">Casos barridos acumulados, por fecha del último intento</span>
            <AreaAcumulada serie={acumulado} meta={null} tituloEje="Casos" etiqueta="Casos barridos acumulados por fecha del último intento" />
          </div>
        ) : null}
      </aside>
    </div>
  );
}

/**
 * Control › Barrido (ficha Ctl2): cuánto del padrón se llamó y con qué
 * resultado. Lee la hoja telefónica del corte y, de la memoria del corte, la
 * meta y las efectivas por canal del público que tiene barrido.
 */
export function Barrido({ reports, state }: { reports: MonitoreoAcreditacionReports; state: MonitoreoState | null | undefined }) {
  const reglas = state?.config?.operational_model?.state_rules;
  const modelo = useMemo(() => construirBarridoDeAcreditacion(reports, reglas ?? []), [reports, reglas]);
  const avance = useResumenDelCorte((estado) => estado.avance);
  const fuentes = useResumenDelCorte((estado) => estado.fuentes);
  if (!modelo.padron) {
    return (
      <PestanaSinContenido titulo="Del padrón al cruce" icono={<Phone size={18} />} motivo="El corte no trae la hoja de barrido." descripcion="Se conecta en Insumos › Fuentes y se lee al actualizar." />
    );
  }
  return <BarridoVista modelo={modelo} tarjetas={avance?.tarjetas ?? []} fuentes={fuentes ?? []} />;
}
