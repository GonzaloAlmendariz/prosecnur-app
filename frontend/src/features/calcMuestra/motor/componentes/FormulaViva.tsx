/**
 * La fórmula viva: los cuatro parámetros del diseño como controles reales.
 * Mover un parámetro recalcula el n al instante (motor TS con paridad R
 * blindada) y enseña la diferencia entre el despeje exacto y la cifra de
 * diseño. "Volver al canon" restaura los valores del perfil.
 */
import { RotateCcw } from "lucide-react";
import { fmtDec, fmtInt } from "../../sharedCore";
import { errorImplicito, nFormula, type ParametrosMuestra } from "../../dominio";
import { FormulaLatex } from "../../universidad/ui";
import { CifraMotor, CifraFila } from "../../universidad/ui";

const CONFIANZAS = [
  { valor: 0.9, label: "90%" },
  { valor: 0.95, label: "95%" },
  { valor: 0.99, label: "99%" },
];

function Control({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <label className="rec-formula-control">
      <span className="rec-formula-control-label">{label}</span>
      {children}
      <span className="rec-formula-control-hint">{hint}</span>
    </label>
  );
}

export function FormulaViva({
  N,
  parametros,
  canon,
  tocado,
  onParametro,
  onReset,
}: {
  N: number;
  parametros: ParametrosMuestra;
  /** Parámetros canónicos del perfil, para señalar desvíos. */
  canon: ParametrosMuestra;
  tocado: boolean;
  onParametro: (patch: Partial<ParametrosMuestra>) => void;
  onReset: () => void;
}) {
  const n = nFormula(N, parametros);
  const nDiseno = parametros.nDiseno;
  const eImplicito = nDiseno != null ? errorImplicito(nDiseno, N, parametros) : null;

  return (
    <div className="rec-formula">
      <FormulaLatex
        caption="Poblaciones finitas con efecto de diseño"
        expression={String.raw`n = \frac{N \cdot z^2 \cdot p(1-p) \cdot \text{deff}}{(N-1)\cdot e^2 + z^2 \cdot p(1-p) \cdot \text{deff}}`}
        terms={[
          { symbol: "N", termino: "población objetivo", value: fmtInt(N) },
          { symbol: "z", termino: "nivel de confianza", value: `${Math.round(parametros.confianza * 100)}%` },
          { symbol: "p", termino: "p (proporción esperada)", value: fmtDec(parametros.proporcion, 2) },
          { symbol: "e", termino: "margen de error", value: `${fmtDec(parametros.margenError * 100, 2)}%` },
          { symbol: "deff", termino: "deff", value: fmtDec(parametros.deff, 1) },
        ]}
      />

      <div className="rec-formula-controles">
        <Control label="Confianza" hint="cuánta seguridad exige la estimación">
          <div className="rec-segmented" role="radiogroup" aria-label="Nivel de confianza">
            {CONFIANZAS.map((op) => (
              <button
                key={op.valor}
                type="button"
                role="radio"
                aria-checked={Math.abs(parametros.confianza - op.valor) < 1e-9}
                data-activo={Math.abs(parametros.confianza - op.valor) < 1e-9 || undefined}
                onClick={() => onParametro({ confianza: op.valor })}
              >
                {op.label}
              </button>
            ))}
          </div>
        </Control>
        <Control label={`Margen de error · ${fmtDec(parametros.margenError * 100, 2)}%`} hint="menos error exige más muestra">
          <input
            type="range"
            min={1}
            max={10}
            step={0.01}
            value={parametros.margenError * 100}
            aria-label="Margen de error en puntos porcentuales"
            onChange={(e) => onParametro({ margenError: Number(e.target.value) / 100 })}
          />
        </Control>
        <Control label={`Proporción esperada · ${fmtDec(parametros.proporcion * 100, 0)}%`} hint="máxima incertidumbre en 50%">
          <input
            type="range"
            min={5}
            max={95}
            step={1}
            value={parametros.proporcion * 100}
            aria-label="Proporción esperada del fenómeno"
            onChange={(e) => onParametro({ proporcion: Number(e.target.value) / 100 })}
          />
        </Control>
        <Control label={`Efecto de diseño · ${fmtDec(parametros.deff, 1)}`} hint="el costo de muestrear por aulas">
          <input
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={parametros.deff}
            aria-label="Efecto de diseño (deff)"
            onChange={(e) => onParametro({ deff: Number(e.target.value) })}
          />
        </Control>
      </div>

      <CifraFila>
        <CifraMotor
          label="n que despeja la fórmula"
          value={n != null ? fmtInt(n) : "—"}
          detalle="redondeado hacia arriba, como todo tamaño de muestra"
          hero
        />
        {nDiseno != null && (
          <>
            <CifraMotor
              label="Cifra de diseño"
              value={fmtInt(nDiseno)}
              detalle="el n fijado por el diseño (redondeo conservador)"
              tono="ok"
              hero
            />
            <CifraMotor
              label="Error implícito del diseño"
              value={eImplicito != null ? `${fmtDec(eImplicito * 100, 2)}%` : "—"}
              detalle={`con n = ${fmtInt(nDiseno)}, el error real queda por debajo del exigido`}
            />
          </>
        )}
      </CifraFila>

      <div className="rec-formula-canon" data-tocado={tocado || undefined}>
        {tocado ? (
          <>
            <span>
              Parámetros modificados. Referencia del perfil: confianza {Math.round(canon.confianza * 100)}% ·
              e {fmtDec(canon.margenError * 100, 2)}% · p {fmtDec(canon.proporcion, 2)} · deff {fmtDec(canon.deff, 1)}.
            </span>
            <button type="button" className="rec-link" onClick={onReset}>
              <RotateCcw size={12} aria-hidden="true" /> Restaurar
            </button>
          </>
        ) : (
          <span>Parámetros del perfil activo. El resultado se recalcula con cada cambio.</span>
        )}
      </div>
    </div>
  );
}
