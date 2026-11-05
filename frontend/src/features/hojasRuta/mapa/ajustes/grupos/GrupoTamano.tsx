import type { HojasRutaIntegratedConfig, HojasRutaSampleSizeConfig } from "../../../../../api/hojasRuta";
import { PulsoSwitch } from "../../../../../components/PulsoSwitch";
import { formatoDecimal } from "../../../../../lib/formatoNumero";
import { visitasCap, visitasPorRuta } from "../../../seleccion/visitas";
import { fuenteDelReparto } from "../../muestra/BaseReparto2025";
import { Atajos, DEFF_TIPICOS, fmt, Numero, Opciones, pct } from "../../muestra/controlesMuestra";
import { deffPorIcc, type BorradorMuestra } from "../../muestra/desdeConfig";
import { GuiaDeMuestra } from "../../muestra/GuiaDeMuestra";
import { IccPanel } from "../../muestra/IccPanel";
import { MargenCurva } from "../../muestra/MargenCurva";
import type { ResultadoTamano } from "../../muestra/motorTamano";
import { pasosDelN } from "../../muestra/pasosDelN";
import { CampoN } from "./CampoN";
import { SelectorK } from "./SelectorK";
import { intervaloP50, nEfectivo } from "./tamanoN";
import { useLienzoHojasRuta } from "../../store";

type Props = {
  /** La config de muestra con el borrador aplicado encima (la misma que veía el inspector de Muestra). */
  config: HojasRutaIntegratedConfig;
  resultado: ResultadoTamano;
  bloqueado: boolean;
  guardando: boolean;
  margenPara?: (n: number) => number | null;
};

/**
 * Grupo 1 de «Ajustes del diseño», Tamaño y precisión (M2a): los controles que vivían en el inspector de
 * Muestra, mudados tal cual. Escriben el MISMO borrador (`muestraBorrador`) que se aplica con el mismo
 * guardar de la página: ningún control cambia de semántica (C5).
 */
export function GrupoTamano({ config, resultado: r, bloqueado, guardando, margenPara }: Props) {
  const { muestraBorrador, setMuestraBorrador } = useLienzoHojasRuta();
  const s = config.sample_size;
  const ruta = config.entrevistas_por_manzana;
  const cambiar = (b: BorradorMuestra) => setMuestraBorrador({ ...muestraBorrador, ...b, sample_size: { ...muestraBorrador?.sample_size, ...b.sample_size } });
  const cambiarS = (x: Partial<HojasRutaSampleSizeConfig>) => cambiar({ sample_size: x });
  const pasosN = pasosDelN({ z: r.z, p: s.expected_proportion, margenTotal: s.margin_total, deff: s.design_effect, fpc: s.apply_fpc, poblacion: r.poblacionTotal, porRuta: ruta, piso: Boolean(s.enforce_district_floor), margenDistrito: s.margin_district, sumaMinimos: r.sumaMinimos });
  const alternativas = [
    ["N en uso", r.nUsado],
    ["Mínimo por margen total", r.nTotalMinimo],
    ["Suma de mínimos por distrito", r.sumaMinimos],
  ].filter(([, n], i, a) => Number(n) > 0 && a.findIndex((x) => x[1] === n) === i) as Array<[string, number]>;
  const ed = bloqueado || guardando;
  const intervalo = intervaloP50(r.margenTotal);

  return (
    <div className="hr-ajustes-grupo-cuerpo">
        <Opciones
          etiqueta="Lógica del N"
          valor={config.sample_size_mode}
          deshabilitado={ed}
          opciones={[["calculator", "Calculado"], ["external_total", "N total"], ["external_district", "Por distrito"]] as const}
          onCambio={(v) => cambiar({ sample_size_mode: v })}
        />
        {config.sample_size_mode === "external_total" ? (
          <CampoN valor={config.n_objetivo} k={ruta} deshabilitado={ed} onCambio={(n_objetivo) => cambiar({ n_objetivo })} />
        ) : config.sample_size_mode === "external_district" ? (
          <p className="hr-mapa-nota">Escribe el N de cada distrito en la lista de la izquierda.</p>
        ) : (
          <p className="hr-mapa-nota">El N sale de los márgenes y supuestos de abajo, redondeado a rutas completas.</p>
        )}

        <SelectorK n={config.sample_size_mode === "external_total" ? config.n_objetivo : r.nUsado} k={ruta} deshabilitado={ed} onCambio={(entrevistas_por_manzana) => cambiar({ entrevistas_por_manzana })} />
        {/* Fórmulas y derivados en contenedor formal, no como texto con «=» (maqueta aprobada). */}
        <dl className="hr-ajustes-formula" aria-label="Encuestas, rutas y precisión">
          <div><dt>Encuestas</dt><dd>{fmt(r.nUsado)}</dd></div>
          <div><dt>Rutas de {ruta}</dt><dd>{r.multiploDeRuta ? fmt(r.nUsado / ruta) : <small>N no múltiplo de {ruta}</small>}</dd></div>
          <div><dt>Intervalo, p 50 %</dt><dd>{intervalo ? `${formatoDecimal(intervalo[0], 1)} a ${formatoDecimal(intervalo[1], 1)} %` : "—"}</dd></div>
          <div><dt>Tamaño efectivo</dt><dd>{fmt(nEfectivo(r.nUsado, s.design_effect))} <small>DEFF {formatoDecimal(s.design_effect, 2)}</small></dd></div>
        </dl>

        <section className="hr-ajustes-bloque" aria-label="Margen de error">
          <h4>Margen de error</h4>
          <Opciones etiqueta="Confianza" valor={s.confidence_level} deshabilitado={ed} opciones={[[0.9, "90 %"], [0.95, "95 %"], [0.99, "99 %"]] as const} onCambio={(v) => cambiarS({ confidence_level: v })} />
          <div className="hr-muestra-dos">
            <Numero etiqueta="Margen total" sufijo="%" valor={Math.round(s.margin_total * 1000) / 10} min={0.1} max={50} paso={0.5} deshabilitado={ed} onCambio={(v) => cambiarS({ margin_total: Math.min(0.5, Math.max(0.001, v / 100)) })} />
            <Numero etiqueta="Margen por distrito" sufijo="%" valor={Math.round(s.margin_district * 1000) / 10} min={0.1} max={80} paso={0.5} deshabilitado={ed} onCambio={(v) => cambiarS({ margin_district: Math.min(0.8, Math.max(0.001, v / 100)) })} />
          </div>
          <div className="hr-muestra-dos">
            <Atajos valores={[3, 4, 5]} actual={s.margin_total} deshabilitado={ed} etiqueta="Margen total" onElegir={(v) => cambiarS({ margin_total: v })} />
            <Atajos valores={[8, 10, 15]} actual={s.margin_district} deshabilitado={ed} etiqueta="Margen por distrito" onElegir={(v) => cambiarS({ margin_district: v })} />
          </div>
          {margenPara ? <MargenCurva ancho={640} margenPara={margenPara} nUsado={r.nUsado} objetivo={s.margin_total} porRuta={ruta} onElegirN={config.sample_size_mode === "external_total" && !ed ? (n_objetivo) => cambiar({ n_objetivo }) : undefined} /> : null}
          {config.sample_size_mode === "calculator" ? (
            <Opciones etiqueta="El margen por distrito es…" valor={s.enforce_district_floor ? "requisito" : "maximo"} deshabilitado={ed} opciones={[["requisito", "Un requisito"], ["maximo", "Solo un máximo"]] as const} onCambio={(v) => cambiarS({ enforce_district_floor: v === "requisito" })} />
          ) : null}
        </section>

        <section className="hr-ajustes-bloque" aria-label="Supuestos">
          <h4>Supuestos</h4>
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

        <section className="hr-ajustes-bloque" aria-label="Alternativas y cálculo">
          <h4>Alternativas y cálculo</h4>
        <section className="hr-muestra-grupo" aria-label="Alternativas">
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
        </section>
    </div>
  );
}
