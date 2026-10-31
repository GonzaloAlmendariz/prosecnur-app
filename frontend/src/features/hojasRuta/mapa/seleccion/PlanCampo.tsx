import { useState, type ReactNode } from "react";
import "./planCampo.css";
import { tonoCss } from "../lienzo/tonos";
import { PulsoButton } from "../../../../components/PulsoButton";
import { downloadUrl } from "../../../../api/core";
import { apiHojasRutaHojaDia, apiHojasRutaPlanCampo, normalizarPlanSupuestos, PLAN_SUPUESTOS_POR_DEFECTO, type HojasRutaJornada, type HojasRutaPlanCampo, type HojasRutaPlanSupuestos } from "../../../../api/hojasRuta";
import { nombreDistrito } from "../nombres";

/**
 * Plan de campo y costo (U14) dentro de las salidas de Selección: jornadas por
 * cercanía con capacidad en visitas (ADR 0116), días según encuestadores y costo.
 * Calcular no guarda nada; «Guardar supuestos» los deja en el proyecto.
 */

const fmt = (n: number, d = 0) => n.toLocaleString("es-PE", { maximumFractionDigits: d });

/** Las jornadas agrupadas por el día en que empiezan, en orden de encuestador. */
export function porDia(jornadas: readonly HojasRutaJornada[]): [number, HojasRutaJornada[]][] {
  const m = new Map<number, HojasRutaJornada[]>();
  for (const j of jornadas) m.set(j.dia, [...(m.get(j.dia) ?? []), j]);
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([d, js]) => [d, [...js].sort((x, y) => x.encuestador - y.encuestador)]);
}

/**
 * `conCostos = false` (Material de campo): sin costos ni precios, que los lleva otra persona (Gonzalo,
 * 2026-10-30). Los supuestos de costo guardados no se tocan: se conservan al guardar los demás.
 *
 * `cabezaEncuestador` (Material, decisión I3): reemplaza el rótulo «Encuestador k» de la columna, con las
 * UMP (`id_manzana`) de todas sus jornadas, para asignarle una persona de la lista de Monitoreo.
 */
/**
 * De dónde salen el plan y la hoja del día. Por defecto, de la muestra viva de Hojas de
 * ruta; Material pasa los de la foto enviada (P6), para repartir lo que recibió.
 */
export type FuenteDelPlan = {
  plan: (s: HojasRutaPlanSupuestos) => Promise<HojasRutaPlanCampo>;
  hojaDia: (jornada: string, s: HojasRutaPlanSupuestos) => Promise<{ file_id: string }>;
};

const FUENTE_VIVA: FuenteDelPlan = { plan: apiHojasRutaPlanCampo, hojaDia: apiHojasRutaHojaDia };

export function PlanCampo({ guardados, deshabilitado, onGuardar, conCostos = true, cabezaEncuestador, fuente = FUENTE_VIVA }: { guardados: HojasRutaPlanSupuestos | undefined; deshabilitado: boolean; onGuardar: (s: HojasRutaPlanSupuestos) => Promise<void>; conCostos?: boolean; cabezaEncuestador?: (k: number, umps: string[]) => ReactNode; fuente?: FuenteDelPlan }) {
  const [s, setS] = useState<HojasRutaPlanSupuestos>(normalizarPlanSupuestos(guardados));
  const [plan, setPlan] = useState<HojasRutaPlanCampo | null>(null);
  const [ocupado, setOcupado] = useState<"" | "calcular" | "guardar">("");
  const [error, setError] = useState("");
  const [hoja, setHoja] = useState<string | null>(null);
  const cambiado = JSON.stringify(s) !== JSON.stringify(normalizarPlanSupuestos(guardados));
  const campo = (k: keyof Omit<HojasRutaPlanSupuestos, "moneda">, etiqueta: string, sufijo?: string) => (
    <label className="hr-muestra-campo">
      <small>{etiqueta}</small>
      <span className="hr-muestra-numero">
        <input type="number" min={0} value={s[k]} disabled={deshabilitado} onChange={(e) => e.target.value !== "" && setS(normalizarPlanSupuestos({ ...s, [k]: Number(e.target.value) }))} />
        {sufijo ? <span>{sufijo}</span> : null}
      </span>
    </label>
  );
  const calcular = () => {
    setOcupado("calcular");
    setError("");
    fuente.plan(s)
      .then(setPlan)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "No se pudo armar el plan"))
      .finally(() => setOcupado(""));
  };
  return (
    <section className="hr-muestra-grupo" aria-label="Plan de campo">
      <h3>Plan de campo</h3>
      <div className="hr-muestra-dos">
        {campo("encuestadores", "Encuestadores")}
        {campo("visitas_por_jornada", "Visitas por jornada")}
        {conCostos ? (
          <>
            {campo("costo_por_entrevista", "Costo por entrevista", s.moneda)}
            {campo("costo_por_jornada", "Costo por jornada", s.moneda)}
            {campo("costo_por_km", "Movilidad por km", s.moneda)}
            {campo("supervision_pct", "Supervisión y coordinación", "%")}
          </>
        ) : null}
      </div>
      {conCostos && JSON.stringify({ ...s, encuestadores: 0, visitas_por_jornada: 0 }) === JSON.stringify({ ...PLAN_SUPUESTOS_POR_DEFECTO, encuestadores: 0, visitas_por_jornada: 0 }) ? (
        <p className="hr-mapa-nota">Costos por defecto: {s.moneda} 120 de pago y {s.moneda} 25 de movilidad por jornada, y 15 % de supervisión. Edítalos con los del estudio; el informe los publica.</p>
      ) : null}
      {error ? <p className="hr-mapa-aviso">{error}</p> : null}
      {plan ? (
        <>
          <div className="hr-mapa-cifras">
            <div><small>Jornadas</small><strong>{fmt(plan.resumen.jornadas)}</strong></div>
            <div><small>Días</small><strong>{fmt(plan.resumen.dias)}</strong></div>
            {conCostos ? <div><small>Costo</small><strong>{plan.supuestos.moneda} {fmt(plan.resumen.costo)}</strong></div> : <div><small>Encuestadores</small><strong>{fmt(plan.supuestos.encuestadores)}</strong></div>}
          </div>
          <dl className="hr-mapa-filas">
            <div><dt>Entre rutas, en promedio</dt><dd>{fmt(plan.jornadas.length ? plan.resumen.km / plan.jornadas.length : 0, 1)} km por jornada</dd></div>
            {conCostos ? <div><dt>Por entrevista completa</dt><dd>{plan.supuestos.moneda} {fmt(plan.resumen.entrevistas ? plan.resumen.costo / plan.resumen.entrevistas : 0)}</dd></div> : null}
          </dl>
          <p className="hr-mapa-nota">
            {fmt(plan.resumen.rutas)} rutas, {fmt(plan.resumen.visitas)} visitas esperadas y unos {fmt(plan.resumen.km, 1)} km entre titulares. Cada jornada es un día de un encuestador, con titulares cercanas del mismo distrito. Se llena con las visitas esperadas, que son un promedio: cerca de la mitad de las jornadas se pasará un poco.
          </p>
          {plan.alertas.slice(0, 3).map((a) => (
            <p key={a.message} className="hr-mapa-aviso" data-codigo={a.code}>{a.message}</p>
          ))}
          {/* M14: el plan como calendario — un día por fila, un encuestador por columna; todos los días a la vista (C4). */}
          <div className="hr-plan-calendario" role="table" aria-label="Plan por encuestador y día" style={{ ["--hr-plan-encuestadores" as string]: String(plan.supuestos.encuestadores) }}>
            <div className="hr-plan-fila hr-plan-cabeza" role="row">
              <span role="columnheader">Día</span>
              {Array.from({ length: plan.supuestos.encuestadores }, (_, k) => (
                <span key={k} role="columnheader">
                  <i className="hr-plan-enc" style={{ background: tonoCss(k) }} aria-hidden="true" /> Encuestador {k + 1}
                  {cabezaEncuestador ? cabezaEncuestador(k, plan.jornadas.filter((j) => j.encuestador === k + 1).flatMap((j) => j.rutas)) : null}
                </span>
              ))}
            </div>
            {porDia(plan.jornadas).map(([dia, js]) => (
              <div key={dia} className="hr-plan-fila" role="row">
                <span className="hr-plan-dia-num" role="rowheader">Día {dia}</span>
                {Array.from({ length: plan.supuestos.encuestadores }, (_, k) => {
                  const j = js.find((x) => x.encuestador === k + 1);
                  if (!j) return <span key={k} className="hr-plan-libre" role="cell">—</span>;
                  const corta = j.rutas.length === 1 && !j.excede_jornada;
                  return (
                    <span key={k} className="hr-plan-jornada" role="cell" data-corta={corta || undefined} title={j.rutas.join(", ")}>
                      <span className="hr-plan-jornada-cab">
                        <strong>{j.id}</strong>
                        <span>{nombreDistrito(j.distrito)}</span>
                      </span>
                      <small>
                        {j.rutas.length === 1 ? "1 UMP" : `${j.rutas.length} UMP`} · {fmt(j.visitas)} visitas
                        {j.excede_jornada ? ` · ${j.jornadas_equivalentes} días seguidos` : ` · ${fmt(j.km, 1)} km`}
                      </small>
                      {corta ? <em>Jornada corta: una sola ruta</em> : null}
                      <button
                        type="button"
                        className="hr-plan-hoja"
                        disabled={hoja != null}
                        onClick={() => {
                          setHoja(j.id);
                          fuente.hojaDia(j.id, s)
                            .then((r) => window.open(downloadUrl(r.file_id), "_blank", "noopener,noreferrer"))
                            .catch((e: unknown) => setError(e instanceof Error ? e.message : "No se pudo generar la hoja del día"))
                            .finally(() => setHoja(null));
                        }}
                      >
                        {hoja === j.id ? "Generando…" : "Hoja del día"}
                      </button>
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      ) : null}
      <div className="hr-salidas-acciones">
        <PulsoButton variant="secondary" disabled={deshabilitado || ocupado !== ""} onClick={calcular}>
          {ocupado === "calcular" ? "Armando…" : plan ? "Recalcular" : "Armar el plan"}
        </PulsoButton>
        <PulsoButton
          variant="secondary"
          disabled={deshabilitado || ocupado !== "" || !cambiado}
          onClick={() => {
            setOcupado("guardar");
            onGuardar(s)
              .catch((e: unknown) => setError(e instanceof Error ? e.message : "No se pudo guardar"))
              .finally(() => setOcupado(""));
          }}
        >
          {ocupado === "guardar" ? "Guardando…" : "Guardar supuestos"}
        </PulsoButton>
      </div>
    </section>
  );
}
