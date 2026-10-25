import { Fragment, memo, useMemo, useState } from "react";
import { ArrowRightLeft, ChevronDown, ChevronRight, Info, Map as MapIcon, Target } from "lucide-react";
import type { MonitoreoTerritorialDashboard } from "../../../../../api/client";
import { Switch } from "../../../../../components/Switch";
import { useFocoMonitoreo } from "../../../useMonitoreoDireccion";
import { fmt, fmtConSigno } from "../rotulos";
import {
  construirFaltante,
  filtrarFilas,
  saldoDeSubsanaciones,
  textoDeQuienCubre,
  type CeldaDeCuota,
  type FilaDeUmp,
  type FiltroDeFaltante,
  type ModeloFaltante,
} from "./faltanteModel";
import { DetalleDeUmp } from "./DetalleDeUmp";
import { SiluetaDeDistrito } from "./SiluetaDeDistrito";
import { RotuloDePestana } from "../navegacion/RotuloDePestana";
import "./faltante.css";

/**
 * Avance › Faltante por UMP, pantalla de llegada del modo (§3.17).
 *
 * Arriba, lo que falta en la manzana en uso de cada UMP pendiente y quién lo
 * cubre; a la derecha, lo logrado frente a la cuota por distrito. Abajo, la
 * cuota de cada UMP celda por celda, con el signo de lo subsanado, la falta y
 * quién la cubre. Cada fila se despliega con su matriz observada (paridad con
 * Validación › Cuotas: encuestadores, subsanado y falta real).
 */
function FaltantePorUmpImpl({ reports }: { reports: MonitoreoTerritorialDashboard | null }) {
  const modelo = useMemo(() => construirFaltante(reports), [reports]);
  const [foco, escribirFoco] = useFocoMonitoreo();
  const [filtro, setFiltro] = useState<FiltroDeFaltante>("todas");
  const [conReemplazos, setConReemplazos] = useState(true);
  const filas = useMemo(() => filtrarFilas(modelo.filas, filtro, conReemplazos), [conReemplazos, filtro, modelo.filas]);

  if (!modelo.configurado) {
    return (
      <section className="mon-falt mon-falt--vacio" data-audit-ready="vacio:sin-cuota" aria-label="Faltante por UMP">
        <div className="mon-falt-panel mon-falt-vacio" data-qa-geometry-empty="legitimo">
          <RotuloDePestana />
          <Target size={20} aria-hidden="true" />
          <strong>Sin cuota territorial configurada</strong>
          <span>La cuota por UMP se declara en Modelo › Cuotas desde la muestra de Hojas de ruta.</span>
          <button type="button" className="mon-falt-boton" onClick={() => escribirFoco(null, { seccion: "modelo", pestana: "cuotas", panel: null })}>
            Abrir Modelo › Cuotas
          </button>
        </div>
      </section>
    );
  }

  const conteos: Record<FiltroDeFaltante, number> = {
    pendientes: modelo.pendientes.length,
    subsanadas: modelo.subsanadas,
    todas: modelo.totalUmp,
  };

  return (
    <section
      className="mon-falt"
      aria-label="Faltante por UMP"
      data-audit-ready="monitoreo-territorial-avance-faltante"
      data-qa-geometry-group="territorial-faltante"
      data-qa-geometry-contract="intrinsic"
    >
      <div className="mon-falt-arriba">
        <PanelDePendientes
          modelo={modelo}
          onSugerencia={(ump) => escribirFoco(ump, { seccion: "control", pestana: "subsanaciones", panel: null })}
          onMapa={(ump) => escribirFoco(ump, { seccion: "avance", pestana: "mapa", panel: null })}
        />
        <MapaDeCalor modelo={modelo} />
      </div>

      <section className="mon-falt-panel mon-falt-cuotas" aria-labelledby="mon-falt-cuotas-titulo" data-qa-geometry-member="cuotas">
        <header className="mon-falt-cabecera">
          <h3 id="mon-falt-cuotas-titulo">Cuota de cada UMP</h3>
          <span className="mon-falt-base">Manzana en uso. El signo indica subsanaciones recibidas o cedidas.</span>
          <span className="mon-falt-controles">
            <span className="mon-falt-segmentado" role="group" aria-label="Qué UMP mostrar">
              {(["pendientes", "subsanadas", "todas"] as const).map((clave) => (
                <button
                  key={clave}
                  type="button"
                  aria-pressed={filtro === clave}
                  className={filtro === clave ? "is-active" : ""}
                  onClick={() => setFiltro(clave)}
                >
                  {clave === "pendientes" ? "Con celda pendiente" : clave === "subsanadas" ? "Subsanadas" : "Todas"}
                  <b>{fmt(conteos[clave])}</b>
                </button>
              ))}
            </span>
            <span className="mon-falt-switch">
              <Switch
                checked={conReemplazos}
                onToggle={() => setConReemplazos((valor) => !valor)}
                ariaLabel="Incluir UMP que trabajan en su manzana de reemplazo"
                className="mon-falt-switch-piel"
              />
              <span aria-hidden="true">Incluir reemplazos</span>
            </span>
          </span>
        </header>
        <TablaDeCuotas
          filas={filas}
          columnas={modelo.columnas}
          foco={foco}
          onFoco={(ump) => escribirFoco(foco === ump ? null : ump)}
        />
      </section>
    </section>
  );
}

function PanelDePendientes({
  modelo,
  onSugerencia,
  onMapa,
}: {
  modelo: ModeloFaltante;
  onSugerencia: (ump: string) => void;
  onMapa: (ump: string) => void;
}) {
  const completas = modelo.totalUmp - modelo.pendientes.length;
  return (
    <section className="mon-falt-panel mon-falt-pendientes" aria-labelledby="mon-falt-pendientes-titulo" data-qa-geometry-member="pendientes">
      <header className="mon-falt-cabecera">
        <RotuloDePestana />
        <h3 id="mon-falt-pendientes-titulo">Falta en la manzana en uso</h3>
        {modelo.celdasFueraDeUso > 0 ? (
          <span className="mon-falt-base">
            {modelo.celdasFueraDeUso === 1
              ? "Otra celda con déficit está en una manzana que la UMP ya no usa."
              : `Otras ${fmt(modelo.celdasFueraDeUso)} celdas con déficit están en manzanas que la UMP ya no usa.`}
          </span>
        ) : null}
      </header>
      <div className="mon-falt-tarjetas" data-qa-geometry-group="territorial-faltante-tarjetas" data-qa-geometry-contract="intrinsic">
        {modelo.pendientes.map((fila) => (
          <article key={fila.ump} className={`mon-falt-tarjeta${fila.cubre?.tipo === "sugerencia" ? " is-con-sugerencia" : ""}`}>
            <SiluetaDeDistrito distrito={fila.distrito} tono="falta" />
            <div className="mon-falt-tarjeta-linea is-identidad">
              <strong>UMP {fila.ump}</strong>
              <span>{fila.distrito}, manzana {fila.manzana}, {fila.aplicador}</span>
            </div>
            <div className="mon-falt-tarjeta-linea is-falta">
              {fila.faltantes.map((item) => (
                <span key={item.texto} className="mon-falt-chip is-falta">Falta {fmt(item.falta)}: {item.texto}</span>
              ))}
              {fila.cubre?.tipo === "sugerencia" ? (
                <span className="mon-falt-chip is-sugerencia">Sugerencia desde la {textoDeQuienCubre(fila.cubre)}</span>
              ) : (
                <span className="mon-falt-sin">Sin excedente compatible cerca</span>
              )}
            </div>
            <div className="mon-falt-tarjeta-accion">
              {fila.ultimoCaso ? <small>Último caso el {fila.ultimoCaso}</small> : null}
              {fila.cubre?.tipo === "sugerencia" ? (
                <button type="button" className="mon-falt-boton is-primario" onClick={() => onSugerencia(fila.ump)}>
                  <ArrowRightLeft size={14} aria-hidden="true" />
                  Revisar sugerencia
                </button>
              ) : (
                <button type="button" className="mon-falt-boton" onClick={() => onMapa(fila.ump)}>
                  <MapIcon size={14} aria-hidden="true" />
                  Ver en el mapa
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      <p className={`mon-falt-aviso${modelo.pendientes.length ? "" : " is-ok"}`}>
        <Info size={15} aria-hidden="true" />
        <span>
          {modelo.pendientes.length
            ? `Las otras ${fmt(completas)} UMP tienen su cuota completa`
            : `Las ${fmt(modelo.totalUmp)} UMP tienen su cuota completa`}
          {modelo.subsanadas ? `, ${fmt(modelo.subsanadas)} de ellas con subsanación.` : "."}
        </span>
      </p>
    </section>
  );
}

function tonoDeCalor(logrado: number, meta: number): { fondo: string; tinta: "clara" | "oscura" } {
  if (!(meta > 0)) return { fondo: "var(--pulso-surface-3)", tinta: "oscura" };
  const razon = logrado / meta;
  if (razon < 1) return { fondo: "var(--pulso-warn-bg)", tinta: "oscura" };
  // De 100 % a 125 % o más, del azul más suave al marino.
  const intensidad = Math.round(28 + Math.min(1, (razon - 1) / 0.25) * 52);
  return {
    fondo: `color-mix(in srgb, var(--pulso-brand-navy) ${intensidad}%, var(--pulso-surface))`,
    tinta: intensidad >= 50 ? "clara" : "oscura",
  };
}

function MapaDeCalor({ modelo }: { modelo: ModeloFaltante }) {
  const columnas = modelo.distritos[0]?.celdas ?? [];
  return (
    <section className="mon-falt-panel mon-falt-calor" aria-labelledby="mon-falt-calor-titulo" data-qa-geometry-member="calor">
      <header className="mon-falt-cabecera">
        <h3 id="mon-falt-calor-titulo">Logrado frente a la cuota, por distrito</h3>
        <span className="mon-falt-base">Base: {fmt(modelo.casosConSexoYEdad)} casos con sexo y edad</span>
      </header>
      <table className="mon-falt-calor-tabla">
        <thead>
          <tr>
            <th scope="col"><span className="pulso-sr-only">Distrito</span></th>
            {columnas.map((celda) => <th key={celda.clave} scope="col">{celda.rotulo}</th>)}
          </tr>
        </thead>
        <tbody>
          {modelo.distritos.map((fila) => (
            <tr key={fila.distrito}>
              <th scope="row"><span className="mon-ter-con-silueta"><SiluetaDeDistrito distrito={fila.distrito} lado={22} />{fila.distrito}</span></th>
              {fila.celdas.map((celda) => {
                const tono = tonoDeCalor(celda.logrado, celda.meta);
                return (
                  <td key={celda.clave}>
                    <span
                      className={`mon-falt-calor-celda is-${tono.tinta}`}
                      style={{ background: tono.fondo }}
                      title={`${fila.distrito}, ${celda.rotulo}: ${fmt(celda.logrado)} de ${fmt(celda.meta)}`}
                    >
                      <b>{fmt(celda.logrado)}</b> de {fmt(celda.meta)}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function CeldaDeTabla({ celda }: { celda: CeldaDeCuota }) {
  const tono = celda.falta > 0 ? "is-falta" : "is-cumple";
  return (
    <span className={`mon-falt-celda ${tono}`}>
      {fmt(celda.logrado)} de {fmt(celda.meta)}
      {celda.delta !== 0 ? <b className={celda.delta > 0 ? "is-recibe" : "is-cede"}>{fmtConSigno(celda.delta)}</b> : null}
    </span>
  );
}

function TablaDeCuotas({
  filas,
  columnas,
  foco,
  onFoco,
}: {
  filas: readonly FilaDeUmp[];
  columnas: ModeloFaltante["columnas"];
  foco: string | null;
  onFoco: (ump: string) => void;
}) {
  if (!filas.length) {
    return (
      <div className="mon-falt-vacio-tabla" data-qa-geometry-empty="legitimo">
        Ninguna UMP con ese filtro.
      </div>
    );
  }
  return (
    <div className="mon-falt-tabla-marco" data-scroll-reset data-qa-geometry-capacity="owned" tabIndex={0} aria-label="Cuota de cada UMP, con desplazamiento">
      <table className="mon-falt-tabla">
        <thead>
          <tr>
            <th scope="col" className="is-ump">UMP</th>
            <th scope="col" className="is-distrito">Distrito</th>
            <th scope="col">Manzana</th>
            <th scope="col" className="is-aplicador">Aplicador</th>
            {columnas.map((columna) => <th key={columna.clave} scope="col" className="is-celda">{columna.rotulo}</th>)}
            <th scope="col" className="is-num">Falta</th>
            <th scope="col" className="is-num" title="Saldo de subsanaciones recibidas o cedidas">Saldo</th>
            <th scope="col" className="is-cubre" title="Quién cubre la falta">Cubre</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => {
            const abierta = foco === fila.ump;
            return (
              <Fragment key={fila.ump}>
                <tr className={`is-${fila.estado}${abierta ? " is-abierta" : ""}`}>
                  <th scope="row" className="is-ump">
                    <button
                      type="button"
                      aria-expanded={abierta}
                      aria-controls={`mon-falt-detalle-${fila.ump}`}
                      aria-label={`UMP ${fila.ump}: ${abierta ? "ocultar" : "ver"} el detalle de su cuota`}
                      onClick={() => onFoco(fila.ump)}
                    >
                      {abierta ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
                      {fila.ump}
                    </button>
                  </th>
                  <td className="is-distrito">{fila.distrito}</td>
                  <td>{fila.reemplazo ? "Reemplazo" : "Titular"} {fila.manzana}</td>
                  <td className="is-aplicador">{fila.aplicador}</td>
                  {fila.celdas.map((celda) => (
                    <td key={celda.clave} className="is-celda"><CeldaDeTabla celda={celda} /></td>
                  ))}
                  <td className={`is-num${fila.falta > 0 ? " is-falta" : ""}`}>{fmt(fila.falta)}</td>
                  <td className="is-num">{saldoDeSubsanaciones(fila)}</td>
                  <td className="is-cubre">
                    {fila.cubre?.tipo === "sugerencia" ? (
                      <span className="mon-falt-chip is-sugerencia">{textoDeQuienCubre(fila.cubre)}</span>
                    ) : fila.falta > 0 ? textoDeQuienCubre(fila.cubre) : "—"}
                  </td>
                </tr>
                {abierta ? (
                  <tr className="mon-falt-detalle-fila" id={`mon-falt-detalle-${fila.ump}`}>
                    <td colSpan={columnas.length + 7}>
                      <DetalleDeUmp fila={fila} />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export const FaltantePorUmp = memo(FaltantePorUmpImpl);
