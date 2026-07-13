/**
 * Cadena A — de la población a la META (cuotas facultad × sexo).
 *
 * Hace EXPLÍCITA la cadena que el estudio HSyVBG documenta y que la tabla de
 * cuotas por sí sola aplana:
 *   ① Fórmula (n de Cochran + deff + FPC)
 *   ② Redondeo de diseño (el n objetivo NO sale exacto de la fórmula; es cifra
 *      fijada — con su error implícito)
 *   ③ Afijación por facultad   n_fac = round(n · N_fac / N)
 *   ④ Afijación por sexo        n_sexo = round(n_fac · sexo_fac / N_fac)
 *   ⑤ Cuadratura                Σ celdas debe cerrar en el n objetivo
 *   ⑥ LA META                   el reparto exacto M / H = n objetivo
 *
 * Consume las cifras VALIDADAS del motor (backend R) que ya vienen en el
 * resultado del componente; reconstruye el desglose de la META como la suma de
 * las cuotas por facultad (nunca de un total agregado aparte — guarda contra el
 * descuadre del "Total" documentado en las cifras canónicas).
 */
import type { CalcMuestraComponente } from "../../../../api/client";
import { fmtInt, fmtPct, fmtSignedInt } from "../../sharedCore";
import { FlujoVertical, type FlujoEtapa } from "../ui";

type CuotaFila = { facultad: string; N: number; mujeres: number; hombres: number; n: number };

export function CadenaAfijacion({
  comp,
  rows,
}: {
  comp: CalcMuestraComponente;
  rows: CuotaFila[];
}) {
  const nTeorico = comp.resultado?.n_teorico ?? null;
  const nObjetivo = comp.resultado?.n_objetivo ?? 0;
  const precision = comp.resultado?.precision_alcanzada ?? null;

  const totalMujeres = rows.reduce((acc, r) => acc + r.mujeres, 0);
  const totalHombres = rows.reduce((acc, r) => acc + r.hombres, 0);
  const sumaCuotas = rows.reduce((acc, r) => acc + r.n, 0);
  const faltante = nObjetivo - sumaCuotas;
  const cierra = faltante === 0;
  const pctMujeres = sumaCuotas > 0 ? totalMujeres / sumaCuotas : null;
  // El redondeo de diseño es real cuando el n objetivo se separa del teórico.
  const esCifraDiseno = nTeorico != null && Math.abs(nObjetivo - nTeorico) >= 1;

  const etapas: FlujoEtapa[] = [
    {
      id: "formula",
      label: "① Fórmula",
      valor: nTeorico != null ? fmtInt(nTeorico) : undefined,
      detalle: "Cochran + deff + FPC",
      estado: nTeorico != null ? "ready" : "pending",
    },
    {
      id: "diseno",
      label: "② Redondeo de diseño",
      valor: fmtInt(nObjetivo),
      detalle: esCifraDiseno
        ? `cifra fijada · error real ${fmtPct(precision)}`
        : "coincide con la fórmula",
      estado: "ready",
    },
    {
      id: "facultad",
      label: "③ Afijación facultad",
      valor: `${rows.length} unidades`,
      detalle: "round(n · N_fac / N)",
      estado: rows.length > 0 ? "ready" : "pending",
    },
    {
      id: "sexo",
      label: "④ Afijación sexo",
      valor: `M ${fmtInt(totalMujeres)} · H ${fmtInt(totalHombres)}`,
      detalle: "round(n_fac · sexo / N_fac)",
      estado: rows.length > 0 ? "ready" : "pending",
    },
    {
      id: "cuadratura",
      label: "⑤ Cuadratura",
      valor: cierra ? "exacto" : fmtSignedInt(faltante),
      detalle: `Σ ${fmtInt(sumaCuotas)} → objetivo ${fmtInt(nObjetivo)}`,
      estado: cierra ? "ready" : "working",
    },
    {
      id: "meta",
      label: "⑥ LA META",
      valor: fmtInt(sumaCuotas),
      detalle: "cuotas facultad × sexo",
      estado: rows.length > 0 ? "ready" : "pending",
    },
  ];

  return (
    <div className="cmv2-cadena-a">
      <FlujoVertical
        etapas={etapas}
        orientacion="horizontal"
        ariaLabel="Cadena de la población a la meta: fórmula, redondeo de diseño, afijación por facultad y sexo, cuadratura y meta"
      />
      <p className="cmv2-cadena-a-meta">
        <strong>
          Meta: M {fmtInt(totalMujeres)} · H {fmtInt(totalHombres)} = {fmtInt(sumaCuotas)}
        </strong>
        {pctMujeres != null && <> · {fmtPct(pctMujeres)} mujeres, la proporción real de la población.</>}{" "}
        {esCifraDiseno && (
          <>
            El n objetivo ({fmtInt(nObjetivo)}) es una <em>cifra de diseño</em>, no el despeje exacto de la fórmula
            ({nTeorico != null ? fmtInt(nTeorico) : "—"}).{" "}
          </>
        )}
        El desglose sale de la <em>suma de cuotas por facultad</em>, no de un total agregado aparte.
      </p>
    </div>
  );
}
