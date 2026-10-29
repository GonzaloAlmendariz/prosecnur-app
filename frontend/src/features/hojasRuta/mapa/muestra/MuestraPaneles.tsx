import type { ReactNode } from "react";
import { GlidingRadioGroup } from "../../../../components/GlidingRadioGroup";
import { PulsoButton } from "../../../../components/PulsoButton";
import { PulsoSwitch } from "../../../../components/PulsoSwitch";
import type { HojasRutaIntegratedConfig, HojasRutaSampleSizeConfig } from "../../../../api/hojasRuta";
import { nombreDistrito } from "../nombres";
import { useLienzoHojasRuta } from "../store";
import { deffPorIcc, pasoDeRutas, type BorradorMuestra } from "./desdeConfig";
import type { ResultadoTamano } from "./motorTamano";

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
  onGuardar: () => void;
};

export function MuestraInspector({ config, resultado: r, bloqueado, guardando, hayMuestra, onGuardar }: InspectorProps) {
  const { muestraBorrador, setMuestraBorrador } = useLienzoHojasRuta();
  const s = config.sample_size;
  const ruta = config.entrevistas_por_manzana;
  const cambiar = (b: BorradorMuestra) => setMuestraBorrador({ ...muestraBorrador, ...b, sample_size: { ...muestraBorrador?.sample_size, ...b.sample_size } });
  const cambiarS = (x: Partial<HojasRutaSampleSizeConfig>) => cambiar({ sample_size: x });
  const peor = r.filas.length ? Math.max(...r.filas.map((f) => f.margen ?? 0)) : null;
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
      <header className="hr-mapa-cab">
        <h2>Tamaño y reparto</h2>
      </header>
      <div className="hr-mapa-ins-cuerpo">
        <section className="hr-muestra-resultado" aria-label="Resultado">
          <small>N final</small>
          <strong>{fmt(r.nUsado)}</strong>
          <span>
            {fmt(Math.floor(r.nUsado / ruta))} rutas de {ruta} · {razon}
          </span>
          <div className="hr-mapa-cifras">
            <div><small>Margen total</small><strong data-aviso={r.margenTotal != null && r.margenTotal > s.margin_total + 1e-9 || undefined}>{pct(r.margenTotal)}</strong></div>
            <div><small>Peor distrito</small><strong data-aviso={excedidos > 0 || undefined}>{pct(peor)}</strong></div>
            <div><small>Contactos</small><strong>{fmt(r.contactos)}</strong></div>
          </div>
          {!r.multiploDeRuta ? <p className="hr-mapa-aviso">El N no es múltiplo de {ruta} entrevistas por ruta</p> : null}
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

        <Numero etiqueta="Encuestas por ruta (por manzana)" valor={ruta} min={1} paso={1} deshabilitado={ed} onCambio={(v) => cambiar({ entrevistas_por_manzana: Math.max(1, Math.round(v)) })} ayuda={r.multiploDeRuta ? `N compatible: ${fmt(r.nUsado)} = ${fmt(Math.floor(r.nUsado / ruta))} × ${ruta}` : `El N debe ser múltiplo de ${ruta}`} />

        <section className="hr-muestra-grupo" aria-label="Margen de error">
          <h3>Margen de error que quieres lograr</h3>
          <Opciones etiqueta="Confianza" valor={s.confidence_level} deshabilitado={ed} opciones={[[0.9, "90 %"], [0.95, "95 %"], [0.99, "99 %"]] as const} onCambio={(v) => cambiarS({ confidence_level: v })} />
          <div className="hr-muestra-dos">
            <Numero etiqueta="Margen total" sufijo="%" valor={Math.round(s.margin_total * 1000) / 10} min={0.1} max={50} paso={0.5} deshabilitado={ed} onCambio={(v) => cambiarS({ margin_total: Math.min(0.5, Math.max(0.001, v / 100)) })} />
            <Numero etiqueta="Margen por distrito" sufijo="%" valor={Math.round(s.margin_district * 1000) / 10} min={0.1} max={80} paso={0.5} deshabilitado={ed} onCambio={(v) => cambiarS({ margin_district: Math.min(0.8, Math.max(0.001, v / 100)) })} />
          </div>
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
          <Opciones etiqueta="Efecto de diseño (DEFF)" valor={s.design_effect} deshabilitado={ed} opciones={[[1, "1,0"], [1.2, "1,2"], [1.5, "1,5"], [2, "2,0"]] as const} onCambio={(v) => cambiarS({ design_effect: v })} />
          <div className="hr-muestra-guia">
            <small>Con {ruta} entrevistas por manzana, DEFF ≈ 1 + ({ruta} − 1) × ICC</small>
            <div className="hr-mapa-chips">
              {[0.02, 0.05, 0.1].map((icc) => (
                <button key={icc} type="button" className="hr-mapa-zona" disabled={ed} onClick={() => cambiarS({ design_effect: deffPorIcc(ruta, icc) })}>
                  <span>ICC {String(icc).replace(".", ",")} → {String(deffPorIcc(ruta, icc)).replace(".", ",")}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {config.sample_size_mode !== "external_district" ? (
          <Opciones etiqueta="Asignación entre distritos" valor={s.allocation_mode ?? "proportional"} deshabilitado={ed} opciones={[["proportional", "Por tamaño"], ["uniform", "Igualitaria"], ["compromise", "Intermedia"]] as const} onCambio={(v) => cambiarS({ allocation_mode: v })} />
        ) : null}

        <section className="hr-muestra-grupo" aria-label="Alternativas">
          <h3>Alternativas</h3>
          <div className="hr-muestra-alts">
            {alternativas.map(([l, n]) => (
              <button key={l} type="button" aria-pressed={n === r.nUsado} disabled={ed} onClick={() => cambiar({ sample_size_mode: "external_total", n_objetivo: n })}>
                <small>{l}</small>
                <b>{fmt(n)}</b>
              </button>
            ))}
          </div>
        </section>

        <PulsoSwitch label="Corrección por población finita (FPC)" size="sm" checked={s.apply_fpc} disabled={ed} onCheckedChange={(v) => cambiarS({ apply_fpc: v })} />

        <details className="hr-muestra-formula">
          <summary>¿De dónde sale este N?</summary>
          <dl className="hr-mapa-filas">
            <div><dt>z (confianza {Math.round(s.confidence_level * 100)} %)</dt><dd>{r.z.toFixed(3)}</dd></div>
            <div><dt>Mínimo por margen total, a rutas de {ruta}</dt><dd>{fmt(r.nTotalMinimo)}</dd></div>
            <div><dt>Suma de mínimos por distrito</dt><dd>{fmt(r.sumaMinimos)}</dd></div>
            <div><dt>Población de los distritos</dt><dd>{fmt(r.poblacionTotal)}</dd></div>
          </dl>
        </details>
        {muestraBorrador && hayMuestra ? <p className="hr-mapa-aviso">Guardar recalcula el tamaño y descarta las cuotas y el sorteo actual.</p> : null}
      </div>
      <footer className="hr-mapa-pie">
        <PulsoButton variant="secondary" disabled={!muestraBorrador || guardando} onClick={() => setMuestraBorrador(null)}>
          Deshacer
        </PulsoButton>
        <PulsoButton variant="primary" disabled={!muestraBorrador || bloqueado || guardando || !r.multiploDeRuta} onClick={onGuardar}>
          {guardando ? "Calculando…" : "Guardar y calcular"}
        </PulsoButton>
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
  const peor = r.filas.length ? Math.max(...r.filas.map((f) => f.margen ?? 0)) : null;

  return (
    <>
      <div className="hr-mapa-cab hr-mapa-cab--pila">
        <div className="hr-mapa-cab-titulo">
          <h2>Reparto por distrito</h2>
        </div>
        <div className="hr-mapa-cifras">
          <div><small>Entrevistas</small><strong>{fmt(r.nUsado)}</strong></div>
          <div><small>Rutas</small><strong>{fmt(Math.floor(r.nUsado / ruta))}</strong></div>
          <div><small>Peor margen</small><strong>{pct(peor)}</strong></div>
        </div>
      </div>
      <ul className="hr-muestra-reparto">
        {r.filas.map((f) => (
          <li key={f.ubigeo}>
            <div className="hr-muestra-rep-cab">
              <strong>{nombreDistrito(f.distrito)}</strong>
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
              <i style={{ width: `${(f.nUsado / tope) * 100}%` }} />
              <s style={{ left: `${(f.nMinimo / tope) * 100}%` }} />
            </div>
            <small>
              {f.nUsado % ruta ? `${fmt(f.nUsado)} entr.` : `${fmt(f.nUsado / ruta)} rutas`} · mín. {fmt(f.nMinimo)} · <span data-aviso={(f.margen ?? 0) > f.margenObjetivo + 1e-9 || undefined}>{pct(f.margen)}</span>
              {porDistrito && f.nUsado % ruta ? <span data-error> · no es múltiplo de {ruta}</span> : null}
            </small>
          </li>
        ))}
      </ul>
      {porDistrito ? <p className="hr-mapa-nota hr-muestra-pie">Puedes pegar una columna desde Excel o Sheets sobre el primer campo.</p> : null}
    </>
  );
}
