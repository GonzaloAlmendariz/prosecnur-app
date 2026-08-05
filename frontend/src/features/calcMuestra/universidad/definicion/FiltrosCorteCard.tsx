/**
 * ADR 0060 · catálogo de filtros de corte de la base histórica.
 *
 * Nota de layout: la tarjeta NO reusa `.cmv2-defi-var-card`. Esa es un grid de
 * cuatro columnas con áreas nombradas (head/select/confirm/detail) pensado para
 * una variable por fila; un filtro tiene cuatro campos y una explicación, así
 * que aquí se apila en bloque con clases propias. Se comparte el lenguaje
 * —estados, filete, confirmación— no la rejilla.
 *
 * Gonzalo: «la declaración de filtros va al inicio, con una lógica parecida a
 * la que ya se tiene para emparejar variables con conceptos, pero esta vez con
 * filtros y condiciones».
 *
 * Es el mismo emparejamiento de `VariableMapCard` con la dirección invertida:
 * allá el rol es fijo y se busca la columna; acá se elige la columna y se le
 * asigna una **clase**. Por eso reusa su lenguaje visual —tarjeta, selector,
 * confirmación explícita— en vez de inventar otro.
 *
 * Lo que el estudio declara es libre: cuántos filtros hay, cómo se llaman, qué
 * columna los produce, qué condición los dispara y en qué orden caen. Lo único
 * cerrado es la clase, porque es lo que el motor interpreta para decidir si ese
 * corte queda dentro o fuera del denominador. Por eso la tarjeta muestra esa
 * consecuencia junto al selector: elegir la clase no es etiquetar, es decidir
 * cómo se cuenta.
 *
 * Vive aquí y no en la pestaña de variables porque esa mapea la base madre y el
 * catálogo de curso-horario; estos filtros pertenecen al instrumento del estudio
 * previo, que llega con esta base.
 */
import { useId } from "react";
import { ArrowDown, ArrowUp, Filter, Plus, X } from "lucide-react";
import type {
  CalcMuestraFiltroCorteDeclarado,
  CalcMuestraReferenciaAsistenciaFiltroClase,
  CalcMuestraWorkspaceSourceBinding,
} from "../../../../api/client";
import { CALC_MUESTRA_FILTRO_CLASES } from "../../../../api/client";

const CLASE_BY_ID = new Map(CALC_MUESTRA_FILTRO_CLASES.map((item) => [item.clase, item]));

function nextId(existentes: CalcMuestraFiltroCorteDeclarado[]): string {
  let n = existentes.length + 1;
  const usados = new Set(existentes.map((item) => item.id));
  while (usados.has(`filtro_${n}`)) n += 1;
  return `filtro_${n}`;
}

/** Las columnas ofrecidas son las de la hoja activa de esta base, no las del marco. */
function columnasDe(binding: CalcMuestraWorkspaceSourceBinding | null): string[] {
  if (!binding) return [];
  const hoja = binding.sheet_name;
  const diagnostics = binding.sheet_diagnostics ?? [];
  const activa = hoja
    ? diagnostics.find((item) => item.name === hoja)
    : diagnostics[0];
  return (activa?.columns_sample ?? []).filter((name) => typeof name === "string" && name.trim());
}

export function FiltrosCorteCard({
  binding,
  filtros,
  onChange,
}: {
  binding: CalcMuestraWorkspaceSourceBinding | null;
  filtros: CalcMuestraFiltroCorteDeclarado[];
  onChange: (next: CalcMuestraFiltroCorteDeclarado[]) => void;
}) {
  const titleId = useId();
  const columnas = columnasDe(binding);
  const ordenados = [...filtros].sort((a, b) => a.orden - b.orden);
  const confirmados = ordenados.filter((item) => item.confirmado).length;

  // El orden es la cascada: cada filtro se evalúa sólo sobre quienes pasaron los
  // anteriores. Reordenar reescribe `orden` para que no queden huecos.
  function reindexar(lista: CalcMuestraFiltroCorteDeclarado[]) {
    onChange(lista.map((item, index) => ({ ...item, orden: index + 1 })));
  }

  function actualizar(id: string, patch: Partial<CalcMuestraFiltroCorteDeclarado>) {
    onChange(ordenados.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function mover(index: number, delta: number) {
    const destino = index + delta;
    if (destino < 0 || destino >= ordenados.length) return;
    const copia = [...ordenados];
    const [movido] = copia.splice(index, 1);
    copia.splice(destino, 0, movido);
    reindexar(copia);
  }

  function agregar() {
    reindexar([
      ...ordenados,
      {
        id: nextId(ordenados),
        etiqueta: "",
        columna: "",
        condicion: "",
        clase: "rechazo",
        origen: "formulario",
        orden: ordenados.length + 1,
        confirmado: false,
      },
    ]);
  }

  return (
    <section
      className="cmv2-defi-filtros"
      data-qa-geometry-group="calc-muestra/definicion-filtros-corte"
      data-qa-geometry-contract="intrinsic"
      data-audit-ready={filtros.length === 0 || confirmados === filtros.length ? "true" : "false"}
      aria-labelledby={titleId}
    >
      <header className="cmv2-defi-filtros-head">
        <div>
          <span className="cmv2-eyebrow">Instrumento del estudio previo</span>
          <h4 id={titleId}>Filtros de corte</h4>
          <p>
            Dónde se cortaba la encuesta y qué significaba cada corte. La clase decide si esas
            personas cuentan como pérdida o salen del denominador.
          </p>
        </div>
        <button type="button" className="cmv2-defi-filtros-add" onClick={agregar}>
          <Plus size={14} aria-hidden="true" />
          Agregar filtro
        </button>
      </header>

      {ordenados.length === 0 ? (
        // C3: el vacío vive dentro de la superficie y dice qué pasa si se deja así.
        <p className="cmv2-defi-filtros-empty" role="status">
          Sin filtros declarados. La base se leerá como si toda respuesta iniciada fuera
          elegible, y las tasas se calcularán sobre ese supuesto.
        </p>
      ) : (
        <ol className="cmv2-defi-filtros-list">
          {ordenados.map((filtro, index) => {
            const meta = CLASE_BY_ID.get(filtro.clase);
            const completo = Boolean(filtro.columna && filtro.condicion && filtro.etiqueta.trim());
            const state = filtro.confirmado
              ? "confirmada"
              : completo
                ? "por-confirmar"
                : "falta";
            return (
              <li key={filtro.id}>
                <article className="cmv2-defi-filtro-card" data-state={state}>
                  <div className="cmv2-defi-filtro-head">
                    <span className="cmv2-defi-filtro-title">
                      <span className="cmv2-defi-filtro-ic" aria-hidden="true">
                        <Filter size={14} />
                      </span>
                      <span className="cmv2-defi-filtros-orden" aria-hidden="true">{index + 1}</span>
                      <input
                        className="cmv2-defi-filtros-label"
                        value={filtro.etiqueta}
                        placeholder="Cómo se llama este corte"
                        aria-label={`Etiqueta del filtro ${index + 1}`}
                        onChange={(event) =>
                          actualizar(filtro.id, { etiqueta: event.target.value, confirmado: false })}
                      />
                    </span>
                    <span className="cmv2-defi-filtro-meta">
                      <span
                        className="cmv2-defi-chip"
                        data-tone={meta?.enDenominador ? "req" : undefined}
                      >
                        {meta?.enDenominador ? "cuenta como pérdida" : "sale del denominador"}
                      </span>
                      <button
                        type="button"
                        className="cmv2-defi-filtros-move"
                        aria-label={`Subir el filtro ${index + 1}`}
                        disabled={index === 0}
                        onClick={() => mover(index, -1)}
                      >
                        <ArrowUp size={13} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="cmv2-defi-filtros-move"
                        aria-label={`Bajar el filtro ${index + 1}`}
                        disabled={index === ordenados.length - 1}
                        onClick={() => mover(index, 1)}
                      >
                        <ArrowDown size={13} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="cmv2-defi-filtros-remove"
                        aria-label={`Quitar el filtro ${index + 1}`}
                        onClick={() => reindexar(ordenados.filter((item) => item.id !== filtro.id))}
                      >
                        <X size={13} aria-hidden="true" />
                      </button>
                    </span>
                  </div>

                  <div className="cmv2-defi-filtros-grid">
                    <label>
                      <small>Columna</small>
                      <select
                        className="cmv2-defi-filtro-input"
                        value={filtro.columna}
                        onChange={(event) =>
                          actualizar(filtro.id, { columna: event.target.value, confirmado: false })}
                      >
                        <option value="">Elige la columna…</option>
                        {filtro.columna && !columnas.includes(filtro.columna) ? (
                          <option value={filtro.columna}>{filtro.columna} (no está en la hoja)</option>
                        ) : null}
                        {columnas.map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <small>Condición que corta</small>
                      <input
                        className="cmv2-defi-filtro-input"
                        value={filtro.condicion}
                        placeholder="p. ej. == 2"
                        onChange={(event) =>
                          actualizar(filtro.id, { condicion: event.target.value, confirmado: false })}
                      />
                    </label>
                    <label>
                      <small>Qué significa</small>
                      <select
                        className="cmv2-defi-filtro-input"
                        value={filtro.clase}
                        onChange={(event) =>
                          actualizar(filtro.id, {
                            clase: event.target.value as CalcMuestraReferenciaAsistenciaFiltroClase,
                            confirmado: false,
                          })}
                      >
                        {CALC_MUESTRA_FILTRO_CLASES.map((item) => (
                          <option key={item.clase} value={item.clase}>{item.label}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <small>De dónde viene</small>
                      <select
                        className="cmv2-defi-filtro-input"
                        value={filtro.origen}
                        onChange={(event) =>
                          actualizar(filtro.id, {
                            origen: event.target.value as "campo" | "formulario",
                            confirmado: false,
                          })}
                      >
                        <option value="formulario">Lo pregunta el formulario</option>
                        <option value="campo">Lo cuenta el aplicador</option>
                      </select>
                    </label>
                  </div>

                  {meta ? <p className="cmv2-defi-filtros-meaning">{meta.detalle}</p> : null}

                  <div className="cmv2-defi-filtro-confirm" data-state={state}>
                    {filtro.confirmado ? (
                      <>
                        <span className="cmv2-defi-filtro-ok">Confirmado</span>
                        <button
                          type="button"
                          className="cmv2-defi-filtro-action"
                          onClick={() => actualizar(filtro.id, { confirmado: false })}
                        >
                          Editar
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="cmv2-defi-filtro-action"
                        disabled={!completo}
                        onClick={() => actualizar(filtro.id, { confirmado: true })}
                      >
                        {completo ? "Confirmar" : "Falta columna, condición o nombre"}
                      </button>
                    )}
                  </div>
                </article>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
