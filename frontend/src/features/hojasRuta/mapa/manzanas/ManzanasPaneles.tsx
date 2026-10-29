import type { ReactNode } from "react";
import { Shuffle } from "../../../../vendor/lucide-react";
import { InspectorCabecera } from "../InspectorCabecera";
import { GlidingRadioGroup } from "../../../../components/GlidingRadioGroup";
import { PulsoButton } from "../../../../components/PulsoButton";
import type { HojasRutaCoberturaMarco, HojasRutaIntegratedConfig, HojasRutaRouteSnapshot, HojasRutaSamplePreview, SamplingMethod } from "../../../../api/hojasRuta";
import { tonoCobertura } from "./marcoElegible";
import { CompararSemillas } from "./CompararSemillas";
import { nombreDistrito } from "../nombres";
import { tonoCss } from "../lienzo/tonos";
import { useLienzoHojasRuta } from "../store";
import { useSeccion } from "../../../../lib/navegacion/useDireccion";
import { acotarReemplazos, cambiosDeSorteo, mismoTerritorio, otraSemilla, saltoVistaPrevia, type BorradorSorteo } from "./sorteo";

/**
 * Manzanas en la página del lienzo (U8). El inspector arma el sorteo —método,
 * peso, semilla, recorrido y reemplazos— y lo manda a R; la estructura es el
 * resultado por distrito y el historial de ruteos del proyecto.
 */

const fmt = (n: number) => new Intl.NumberFormat("es-PE").format(Math.round(n));

const METODOS: ReadonlyArray<{ id: SamplingMethod; titulo: string; cuerpo: string }> = [
  { id: "pps", titulo: "PPS estratificado", cuerpo: "Más viviendas, más probabilidad, dentro de cada distrito." },
  { id: "sistematico", titulo: "Sistemático", cuerpo: "Ordena, calcula un salto y arranca al azar." },
  { id: "conglomerado_fijo", titulo: "Conglomerado fijo", cuerpo: "Menos manzanas con carga estable: menos traslados." },
];
const ESQUINAS = [["auto", "Auto"], ["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"]] as const;
const SALTOS = [["auto", "Automático"], ["off", "Sin salto"], ["manual", "Manual"]] as const;
const POLITICAS = [["alternate_zone_same_district", "Otra zona"], ["paired_by_titular_zone", "Misma zona"]] as const;
const PESOS = [["viviendas", "Viviendas"], ["poblacion", "Población"]] as const;
const metodoDe = (m: SamplingMethod) => METODOS.find((x) => x.id === m)?.titulo ?? m;

function Diagrama({ metodo }: { metodo: SamplingMethod }) {
  if (metodo === "pps")
    return (
      <svg viewBox="0 0 96 28" aria-hidden="true">
        {[10, 28, 50, 77].map((x, i) => <circle key={x} cx={x} cy={14} r={[4, 6, 9, 12][i]} data-activo={i === 3 || undefined} />)}
      </svg>
    );
  if (metodo === "sistematico")
    return (
      <svg viewBox="0 0 96 28" aria-hidden="true">
        <line x1="4" x2="92" y1="14" y2="14" />
        {[14, 37, 60, 83].map((x) => <circle key={x} cx={x} cy={14} r="4" data-activo />)}
      </svg>
    );
  return (
    <svg viewBox="0 0 96 28" aria-hidden="true">
      {[6, 30, 54, 78].map((x, i) => <rect key={x} x={x} y={6} width="13" height="16" rx="3" data-activo={i < 3 || undefined} />)}
    </svg>
  );
}

function Opciones<V extends string>({ etiqueta, valor, opciones, onCambio, deshabilitado }: { etiqueta: string; valor: V; opciones: ReadonlyArray<readonly [V, string]>; onCambio: (v: V) => void; deshabilitado?: boolean }) {
  return (
    <div className="hr-muestra-campo">
      <small>{etiqueta}</small>
      <GlidingRadioGroup value={valor} options={opciones} getOptionValue={(o) => o[0]} onValueChange={onCambio} className="hr-muestra-opciones" aria-label={etiqueta} getOptionProps={() => ({ disabled: deshabilitado })}>
        {(o) => <span>{o[1]}</span>}
      </GlidingRadioGroup>
    </div>
  );
}

type InspectorProps = {
  guardada: HojasRutaIntegratedConfig;
  config: HojasRutaIntegratedConfig;
  muestra: HojasRutaSamplePreview | null;
  viviendas: number;
  manzanas: number;
  listoParaSortear: boolean;
  /** El bloque del marco elegible (ADR 0115): va antes del método porque decide sobre qué se sortea. */
  marcoElegible?: ReactNode;
  /** «¿Se parece al marco?» (B38): NSE del marco frente al de la muestra. */
  parecido?: ReactNode;
  bloqueado: boolean;
  guardando: boolean;
  onSortear: () => void;
};

export function ManzanasInspector({ guardada, config, muestra, viviendas, manzanas, listoParaSortear, marcoElegible, parecido, bloqueado, guardando, onSortear }: InspectorProps) {
  const { sorteoBorrador, setSorteoBorrador } = useLienzoHojasRuta();
  const nav = useSeccion("hojas-ruta");
  const cambiar = (b: BorradorSorteo) => setSorteoBorrador({ ...sorteoBorrador, ...b });
  const cambios = cambiosDeSorteo(guardada, sorteoBorrador);
  const ruta = Math.max(1, config.entrevistas_por_manzana || 1);
  const reemplazos = acotarReemplazos(config.replacements_per_titular);
  const salto = saltoVistaPrevia(viviendas, manzanas, ruta);
  const ed = bloqueado || guardando;
  const vigente = Boolean(muestra) && !cambios.length;

  return (
    <>
      <InspectorCabecera icono={Shuffle} sobre="Manzanas" titulo={muestra ? `${muestra.blocks.length} UMP sorteadas` : "Sorteo de manzanas"} />
      <div className="hr-mapa-ins-cuerpo">
        {muestra ? (
          <section className="hr-muestra-resultado" aria-label="Sorteo vigente">
            <div className="hr-mapa-cifras">
              <div><small>Titulares</small><strong>{fmt(muestra.n_blocks)}</strong></div>
              <div><small>Reemplazos</small><strong>{fmt(muestra.n_replacement_blocks ?? 0)}</strong></div>
              <div><small>Entrevistas</small><strong>{fmt(muestra.total_entrevistas)}</strong></div>
            </div>
            <p className="hr-mapa-nota">{metodoDe(muestra.method)} · semilla {muestra.seed}{vigente ? "" : " · cambiaste parámetros: sortea de nuevo para verlos"}</p>
          </section>
        ) : (
          <ol className="hr-mapa-pasos">
            <li>Elige el método y revisa el recorrido</li>
            <li>Sortea las manzanas</li>
            <li>Revísalas en Selección</li>
          </ol>
        )}
        {muestra ? parecido : null}
        {!listoParaSortear ? <p className="hr-mapa-aviso">Primero calcula el tamaño en Muestra: el sorteo reparte ese N en rutas de {ruta} entrevistas.</p> : null}

        {marcoElegible}

        <section className="hr-muestra-grupo" aria-label="Método">
          <h3>Método</h3>
          <GlidingRadioGroup value={config.sampling_method} options={METODOS} getOptionValue={(m) => m.id} onValueChange={(sampling_method) => cambiar({ sampling_method })} className="hr-sorteo-metodos" aria-label="Método de selección" getOptionProps={() => ({ disabled: ed })}>
            {(m) => (
              <>
                <Diagrama metodo={m.id} />
                <strong>{m.titulo}</strong>
                <small>{m.cuerpo}</small>
              </>
            )}
          </GlidingRadioGroup>
        </section>

        <section className="hr-muestra-grupo" aria-label="Carga de la ruta">
          <h3>Carga de la ruta</h3>
          <Opciones etiqueta="Ponderar manzanas por" valor={config.measure_var} opciones={PESOS} onCambio={(measure_var) => cambiar({ measure_var })} deshabilitado={ed} />
          <div className="hr-sorteo-ruta">
            <span>
              <b>{ruta} encuestas por ruta</b>
              <small>Se define en Muestra</small>
            </span>
            <PulsoButton variant="secondary" size="sm" onClick={() => nav.irA("seccion", "muestra")}>
              Cambiar
            </PulsoButton>
          </div>
          <div className="hr-muestra-campo">
            <small>Semilla</small>
            <span className="hr-sorteo-semilla">
              <input type="number" min={0} step={1} aria-label="Semilla" value={config.seed} disabled={ed} onChange={(e) => e.target.value !== "" && Number.isFinite(Number(e.target.value)) && cambiar({ seed: Math.max(0, Math.round(Number(e.target.value))) })} />
              <PulsoButton variant="secondary" size="sm" disabled={ed} onClick={() => cambiar({ seed: otraSemilla(config.seed) })}>
                Otra
              </PulsoButton>
            </span>
            <span className="hr-mapa-nota">La misma semilla con los mismos parámetros repite el sorteo.</span>
          </div>
          {listoParaSortear ? <CompararSemillas config={config} deshabilitado={ed} onUsar={(seed) => cambiar({ seed })} /> : null}
        </section>

        <section className="hr-muestra-grupo" aria-label="Recorrido en campo">
          <h3>Recorrido en campo</h3>
          <Opciones etiqueta="Esquina inicial" valor={config.route_start_corner} opciones={ESQUINAS} onCambio={(route_start_corner) => cambiar({ route_start_corner })} deshabilitado={ed} />
          <Opciones etiqueta="Salto entre viviendas" valor={config.route_jump_mode} opciones={SALTOS} onCambio={(route_jump_mode) => cambiar({ route_jump_mode })} deshabilitado={ed} />
          {config.route_jump_mode === "manual" ? (
            <label className="hr-muestra-campo">
              <small>Salto manual</small>
              <span className="hr-muestra-numero">
                <input type="number" min={1} step={1} value={config.route_jump_manual} disabled={ed} onChange={(e) => e.target.value !== "" && cambiar({ route_jump_manual: Math.max(1, Math.round(Number(e.target.value) || 1)) })} />
                <span>viviendas</span>
              </span>
            </label>
          ) : null}
          <p className="hr-mapa-nota">
            {config.route_jump_mode === "off"
              ? "Sin salto: se visita cada vivienda desde la esquina."
              : config.route_jump_mode === "manual"
                ? `Se toca una de cada ${config.route_jump_manual} viviendas en todas las manzanas.`
                : salto
                  ? `K = viviendas por manzana / ${ruta} entrevistas ≈ ${salto.k.toLocaleString("es-PE", { maximumFractionDigits: 1 })}: en el PDF, una de cada ${salto.operativo}.`
                  : "K = viviendas por manzana / entrevistas de la ruta, calculado en cada manzana."}
          </p>
        </section>

        <section className="hr-muestra-grupo" aria-label="Reemplazos">
          <h3>Reemplazos</h3>
          <div className="hr-muestra-campo">
            <small>Por cada titular</small>
            <span className="hr-muestra-pasos">
              <PulsoButton variant="icon" size="sm" aria-label="Un reemplazo menos" disabled={ed || reemplazos <= 0} onClick={() => cambiar({ replacements_per_titular: acotarReemplazos(reemplazos - 1) })}>−</PulsoButton>
              <input type="number" min={0} max={10} aria-label="Reemplazos por titular" value={reemplazos} disabled={ed} onChange={(e) => cambiar({ replacements_per_titular: acotarReemplazos(Number(e.target.value)) })} />
              <PulsoButton variant="icon" size="sm" aria-label="Un reemplazo más" disabled={ed || reemplazos >= 10} onClick={() => cambiar({ replacements_per_titular: acotarReemplazos(reemplazos + 1) })}>+</PulsoButton>
            </span>
            <span className="hr-mapa-nota">{reemplazos === 0 ? "Sin reemplazos: si una manzana falla, no hay respaldo sorteado." : `De 0 a 10. ${reemplazos} por titular.`}</span>
          </div>
          <Opciones etiqueta="Dónde buscar el reemplazo" valor={config.replacement_policy} opciones={POLITICAS} onCambio={(replacement_policy) => cambiar({ replacement_policy })} deshabilitado={ed || reemplazos === 0} />
        </section>
        {avisosDelSorteo(muestra).map((a) => (
          <p key={a.code + a.message} className="hr-mapa-aviso" data-codigo={a.code}>{a.message}</p>
        ))}
        {muestra && cambios.length ? <p className="hr-mapa-aviso">Sortear de nuevo reemplaza las titulares y reemplazos actuales. El sorteo anterior queda en el historial.</p> : null}
      </div>
      <footer className="hr-mapa-pie">
        <PulsoButton variant="secondary" disabled={!cambios.length || guardando} onClick={() => setSorteoBorrador(null)}>
          Deshacer
        </PulsoButton>
        <PulsoButton variant="primary" disabled={ed || !listoParaSortear || vigente} onClick={onSortear}>
          {guardando ? "Sorteando…" : muestra ? "Sortear de nuevo" : "Sortear manzanas"}
        </PulsoButton>
      </footer>
    </>
  );
}

/**
 * Avisos que el servidor adjunta al sorteo (n sin asignar, marco elegible, decisión de
 * cobertura): se pintan junto al botón que los produjo. Sólo los que piden algo al
 * equipo; los informativos ya tienen su lugar en el inspector.
 */
export function avisosDelSorteo(muestra: HojasRutaSamplePreview | null) {
  return (muestra?.alerts ?? []).filter((a) => a.level !== "info" && /^[WE]_/.test(a.code ?? "")).slice(0, 4);
}

type EstructuraProps = {
  muestra: HojasRutaSamplePreview | null;
  historial: readonly HojasRutaRouteSnapshot[];
  /** Territorio confirmado hoy: un ruteo de otro territorio no se ofrece para repetir. */
  territorios: readonly string[];
  /** N vigente (entrevistas del sorteo actual), o null si no hay. */
  nFinal: number | null;
  /** Cobertura del marco elegible por distrito (vista previa); vacía si no hay. */
  cobertura?: readonly HojasRutaCoberturaMarco[];
  bloqueado: boolean;
  guardando: boolean;
  onUsar: (s: HojasRutaRouteSnapshot) => void;
};

export function ManzanasEstructura({ muestra, historial, territorios, nFinal, cobertura = [], bloqueado, guardando, onUsar }: EstructuraProps) {
  const porDistrito = new Map<string, { distrito: string; titulares: number; entrevistas: number; reemplazos: number }>();
  for (const b of muestra?.blocks ?? []) {
    const f = porDistrito.get(b.ubigeo) ?? { distrito: b.distrito, titulares: 0, entrevistas: 0, reemplazos: 0 };
    f.titulares += 1;
    f.entrevistas += Number(b.entrevistas || 0);
    porDistrito.set(b.ubigeo, f);
  }
  for (const b of muestra?.replacement_blocks ?? []) {
    const f = porDistrito.get(b.ubigeo) ?? { distrito: b.distrito, titulares: 0, entrevistas: 0, reemplazos: 0 };
    f.reemplazos += 1;
    porDistrito.set(b.ubigeo, f);
  }
  const filas = [...porDistrito.entries()].sort((a, b) => a[1].distrito.localeCompare(b[1].distrito, "es"));
  const vigente = (h: HojasRutaRouteSnapshot) => Boolean(muestra) && h.seed === muestra?.seed && h.method === muestra?.method && h.n_blocks === muestra?.n_blocks;

  return (
    <>
      <div className="hr-mapa-cab hr-mapa-cab--pila">
        <div className="hr-mapa-cab-titulo">
          <h2>Por distrito</h2>
          <small>{muestra ? `${fmt(muestra.n_blocks)} titulares` : "Sin sorteo"}</small>
        </div>
      </div>
      <div className="hr-mapa-ins-cuerpo">
        {filas.length ? (
          <ul className="hr-sorteo-distritos">
            {filas.map(([u, f]) => (
              <li key={u}>
                {/* B40: el punto lleva el tono del distrito en el mapa (orden de confirmación, como en B9). */}
                <i style={{ background: tonoCss(territorios.indexOf(u)) }} aria-hidden="true" />
                <span className="hr-sorteo-dist-copia">
                  <strong>{nombreDistrito(f.distrito)}</strong>
                  <small>
                    {fmt(f.entrevistas)} entrevistas{f.reemplazos ? ` · ${fmt(f.reemplazos)} reemplazo${f.reemplazos === 1 ? "" : "s"}` : ""}
                  </small>
                </span>
                <span className="hr-sorteo-dist-cifra">
                  <b>{fmt(f.titulares)}</b>
                  <small>UMP</small>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hr-mapa-vacio">Todavía no hay manzanas sorteadas. Sortea desde el panel de la derecha.</p>
        )}
        {cobertura.some((c) => c.cobertura_poblacion != null && c.cobertura_poblacion < 1) ? (
          <section className="hr-muestra-grupo" aria-label="Cobertura del marco elegible">
            <h3>Cobertura del marco</h3>
            <ul className="hr-me-cobertura">
              {cobertura.map((c) => (
                <li key={c.ubigeo} data-tono={tonoCobertura(c)}>
                  <strong>{nombreDistrito(c.distrito)}</strong>
                  <span>{c.cobertura_poblacion == null ? "—" : `${(c.cobertura_poblacion * 100).toLocaleString("es-PE", { maximumFractionDigits: 1 })} %`}</span>
                  <small>{fmt(c.elegible.manzanas)} de {fmt(c.total.manzanas)} manzanas</small>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <section className="hr-muestra-grupo" aria-label="Historial de ruteos">
          <h3>Historial de ruteos</h3>
          {historial.length ? (
            <ul className="hr-sorteo-historial">
              {historial.map((h) => (
                <li key={h.id} data-vigente={vigente(h) || undefined}>
                  <span>
                    <strong>{h.label}</strong>
                    <small>{metodoDe(h.method)} · semilla {h.seed} · {fmt(h.n_replacement_blocks)} reemplazos{nFinal != null && h.n_final !== nFinal ? ` · con N ${fmt(h.n_final)}` : ""}</small>
                  </span>
                  {vigente(h) ? (
                    <em>En uso</em>
                  ) : !mismoTerritorio(h.territories, territorios) ? (
                    <em data-otro title="Se sorteó con otros distritos: repetirlo hoy daría otra muestra">Otro territorio</em>
                  ) : (
                    <PulsoButton variant="secondary" size="sm" disabled={bloqueado || guardando} onClick={() => onUsar(h)}>
                      Usar
                    </PulsoButton>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="hr-mapa-nota">Cada sorteo queda aquí para volver a él con la misma semilla.</p>
          )}
        </section>
      </div>
    </>
  );
}
