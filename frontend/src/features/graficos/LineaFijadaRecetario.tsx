import { useId } from "react";
import { Lock } from "../../vendor/lucide-react";
import type { ArgMetadata } from "../../api/graficos";
import type { WordFijado } from "../../api/graficosWordFijado";
import { notaValorGuardado, rotuloDeArg, textoValorFijado } from "./wordFijado";
import "./lineaFijadaRecetario.css";

/**
 * Un ajuste del Word que fija el recetario: rótulo, lo que sale y por qué, sin control editable. El motivo es la
 * descripción enlazada del grupo (aria-describedby); si el proyecto guarda otro valor, la nota lo dice sin borrarlo.
 */
export function LineaFijadaRecetario({
  fijado,
  meta,
  guardado,
}: {
  fijado: WordFijado;
  /** Metadatos del arg si es arg del preset (rótulo, choices, unidad del catálogo). */
  meta?: ArgMetadata;
  /** Decisión que el proyecto guarda para este arg, si guarda alguna. */
  guardado?: unknown;
}) {
  const id = useId();
  const labelId = `${id}-rotulo`;
  const motivoId = `${id}-motivo`;
  const notaId = `${id}-nota`;
  const nota = notaValorGuardado(fijado, guardado, meta);
  const sinEfecto = fijado.valor === undefined;
  return (
    <div
      className="pulso-gv2-fijado"
      role="group"
      data-arg-name={fijado.arg}
      data-arg-state="fijado"
      data-sin-efecto={sinEfecto}
      aria-labelledby={labelId}
      aria-describedby={nota ? `${motivoId} ${notaId}` : motivoId}
    >
      <span className="pulso-gv2-fijado-cabecera">
        <span id={labelId} className="pulso-gv2-field-title">{rotuloDeArg(fijado.arg, meta)}</span>
        <span className="pulso-gv2-fijado-sello">
          <Lock size={11} aria-hidden="true" />
          Lo fija el recetario
        </span>
      </span>
      <span className={`pulso-gv2-fijado-valor ${sinEfecto ? "is-sin-efecto" : ""}`}>
        <span className="pulso-sr-only">En el Word: </span>
        {textoValorFijado(fijado, meta)}
      </span>
      <span id={motivoId} className="pulso-gv2-fijado-motivo">{fijado.motivo}</span>
      {nota && (
        <span id={notaId} className="pulso-gv2-fijado-nota">{nota}</span>
      )}
    </div>
  );
}

/** Grupo final del editor Word: ajustes que fija el recetario y que no son args de este tipo de gráfico. */
export function GrupoFijadosRecetario({
  fijados,
  guardados,
}: {
  fijados: readonly WordFijado[];
  guardados: Record<string, unknown>;
}) {
  const tituloId = useId();
  if (fijados.length === 0) return null;
  return (
    <section
      className="pulso-gv2-arg-group pulso-gv2-arg-group--section is-open pulso-gv2-fijados-grupo"
      aria-labelledby={tituloId}
      data-qa-geometry-group="graficos/word-fijados-recetario"
      data-qa-geometry-contract="intrinsic"
    >
      <div className="pulso-gv2-arg-group-trigger pulso-gv2-arg-group-header">
        <span className="pulso-gv2-arg-group-main">
          <span className="pulso-gv2-arg-group-icon" aria-hidden="true">
            <Lock size={12} />
          </span>
          <span className="pulso-gv2-arg-group-copy">
            <h4 id={tituloId} className="pulso-gv2-arg-group-label">Lo fija el recetario</h4>
            <span className="pulso-gv2-arg-group-description">
              Ajustes que el Word dibuja siempre igual en este tipo de gráfico.
            </span>
          </span>
        </span>
      </div>
      <div className="pulso-gv2-arg-body">
        {fijados.map((f) => (
          <LineaFijadaRecetario key={f.arg} fijado={f} guardado={guardados[f.arg]} />
        ))}
      </div>
    </section>
  );
}
