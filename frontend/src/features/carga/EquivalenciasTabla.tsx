// Tabla del editor de equivalencias (ADR 0062, enmienda del editor).
//
// La forma la dicta el Excel que el equipo ya usaba, porque es la que se lee
// bien: una fila por pregunta y los públicos en paralelo. Se lee de corrido y
// se ve de un golpe en cuántos públicos existe cada pregunta.
//
// ADR 0104: la matriz se arma aquí, por la persona. Cada base elige su pregunta
// con un buscador por texto (`PreguntaCombobox`), y la columna «Escala» dice si
// las preguntas elegidas usan la misma lista de respuestas y abre la
// armonización de la fila cuando no.
//
// La lógica vive en `equivalenciasEditorModel` y `preguntaEquivalenteModel`;
// aquí sólo hay render y eventos.

import { CheckCircle2, Check, GitCompareArrows, Minus, Plus, Trash2 } from "../../vendor/lucide-react";
import type { VariableDeBase } from "../../api/equivalencias";
import { variablesTomadas, type FilaEditor } from "./equivalenciasEditorModel";
import { focoDeFila } from "./armonizacionModel";
import { indicadorDeEscala, type IndicadorDeEscala } from "./preguntaEquivalenteModel";
import { PreguntaCombobox } from "./PreguntaCombobox";
import { CoberturaBases } from "./CoberturaBases";
import { nombreDeSerieDeBases, type NombreDeSerie } from "./nombreDeSerie";
import { ANCHO_COLUMNA_ESTADO_PX, anchoColumnaPublico, anchoMinimoLista } from "./equivalenciasAnchos";
import { useDesbordeHorizontal } from "./useDesbordeHorizontal";
import { PulsoButton } from "../../components/PulsoButton";
import { esCompuesta } from "./indicadorCompuestoModel";
import { IndicadorCompuestoCelda } from "./IndicadorCompuestoCelda";
import { AnadirIndicadorCompuestoBoton } from "./IndicadorCompuestoEditor";

export type EquivalenciasTablaProps = {
  bases: string[];
  filas: FilaEditor[];
  variablesPorBase: Record<string, VariableDeBase[]>;
  onAsignar: (filaId: string, base: string, variable: string) => void;
  onEditar: (filaId: string, campo: "etiqueta_estandar" | "seccion", valor: string) => void;
  onQuitar: (filaId: string) => void;
  /** Confirma una propuesta heredada de un `.pulso` anterior (ADR 0104 §5). */
  onConfirmar: (filaId: string) => void;
  onAgregarFila: () => void;
  /** Abre el editor de armonización con el `foco` de la fila. Sin él, no hay columna de escala. */
  onArmonizar?: (foco: string) => void;
  /** ADR 0105: abre el editor del indicador compuesto; sin `foco`, uno nuevo. */
  onIndicadorCompuesto?: (foco?: string) => void;
};

/**
 * Indicador de escala de la fila. Abre la armonización cuando hay dos bases
 * elegidas; una fila sin guardar todavía no tiene a qué referirse y lo dice.
 */
function EscalaDeFila({
  fila,
  bases,
  variablesPorBase,
  serie,
  onArmonizar,
}: {
  fila: FilaEditor;
  bases: readonly string[];
  variablesPorBase: Record<string, VariableDeBase[]>;
  serie: NombreDeSerie;
  onArmonizar: (foco: string) => void;
}) {
  const ind: IndicadorDeEscala = indicadorDeEscala(fila, bases, variablesPorBase, serie);
  const icono = ind.tono === "ok"
    ? <CheckCircle2 size={11} aria-hidden="true" />
    : ind.tono === "aviso"
      ? <GitCompareArrows size={11} aria-hidden="true" />
      : <Minus size={11} aria-hidden="true" />;
  if (!ind.abre) {
    return (
      <span className={`pulso-equiv-escala is-${ind.tono}`} title={ind.explicacion}>
        {icono}
        <span>{ind.texto}</span>
      </span>
    );
  }
  const foco = focoDeFila(fila);
  const nombre = fila.etiqueta_estandar || "esta pregunta";
  return (
    <button
      type="button"
      className={`pulso-equiv-escala is-${ind.tono}`}
      disabled={!foco}
      data-armon-abrir={foco ?? undefined}
      title={foco ? ind.explicacion : `${ind.explicacion} Guarda la fila para poder armonizarla.`}
      aria-label={`${ind.texto}. Abrir la armonización de ${nombre}`}
      onClick={() => foco && onArmonizar(foco)}
    >
      {icono}
      <span>{ind.texto}</span>
    </button>
  );
}

export function EquivalenciasTabla({
  bases,
  filas,
  variablesPorBase,
  onAsignar,
  onEditar,
  onQuitar,
  onConfirmar,
  onAgregarFila,
  onArmonizar,
  onIndicadorCompuesto,
}: EquivalenciasTablaProps) {
  const [marcoRef, desborda] = useDesbordeHorizontal();
  const serie = nombreDeSerieDeBases(bases);
  const minimo = anchoMinimoLista(bases.length);
  return (
    <div className="pulso-equiv-tabla-wrap">
      {/* `table-layout: fixed` con columnas declaradas: el reparto lo decide el
          rol de cada columna y no el texto más largo que traiga una fila. La tabla
          tiene un ancho mínimo que crece con las bases y, si no cabe, el marco
          se vuelve el dueño del desplazamiento horizontal con la etiqueta fija. */}
      <div
        ref={marcoRef}
        className={desborda ? "pulso-equiv-hscroll is-desborda" : "pulso-equiv-hscroll"}
        data-scroll-axis={desborda ? "x" : undefined}
        role={desborda ? "region" : undefined}
        aria-label={desborda ? `Lista de equivalencias, ${bases.length} bases, desplázate a la derecha para ver todas` : undefined}
        tabIndex={desborda ? 0 : undefined}
      >
      <table className="pulso-equiv-tabla" style={{ minWidth: `${minimo}px` }}>
        <colgroup>
          <col />
          {onArmonizar && <col style={{ width: `${ANCHO_COLUMNA_ESTADO_PX}px` }} />}
          {bases.map((base) => (
            <col key={base} style={{ width: anchoColumnaPublico() }} />
          ))}
          <col className="pulso-equiv-col-n" />
          <col className="pulso-equiv-col-acciones" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className="pulso-equiv-col-etiqueta">Nombre estándar</th>
            {onArmonizar && <th scope="col" className="pulso-equiv-col-estado">Escala</th>}
            {bases.map((base) => (
              <th key={base} scope="col">{base}</th>
            ))}
            <th scope="col" className="pulso-equiv-col-n">Bases</th>
            <th scope="col"><span className="pulso-sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, indice) => {
            const contexto = fila.etiqueta_estandar.trim() || `la fila ${indice + 1}`;
            return (
            <tr key={fila.id} className={fila.sugerida ? "is-sugerida" : undefined} data-equiv-fila={fila.id}>
              <td>
                <div className="pulso-equiv-celda-etiqueta">
                  {/* Sólo una matriz de una versión anterior trae propuestas sin
                      confirmar (ADR 0104 §5). La marca va en texto además del
                      color: una propuesta y una decisión no pueden leerse igual. */}
                  {fila.sugerida && (
                    <span className="pulso-equiv-chip-sugerida" title="Viene de una versión anterior y nadie la confirmó: no entra al mazo hasta que la confirmes.">
                      Sin confirmar
                    </span>
                  )}
                  <input
                    value={fila.etiqueta_estandar}
                    title={fila.etiqueta_estandar || undefined}
                    placeholder="Cómo se llama esta pregunta en el informe"
                    aria-label={`Nombre estándar de la fila ${indice + 1}`}
                    onChange={(e) => onEditar(fila.id, "etiqueta_estandar", e.target.value)}
                  />
                </div>
              </td>
              {onArmonizar && (
                <td className="pulso-equiv-col-estado">
                  <EscalaDeFila
                    fila={fila}
                    bases={bases}
                    variablesPorBase={variablesPorBase}
                    serie={serie}
                    onArmonizar={onArmonizar}
                  />
                </td>
              )}
              {bases.map((base) => {
                if (esCompuesta(fila)) {
                  return (
                    <td key={base}>
                      <IndicadorCompuestoCelda
                        fila={fila}
                        base={base}
                        foco={focoDeFila(fila)}
                        contexto={contexto}
                        onEditar={onIndicadorCompuesto}
                      />
                    </td>
                  );
                }
                const valor = fila.variables[base] ?? "";
                const enOtras = new Set(variablesTomadas(filas.filter((f) => f.id !== fila.id), base));
                return (
                  <td key={base}>
                    <PreguntaCombobox
                      base={base}
                      opciones={variablesPorBase[base] ?? []}
                      valor={valor}
                      contexto={contexto}
                      tomadasEnOtraFila={enOtras}
                      onElegir={(v) => onAsignar(fila.id, base, v)}
                    />
                  </td>
                );
              })}
              <td className="pulso-equiv-col-n">
                <CoberturaBases bases={bases} variables={fila.variables} />
              </td>
              <td>
                <div className="pulso-equiv-acciones-fila">
                  {fila.sugerida && (
                    <button
                      type="button"
                      className="pulso-icon"
                      title="Confirmar esta fila"
                      aria-label={`Confirmar ${contexto}`}
                      onClick={() => onConfirmar(fila.id)}
                    >
                      <Check size={12} />
                    </button>
                  )}
                  <button
                    type="button"
                    className="pulso-icon pulso-icon-danger"
                    title="Quitar la fila"
                    aria-label={`Quitar ${contexto}`}
                    onClick={() => onQuitar(fila.id)}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
      </div>

      <div className="pulso-compuesto-acciones-tabla">
        <PulsoButton variant="secondary" className="pulso-equiv-btn" onClick={onAgregarFila}>
          <Plus size={14} aria-hidden="true" />
          Añadir pregunta equivalente
        </PulsoButton>
        {onIndicadorCompuesto && <AnadirIndicadorCompuestoBoton onAbrir={() => onIndicadorCompuesto()} />}
      </div>
    </div>
  );
}
