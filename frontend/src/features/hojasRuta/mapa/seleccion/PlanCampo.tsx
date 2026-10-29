import { useState } from "react";
import { PulsoButton } from "../../../../components/PulsoButton";
import { downloadUrl } from "../../../../api/core";
import { apiHojasRutaHojaDia, apiHojasRutaPlanCampo, normalizarPlanSupuestos, PLAN_SUPUESTOS_POR_DEFECTO, type HojasRutaPlanCampo, type HojasRutaPlanSupuestos } from "../../../../api/hojasRuta";
import { nombreDistrito } from "../nombres";

/**
 * Plan de campo y costo (U14) dentro de las salidas de Selección: jornadas por
 * cercanía con capacidad en visitas (ADR 0116), días según encuestadores y costo.
 * Calcular no guarda nada; «Guardar supuestos» los deja en el proyecto.
 */

const fmt = (n: number, d = 0) => n.toLocaleString("es-PE", { maximumFractionDigits: d });

export function PlanCampo({ guardados, deshabilitado, onGuardar }: { guardados: HojasRutaPlanSupuestos | undefined; deshabilitado: boolean; onGuardar: (s: HojasRutaPlanSupuestos) => Promise<void> }) {
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
    apiHojasRutaPlanCampo(s)
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
        {campo("costo_por_entrevista", "Costo por entrevista", s.moneda)}
        {campo("costo_por_jornada", "Costo por jornada", s.moneda)}
        {campo("costo_por_km", "Movilidad por km", s.moneda)}
        {campo("supervision_pct", "Supervisión y coordinación", "%")}
      </div>
      {JSON.stringify({ ...s, encuestadores: 0, visitas_por_jornada: 0 }) === JSON.stringify({ ...PLAN_SUPUESTOS_POR_DEFECTO, encuestadores: 0, visitas_por_jornada: 0 }) ? (
        <p className="hr-mapa-nota">Costos por defecto: {s.moneda} 120 de pago y {s.moneda} 25 de movilidad por jornada, y 15 % de supervisión. Edítalos con los del estudio; el informe los publica.</p>
      ) : null}
      {error ? <p className="hr-mapa-aviso">{error}</p> : null}
      {plan ? (
        <>
          <div className="hr-mapa-cifras">
            <div><small>Jornadas</small><strong>{fmt(plan.resumen.jornadas)}</strong></div>
            <div><small>Días</small><strong>{fmt(plan.resumen.dias)}</strong></div>
            <div><small>Costo</small><strong>{plan.supuestos.moneda} {fmt(plan.resumen.costo)}</strong></div>
          </div>
          <p className="hr-mapa-nota">
            {fmt(plan.resumen.rutas)} rutas, {fmt(plan.resumen.visitas)} visitas esperadas y unos {fmt(plan.resumen.km, 1)} km entre titulares. Cada jornada es un día de un encuestador, con titulares cercanas del mismo distrito. Se llena con las visitas esperadas, que son un promedio: cerca de la mitad de las jornadas se pasará un poco.
          </p>
          {plan.alertas.slice(0, 3).map((a) => (
            <p key={a.message} className="hr-mapa-aviso" data-codigo={a.code}>{a.message}</p>
          ))}
          <ul className="hr-plan-jornadas">
            {plan.jornadas.slice(0, 12).map((j) => (
              <li key={j.id}>
                <strong>{j.id}</strong>
                <span>
                  {nombreDistrito(j.distrito)} · {j.rutas.length} ruta{j.rutas.length === 1 ? "" : "s"} · {fmt(j.visitas)} visitas
                  {j.excede_jornada ? ` · no cabe en una jornada: ${j.jornadas_equivalentes} días seguidos, mismo encuestador` : ` · ${fmt(j.km, 1)} km`}
                </span>
                <button
                  type="button"
                  className="hr-plan-hoja"
                  disabled={hoja != null}
                  onClick={() => {
                    setHoja(j.id);
                    apiHojasRutaHojaDia(j.id, s)
                      .then((r) => window.open(downloadUrl(r.file_id), "_blank", "noopener,noreferrer"))
                      .catch((e: unknown) => setError(e instanceof Error ? e.message : "No se pudo generar la hoja del día"))
                      .finally(() => setHoja(null));
                  }}
                >
                  {hoja === j.id ? "Generando…" : "Hoja del día"}
                </button>
              </li>
            ))}
          </ul>
          {plan.jornadas.length > 12 ? <p className="hr-mapa-nota">y {plan.jornadas.length - 12} jornadas más.</p> : null}
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
