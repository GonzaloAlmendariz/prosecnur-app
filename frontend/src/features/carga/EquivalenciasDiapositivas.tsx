// Vista de diapositivas del editor de equivalencias (ADR 0064).
//
// La declaración se lee agrupada por diapositiva del informe, que es la unidad
// que el analista decide y la que Gráficos convierte en el mazo. La tabla plana
// mostraba las 153 filas seguidas: la agrupación —lo que gobierna el mazo— sólo
// se veía generando el PPT.
//
// Los avisos de invariante NO son errores: describen el estado de la
// diapositiva. Una escala divergente puede ser un hallazgo del estudio, y dos
// escalas en una diapositiva sólo significan que saldrá apilada. Pintarlos de
// alerta enseñaba un problema donde muchas veces sólo hay una descripción.
//
// Cada tarjeta pone la escala UNA vez en su cabecera en lugar de repetirla por
// fila, que es lo que permite leer las invariantes E1/E2 sin buscarlas.
//
// La lógica (agrupar, escalas, invariantes) vive en `equivalenciasEditorModel`;
// aquí sólo hay render y eventos.

import { useState } from "react";
import { Check, Info, Layers, Plus, Sparkles, Trash2 } from "../../vendor/lucide-react";
import type { VariableDeBase } from "../../api/equivalencias";
import type { CampoFila, CatalogoEscalas, FilaEditor, DiapositivaEditor } from "./equivalenciasEditorModel";
import { escalaDeFila } from "./equivalenciasEditorModel";
import { EscalaChip } from "./EscalaChip";

export type EquivalenciasDiapositivasProps = {
  bases: string[];
  diapositivas: DiapositivaEditor[];
  catalogo: CatalogoEscalas;
  variablesPorBase: Record<string, VariableDeBase[]>;
  onEditarFila: (filaId: string, campo: CampoFila, valor: string) => void;
  onEditarDiapositiva: (clave: string, campo: CampoFila, valor: string) => void;
  onAsignar: (filaId: string, base: string, variable: string) => void;
  onQuitar: (filaId: string) => void;
  onConfirmar: (filaId: string) => void;
  onAgregarTema: (clave: string) => void;
};

/**
 * Cuántos temas con escala divergente se nombran uno por uno antes de resumir el
 * resto. Nombrar los tres primeros resuelve el caso normal; nombrar veinte
 * convertiría la tarjeta en un informe y taparía sus temas.
 */
const MAX_AVISOS_TEMA = 3;

/** «docentes, egresados y estudiantes». El separador final en palabras evita que
 *  una lista de públicos se lea como parte del nombre de la escala. */
function listar(bases: readonly string[]): string {
  if (bases.length <= 1) return bases[0] ?? "";
  return `${bases.slice(0, -1).join(", ")} y ${bases[bases.length - 1]}`;
}


/** Celda de variable. El `<select>` sólo se monta al editar: con 153 temas por
 *  4 públicos, montarlos todos mete decenas de miles de `<option>` en el DOM y
 *  la pestaña tarda en responder al primer clic. */
function CeldaVariable({
  valor,
  opciones,
  activa,
  onActivar,
  onCerrar,
  onElegir,
  etiqueta,
}: {
  valor: string;
  opciones: VariableDeBase[];
  activa: boolean;
  onActivar: () => void;
  onCerrar: () => void;
  onElegir: (v: string) => void;
  etiqueta: string;
}) {
  if (!activa) {
    return (
      <button
        type="button"
        className={valor ? "pulso-equiv-var" : "pulso-equiv-var is-vacia"}
        onClick={onActivar}
        aria-label={etiqueta}
      >
        {valor || "—"}
      </button>
    );
  }
  return (
    <select
      autoFocus
      value={valor}
      aria-label={etiqueta}
      onBlur={onCerrar}
      onChange={(e) => {
        onElegir(e.target.value);
        onCerrar();
      }}
    >
      <option value="">—</option>
      {opciones.map((v) => (
        <option key={v.name} value={v.name}>
          {v.name} · {v.label.slice(0, 70)}
        </option>
      ))}
    </select>
  );
}

export function EquivalenciasDiapositivas({
  bases,
  diapositivas,
  catalogo,
  variablesPorBase,
  onEditarFila,
  onEditarDiapositiva,
  onAsignar,
  onQuitar,
  onConfirmar,
  onAgregarTema,
}: EquivalenciasDiapositivasProps) {
  const [editando, setEditando] = useState<{ filaId: string; base: string } | null>(null);

  return (
    <div className="pulso-equiv-diapositivas">
      {diapositivas.map((diapo) => {
        const sinDiapositiva = diapo.clave === "";
        return (
          <section
            key={diapo.clave || "__sin__"}
            className={sinDiapositiva ? "pulso-equiv-diapositiva is-pendiente" : "pulso-equiv-diapositiva"}
            data-qa-geometry-group="carga-equivalencias-diapositiva"
            data-qa-geometry-contract="intrinsic"
            aria-label={sinDiapositiva ? "Temas sin diapositiva" : `Diapositiva ${diapo.clave}`}
          >
            <header className="pulso-equiv-diapositiva-head">
              <div className="pulso-equiv-diapositiva-id">
                <Layers size={14} aria-hidden="true" />
                <span>{sinDiapositiva ? "Sin diapositiva" : diapo.clave}</span>
              </div>

              <div className="pulso-equiv-diapositiva-texto">
                {sinDiapositiva ? (
                  // C5: el vacío de este grupo dice qué es y qué falta, en vez de
                  // parecer una diapositiva más que salió mal.
                  <p className="pulso-equiv-diapositiva-nota">
                    Estos temas están declarados pero no van a ninguna diapositiva, así que
                    no entran al mazo. Escríbeles una diapositiva para agruparlos.
                  </p>
                ) : (
                  <input
                    className="pulso-equiv-enunciado"
                    value={diapo.enunciado}
                    placeholder="¿Qué pregunta hace esta diapositiva? — será su título"
                    aria-label={`Enunciado de la diapositiva ${diapo.clave}`}
                    onChange={(e) => onEditarDiapositiva(diapo.clave, "enunciado", e.target.value)}
                  />
                )}
                {diapo.seccion && <span className="pulso-equiv-seccion">{diapo.seccion}</span>}
              </div>

              <div className="pulso-equiv-diapositiva-meta">
                <EscalaChip
                  texto={diapo.escalaTexto}
                  opciones={diapo.escalaOpciones}
                  contexto={sinDiapositiva ? "estos temas" : `la diapositiva ${diapo.clave}`}
                />
                <span className="pulso-equiv-chip-n">
                  {diapo.filas.length} {diapo.filas.length === 1 ? "tema" : "temas"}
                </span>
              </div>
            </header>

            {/* Las invariantes describen una diapositiva, así que no se evalúan
                sobre el grupo de lo que aún no tiene una. Ahí decían «reúne 14
                escalas: saldrá apilada» sobre algo que no va a salir, y «no
                entra al mazo» por la escala cuando lo que lo deja fuera es no
                tener diapositiva. */}
            {!sinDiapositiva &&
              (diapo.escalas.length > 1 ||
                diapo.temasEscalaRota.length > 0 ||
                diapo.etiquetasRepetidas.length > 0) && (
              <div className="pulso-equiv-avisos">
                {diapo.temasEscalaRota.slice(0, MAX_AVISOS_TEMA).map((tema, i) => (
                  <p className="pulso-equiv-aviso-caja" key={`escala-${i}`}>
                    <Info size={13} aria-hidden="true" />
                    <span>
                      <strong>«{tema.etiqueta}»</strong> no comparte escala:{" "}
                      {tema.porFirma.map((e) => `${e.texto} en ${listar(e.bases)}`).join("; ")}
                      . No entra al mazo.
                    </span>
                  </p>
                ))}

                {diapo.temasEscalaRota.length > MAX_AVISOS_TEMA && (
                  <p className="pulso-equiv-aviso-caja">
                    <Info size={13} aria-hidden="true" />
                    <span>
                      Otros {diapo.temasEscalaRota.length - MAX_AVISOS_TEMA} temas de esta
                      diapositiva tampoco comparten escala entre públicos.
                    </span>
                  </p>
                )}

                {diapo.escalas.length > 1 && (
                  <p className="pulso-equiv-aviso-caja">
                    <Info size={13} aria-hidden="true" />
                    <span>
                      Reúne {diapo.escalas.length} escalas
                      ({diapo.escalas.filter(Boolean).join(" · ")}): el gráfico saldrá apilado
                      en un bloque por escala.
                    </span>
                  </p>
                )}

                {diapo.etiquetasRepetidas.map((rep) => (
                  <p className="pulso-equiv-aviso-caja" key={`repetida-${rep.etiqueta}`}>
                    <Info size={13} aria-hidden="true" />
                    <span>
                      <strong>«{rep.etiqueta}»</strong> nombra {rep.veces} temas de esta
                      diapositiva: saldrían {rep.veces} barras con el mismo nombre.
                    </span>
                  </p>
                ))}
              </div>
            )}

            <table className="pulso-equiv-diapositiva-tabla">
              <thead>
                <tr>
                  <th scope="col" className="pulso-equiv-col-etiqueta">Tema</th>
                  {bases.map((base) => (
                    <th key={base} scope="col">{base}</th>
                  ))}
                  <th scope="col" className="pulso-equiv-col-cob">Públicos</th>
                  <th scope="col" className="pulso-equiv-col-diapo">Diapositiva</th>
                  <th scope="col"><span className="pulso-sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {diapo.filas.map((fila: FilaEditor) => {
                  const esc = escalaDeFila(fila, catalogo);
                  return (
                    <tr
                      key={fila.id}
                      className={
                        [fila.sugerida ? "is-sugerida" : "", esc.rota ? "is-escala-rota" : ""]
                          .filter(Boolean)
                          .join(" ") || undefined
                      }
                    >
                      <td>
                        <div className="pulso-equiv-celda-etiqueta">
                          {fila.sugerida && (
                            <span
                              className="pulso-equiv-chip-sugerida"
                              title="Propuesta del sistema: revísala y confírmala"
                            >
                              <Sparkles size={11} aria-hidden="true" />
                              Propuesta
                            </span>
                          )}
                          <input
                            value={fila.etiqueta_estandar}
                            placeholder="Nombre corto de la barra"
                            aria-label={`Etiqueta del tema ${fila.id}`}
                            onChange={(e) =>
                              onEditarFila(fila.id, "etiqueta_estandar", e.target.value)
                            }
                          />
                        </div>
                      </td>

                      {bases.map((base) => (
                        <td key={base}>
                          <CeldaVariable
                            valor={fila.variables[base] ?? ""}
                            opciones={variablesPorBase[base] ?? []}
                            activa={editando?.filaId === fila.id && editando?.base === base}
                            onActivar={() => setEditando({ filaId: fila.id, base })}
                            onCerrar={() => setEditando(null)}
                            onElegir={(v) => onAsignar(fila.id, base, v)}
                            etiqueta={`Variable de ${base} en ${fila.etiqueta_estandar || "el tema"}`}
                          />
                        </td>
                      ))}

                      <td className="pulso-equiv-col-cob">
                        {/* Puntos y no un cociente: «3/4» dice cuántos faltan y nunca
                            cuál. La posición fija del punto responde eso de un vistazo. */}
                        <span
                          className="pulso-equiv-dots"
                          title={bases
                            .filter((b) => fila.variables[b])
                            .join(" · ") || "ningún público"}
                        >
                          {bases.map((b) => (
                            <i
                              key={b}
                              className={fila.variables[b] ? "is-on" : "is-off"}
                              aria-hidden="true"
                            />
                          ))}
                          <span className="pulso-sr-only">
                            {bases.filter((b) => fila.variables[b]).length} de {bases.length} públicos
                          </span>
                        </span>
                      </td>

                      <td className="pulso-equiv-col-diapo">
                        <input
                          className="pulso-equiv-input-diapo"
                          value={fila.diapositiva ?? ""}
                          placeholder="—"
                          aria-label={`Mover ${fila.etiqueta_estandar || "el tema"} a otra diapositiva`}
                          onChange={(e) => onEditarFila(fila.id, "diapositiva", e.target.value)}
                        />
                      </td>

                      <td>
                        <div className="pulso-equiv-acciones-fila">
                          {fila.sugerida && (
                            <button
                              type="button"
                              className="pulso-icon"
                              title="Confirmar esta propuesta"
                              aria-label="Confirmar propuesta"
                              onClick={() => onConfirmar(fila.id)}
                            >
                              <Check size={12} />
                            </button>
                          )}
                          <button
                            type="button"
                            className="pulso-icon pulso-icon-danger"
                            title="Quitar el tema"
                            aria-label="Quitar tema"
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

            <button
              type="button"
              className="pulso-equiv-add-tema"
              onClick={() => onAgregarTema(diapo.clave)}
            >
              <Plus size={13} aria-hidden="true" />
              Añadir tema a esta diapositiva
            </button>
          </section>
        );
      })}
    </div>
  );
}
