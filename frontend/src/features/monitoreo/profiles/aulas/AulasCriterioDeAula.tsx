import { useState } from "react";

import { Target } from "../../../../vendor/lucide-react";

/**
 * Qué es un aula válida en este estudio.
 *
 * Hasta aquí la app no lo sabía: se lo creía al Excel. El equipo escribía su
 * veredicto en la hoja y la aplicación lo repetía, así que **el criterio no era
 * de nadie que estuviera mirando la pantalla**. Gonzalo: «ni siquiera hemos
 * definido si un aula es válida al 70 % o no».
 *
 * La vara buena no es una proporción igual para todas: es **lo que el diseño
 * esperaba de esa aula**. El cálculo de muestra publica `efectivas_esperadas`
 * por curso-horario —de 5,8 a 34,8 en el marco 2026— y aquí sólo se declara qué
 * parte de ese esperado se acepta como suficiente.
 *
 * Va junto al veredicto que produce, no en una pantalla de ajustes: una vara
 * declarada lejos de su resultado es una vara que nadie sabe cuál es.
 */

const fmtPct = (v: number) => `${Math.round(v * 100)} %`;

export type CriterioDeAula = {
  modo?: "esperado" | "proporcion" | string;
  alfa?: number;
  umbral?: number;
  exige?: string;
} | null;

export function AulasCriterioDeAula({ criterio, hayMetas, onGuardar }: {
  criterio: CriterioDeAula;
  /**
   * Cuántas aulas del plan traen meta DEL DISEÑO, leída de `meta_origen`.
   * Sin ellas el modo no juzga ninguna.
   */
  hayMetas: number;
  onGuardar: (valor: { modo: string; alfa: number }) => Promise<void> | void;
}) {
  const declarado = criterio?.modo === "esperado" && typeof criterio.alfa === "number";
  const [abierto, setAbierto] = useState(false);
  const [alfa, setAlfa] = useState(declarado ? Math.round((criterio!.alfa ?? 0.8) * 100) : 80);
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    setGuardando(true);
    try {
      await onGuardar({ modo: "esperado", alfa: alfa / 100 });
      setAbierto(false);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="aulas-criterio">
      <p className="aulas-criterio-linea">
        <Target size={13} aria-hidden="true" />
        {declarado ? (
          <>
            Un aula cumple con el <strong>{fmtPct(criterio!.alfa ?? 0)}</strong> de
            lo que el diseño esperaba de ella.
          </>
        ) : (
          <>
            {/* No se inventa un valor por defecto: decir «70 %» aquí sería poner
                una vara que nadie eligió, que es justo lo que se viene a
                corregir. */}
            Este estudio <strong>no ha declarado</strong> qué es un aula válida:
            lo que se ve abajo es el veredicto que el equipo escribió en su Excel.
          </>
        )}
        <button type="button" onClick={() => setAbierto((v) => !v)} className="aulas-criterio-boton">
          {abierto ? "Cerrar" : declarado ? "Cambiar" : "Declararlo"}
        </button>
      </p>
      {abierto ? (
        <div className="aulas-criterio-form">
          <label>
            <span>Se acepta desde el</span>
            <input
              type="number" min={1} max={100} step={5} value={alfa}
              onChange={(e) => setAlfa(Math.max(1, Math.min(100, Number(e.target.value) || 0)))}
            />
            <span>% de lo esperado</span>
          </label>
          <button type="button" onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar criterio"}
          </button>
          {/* La condición para que el criterio sirva de algo, dicha antes de
              guardarlo y no después: sin meta del diseño el aula no se juzga. */}
          {/* Ya se puede decir «del diseño» con evidencia: el plan trae
              `meta_origen` por fila —lo escribe el cálculo de muestra junto a
              `efectivas_esperadas`— en vez de que esta pantalla lo infiera
              comparando la meta con los elegibles, que es lo que daba 267 aulas
              «del diseño» en un fixture donde ninguna sale de un cálculo. */}
          <p className="mon-profile-muted">
            Se compara con lo que el diseño esperaba de cada curso-horario
            (`efectivas_esperadas` del cálculo de muestra).{" "}
            {hayMetas > 0
              ? `${hayMetas} aulas del plan la traen; las que no, quedarán sin juzgar.`
              : "Ninguna aula del plan la trae, así que este criterio no podría juzgar ninguna: el plan tiene que venir del cálculo de muestra."}
          </p>
        </div>
      ) : null}
    </div>
  );
}
