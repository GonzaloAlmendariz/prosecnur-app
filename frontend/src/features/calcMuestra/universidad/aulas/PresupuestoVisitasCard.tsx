/**
 * El presupuesto de visitas (opción B de Gonzalo: «el techo manda»).
 *
 * Techo declarado del estudio vs plan vigente: titulares + activaciones
 * esperadas (Σ(1−p_aplicada_ref) de la calibración 2025, cuando viaja).
 * Sin techo declarado no pinta nada — un presupuesto de 0 no es presupuesto.
 */
import { Gauge } from "lucide-react";
import { fmtInt } from "../../sharedCore";
import { efectividadExplicada, etiquetaDocente } from "./efectividadExplicadaModel";
import "./docenteUnico.css";
import "./presupuestoVisitas.css";

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
      {p.plan != null && (
        <div className="cmv2-presup-carril" role="img"
          aria-label={`Titulares ${fmtInt(p.titulares)} más ${fmtInt(p.activacionesEsperadas ?? 0)} activaciones esperadas = plan ${fmtInt(p.plan)}, contra un techo de ${fmtInt(p.techo)}`}>
          {(() => {
            // La barra del presupuesto: se VE cuánto comen los titulares,
            // cuánto las activaciones y cuánto queda (o cuánto se pasa).
            const escala = Math.max(p.techo, p.plan ?? 0);
            const w = (v: number) => `${(v / escala) * 100}%`;
            const dentroPlan = Math.min(p.plan ?? 0, p.techo);
            const activacionesDentro = Math.max(0, dentroPlan - p.titulares);
            const exceso = Math.max(0, (p.plan ?? 0) - p.techo);
            return (
              <>
                <span className="cmv2-presup-seg" data-seg="titulares" style={{ width: w(Math.min(p.titulares, p.techo)) }} />
                {activacionesDentro > 0 && (
                  <span className="cmv2-presup-seg" data-seg="activaciones" style={{ width: w(activacionesDentro) }} />
                )}
                {exceso > 0 && (
                  <span className="cmv2-presup-seg" data-seg="exceso" style={{ width: w(exceso) }} />
                )}
                <i className="cmv2-presup-techo" style={{ left: w(p.techo) }}>
                  <b>techo {fmtInt(p.techo)}</b>
                </i>
              </>
            );
          })()}
        </div>
      )}
      {p.plan != null && (
        <p className="cmv2-presup-leyenda">
          <i data-seg="titulares" /> {fmtInt(p.titulares)} titulares ·{" "}
          <i data-seg="activaciones" /> {fmtInt(p.activacionesEsperadas ?? 0)} activaciones esperadas
          {(p.plan ?? 0) > p.techo ? (
            <>
              {" "}· <i data-seg="exceso" /> {fmtInt((p.plan ?? 0) - p.techo)} sobre el techo
            </>
          ) : (
            <> · quedan {fmtInt(p.techo - (p.plan ?? 0))} de holgura</>
          )}
        </p>
      )}
      {(() => {
        // V7/plan 1b: la tasa de aplicacion por tipo de docente vive AQUI —
        // su casa conceptual es el presupuesto (anticipa intentos y cadena),
        // no la cuenta de efectivas. Derivada de las filas del motor (un dueño).
        const grupos = efectividadExplicada(titulares as Record<string, unknown>[])?.porDocente ?? [];
        if (!grupos.length) return null;
        return (
          <div className="cmv2-presup-docentes">
            <table className="cmv2-efexp-tabla-ref">
              <caption>Tasa de aplicación por tipo de docente — anticipa intentos y cadena, no efectivas</caption>
              <thead>
                <tr>
                  <th scope="col">Tipo de docente</th>
                  <th scope="col">Tasa de aplicación</th>
                  <th scope="col">Titulares</th>
                </tr>
              </thead>
              <tbody>
                {grupos.map((g) => (
                  <tr key={g.tasa}>
                    <th scope="row">{etiquetaDocente(g.etiqueta)}</th>
                    <td>{`${Math.round(g.tasa * 100)} %`}</td>
                    <td>{fmtInt(g.nAulas)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })()}
    </section>
  );
}
