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

import { useEffect, useState } from "react";
import { Check, Info, Layers, Plus, Sparkles, Trash2 } from "../../vendor/lucide-react";
import type { VariableDeBase } from "../../api/equivalencias";
import type { CampoFila, CatalogoEscalas, FilaEditor, DiapositivaEditor } from "./equivalenciasEditorModel";
import { escalaDeFila, resumenEscala } from "./equivalenciasEditorModel";
import { EscalaChip } from "./EscalaChip";
import { BloqueGrafico } from "./BloqueGrafico";

export type EquivalenciasDiapositivasProps = {
  bases: string[];
  diapositivas: DiapositivaEditor[];
  catalogo: CatalogoEscalas;
  variablesPorBase: Record<string, VariableDeBase[]>;
  onEditarFila: (filaId: string, campo: CampoFila, valor: string) => void;
  onEditarDiapositiva: (clave: string, campo: CampoFila, valor: string) => void;
  /** Escribe un campo en todas las filas de un bloque (gráfico y corte). */
  onEditarBloque: (ids: string[], campo: CampoFila, valor: string) => void;
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


/**
 * Campo que sólo se ve cuando dice algo. Vacío es una acción discreta —«Añadir
 * enunciado»— y no un recuadro esperando texto.
 *
 * La diferencia importa a escala: con 44 diapositivas sin enunciado, la vista
 * eran 44 recuadros vacíos con el mismo texto gris repetido, y la columna de
 * diapositiva eran 157 celdas diciendo «—». Nada de eso informaba de nada, y
 * tapaba lo que sí: la etiqueta y los códigos por público.
 *
 * Alcanzable siempre: un clic —o el foco de teclado— lo convierte en input.
 */
function CampoEditable({
  valor,
  vacio,
  onCambiar,
  className,
  etiqueta,
}: {
  valor: string;
  vacio: string;
  onCambiar: (v: string) => void;
  className: string;
  etiqueta: string;
}) {
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState(valor);

  // El valor puede cambiar por fuera —editar el enunciado de la diapositiva lo
  // escribe en todas sus filas— y el borrador tiene que seguirlo mientras no se
  // esté editando aquí.
  useEffect(() => {
    if (!editando) setBorrador(valor);
  }, [valor, editando]);

  if (!editando) {
    return (
      <button
        type="button"
        className={valor ? className : `${className} is-vacio`}
        aria-label={etiqueta}
        onClick={() => setEditando(true)}
      >
        {valor || vacio}
      </button>
    );
  }

  return (
    <input
      autoFocus
      className={className}
      value={borrador}
      aria-label={etiqueta}
      onChange={(e) => setBorrador(e.target.value)}
      onBlur={() => {
        setEditando(false);
        if (borrador !== valor) onCambiar(borrador);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setBorrador(valor);
          setEditando(false);
        }
      }}
    />
  );
}

/**
 * Celda de variable. Escribe para buscar en vez de recorrer la lista.
 *
 * Era un `<select>` con las 102 variables de la base: para poner `p13_1` había
 * que reconocerla entre cien hermanas ordenadas por el formulario. Ahora es un
 * campo con `list=`, que filtra por código o por etiqueta mientras escribes —el
 * mismo gesto que el desplegable del Excel, y por el mismo motivo.
 *
 * El `<datalist>` se monta UNA vez por base y lo comparten todas las celdas: con
 * 153 temas por 4 públicos, montar uno por celda serían decenas de miles de
 * `<option>` y la pestaña tardaría en responder al primer clic.
 *
 * Sólo se acepta un código que exista en esa base. Un código de otro público
 * escrito aquí es el error que ninguna validación posterior distingue bien de
 * una decisión, porque `p13_1` existe en las cuatro y significa cosas distintas.
 */
function CeldaVariable({
  valor,
  opciones,
  listaId,
  activa,
  onActivar,
  onCerrar,
  onElegir,
  etiqueta,
}: {
  valor: string;
  opciones: VariableDeBase[];
  listaId: string;
  activa: boolean;
  onActivar: () => void;
  onCerrar: () => void;
  onElegir: (v: string) => void;
  etiqueta: string;
}) {
  const [borrador, setBorrador] = useState(valor);

  useEffect(() => {
    if (activa) setBorrador(valor);
  }, [activa, valor]);

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

  const confirmar = () => {
    const limpio = borrador.trim();
    // Vaciar la celda es una decisión válida —esta pregunta no existe en este
    // público— y por eso el vacío se acepta igual que un código.
    if (!limpio) {
      if (valor) onElegir("");
      onCerrar();
      return;
    }
    if (opciones.some((v) => v.name === limpio)) {
      if (limpio !== valor) onElegir(limpio);
      onCerrar();
      return;
    }
    // Lo que no existe en esta base no entra: se descarta y la celda vuelve a lo
    // que decía.
    setBorrador(valor);
    onCerrar();
  };

  return (
    <input
      autoFocus
      list={listaId}
      className="pulso-equiv-var-input"
      value={borrador}
      placeholder="buscar…"
      aria-label={etiqueta}
      onChange={(e) => setBorrador(e.target.value)}
      onBlur={confirmar}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setBorrador(valor);
          onCerrar();
        }
      }}
    />
  );
}

export function EquivalenciasDiapositivas({
  bases,
  diapositivas,
  catalogo,
  variablesPorBase,
  onEditarFila,
  onEditarDiapositiva,
  onEditarBloque,
  onAsignar,
  onQuitar,
  onConfirmar,
  onAgregarTema,
}: EquivalenciasDiapositivasProps) {
  const [editando, setEditando] = useState<{ filaId: string; base: string } | null>(null);

  return (
    <div className="pulso-equiv-diapositivas">
      {/* Un `datalist` por base, compartido por todas sus celdas. Montarlo por
          celda serían decenas de miles de `<option>` en el DOM. */}
      {bases.map((base) => (
        <datalist key={base} id={`pulso-equiv-vars-${base}`}>
          {(variablesPorBase[base] ?? []).map((v) => (
            <option key={v.name} value={v.name}>
              {v.label.slice(0, 80)}
            </option>
          ))}
        </datalist>
      ))}

      {diapositivas.map((diapo) => {
        const sinDiapositiva = diapo.clave === "";
        const filaTr = (fila: FilaEditor) => {
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
                            listaId={`pulso-equiv-vars-${base}`}
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
                          {/* Mover es una ACCION, no un dato: la diapositiva ya
                              está en la esquina de la tarjeta y repetirla en
                              cada fila no decía nada. El campo arranca vacío y
                              pide el destino. */}
                          <CampoEditable
                            className="pulso-equiv-mover"
                            valor=""
                            vacio="mover"
                            etiqueta={`Mover ${fila.etiqueta_estandar || "el tema"} a otra diapositiva`}
                            onCambiar={(v) => {
                              const destino = v.trim();
                              if (destino) onEditarFila(fila.id, "diapositiva", destino);
                            }}
                          />
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
        };

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
                  <CampoEditable
                    className="pulso-equiv-enunciado"
                    valor={diapo.enunciado}
                    vacio="Añadir enunciado"
                    etiqueta={`Enunciado de la diapositiva ${diapo.clave} — será su título`}
                    onCambiar={(v) => onEditarDiapositiva(diapo.clave, "enunciado", v)}
                  />
                )}
                {diapo.seccion && <span className="pulso-equiv-seccion">{diapo.seccion}</span>}
              </div>

              <div className="pulso-equiv-diapositiva-meta">
                {/* La escala NO vive aquí: vive en cada bloque. Una diapositiva
                    que junta «¿Conoce?» con la satisfacción tiene dos escalas
                    con categorías distintas, y anunciar «la escala de la
                    diapositiva» era decir la de uno y callar la del otro. */}
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
              (diapo.bloques.length > 1 ||
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

                {diapo.bloques.length > 1 && (
                  <p className="pulso-equiv-aviso-caja">
                    <Info size={13} aria-hidden="true" />
                    <span>
                      Reúne {diapo.bloques.length} escalas distintas: el gráfico saldrá
                      apilado, un bloque por escala. Cada bloque tiene sus propias
                      categorías — ábrelas en su chip.
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

            {/* UNA tabla por tarjeta, con los bloques como `tbody`.
                Antes cada bloque montaba su propia tabla: repetía la cabecera de
                públicos y, sobre todo, cada tabla calculaba sus anchos por su
                cuenta, así que las columnas de un bloque no caían donde las del
                bloque de arriba. Con una sola tabla hay un único modelo de
                columnas y todo queda alineado. */}
            <table className="pulso-equiv-diapositiva-tabla">
              <thead>
                <tr>
                  <th scope="col" className="pulso-equiv-col-etiqueta">Tema</th>
                  {bases.map((base) => (
                    <th key={base} scope="col">{base}</th>
                  ))}
                  <th scope="col" className="pulso-equiv-col-cob">Públicos</th>
                  <th scope="col"><span className="pulso-sr-only">Acciones</span></th>
                </tr>
              </thead>

              {/* El bloque agrupa por escala y es lo que el render apila. En el
                  grupo de lo que aún no tiene diapositiva no hay apilado que
                  anticipar, así que ahí no se parte: eran 16 cajas sobre 300
                  temas sin emparejar que no decían nada. */}
              {sinDiapositiva ? (
                <tbody>{diapo.filas.map(filaTr)}</tbody>
              ) : (
                diapo.bloques.map((bloque, bi) => (
                  <tbody
                    className={diapo.bloques.length > 1
                      ? "pulso-equiv-bloque is-partido"
                      : "pulso-equiv-bloque"}
                    key={`bloque-${bi}`}
                  >
                    <tr className="pulso-equiv-bloque-head">
                      <td colSpan={bases.length + 3}>
                        <EscalaChip
                          texto={resumenEscala(bloque.opciones)}
                          opciones={bloque.opciones}
                          contexto={
                            diapo.bloques.length > 1
                              ? `el bloque ${bi + 1} de la diapositiva ${diapo.clave}`
                              : `la diapositiva ${diapo.clave}`
                          }
                        />
                        {diapo.bloques.length > 1 && (
                          <span className="pulso-equiv-bloque-n">
                            bloque {bi + 1} de {diapo.bloques.length} · {bloque.filas.length}
                            {bloque.filas.length === 1 ? " tema" : " temas"}
                          </span>
                        )}
                        <BloqueGrafico
                          bloque={bloque}
                          onCambiar={(campo, valor) =>
                            onEditarBloque(bloque.filas.map((f) => f.id), campo, valor)
                          }
                        />
                      </td>
                    </tr>
                    {bloque.filas.map(filaTr)}
                  </tbody>
                ))
              )}
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
