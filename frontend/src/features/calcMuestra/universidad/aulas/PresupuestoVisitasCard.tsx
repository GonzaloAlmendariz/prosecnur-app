/**
 * El presupuesto de visitas (opción B de Gonzalo: «el techo manda»).
 *
 * Techo declarado del estudio vs plan vigente: titulares + activaciones
 * esperadas (Σ(1−p_aplicada_ref) de la calibración 2025, cuando viaja).
 * Sin techo declarado no pinta nada — un presupuesto de 0 no es presupuesto.
 */
import { Gauge } from "lucide-react";
import { fmtInt } from "../../sharedCore";
import "./docenteUnico.css";

export function presupuestoVisitas(
  techo: number | null | undefined,
  titulares: ReadonlyArray<Record<string, unknown>>,
): { techo: number; titulares: number; activacionesEsperadas: number | null; plan: number | null; estado: "dentro" | "rozando" | "excedido" } | null {
  const t = Number(techo);
  if (!Number.isFinite(t) || t <= 0 || !titulares.length) return null;
  let caidas = 0;
  let conDato = 0;
  for (const r of titulares) {
    const p = Number(r.p_aplicada_ref);
    if (Number.isFinite(p) && r.p_aplicada_ref != null) {
      caidas += 1 - p;
      conDato += 1;
    }
  }
  const activaciones = conDato > 0 ? Math.round(caidas) : null;
  const plan = activaciones != null ? titulares.length + activaciones : null;
  const estado = plan == null
    ? "dentro"
    : plan > t ? "excedido" : plan >= t - 5 ? "rozando" : "dentro";
  return { techo: t, titulares: titulares.length, activacionesEsperadas: activaciones, plan, estado };
}

export function PresupuestoVisitasCard({
  techo,
  titulares,
}: {
  techo: number | null | undefined;
  titulares: ReadonlyArray<Record<string, unknown>>;
}) {
  const p = presupuestoVisitas(techo, titulares);
  if (!p) return null;
  return (
    <section className="cmv2-docente-unico" aria-label="Presupuesto de visitas" data-estado={p.estado}>
      <header>
        <Gauge size={14} aria-hidden="true" />
        <strong>Presupuesto de visitas: techo {fmtInt(p.techo)}</strong>
        <span>
          {p.plan != null
            ? `plan vigente ≈ ${fmtInt(p.plan)} (${fmtInt(p.titulares)} titulares + ${fmtInt(p.activacionesEsperadas ?? 0)} activaciones esperadas según 2025) — ${
                p.estado === "excedido" ? "EXCEDE el techo" : p.estado === "rozando" ? "roza el techo" : "dentro del techo"
              }`
            : `${fmtInt(p.titulares)} titulares; sin calibración para estimar activaciones`}
        </span>
      </header>
    </section>
  );
}
