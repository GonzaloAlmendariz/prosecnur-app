/**
 * Pestaña Cálculo: parámetros editables con recálculo inmediato, cifra de
 * diseño opcional, escenarios E1/E2 y bolsa operativa. Los desgloses por
 * unidad viven en Distribución.
 */
import type { PerfilInstitucional, ResultadoEscenario1, ResultadoEscenario2 } from "../../dominio";
import { fmtDec, fmtInt } from "../../sharedCore";
import { useMotorStore } from "../store";
import { ComparadorEscenarios } from "../componentes/ComparadorEscenarios";
import { FormulaViva } from "../componentes/FormulaViva";
import { NotaPorQue } from "../componentes/NotaPorQue";

export function TabCalculo({
  perfil,
  e1,
  e2,
  onAplicarAlEstudio,
  calculando,
}: {
  perfil: PerfilInstitucional;
  e1: ResultadoEscenario1;
  e2: ResultadoEscenario2 | null;
  /** Aplica los parámetros vigentes al estudio y calcula con el motor R. */
  onAplicarAlEstudio?: () => void;
  calculando?: boolean;
}) {
  const parametros = useMotorStore((s) => s.decisiones.parametros);
  const tocado = useMotorStore((s) => s.tocado);
  const setParametro = useMotorStore((s) => s.setParametro);
  const resetCanon = useMotorStore((s) => s.resetCanon);
  const escenario = useMotorStore((s) => s.decisiones.escenario);
  const setEscenario = useMotorStore((s) => s.setEscenario);
  const bolsa = useMotorStore((s) => s.decisiones.bolsaExtraPorFacultad);
  const setBolsa = useMotorStore((s) => s.setBolsa);

  if (e1.N === 0) {
    return (
      <div className="rec-cap">
        <p className="rec-chip-ilustrativo">
          El cálculo requiere unidades con población (pestaña Datos) o el proyecto activo con
          estratos sincronizados.
        </p>
      </div>
    );
  }

  const facultadAjustada = perfil.facultades.find((f) => f.id === e1.cuadratura.facultadAjustada);
  const sexoAjustado =
    e1.cuadratura.sexoAjustado === "hombres" ? perfil.etiquetasSexo[1] : perfil.etiquetasSexo[0];

  return (
    <div className="rec-cap rec-diseno">
      <section className="rec-bloque">
        <h3>Tamaño de muestra</h3>
        <FormulaViva
          N={e1.N}
          parametros={parametros}
          canon={perfil.parametros}
          tocado={tocado}
          onParametro={setParametro}
          onReset={resetCanon}
        />
        <div className="rec-ndiseno">
          <label>
            <span>Cifra de diseño (opcional)</span>
            <input
              type="number"
              min={0}
              value={parametros.nDiseno ?? ""}
              placeholder={`despeje: ${fmtInt(e1.nFormula)}`}
              aria-label="Cifra de diseño"
              onChange={(e) => {
                const valor = Math.round(Number(e.target.value));
                setParametro({ nDiseno: Number.isFinite(valor) && valor > 0 ? valor : null });
              }}
            />
          </label>
          <p>
            n operativo fijado por encima del despeje (redondeo conservador). Vacío = usar el
            despeje de la fórmula.
          </p>
          {onAplicarAlEstudio && (
            <button
              type="button"
              className="rec-pie-nav"
              disabled={calculando}
              onClick={onAplicarAlEstudio}
            >
              {calculando ? "Calculando…" : "Aplicar al estudio y calcular (motor R)"}
            </button>
          )}
        </div>
        <NotaPorQue pregunta="Ajuste de cuadratura del reparto">
          El redondeo por celda deja la suma en {fmtInt(e1.cuadratura.sumaRedondeada)}; el faltante
          ({fmtInt(Math.abs(e1.cuadratura.faltante))}) se asigna a la unidad de mayor población
          {facultadAjustada ? ` — ${facultadAjustada.nombre} (${sexoAjustado})` : ""} para cerrar
          exacto en {fmtInt(e1.cuadratura.objetivo)}. Regla determinística: reproducible por
          cualquiera que recalcule.
        </NotaPorQue>
      </section>

      <div className="rec-diseno-lower">
        <section className="rec-bloque rec-diseno-panel">
          <h3>Reserva operativa de cursos-horario</h3>
          <div className="rec-segmented rec-segmented-bolsa" role="radiogroup" aria-label="Bolsa operativa">
            {perfil.bolsaOpciones.map((extra, i) => {
              const letra = String.fromCharCode(65 + i);
              const total = e1.aulasBase + extra * e1.cuotas.length;
              return (
                <button
                  key={extra}
                  type="button"
                  role="radio"
                  aria-checked={bolsa === extra}
                  data-activo={bolsa === extra || undefined}
                  onClick={() => setBolsa(extra)}
                >
                  <strong>{letra} · {extra === 0 ? "sin bolsa" : `+${extra}/${perfil.etiquetaUnidad}`}</strong>
                  <span>{e1.aulasBase > 0 ? fmtInt(total) : "—"} cursos-horario</span>
                  <em>
                    {extra === 0
                      ? "sin margen operativo"
                      : extra === perfil.bolsaOpciones[perfil.bolsaSugerida]
                        ? "margen moderado (sugerida)"
                        : "margen amplio"}
                  </em>
                </button>
              );
            })}
          </div>
          <p className="rec-bloque-sub">
            Cursos-horario adicionales reservados para incidencias de campo. No modifica la muestra (
            {fmtInt(e1.nDiseno)} encuestas) ni la sobremuestra (×{fmtDec(parametros.factorSobremuestra, 1)} ={" "}
            {fmtInt(e1.sobremuestraTotal)}).
          </p>
        </section>

        <section className="rec-bloque rec-diseno-panel">
          <h3>Escenarios</h3>
          <ComparadorEscenarios
            e1={e1}
            e2={e2}
            escenario={escenario}
            onEscenario={setEscenario}
            etiquetaUnidad={perfil.etiquetaUnidad}
          />
        </section>
      </div>
    </div>
  );
}
