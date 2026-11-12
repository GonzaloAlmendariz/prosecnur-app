import { useId } from "react";
import { ArrowDown, Check, GitCompare, Pencil, Split, Trash2 } from "../../../../vendor/lucide-react";
import type { OpcionDeEscala, VariableDeBase } from "../../../../api/equivalencias";
import { EstadoVacio } from "../../../../components/EstadoVacio";
import { PanelDeMesa } from "../../../../components/procesamiento/PanelDeMesa";
import { PulsoButton } from "../../../../components/PulsoButton";
import { PulsoInput } from "../../../../components/PulsoInput";
import { focoDeFila } from "../../armonizacionModel";
import { variablesTomadas, type FilaEditor } from "../../equivalenciasEditorModel";
import { IndicadorCompuestoCelda } from "../../IndicadorCompuestoCelda";
import { esCompuesta } from "../../indicadorCompuestoModel";
import { mayuscula } from "../../nombreDeSerie";
import { PreguntaCombobox } from "../../PreguntaCombobox";
import { claveDeFilaCruce } from "../../segmentos/segmentosModel";
import {
  HUECOS_DEL_MOTOR_EQUIVALENCIAS,
  enumerarConY,
  escalasDeFila,
  mapaEnPalabras,
  type FilaDeMesa,
} from "./equivalenciasMesaModel";

function primeraFrase(texto: string): string {
  const fin = texto.indexOf(". ");
  return fin > 0 ? texto.slice(0, fin + 1) : texto;
}

/** Tono de la secuencia de datos (1 a 5) para la posición de una categoría en su escala. */
function tonoDePosicion(i: number, n: number): number {
  return n <= 1 ? 3 : 1 + Math.round((i * 4) / (n - 1));
}

function Escala({ opciones }: { opciones: readonly { codigo: string; etiqueta: string }[] }) {
  return (
    <ol className="pulso-equiv-mesa-escala">
      {opciones.map((o, i) => (
        <li key={o.codigo} data-seq={tonoDePosicion(i, opciones.length)} title={`${o.etiqueta || o.codigo} (${o.codigo})`}>
          {o.etiqueta || o.codigo}
        </li>
      ))}
    </ol>
  );
}

/**
 * La pregunta elegida (prototipo "carga-equivalencias", columna derecha): su
 * escala en cada base y, si está armonizada, la escala común y qué respuestas
 * cambian de categoría; debajo, su nombre en el informe y su pregunta en cada
 * base, que es donde se edita la fila. Al pie, armonizar (abre el editor de
 * armonización, `panel=armonizacion`), confirmar una propuesta y quitar la fila.
 */
export function InspectorDeEquivalencia({
  elegida,
  filas,
  bases,
  variablesPorBase,
  onEditarNombre,
  onAsignar,
  onQuitar,
  onConfirmar,
  onArmonizar,
  onIndicadorCompuesto,
  onSegmento,
}: {
  elegida: FilaDeMesa | null;
  /** Todas las filas de la matriz: una pregunta tomada en otra fila se marca en el buscador. */
  filas: readonly FilaEditor[];
  bases: readonly string[];
  variablesPorBase: Record<string, VariableDeBase[]>;
  onEditarNombre: (id: string, valor: string) => void;
  onAsignar: (id: string, base: string, variable: string) => void;
  onQuitar: (id: string) => void;
  onConfirmar: (id: string) => void;
  onArmonizar: (foco: string) => void;
  onIndicadorCompuesto: (foco?: string) => void;
  onSegmento: (clave: string) => void;
}) {
  const idNombre = useId();
  if (!elegida) {
    return (
      <PanelDeMesa zona="inspector" titulo="Pregunta">
        <EstadoVacio tamano="compacto" icono={<GitCompare size={15} />} titulo={filas.length > 0 ? "Elige una pregunta de la tabla" : "Sin pregunta que mostrar"} />
      </PanelDeMesa>
    );
  }
  const { fila, estado } = elegida;
  const foco = focoDeFila(fila);
  const claveCruce = claveDeFilaCruce(fila);
  const compuesta = esCompuesta(fila);
  const nombre = fila.etiqueta_estandar.trim() || "Sin nombre en el informe";
  const contexto = fila.etiqueta_estandar.trim() || "la fila nueva";
  const escalas = escalasDeFila(fila, bases, variablesPorBase);
  const conLista = escalas.some((e) => e.opciones.length > 0);
  const comun: readonly OpcionDeEscala[] = fila.armonizacion?.escala ?? [];
  const pasos = mapaEnPalabras(fila, escalas);

  const accionEscala = claveCruce !== null ? (
    <PulsoButton variant="primary" size="lg" onClick={() => onSegmento(claveCruce)}>
      <Split size={14} aria-hidden="true" />
      Editar el segmento
    </PulsoButton>
  ) : compuesta ? (
    <PulsoButton variant="primary" size="lg" disabled={!foco} onClick={() => foco && onIndicadorCompuesto(foco)}>
      <Pencil size={14} aria-hidden="true" />
      Editar el indicador
    </PulsoButton>
  ) : estado.abre ? (
    <PulsoButton
      variant={estado.porArmonizar ? "primary" : "secondary"}
      size="lg"
      disabled={!foco}
      title={foco ? undefined : "Guarda la fila para poder armonizarla."}
      onClick={() => foco && onArmonizar(foco)}
    >
      <GitCompare size={14} aria-hidden="true" />
      {comun.length > 0 ? "Editar la escala común" : estado.porArmonizar ? "Armonizar la escala" : "Cambiar la escala"}
    </PulsoButton>
  ) : null;

  return (
    <PanelDeMesa
      zona="inspector"
      titulo={nombre}
      etiquetaCuerpo={`Ficha de ${nombre}`}
      pie={(
        <>
          {accionEscala}
          {fila.sugerida ? (
            <PulsoButton variant="secondary" size="lg" onClick={() => onConfirmar(fila.id)}>
              <Check size={14} aria-hidden="true" />
              Confirmar la fila
            </PulsoButton>
          ) : null}
          {claveCruce === null ? (
            <PulsoButton variant="secondary" size="lg" onClick={() => onQuitar(fila.id)}>
              <Trash2 size={14} aria-hidden="true" />
              Quitar la fila
            </PulsoButton>
          ) : null}
        </>
      )}
    >
      <div
        className="pulso-equiv-mesa-ficha"
        data-qa-geometry-group="carga/equivalencias-ficha"
        data-qa-geometry-contract="intrinsic"
        data-huecos-del-motor={HUECOS_DEL_MOTOR_EQUIVALENCIAS}
      >
        {/* La causa, en su primera frase (qué bases cambian); la explicación entera queda en el `title` del estado. */}
        {estado.porArmonizar ? <p className="pulso-equiv-mesa-causa">{primeraFrase(estado.explicacion)}</p> : null}

        {conLista && !compuesta && claveCruce === null ? (
          <section aria-label="Escala en cada base">
            <h4 className="pulso-equiv-mesa-h">Escala en cada base</h4>
            <div className="pulso-equiv-mesa-escalas">
              {escalas.map((e) => (
                <div key={e.base} className="pulso-equiv-mesa-escala-fila">
                  <b>{mayuscula(e.base)}</b>
                  {!e.variable
                    ? <span className="pulso-equiv-mesa-tenue">No está</span>
                    : e.opciones.length === 0
                      ? <span className="pulso-equiv-mesa-tenue">Sin lista</span>
                      : <Escala opciones={e.opciones} />}
                </div>
              ))}
              {comun.length > 0 ? (
                <>
                  <p className="pulso-equiv-mesa-flecha">
                    <ArrowDown size={14} aria-hidden="true" />
                    Escala común
                  </p>
                  <div className="pulso-equiv-mesa-escala-fila is-comun">
                    <b>En el informe</b>
                    <Escala opciones={comun} />
                  </div>
                </>
              ) : null}
            </div>
            {pasos.length > 0 ? (
              <dl className="pulso-equiv-mesa-dl">
                {pasos.map((p) => (
                  <div key={p.bases.join("|")}>
                    <dt>{enumerarConY(p.bases.map(mayuscula))}</dt>
                    <dd>{p.frase}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </section>
        ) : null}

        <section aria-label="Pregunta en cada base">
          <h4 className="pulso-equiv-mesa-h">Pregunta en cada base</h4>
          <div className="pulso-equiv-mesa-campos" data-qa-geometry-group="carga/equivalencias-campos" data-qa-geometry-contract="intrinsic">
            <div className="pulso-equiv-mesa-campo">
              {claveCruce !== null ? (
                <>
                  <span>Nombre en el informe</span>
                  <span className="pulso-equiv-mesa-fijo">{fila.etiqueta_estandar || "Sin nombre"}</span>
                </>
              ) : (
                <>
                  <label htmlFor={idNombre}>Nombre en el informe</label>
                  <PulsoInput
                    id={idNombre}
                    size="sm"
                    value={fila.etiqueta_estandar}
                    placeholder="Nombre en el informe"
                    onChange={(e) => onEditarNombre(fila.id, e.target.value)}
                  />
                </>
              )}
            </div>
            {bases.map((base) => {
              const enOtras = new Set(variablesTomadas(filas.filter((f) => f.id !== fila.id), base));
              return (
                <div key={base} className="pulso-equiv-mesa-campo">
                  <span>{mayuscula(base)}</span>
                  {claveCruce !== null ? (
                    fila.variables[base]
                      ? <code className="pulso-equiv-mesa-codigo">{fila.variables[base]}</code>
                      : <span className="pulso-equiv-mesa-tenue">Sin origen</span>
                  ) : compuesta ? (
                    <IndicadorCompuestoCelda fila={fila} base={base} foco={foco} contexto={contexto} onEditar={onIndicadorCompuesto} />
                  ) : (
                    <PreguntaCombobox
                      base={base}
                      opciones={variablesPorBase[base] ?? []}
                      valor={fila.variables[base] ?? ""}
                      contexto={contexto}
                      tomadasEnOtraFila={enOtras}
                      onElegir={(v) => onAsignar(fila.id, base, v)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </PanelDeMesa>
  );
}
