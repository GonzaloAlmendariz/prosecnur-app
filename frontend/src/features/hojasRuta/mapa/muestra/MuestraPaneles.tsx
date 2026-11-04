import type { ReactNode } from "react";
import { Calculator, Shuffle, Inbox } from "../../../../vendor/lucide-react";
import { AjustesPorDistrito } from "./AjustesPorDistrito";
import { GuiaDeMuestra } from "./GuiaDeMuestra";
import { pasosDelN } from "./pasosDelN";
import { EscenariosMuestra } from "./EscenariosMuestra";
import { MargenCurva } from "./MargenCurva";
import { repartoMinimos, repartoPorPoblacion } from "./repartos";
import { InspectorCabecera } from "../InspectorCabecera";
import { GlidingRadioGroup } from "../../../../components/GlidingRadioGroup";
import { PulsoButton } from "../../../../components/PulsoButton";
import { PulsoSwitch } from "../../../../components/PulsoSwitch";
import type { HojasRutaAlert, HojasRutaIntegratedConfig, HojasRutaSampleSizeConfig, HojasRutaTerritory } from "../../../../api/hojasRuta";
import { nombreDistrito } from "../nombres";
import { tonoCss } from "../lienzo/tonos";
import { useLienzoHojasRuta } from "../store";
import { useSeccion } from "../../../../lib/navegacion/useDireccion";
import { deffPorIcc, pasoDeRutas, type BorradorMuestra } from "./desdeConfig";
import type { ResultadoTamano } from "./motorTamano";
import { visitasCap, visitasPorRuta } from "../../seleccion/visitas";
import { IccPanel } from "./IccPanel";
import { BaseReparto2025, fuenteDelReparto } from "./BaseReparto2025";

import { formatoDecimal } from "../../../../lib/formatoNumero";
import { EstadoVacio } from "../../../../components/EstadoVacio";
/**
 * Muestra en la página del lienzo (U7b). El motor completo vive en el
 * inspector y responde al instante con el espejo de R (motorTamano.ts); al
 * guardar, el tamaño lo recalcula el backend. La estructura es el reparto por
 * distrito, editable cuando el N es por distrito.
 */

const fmt = (n: number) => new Intl.NumberFormat("es-PE").format(Math.round(n));
const pct = (m: number | null, d = 1) => (m == null ? "—" : `±${(m * 100).toLocaleString("es-PE", { minimumFractionDigits: d, maximumFractionDigits: d })} %`);

function Opciones<V extends string | number>({ etiqueta, valor, opciones, onCambio, deshabilitado }: { etiqueta: string; valor: V; opciones: ReadonlyArray<readonly [V, string]>; onCambio: (v: V) => void; deshabilitado?: boolean }) {
  return (
    <div className="hr-muestra-campo">
      <small>{etiqueta}</small>
      <GlidingRadioGroup value={valor} options={opciones} getOptionValue={(o) => o[0]} onValueChange={onCambio} className="hr-muestra-opciones" aria-label={etiqueta} getOptionProps={() => ({ disabled: deshabilitado })}>
        {(o) => <span>{o[1]}</span>}
      </GlidingRadioGroup>
    </div>
  );
}

const DEFF_TIPICOS = [[1, "Sin ajuste"], [1.2, "Ligero"], [1.5, "Territorial"], [2, "Conservador"]] as const;

/** Atajos de margen (B33): valores usuales en un clic; el campo de arriba sigue aceptando cualquiera. */
function Atajos({ valores, actual, etiqueta, onElegir, deshabilitado }: { valores: readonly number[]; actual: number; etiqueta: string; onElegir: (v: number) => void; deshabilitado?: boolean }) {
  return (
    <div className="hr-mapa-chips hr-muestra-atajos" role="group" aria-label={`Atajos de ${etiqueta.toLowerCase()}`}>
      {valores.map((v) => {
        const activo = Math.abs(actual * 100 - v) < 1e-6;
        return (
          <button key={v} type="button" className="hr-mapa-zona" aria-pressed={activo} data-estado={activo ? "todo" : undefined} disabled={deshabilitado} onClick={() => onElegir(v / 100)}>
            <span>±{v} %</span>
          </button>
        );
      })}
    </div>
  );
}

function Numero({ etiqueta, valor, sufijo, min, max, paso, onCambio, ayuda, deshabilitado }: { etiqueta: string; valor: number; sufijo?: string; min?: number; max?: number; paso?: number; onCambio: (v: number) => void; ayuda?: ReactNode; deshabilitado?: boolean }) {
  return (
    <label className="hr-muestra-campo">
      <small>{etiqueta}</small>
      <span className="hr-muestra-numero">
        <input type="number" value={valor} min={min} max={max} step={paso} disabled={deshabilitado} onChange={(e) => e.target.value !== "" && Number.isFinite(Number(e.target.value)) && onCambio(Number(e.target.value))} />
        {sufijo ? <span>{sufijo}</span> : null}
      </span>
      {ayuda ? <span className="hr-mapa-nota">{ayuda}</span> : null}
    </label>
  );
}

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
};

// Lo que el inspector ya dice con sus propias palabras: no se repite el aviso del servidor.
const AVISOS_YA_DICHOS = /MARGIN_HIGH|ROUTE_N_NOT_MULTIPLE|DEFF_IGNORES_CLUSTERING/;

export function MuestraInspector({ config, resultado: r, bloqueado, guardando, hayMuestra, hayTamano = false, avisosServidor = [], margenPara, territorios = [], onGuardar }: InspectorProps) {
  const { muestraBorrador, setMuestraBorrador, cajonMuestra, setCajonMuestra } = useLienzoHojasRuta();
  const nav = useSeccion("hojas-ruta");
  const s = config.sample_size;
  const ruta = config.entrevistas_por_manzana;
  const cambiar = (b: BorradorMuestra) => setMuestraBorrador({ ...muestraBorrador, ...b, sample_size: { ...muestraBorrador?.sample_size, ...b.sample_size } });
  const cambiarS = (x: Partial<HojasRutaSampleSizeConfig>) => cambiar({ sample_size: x });
  const peor = r.filas.length ? Math.max(...r.filas.map((f) => f.margen ?? 0)) : null;
  const pasosN = pasosDelN({ z: r.z, p: s.expected_proportion, margenTotal: s.margin_total, deff: s.design_effect, fpc: s.apply_fpc, poblacion: r.poblacionTotal, porRuta: ruta, piso: Boolean(s.enforce_district_floor), margenDistrito: s.margin_district, sumaMinimos: r.sumaMinimos });
  const excedidos = r.filas.filter((f) => (f.margen ?? 0) > f.margenObjetivo + 1e-9).length;
  const razon = config.sample_size_mode === "calculator" ? (s.enforce_district_floor && r.sumaMinimos > r.nTotalMinimo ? "Manda la suma de mínimos por distrito" : "Manda el margen total") : config.sample_size_mode === "external_total" ? "N aprobado por el cliente" : "N aprobado por distrito";
  const alternativas = [
    ["N en uso", r.nUsado],
    ["Mínimo por margen total", r.nTotalMinimo],
    ["Suma de mínimos por distrito", r.sumaMinimos],
  ].filter(([, n], i, a) => Number(n) > 0 && a.findIndex((x) => x[1] === n) === i) as Array<[string, number]>;
  const ed = bloqueado || guardando;

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

        <Opciones
          etiqueta="Lógica del N"
          valor={config.sample_size_mode}
          deshabilitado={ed}
          opciones={[["calculator", "Calculado"], ["external_total", "N total"], ["external_district", "Por distrito"]] as const}
          onCambio={(v) => cambiar({ sample_size_mode: v })}
        />
        {config.sample_size_mode === "external_total" ? (
          <div className="hr-muestra-campo">
            <small>Encuestas completas aprobadas</small>
            <span className="hr-muestra-pasos">
              <PulsoButton variant="secondary" size="sm" disabled={ed} aria-label="Una ruta menos" onClick={() => cambiar({ n_objetivo: pasoDeRutas(config.n_objetivo, ruta, -1) })}>−</PulsoButton>
              <input type="number" value={config.n_objetivo} min={ruta} step={ruta} disabled={ed} onChange={(e) => e.target.value !== "" && cambiar({ n_objetivo: Math.max(1, Math.round(Number(e.target.value))) })} aria-label="Encuestas completas aprobadas" />
              <PulsoButton variant="secondary" size="sm" disabled={ed} aria-label="Una ruta más" onClick={() => cambiar({ n_objetivo: pasoDeRutas(config.n_objetivo, ruta, 1) })}>+</PulsoButton>
            </span>
            <span className="hr-mapa-nota">− y + quitan o suman una ruta: {ruta} entrevistas.</span>
          </div>
        ) : config.sample_size_mode === "external_district" ? (
          <p className="hr-mapa-nota">Escribe el N de cada distrito en la lista de la izquierda.</p>
        ) : (
          <p className="hr-mapa-nota">El N sale de los márgenes y supuestos de abajo, redondeado a rutas completas.</p>
        )}

        <div className="hr-muestra-campo">
          <small>Encuestas por ruta (por manzana)</small>
          <span className="hr-muestra-pasos">
            <PulsoButton variant="secondary" size="sm" disabled={ed || ruta <= 1} aria-label="Una encuesta menos por ruta" onClick={() => cambiar({ entrevistas_por_manzana: Math.max(1, ruta - 1) })}>−</PulsoButton>
            <input type="number" value={ruta} min={1} step={1} disabled={ed} onChange={(e) => e.target.value !== "" && Number(e.target.value) >= 1 && cambiar({ entrevistas_por_manzana: Math.round(Number(e.target.value)) })} aria-label="Encuestas por ruta" />
            <PulsoButton variant="secondary" size="sm" disabled={ed} aria-label="Una encuesta más por ruta" onClick={() => cambiar({ entrevistas_por_manzana: ruta + 1 })}>+</PulsoButton>
          </span>
          <span className="hr-mapa-nota">{r.multiploDeRuta ? `N compatible: ${fmt(r.nUsado)} = ${fmt(Math.floor(r.nUsado / ruta))} × ${ruta}` : `El N debe ser múltiplo de ${ruta}`}</span>
        </div>

        <section className="hr-muestra-grupo" aria-label="Margen de error">
          <h3>Margen de error que quieres lograr</h3>
          <Opciones etiqueta="Confianza" valor={s.confidence_level} deshabilitado={ed} opciones={[[0.9, "90 %"], [0.95, "95 %"], [0.99, "99 %"]] as const} onCambio={(v) => cambiarS({ confidence_level: v })} />
          <div className="hr-muestra-dos">
            <Numero etiqueta="Margen total" sufijo="%" valor={Math.round(s.margin_total * 1000) / 10} min={0.1} max={50} paso={0.5} deshabilitado={ed} onCambio={(v) => cambiarS({ margin_total: Math.min(0.5, Math.max(0.001, v / 100)) })} />
            <Numero etiqueta="Margen por distrito" sufijo="%" valor={Math.round(s.margin_district * 1000) / 10} min={0.1} max={80} paso={0.5} deshabilitado={ed} onCambio={(v) => cambiarS({ margin_district: Math.min(0.8, Math.max(0.001, v / 100)) })} />
          </div>
          <div className="hr-muestra-dos">
            <Atajos valores={[3, 4, 5]} actual={s.margin_total} deshabilitado={ed} etiqueta="Margen total" onElegir={(v) => cambiarS({ margin_total: v })} />
            <Atajos valores={[8, 10, 15]} actual={s.margin_district} deshabilitado={ed} etiqueta="Margen por distrito" onElegir={(v) => cambiarS({ margin_district: v })} />
          </div>
          {margenPara ? <MargenCurva margenPara={margenPara} nUsado={r.nUsado} objetivo={s.margin_total} porRuta={ruta} /> : null}
          {config.sample_size_mode === "calculator" ? (
            <Opciones etiqueta="El margen por distrito es…" valor={s.enforce_district_floor ? "requisito" : "maximo"} deshabilitado={ed} opciones={[["requisito", "Un requisito"], ["maximo", "Solo un máximo"]] as const} onCambio={(v) => cambiarS({ enforce_district_floor: v === "requisito" })} />
          ) : null}
        </section>

        <section className="hr-muestra-grupo" aria-label="Supuestos">
          <h3>Supuestos</h3>
          <div className="hr-muestra-dos">
            <Numero etiqueta="Resultado esperado (p)" sufijo="%" valor={Math.round(s.expected_proportion * 1000) / 10} min={0.1} max={99.9} paso={5} deshabilitado={ed} onCambio={(v) => cambiarS({ expected_proportion: Math.min(0.999, Math.max(0.001, v / 100)) })} />
            <Numero etiqueta="Respuesta esperada" sufijo="%" valor={Math.round(s.response_rate * 100)} min={1} max={100} paso={5} deshabilitado={ed} onCambio={(v) => cambiarS({ response_rate: Math.min(1, Math.max(0.01, v / 100)) })} ayuda={`${fmt(r.contactos)} contactos`} />
          </div>
          <div className="hr-muestra-dos">
            <Numero etiqueta="Viviendas ocupadas" sufijo="%" valor={Math.round((s.ocupacion ?? 1) * 100)} min={5} max={100} paso={5} deshabilitado={ed} onCambio={(v) => cambiarS({ ocupacion: Math.min(1, Math.max(0.05, v / 100)) })} />
            <div className="hr-muestra-campo">
              <small>Visitas por ruta</small>
              <strong className="hr-muestra-visitas">{visitasPorRuta(ruta, { respuesta: s.response_rate, ocupacion: s.ocupacion ?? 1 })}</strong>
              <span className="hr-mapa-nota">hasta {visitasCap(ruta, { respuesta: s.response_rate, ocupacion: s.ocupacion ?? 1 })} en el 90 % de las rutas, para {ruta} entrevistas</span>
            </div>
          </div>
          <div className="hr-muestra-campo">
            <small>Efecto de diseño (DEFF)</small>
            <div className="hr-mapa-chips hr-muestra-deff" role="group" aria-label="Efecto de diseño (DEFF)">
              {DEFF_TIPICOS.map(([v, rotulo]) => (
                <button key={v} type="button" className="hr-mapa-zona" aria-pressed={s.design_effect === v} data-estado={s.design_effect === v ? "todo" : undefined} disabled={ed} onClick={() => cambiarS({ design_effect: v, design_effect_fuente: "manual", icc_aplicado: null })}>
                  <span>{rotulo}</span>
                  <b>{v.toFixed(1)}</b>
                </button>
              ))}
            </div>
          </div>
          <p className="hr-mapa-nota">
            {s.design_effect_fuente === "icc_biblioteca" && s.icc_aplicado
              ? `Desde un estudio previo: ICC ${formatoDecimal(s.icc_aplicado.icc, 3)} de ${s.icc_aplicado.estudio || s.icc_aplicado.id} con ${ruta} por ruta.`
              : s.design_effect_fuente === "manual"
                ? "Escrito a mano."
                : s.design_effect_fuente === "legado"
                  ? "Heredado de la versión anterior del estudio: no se sabe de dónde salió."
                  : "Por declarar: elige un valor o tráelo de un estudio previo."}
          </p>
          <IccPanel config={config} deshabilitado={ed} onAplicar={(ss) => cambiar({ sample_size: ss })} />
          <div className="hr-muestra-guia">
            <small>Sin un estudio previo, una guía: con {ruta} entrevistas por ruta, DEFF ≈ 1 + ({ruta} − 1) × ICC</small>
            <div className="hr-mapa-chips">
              {[0.02, 0.05, 0.1].map((icc) => (
                <button key={icc} type="button" className="hr-mapa-zona" disabled={ed} onClick={() => cambiarS({ design_effect: deffPorIcc(ruta, icc), design_effect_fuente: "manual", icc_aplicado: null })}>
                  <span>ICC {formatoDecimal(icc, 3)} → {formatoDecimal(deffPorIcc(ruta, icc), 3)}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {config.sample_size_mode !== "external_district" ? (
          <Opciones etiqueta="Asignación entre distritos" valor={s.allocation_mode ?? "proportional"} deshabilitado={ed} opciones={[["proportional", "Por tamaño"], ["uniform", "Igualitaria"], ["compromise", "Intermedia"]] as const} onCambio={(v) => cambiarS({ allocation_mode: v })} />
        ) : null}
        <BaseReparto2025 sampleSize={s} territorios={territorios} deshabilitado={ed} onCambio={(base_reparto) => cambiarS({ base_reparto })} />

        <section className="hr-muestra-grupo" aria-label="Alternativas">
          <h3>Alternativas</h3>
          <div className="hr-muestra-alts">
            {alternativas.map(([l, n]) => (
              <button key={l} type="button" aria-pressed={n === r.nUsado} disabled={ed} onClick={() => cambiar({ sample_size_mode: "external_total", n_objetivo: n })}>
                <small>{l}</small>
                <b>{fmt(n)}</b>
                {margenPara ? <span>{pct(margenPara(n))}</span> : null}
              </button>
            ))}
          </div>
        </section>

        <PulsoSwitch className="hr-muestra-fpc" label="Corrección por población finita (FPC)" size="sm" checked={s.apply_fpc} disabled={ed} onCheckedChange={(v) => cambiarS({ apply_fpc: v })} />

        <details className="hr-muestra-formula">
          <summary>¿De dónde sale este N?</summary>
          {/* P7: la cadena de fórmulas con los supuestos del estudio (pasosDelN.ts, mismas fórmulas que el motor). */}
          <dl className="hr-mapa-filas" aria-label="Cálculo del N paso a paso">
            {pasosN.pasos.map((p, i) => (
              <div key={p.titulo}>
                <dt>
                  {i + 1}. {p.titulo} <small>{p.formula}</small>
                </dt>
                <dd>{p.manda ? <strong>{p.cuenta}</strong> : p.cuenta}</dd>
              </div>
            ))}
            <div><dt>N recomendado</dt><dd><strong>{fmt(pasosN.n)}</strong></dd></div>
          </dl>
          <p className="hr-mapa-nota">Población: {fuenteDelReparto(s)}.</p>
          <p className="hr-mapa-nota">z = {r.z.toFixed(3)} para una confianza de {Math.round(s.confidence_level * 100)} %. Cambiar el margen, p, el DEFF o los márgenes por distrito recalcula este N.</p>
        </details>
        {/* P7: la recomendación de DEFF, los semáforos de los supuestos y los criterios de la clásica. */}
        <GuiaDeMuestra
          entrevistasPorManzana={ruta}
          supuestos={{ margenTotal: s.margin_total, p: s.expected_proportion, deff: s.design_effect, respuesta: s.response_rate }}
          deshabilitado={ed}
          onUsarDeff={(design_effect) => cambiarS({ design_effect })}
        />
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
              {f.nUsado % ruta ? `${fmt(f.nUsado)} entr.` : `${fmt(f.nUsado / ruta)} rutas`}, mín. {fmt(f.nMinimo)}, <span data-aviso={(f.margen ?? 0) > f.margenObjetivo + 1e-9 || undefined}>{pct(f.margen)}</span>
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
