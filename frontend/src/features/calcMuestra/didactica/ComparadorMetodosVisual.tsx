/**
 * Comparador didáctico de métodos de selección de aulas: tarjetas lado a
 * lado con las métricas que devolvió el motor R para cada método candidato,
 * resaltando el recomendado. No decide nada por su cuenta: solo traduce el
 * `method_comparison` del backend a lenguaje llano.
 */
import { useMemo } from "react";
import { Award, GitCompare } from "lucide-react";
import type { CalcMuestraAulasMethodComparison } from "../../../api/client";
import { BadgeMotor } from "./PasoDidactico";
import { rowsFrom, rowText, safeNum } from "./didacticaData";

/** Nombre legible + fortaleza/riesgo en llano por método conocido. */
const METODO_COPY: Record<string, { nombre: string; fortaleza: string; riesgo: string }> = {
  cube_balanceado: {
    nombre: "Sorteo balanceado multidimensional",
    fortaleza: "Sortea cuidando que la muestra conserve las proporciones del marco en varias variables a la vez.",
    riesgo: "Necesita variables auxiliares confiables; si vienen sucias, el balance hereda ese ruido.",
  },
  pps_balanceado: {
    nombre: "Sorteo balanceado (alias legacy)",
    fortaleza: "Compatibilidad con proyectos antiguos: se normaliza al mismo método balanceado recomendado.",
    riesgo: "Es solo un alias; conviene migrar la configuración al nombre actual del método.",
  },
  local_pivotal_balanceado: {
    nombre: "Balance con dispersión local",
    fortaleza: "Además del balance, evita que las aulas elegidas se concentren en un mismo programa u horario.",
    riesgo: "Exige buenas variables de dispersión; con marcos pequeños puede sacrificar algo de balance.",
  },
  pool_controlado: {
    nombre: "Sorteo optimizado contra repetidos",
    fortaleza: "Compara muestras candidatas y se queda con la que comparte menos estudiantes entre aulas.",
    riesgo: "Las probabilidades finales dependen de simulación, así que requiere más corridas para auditarse.",
  },
  sistematico_pps: {
    nombre: "Salto sistemático proporcional al tamaño",
    fortaleza: "Simple y transparente: ordena el marco y avanza con un salto fijo, dando más chance a aulas grandes.",
    riesgo: "Si el orden del marco tiene un patrón oculto, el salto puede alinearse con él y sesgar la muestra.",
  },
  estratificado_aleatorio: {
    nombre: "Aleatorio estratificado simple",
    fortaleza: "Fácil de explicar: sorteo puro dentro de cada facultad, sin supuestos adicionales.",
    riesgo: "No controla repetidos ni balancea otras variables; puede quedar menos parejo que los métodos balanceados.",
  },
  manual_auditable: {
    nombre: "Selección manual auditable",
    fortaleza: "Permite una decisión operativa documentada con responsable y motivo registrados.",
    riesgo: "Al no ser un sorteo, pierde la defensa probabilística: úsalo solo como excepción justificada.",
  },
};

function metodoCopy(methodId: string, methodLabel: string) {
  const conocido = METODO_COPY[methodId];
  if (conocido) return conocido;
  const nombre = methodLabel || methodId.replace(/_/g, " ") || "método sin nombre";
  return {
    nombre,
    fortaleza: "Método probabilístico registrado en la bitácora metodológica de la calculadora.",
    riesgo: "Revisa sus métricas frente al recomendado antes de usarlo en campo.",
  };
}

/**
 * Formatea scores tolerando ambas convenciones (0-1 o 0-100), siempre con el
 * mismo formato "N/100" para que un 0 no se lea distinto al resto de tarjetas.
 */
function fmtScore(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const score = value >= 0 && value <= 1 ? value * 100 : value;
  return `${Math.round(score)}/100`;
}

type Metrica = { etiqueta: string; valor: string };

/** Extrae hasta 4 métricas reconocibles del summary, en orden de prioridad. */
function metricasDe(row: Record<string, unknown>): Metrica[] {
  const candidatas: Array<{ etiqueta: string; keys: string[]; formato?: (n: number) => string }> = [
    { etiqueta: "Puntaje global", keys: ["overall_score"] },
    { etiqueta: "Representatividad", keys: ["representativity_score"] },
    { etiqueta: "Balance", keys: ["balance_score"] },
    { etiqueta: "Cobertura", keys: ["coverage_score", "coverage_unique_pct"] },
    { etiqueta: "Repetidos", keys: ["repetition_score"] },
    {
      etiqueta: "Estudiantes repetidos",
      keys: ["repeated_students"],
      formato: (n) => Math.round(n).toLocaleString("es-PE"),
    },
    { etiqueta: "Estabilidad de pesos", keys: ["n_eff_ratio", "reserve_score"] },
  ];
  const out: Metrica[] = [];
  for (const candidata of candidatas) {
    for (const key of candidata.keys) {
      const raw = row[key];
      if (raw === undefined) continue;
      // Campo presente pero vacío (NA del motor serializado como null/""):
      // se muestra "—" en vez de dejar que safeNum lo lea como 0.
      if (raw === null || String(raw).trim() === "") {
        out.push({ etiqueta: candidata.etiqueta, valor: "—" });
        break;
      }
      const n = safeNum(raw, Number.NaN);
      if (Number.isFinite(n)) {
        out.push({ etiqueta: candidata.etiqueta, valor: candidata.formato ? candidata.formato(n) : fmtScore(n) });
        break;
      }
    }
    if (out.length >= 4) break;
  }
  return out;
}

export function ComparadorMetodosVisual({
  comparison,
}: {
  comparison: CalcMuestraAulasMethodComparison | null | undefined;
}) {
  const metodos = useMemo(() => {
    if (!comparison) return [];
    return rowsFrom<Record<string, unknown>>(comparison.methods).map((row) => {
      const methodId = rowText(row, ["method_id"]);
      const copy = metodoCopy(methodId, rowText(row, ["method_label"]));
      return {
        id: methodId,
        nombre: copy.nombre,
        fortaleza: copy.fortaleza,
        riesgo: copy.riesgo,
        metricas: metricasDe(row),
        razonOperativa: rowText(row, ["operational_reason"]),
      };
    });
  }, [comparison]);

  if (!comparison || !metodos.length) return null;
  const recomendadoId = String(comparison.recommendation?.method_id ?? "").trim();

  return (
    <div className="cmv2-did-result">
      <div className="cmv2-did-result-head">
        <span className="cmv2-eyebrow">Dos formas de sortear, medidas con la misma regla</span>
        <BadgeMotor estado="validado" />
      </div>

      <div className="cmv2-did-aulas-methods">
        {metodos.map((metodo) => {
          const esRecomendado = Boolean(recomendadoId) && metodo.id === recomendadoId;
          return (
            <article key={metodo.id || metodo.nombre} className="cmv2-did-aulas-method" data-recomendado={esRecomendado}>
              <header className="cmv2-did-aulas-method-head">
                <strong>{metodo.nombre}</strong>
                {esRecomendado && (
                  <span className="cmv2-did-aulas-method-tag">
                    <Award size={11} aria-hidden="true" />
                    Recomendado
                  </span>
                )}
              </header>
              {metodo.metricas.length > 0 && (
                <dl className="cmv2-did-aulas-method-metrics">
                  {metodo.metricas.map((metrica) => (
                    <div key={metrica.etiqueta} className="cmv2-did-aulas-method-metric">
                      <dt>{metrica.etiqueta}</dt>
                      <dd>{metrica.valor}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <p className="cmv2-did-aulas-method-frase" data-tono="fortaleza">
                <strong>Fortaleza.</strong> {metodo.fortaleza}
              </p>
              <p className="cmv2-did-aulas-method-frase" data-tono="riesgo">
                <strong>A vigilar.</strong> {metodo.riesgo}
              </p>
            </article>
          );
        })}
      </div>

      <p className="cmv2-did-note">
        <GitCompare size={12} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: 4 }} />
        Los métodos comparados son probabilísticos y auditables: cada aula entra con una probabilidad conocida y
        registrada, y la corrida completa puede reproducirse con la misma semilla. La recomendación no es una
        regla universal — sale de medir cada método contra este marco concreto (su tamaño, sus facultades, sus
        repetidos) y puede cambiar en otro proyecto.
      </p>
    </div>
  );
}
