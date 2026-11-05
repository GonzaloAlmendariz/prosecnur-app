import { Calculator, Shuffle, Inbox } from "../../../../vendor/lucide-react";
import { AjustesPorDistrito } from "./AjustesPorDistrito";
import { EscenariosMuestra } from "./EscenariosMuestra";
import { repartoMinimos, repartoPorPoblacion } from "./repartos";
import { InspectorCabecera } from "../InspectorCabecera";
import { PulsoButton } from "../../../../components/PulsoButton";
import type { HojasRutaAlert, HojasRutaEstratoMuestral, HojasRutaIntegratedConfig, HojasRutaTerritory } from "../../../../api/hojasRuta";
import { nombreDistrito } from "../nombres";
import { tonoCss } from "../lienzo/tonos";
import { useLienzoHojasRuta } from "../store";
import { useSeccion } from "../../../../lib/navegacion/useDireccion";
import type { ResultadoTamano } from "./motorTamano";
import { AccesoAjustes } from "../ajustes/AccesoAjustes";
import { resumenGrupo } from "../ajustes/gruposAjustes";

import { EstadoVacio } from "../../../../components/EstadoVacio";
/**
 * Muestra en la página del lienzo (U7b). El motor completo vive en el
 * inspector y responde al instante con el espejo de R (motorTamano.ts); al
 * guardar, el tamaño lo recalcula el backend. La estructura es el reparto por
 * distrito, editable cuando el N es por distrito.
 */

import { fmt, pct } from "./controlesMuestra";

type InspectorProps = {
  config: HojasRutaIntegratedConfig;
  resultado: ResultadoTamano;
  bloqueado: boolean;
  guardando: boolean;
  hayMuestra: boolean;
  /** Avisos del último tamaño calculado en R (ADR 0116 y otros); no se recalculan con el borrador. */
  avisosServidor?: readonly HojasRutaAlert[];
  /** P4: hay un tamaño guardado, así que las cuotas se pueden calcular antes de sortear. */
  hayTamano?: boolean;
  onGuardar: () => void;
  /** Margen total que daría otro N con los supuestos en vista (B34). */
  margenPara?: (n: number) => number | null;
  /** Distritos confirmados, con los datos de la base 2025 (ADR 0131 §2). */
  territorios?: readonly HojasRutaTerritory[];
  /** `estrato_muestral` del último tamaño guardado (ADR 0131 §1). */
  estratoServidor?: HojasRutaEstratoMuestral | null;
};

// Lo que el inspector ya dice con sus propias palabras: no se repite el aviso del servidor.
const AVISOS_YA_DICHOS = /MARGIN_HIGH|ROUTE_N_NOT_MULTIPLE|DEFF_IGNORES_CLUSTERING/;

export function MuestraInspector({ config, resultado: r, bloqueado, guardando, hayMuestra, hayTamano = false, avisosServidor = [], onGuardar }: InspectorProps) {
  const { muestraBorrador, setMuestraBorrador, cajonMuestra, setCajonMuestra } = useLienzoHojasRuta();
  const nav = useSeccion("hojas-ruta");
  const s = config.sample_size;
  const ruta = config.entrevistas_por_manzana;
  const peor = r.filas.length ? Math.max(...r.filas.map((f) => f.margen ?? 0)) : null;
  const excedidos = r.filas.filter((f) => (f.margen ?? 0) > f.margenObjetivo + 1e-9).length;
  const razon = config.sample_size_mode === "calculator" ? (s.enforce_district_floor && r.sumaMinimos > r.nTotalMinimo ? "Manda la suma de mínimos por distrito" : "Manda el margen total") : config.sample_size_mode === "external_total" ? "N aprobado por el cliente" : "N aprobado por distrito";

  return (
    <>
      <InspectorCabecera icono={Calculator} sobre="Muestra" titulo="Tamaño y reparto" />
      <div className="hr-mapa-ins-cuerpo">
        <section className="hr-muestra-resultado" aria-label="Resultado">
          <small>N final</small>
          <strong>{fmt(r.nUsado)}</strong>
          <span>
            {fmt(Math.floor(r.nUsado / ruta))} rutas de {ruta}, {razon}
          </span>
          <div className="hr-mapa-cifras">
            <div><small>Margen total</small><strong data-aviso={r.margenTotal != null && r.margenTotal > s.margin_total + 1e-9 || undefined}>{pct(r.margenTotal)}</strong></div>
            <div><small>Peor distrito</small><strong data-aviso={excedidos > 0 || undefined}>{pct(peor)}</strong></div>
            <div><small>Contactos</small><strong>{fmt(r.contactos)}</strong></div>
          </div>
          {ruta > 1 && s.design_effect <= 1 ? <p className="hr-mapa-nota hr-muestra-mas">Margen bajo muestreo aleatorio simple: no incluye el conglomerado de {ruta} entrevistas por ruta.</p> : null}
          {!r.multiploDeRuta ? <p className="hr-mapa-aviso">El N no es múltiplo de {ruta} entrevistas por ruta</p> : null}
          {avisosServidor.filter((a) => a.level !== "info" && !AVISOS_YA_DICHOS.test(a.code)).map((a) => (
            <p key={a.code} className="hr-mapa-aviso">{a.message}</p>
          ))}
          {muestraBorrador && avisosServidor.some((a) => !AVISOS_YA_DICHOS.test(a.code)) ? <p className="hr-mapa-nota">Estos avisos son del último cálculo guardado: se recalculan al guardar.</p> : null}
          {excedidos ? <p className="hr-mapa-aviso">{excedidos} distrito{excedidos > 1 ? "s superan" : " supera"} su margen objetivo</p> : null}
        </section>

        <AccesoAjustes grupo="tamano" titulo="Tamaño y precisión" valor={resumenGrupo("tamano", config, { n: r.nUsado })} />

        <AccesoAjustes grupo="reparto" titulo="Reparto y estrato" valor={resumenGrupo("reparto", config)} />
        <AccesoAjustes grupo="visitas" titulo="Visitas mínimas" valor={resumenGrupo("visitas", config)} />

        {muestraBorrador && hayMuestra ? <p className="hr-mapa-aviso">Guardar recalcula el tamaño y descarta las cuotas y el sorteo actual.</p> : null}
      </div>
      <footer className="hr-mapa-pie">
        {muestraBorrador ? (
          <>
            <PulsoButton variant="secondary" disabled={guardando} onClick={() => setMuestraBorrador(null)}>
              Deshacer
            </PulsoButton>
            <PulsoButton variant="primary" disabled={bloqueado || guardando || !r.multiploDeRuta || !r.filas.length || !(ruta > 0)} onClick={onGuardar}>
              {guardando ? "Calculando…" : "Guardar y calcular"}
            </PulsoButton>
          </>
        ) : (
          // B35: sin cambios pendientes, el pie lleva a lo que sigue.
          <>
            <PulsoButton variant="secondary" disabled={!hayMuestra && !hayTamano} aria-pressed={cajonMuestra} onClick={() => setCajonMuestra(!cajonMuestra)}>
              {cajonMuestra ? "Ocultar cuotas" : "Ver cuotas"}
            </PulsoButton>
            {/* Por cuotas no hay sorteo de manzanas: lo que sigue es enviar las zonas (ADR 0125 §2). */}
            <PulsoButton variant="primary" disabled={!hayMuestra} onClick={() => nav.irA("seccion", nav.modo === "cuotas" ? "seleccion" : "manzanas")}>
              {nav.modo === "cuotas" ? "Ir a la entrega" : "Ir al sorteo"}
            </PulsoButton>
          </>
        )}
      </footer>
    </>
  );
}

type EstructuraProps = { config: HojasRutaIntegratedConfig; resultado: ResultadoTamano; bloqueado: boolean };

export function MuestraEstructura({ config, resultado: r, bloqueado }: EstructuraProps) {
  const { muestraBorrador, setMuestraBorrador } = useLienzoHojasRuta();
  const ruta = config.entrevistas_por_manzana;
  const porDistrito = config.sample_size_mode === "external_district";
  const tope = Math.max(1, ...r.filas.map((f) => Math.max(f.nUsado, f.nMinimo)));
  const ponerN = (ubigeo: string, n: number) => setMuestraBorrador({ ...muestraBorrador, n_por_distrito: { ...config.n_por_distrito, ...muestraBorrador?.n_por_distrito, [ubigeo]: Math.max(0, Math.round(n)) } });
  const pegar = (desde: string, texto: string) => {
    const valores = texto.split(/\r?\n/).map((x) => x.trim()).filter(Boolean).map((x) => Number(x.replace(/[^\d.-]/g, "")));
    if (valores.length < 2) return false;
    const orden = r.filas.map((f) => f.ubigeo);
    const i0 = orden.indexOf(desde);
    const n = { ...config.n_por_distrito, ...muestraBorrador?.n_por_distrito };
    valores.forEach((v, k) => {
      const u = orden[i0 + k];
      if (u) n[u] = Math.max(0, Math.round(v || 0));
    });
    setMuestraBorrador({ ...muestraBorrador, n_por_distrito: n });
    return true;
  };
  const ponerTodos = (n: Record<string, number>) => setMuestraBorrador({ ...muestraBorrador, n_por_distrito: { ...config.n_por_distrito, ...n } });
  const peor = r.filas.length ? Math.max(...r.filas.map((f) => f.margen ?? 0)) : null;

  return (
    <>
      <div className="hr-mapa-cab hr-mapa-cab--pila">
        <div className="hr-mapa-cab-titulo">
          <h2>Reparto por distrito</h2>
          <small>{fmt(r.filas.length)} distrito{r.filas.length === 1 ? "" : "s"}</small>
        </div>
        <div className="hr-mapa-cifras">
          <div><small>Entrevistas</small><strong>{fmt(r.nUsado)}</strong></div>
          <div><small>Rutas</small><strong>{ruta > 0 ? fmt(Math.floor(r.nUsado / ruta)) : "—"}</strong></div>
          <div><small>Peor margen</small><strong>{pct(peor)}</strong></div>
        </div>
        {porDistrito && r.filas.length ? (
          <div className="hr-mapa-acciones">
            <PulsoButton
              variant="secondary"
              size="sm"
              disabled={bloqueado || !(r.nUsado > 0)}
              title="Reparte el N actual según la asignación elegida, en rutas completas"
              onClick={() => ponerTodos(repartoPorPoblacion(r.filas, r.nUsado, ruta, config.sample_size.allocation_mode ?? "proportional"))}
            >
              <Shuffle size={13} aria-hidden /> Repartir según población
            </PulsoButton>
            <PulsoButton variant="secondary" size="sm" disabled={bloqueado} title="Pone en cada distrito su mínimo para el margen objetivo" onClick={() => ponerTodos(repartoMinimos(r.filas, ruta))}>
              Mínimos
            </PulsoButton>
          </div>
        ) : null}
      </div>
      {!r.filas.length ? <EstadoVacio icono={<Inbox size={16} />} titulo="Sin distritos confirmados" descripcion="Elígelos en Territorio y calcula la población para repartir la muestra." /> : null}
      <ul className="hr-muestra-reparto">
        {r.filas.map((f) => (
          <li key={f.ubigeo}>
            <div className="hr-muestra-rep-cab">
              <strong className="hr-muestra-rep-nombre">
                <i style={{ background: tonoCss(config.territorios.indexOf(f.ubigeo)) }} aria-hidden="true" />
                {nombreDistrito(f.distrito)}
              </strong>
              {porDistrito ? (
                <input
                  type="number"
                  step={ruta}
                  min={0}
                  value={f.nUsado}
                  disabled={bloqueado}
                  aria-label={`N de ${nombreDistrito(f.distrito)}`}
                  onChange={(e) => e.target.value !== "" && ponerN(f.ubigeo, Number(e.target.value))}
                  onPaste={(e) => pegar(f.ubigeo, e.clipboardData.getData("text")) && e.preventDefault()}
                />
              ) : (
                <b>{fmt(f.nUsado)}</b>
              )}
            </div>
            <div className="hr-muestra-barra" aria-hidden="true">
              {/* D9 (checklist visual 2/11): la barra lleva el color de su distrito, como el punto y el mapa. */}
              <i style={{ width: `${(f.nUsado / tope) * 100}%`, background: tonoCss(config.territorios.indexOf(f.ubigeo)) }} />
              <s style={{ left: `${(f.nMinimo / tope) * 100}%` }} />
            </div>
            <small>
              {/* Sin N el distrito lo dice: «0 rutas, mín. 96, —» se leía como un resultado. */}
              {f.nUsado === 0 ? <span data-aviso>Sin N asignado</span> : <>{f.nUsado % ruta ? `${fmt(f.nUsado)} entr.` : `${fmt(f.nUsado / ruta)} rutas`}, <span data-aviso={(f.margen ?? 0) > f.margenObjetivo + 1e-9 || undefined}>{pct(f.margen)}</span></>}, mín. {fmt(f.nMinimo)}
              {porDistrito && f.nUsado % ruta ? <span data-error>, no es múltiplo de {ruta}</span> : null}
            </small>
          </li>
        ))}
      </ul>
      {porDistrito ? <p className="hr-mapa-nota hr-muestra-pie">Puedes pegar una columna desde Excel o Sheets sobre el primer campo.</p> : <AjustesPorDistrito config={config} filas={r.filas} bloqueado={bloqueado} />}
      <EscenariosMuestra config={config} resultado={r} bloqueado={bloqueado} />
    </>
  );
}
