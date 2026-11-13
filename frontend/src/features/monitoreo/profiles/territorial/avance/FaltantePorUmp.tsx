import { memo, useMemo, useState } from "react";
import { ArrowRightLeft, ChevronLeft, ChevronRight, Info, Map as MapIcon, Target, SearchX } from "lucide-react";
import { Sideover } from "../../../../../components/Sideover";
import { EstadoVacio } from "../../../../../components/EstadoVacio";
import { EstadoChip } from "../../../../../components/EstadoChip";
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
import { DetalleDeUmp, ubicacionDeUmp } from "./DetalleDeUmp";
import { aplicadorCorto, hayAlgunSaldo, quienCubreCorto } from "./celdasDeCuotaUmp";
import { AvancePorZona } from "./AvancePorZona";
import { avancePorZona } from "./porZonaModelo";
import type { UmpPlanificada } from "../../../../../api/monitoreoAsignacionPlanificada";
import { useAsignacionPlanificada } from "./useAsignacionPlanificada";
import { SiluetaDeDistrito } from "./SiluetaDeDistrito";
import { tonoDeCalor } from "./tonoDeCalor";
import { RotuloDePestana } from "../navegacion/RotuloDePestana";
import { useQuedanMasAbajo } from "../../../core/useQuedanMasAbajo";
import "./faltante.css";
import { BloqueDeMonitoreo } from "../../../core/BloqueDeMonitoreo";

/**
 * Avance › Faltante por UMP, pantalla de llegada del modo (§3.17).
 *
 * Arriba, lo que falta en la manzana en uso de cada UMP pendiente y quién lo
 * cubre; a la derecha, lo logrado frente a la cuota por distrito. Abajo, la
 * cuota de cada UMP celda por celda, con el signo de lo subsanado, la falta y
 * quién la cubre. Cada fila abre su detalle en un panel lateral (`foco` en la
 * dirección): la matriz observada, con paridad con Validación › Cuotas
 * (encuestadores, subsanado y falta real). Antes se desplegaba bajo la fila y
 * tapaba la tabla entera (2026-11-12).
 */
function FaltantePorUmpImpl({ reports }: { reports: MonitoreoTerritorialDashboard | null }) {
  const modelo = useMemo(() => construirFaltante(reports), [reports]);
  const [foco, escribirFoco] = useFocoMonitoreo();
  const [filtro, setFiltro] = useState<FiltroDeFaltante>("todas");
  const [conReemplazos, setConReemplazos] = useState(true);
  const filas = useMemo(() => filtrarFilas(modelo.filas, filtro, conReemplazos), [conReemplazos, filtro, modelo.filas]);
  // 2h: el registro del coordinador por manzana, sólo si la asignación es de la muestra en campo.
  const asignacion = useAsignacionPlanificada(reports?.generated_at ?? "");
  const coordinacionDe = useMemo(() => new Map(
    asignacion?.estado === "comparable" ? asignacion.porUmp.map((u) => [u.idManzana, u]) : [],
  ), [asignacion]);

  // ADR 0125 A1: con envío por cuotas no hay UMP; el avance va por zona y celda.
  const porZona = avancePorZona(reports?.cuotas);
  if (porZona) {
    const nombres = new Map((reports?.advance?.district_progress ?? []).map((d) => [String(d.ubigeo ?? ""), String(d.distrito ?? "")] as const));
    return <AvancePorZona modelo={porZona} nombres={nombres} />;
  }

  if (!modelo.configurado) {
    return (
      <section className="mon-falt mon-falt--vacio" data-audit-ready="vacio:sin-cuota" aria-label="Faltante por UMP">
        <div className="mon-falt-panel" data-qa-geometry-empty="legitimo">
          <RotuloDePestana />
          <EstadoVacio
            tamano="normal"
            icono={<Target size={18} />}
            titulo="Sin cuota territorial configurada"
            descripcion="La cuota por UMP se declara en Modelo › Cuotas desde la muestra de Hojas de ruta."
            accion={
              <button type="button" className="mon-falt-boton" onClick={() => escribirFoco(null, { seccion: "modelo", pestana: "cuotas", panel: null })}>
                Abrir Modelo › Cuotas
              </button>
            }
          />
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

      <BloqueDeMonitoreo
        marco="kit"
        className="mon-falt-panel mon-falt-cuotas"
        aria-labelledby="mon-falt-cuotas-titulo"
        data-qa-geometry-member="cuotas"
        titulo="Cuota de cada UMP"
        tituloId="mon-falt-cuotas-titulo"
        bajada={<span title="El signo indica subsanaciones recibidas o cedidas">Manzana en uso</span>}
        acciones={<span className="mon-falt-controles">
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
        </span>}
      >
        <TablaDeCuotas
          filas={filas}
          columnas={modelo.columnas}
          foco={foco}
          onFoco={(ump) => escribirFoco(ump)}
        />
      </BloqueDeMonitoreo>

      <PanelDeUmp
        filas={filas}
        todas={modelo.filas}
        foco={foco}
        onFoco={(ump) => escribirFoco(ump)}
        coordinacionDe={coordinacionDe}
      />
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
  const { ref: listaRef, quedan } = useQuedanMasAbajo<HTMLDivElement>(modelo.pendientes);
  return (
    <BloqueDeMonitoreo
      marco="kit"
      className="mon-falt-panel mon-falt-pendientes"
      aria-labelledby="mon-falt-pendientes-titulo"
      data-qa-geometry-member="pendientes"
      antetitulo={<RotuloDePestana />}
      titulo="Falta en la manzana en uso"
      tituloId="mon-falt-pendientes-titulo"
      bajada={modelo.celdasFueraDeUso > 0
        ? (modelo.celdasFueraDeUso === 1
          ? "1 celda más en una manzana sin usar"
          : `${fmt(modelo.celdasFueraDeUso)} celdas más en manzanas sin usar`)
        : undefined}
    >
      <div ref={listaRef} className={`mon-falt-tarjetas${quedan ? " quedan-mas" : ""}`} data-qa-geometry-group="territorial-faltante-tarjetas" data-qa-geometry-contract="intrinsic">
        {modelo.pendientes.map((fila) => (
          <article key={fila.ump} className={`mon-falt-tarjeta${fila.cubre?.tipo === "sugerencia" ? " is-con-sugerencia" : ""}`}>
            <SiluetaDeDistrito distrito={fila.distrito} tono="falta" />
            <div className="mon-falt-tarjeta-linea is-identidad">
              <strong>UMP {fila.ump}</strong>
              <span>{fila.distrito}, manzana {fila.manzana}, {fila.aplicador}</span>
            </div>
            <div className="mon-falt-tarjeta-linea is-falta">
              {fila.faltantes.map((item) => (
                <EstadoChip key={item.texto} label={`Falta ${fmt(item.falta)}: ${item.texto}`} tone="warn" />
              ))}
              {fila.cubre?.tipo === "sugerencia" ? (
                <EstadoChip label={`Sugerencia desde la ${textoDeQuienCubre(fila.cubre)}`} tone="info" />
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
    </BloqueDeMonitoreo>
  );
}


function MapaDeCalor({ modelo }: { modelo: ModeloFaltante }) {
  const columnas = modelo.distritos[0]?.celdas ?? [];
  return (
    <BloqueDeMonitoreo
      marco="kit"
      className="mon-falt-panel mon-falt-calor"
      aria-labelledby="mon-falt-calor-titulo"
      data-qa-geometry-member="calor"
      titulo="Logrado frente a la cuota, por distrito"
      tituloId="mon-falt-calor-titulo"
      bajada={<>{fmt(modelo.casosConSexoYEdad)} casos con sexo y edad</>}
    >
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
                      <b>{fmt(celda.logrado)}</b>{" "}<small>de {fmt(celda.meta)}</small>
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </BloqueDeMonitoreo>
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

/**
 * Detalle de una UMP en un panel lateral. Lo abre `foco` (enlazable con
 * `&foco=<ump>`); cerrar lo borra. Anterior y siguiente recorren las UMP del
 * filtro activo, en el orden de la tabla.
 */
function PanelDeUmp({
  filas,
  todas,
  foco,
  onFoco,
  coordinacionDe,
}: {
  filas: readonly FilaDeUmp[];
  todas: readonly FilaDeUmp[];
  foco: string | null;
  onFoco: (ump: string | null) => void;
  coordinacionDe: ReadonlyMap<string, UmpPlanificada>;
}) {
  const fila = foco == null ? null : todas.find((item) => item.ump === foco) ?? null;
  const indice = fila ? filas.findIndex((item) => item.ump === fila.ump) : -1;
  const anterior = indice > 0 ? filas[indice - 1] : null;
  const siguiente = indice >= 0 && indice < filas.length - 1 ? filas[indice + 1] : null;
  return (
    <Sideover
      open={fila != null}
      onOpenChange={(abierto) => { if (!abierto) onFoco(null); }}
      title={fila ? `UMP ${fila.ump}` : "UMP"}
      subtitle={fila ? ubicacionDeUmp(fila) : undefined}
      icon={<Target size={18} />}
      className="mon-falt-sideover"
      footerHint={indice >= 0 ? `${fmt(indice + 1)} de ${fmt(filas.length)} en la tabla` : null}
      footer={indice >= 0 ? (
        <>
          <button type="button" className="pulso-button" disabled={!anterior} onClick={() => anterior && onFoco(anterior.ump)}>
            <ChevronLeft size={14} aria-hidden="true" />
            <span>{anterior ? `UMP ${anterior.ump}` : "Anterior"}</span>
          </button>
          <button type="button" className="pulso-button" disabled={!siguiente} onClick={() => siguiente && onFoco(siguiente.ump)}>
            <span>{siguiente ? `UMP ${siguiente.ump}` : "Siguiente"}</span>
            <ChevronRight size={14} aria-hidden="true" />
          </button>
        </>
      ) : undefined}
    >
      {fila ? (
        <DetalleDeUmp
          key={fila.ump}
          fila={fila}
          coordinacion={coordinacionDe.get(fila.bloque.id_manzana) ?? null}
        />
      ) : null}
    </Sideover>
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
  const conSaldo = hayAlgunSaldo(filas);

  if (!filas.length) {
    return (
      <div data-qa-geometry-empty="legitimo">
        <EstadoVacio icono={<SearchX size={15} />} titulo="Ninguna UMP con ese filtro." />
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
            {conSaldo ? <th scope="col" className="is-num" title="Saldo de subsanaciones recibidas o cedidas">Saldo</th> : null}
            <th scope="col" className="is-cubre" title="Quién cubre la falta">Cubre</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => {
            const abierta = foco === fila.ump;
            return (
                <tr key={fila.ump} className={`is-${fila.estado}${abierta ? " is-abierta" : ""}`}>
                  <th scope="row" className="is-ump">
                    <button
                      type="button"
                      aria-haspopup="dialog"
                      aria-label={`UMP ${fila.ump}: ver el detalle de su cuota`}
                      onClick={() => onFoco(fila.ump)}
                    >
                      {fila.ump}
                      <ChevronRight size={14} aria-hidden="true" />
                    </button>
                  </th>
                  <td className="is-distrito">{fila.distrito}</td>
                  <td className="is-manzana">{`${fila.reemplazo ? "Reemplazo" : "Titular"} ${fila.manzana}`}</td>
                  <td className="is-aplicador" title={fila.aplicador}>
                    {(() => {
                      const aplicador = aplicadorCorto(fila.aplicador);
                      return <>{aplicador.codigo ? <span className="mon-falt-codigo">{aplicador.codigo}</span> : null}{aplicador.nombre}</>;
                    })()}
                  </td>
                  {fila.celdas.map((celda) => (
                    <td key={celda.clave} className="is-celda"><CeldaDeTabla celda={celda} /></td>
                  ))}
                  <td className={`is-num${fila.falta > 0 ? " is-falta" : ""}`}>{fmt(fila.falta)}</td>
                  {conSaldo ? <td className="is-num">{saldoDeSubsanaciones(fila)}</td> : null}
                  <td className="is-cubre" title={fila.falta > 0 ? quienCubreCorto(fila.cubre).titulo : undefined}>
                    {fila.cubre?.tipo === "sugerencia" ? (
                      <span className="mon-falt-chip is-sugerencia">{textoDeQuienCubre(fila.cubre)}</span>
                    ) : fila.falta > 0 ? quienCubreCorto(fila.cubre).texto : "—"}
                  </td>
                </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export const FaltantePorUmp = memo(FaltantePorUmpImpl);
