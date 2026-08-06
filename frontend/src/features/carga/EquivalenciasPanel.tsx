// Equivalencias entre públicos (ADR 0062).
//
// Declara qué pregunta de un público es la misma que la de otro. Sin esa tabla,
// comparar públicos depende de la memoria del analista frente a un selector que
// muestra la misma etiqueta —«Servicio de salud»— para tres preguntas distintas,
// y el error no da ninguna señal: en el PPT medido, un grupo comparaba «¿Conoce
// bienestar psicológico?» de docentes contra «¿Ha utilizado…?» de estudiantes,
// 90 % contra 31 %.
//
// La superficie tiene dos entradas deliberadas y en este orden: generar la
// plantilla poblada (la vía principal del ADR) y subir una ya escrita.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCheck,
  CheckCircle2,
  Download,
  GitCompare,
  Layers,
  Save,
  Sparkles,
  Upload,
} from "../../vendor/lucide-react";
import {
  generarPlantillaEquivalencias,
  getEquivalencias,
  getSugerenciasEquivalencias,
  getVariablesEquivalencias,
  guardarEquivalencias,
  importarEquivalencias,
  type EquivalenciasEstado,
  type EquivalenciasImportacion,
  type VariableDeBase,
} from "../../api/equivalencias";
import { EquivalenciasTabla } from "./EquivalenciasTabla";
import { EquivalenciasDiapositivas } from "./EquivalenciasDiapositivas";
import {
  aFilasEditor,
  agruparEnDiapositivas,
  agruparPorBateria,
  asignarVariable,
  catalogoEscalas,
  confirmarFila,
  confirmarTodas,
  editarCampo,
  editarCampoDeDiapositiva,
  filaVacia,
  filasParaGuardar,
  incorporarSugerencias,
  quitarFila,
  resumenEditor,
  type FilaEditor,
} from "./equivalenciasEditorModel";
import { apiUpload } from "../../api/estudio";
import { downloadUrl } from "../../api/core";
import "./EquivalenciasPanel.css";

export type EquivalenciasPanelProps = {
  /**
   * Reporta cuántas preguntas hay declaradas, no cuántas veces se importó. El
   * chip de la pestaña decía «1 pregunta emparejada» tras subir una matriz de
   * 300 filas porque contaba importaciones.
   */
  onDeclaradas?: (n: number) => void;
};

function resumenAplicacion(imp: EquivalenciasImportacion): {
  aplicadas: number;
  conservadas: number;
} {
  return Object.values(imp.aplicacion ?? {}).reduce(
    (acc, base) => ({
      aplicadas: acc.aplicadas + (base.aplicadas ?? 0),
      conservadas: acc.conservadas + (base.conservadas ?? 0),
    }),
    { aplicadas: 0, conservadas: 0 },
  );
}

export function EquivalenciasPanel({ onDeclaradas }: EquivalenciasPanelProps) {
  const [estado, setEstado] = useState<EquivalenciasEstado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState<"" | "plantilla" | "importar" | "sugerir" | "guardar">("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [filas, setFilas] = useState<FilaEditor[]>([]);
  const [variablesPorBase, setVariablesPorBase] = useState<Record<string, VariableDeBase[]>>({});
  const [sucio, setSucio] = useState(false);
  // Por diapositiva es la vista por defecto (ADR 0064): es el grano en que se decide
  // el mazo. La tabla plana se conserva porque sigue siendo la mejor forma de
  // barrer 150 temas buscando uno.
  const [vista, setVista] = useState<"diapositivas" | "tabla">("diapositivas");

  // ADR 0064 regla 8: la agrupación se PROPONE. Se aplica al editor como una
  // edición más —visible en las tarjetas, revertible sin guardar— y sólo se
  // persiste al pulsar Guardar. Acierta 33 de 44 diapositivas del estudio
  // medido; las baterías largas hay que partirlas a mano, así que ofrecerla como
  // algo que se acepta en bloque sería el error que el ADR 0062 prohíbe.
  const onAgrupar = useCallback(() => {
    setFilas((prev) => {
      const next = agruparPorBateria(prev);
      const nuevas = next.filter(
        (f, i) => (f.diapositiva ?? "") !== (prev[i]?.diapositiva ?? ""),
      ).length;
      setAviso(
        nuevas > 0
          ? `${nuevas} temas agrupados por batería del formulario. Revisa las tarjetas —las baterías largas suelen partirse en varias— y guarda cuando estén bien.`
          : "Todos los temas ya tienen diapositiva.",
      );
      return next;
    });
    setSucio(true);
  }, []);

  const onConfirmarTodas = useCallback(() => {
    setFilas((prev) => {
      const pendientes = prev.filter((f) => f.sugerida).length;
      setAviso(
        pendientes > 0
          ? `${pendientes} propuestas confirmadas. Guarda para que apliquen sus etiquetas y entren al mazo.`
          : "No hay propuestas pendientes.",
      );
      return confirmarTodas(prev);
    });
    setSucio(true);
  }, []);

  const refrescar = useCallback(async () => {
    setCargando(true);
    try {
      const est = await getEquivalencias();
      setEstado(est);
      setFilas(aFilasEditor(est.filas ?? []));
      onDeclaradas?.(est.n_filas ?? 0);
      setSucio(false);
      if (est.disponible) {
        // El catálogo va aparte del estado: son cientos de entradas y el estado
        // se pide en cada montaje.
        const cat = await getVariablesEquivalencias();
        setVariablesPorBase(cat.variables ?? {});
      }
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando(false);
    }
  }, [onDeclaradas]);

  useEffect(() => {
    void refrescar();
  }, [refrescar]);

  const onGenerar = useCallback(async () => {
    setOcupado("plantilla");
    setError("");
    try {
      const out = await generarPlantillaEquivalencias();
      // Mismo camino que el resto de artefactos de la sesión: `downloadUrl`
      // resuelve el prefijo de la API, que en dev no es el origen de la página.
      const url = downloadUrl(out.file_id);
      const a = document.createElement("a");
      a.href = url;
      a.download = out.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setAviso(`Plantilla generada: ${out.filename}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado("");
    }
  }, []);

  const onSubir = useCallback(
    async (file: File) => {
      setOcupado("importar");
      setError("");
      try {
        const subido = await apiUpload(file, "equivalencias");
        const imp = await importarEquivalencias(subido.file_id);
        setEstado(imp.estado);
        // Sin esto la tabla quedaba vacía tras importar y sólo se veía el
        // resumen de cobertura: el trabajo entraba al backend y no se podía
        // seguir editando en pantalla.
        setFilas(aFilasEditor(imp.estado.filas ?? []));
        setSucio(false);
        onDeclaradas?.(imp.estado.n_filas ?? 0);
        const { aplicadas, conservadas } = resumenAplicacion(imp);
        setAviso(
          conservadas > 0
            ? `${aplicadas} etiquetas aplicadas. ${conservadas} se conservaron porque ya estaban editadas a mano.`
            : `${aplicadas} etiquetas aplicadas en ${imp.estado.bases.length} públicos.`,
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setOcupado("");
      }
    },
    [onDeclaradas],
  );

  const onSugerir = useCallback(async () => {
    setOcupado("sugerir");
    setError("");
    try {
      const { sugerencias } = await getSugerenciasEquivalencias();
      setFilas((prev) => {
        const next = incorporarSugerencias(prev, sugerencias);
        const nuevas = next.length - prev.length;
        setAviso(nuevas > 0
          ? `${nuevas} propuestas añadidas. Revísalas y confírmalas: sin confirmar no se guardan.`
          : "No hay propuestas nuevas que no choquen con lo ya declarado.");
        return next;
      });
      setSucio(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado("");
    }
  }, []);

  const onGuardar = useCallback(async () => {
    setOcupado("guardar");
    setError("");
    try {
      const out = await guardarEquivalencias(filasParaGuardar(filas));
      setEstado(out.estado);
      setFilas(aFilasEditor(out.estado.filas ?? []));
      setSucio(false);
      onDeclaradas?.(out.estado.n_filas ?? 0);
      const { aplicadas, conservadas } = resumenAplicacion(out);
      setAviso(conservadas > 0
        ? `Guardado. ${aplicadas} etiquetas aplicadas, ${conservadas} conservadas por estar editadas a mano.`
        : `Guardado. ${aplicadas} etiquetas aplicadas.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado("");
    }
  }, [filas, onDeclaradas]);

  // El catálogo se indexa una vez y no en cada fila: son cientos de variables por
  // base y la vista de diapositivas resuelve la escala de cada tema al pintar.
  const catalogo = useMemo(() => catalogoEscalas(variablesPorBase), [variablesPorBase]);
  const diapositivas = useMemo(() => agruparEnDiapositivas(filas, catalogo), [filas, catalogo]);
  const resumen = useMemo(() => resumenEditor(filas), [filas]);
  const sinDiapositiva = useMemo(
    () => filas.filter((f) => !(f.diapositiva ?? "").trim()).length,
    [filas],
  );

  if (cargando && !estado) {
    return (
      <section className="pulso-equiv" aria-label="Equivalencias entre públicos">
        <p className="pulso-equiv-cargando">Revisando la declaración del estudio…</p>
      </section>
    );
  }

  const declarada = Boolean(estado?.declarada);
  const bases = estado?.bases ?? [];
  const desfasadas = estado?.desfasadas ?? [];

  // C1: seccion independiente, no una coleccion de pares. Su alto es intrinseco
  // a proposito — medido, el contenedor de Carga usa filas `auto` con
  // `align-content: start`, asi que estirar esta superficie fabricaria vacio
  // interior en vez de mostrar mas datos. El espacio de abajo pertenece al area
  // de scroll, igual que en sus hermanas.
  return (
    <section
      className="pulso-equiv"
      aria-label="Equivalencias entre públicos"
      data-qa-geometry-group="carga-equivalencias"
      data-qa-geometry-contract="intrinsic"
    >
      <header className="pulso-equiv-head">
        <div className="pulso-equiv-title">
          <GitCompare size={18} aria-hidden="true" />
          <div>
            <strong>La misma pregunta en cada público</strong>
            <small>
              Cada público nombra sus variables distinto. Declarar la equivalencia es lo
              que permite compararlos sin emparejar a mano.
            </small>
          </div>
        </div>
        <div className="pulso-equiv-actions">
          <button
            type="button"
            className="pulso-secondary pulso-equiv-btn"
            onClick={() => void onGenerar()}
            disabled={ocupado !== ""}
          >
            <Download size={14} aria-hidden="true" />
            {declarada ? "Descargar plantilla actual" : "Generar plantilla"}
          </button>
          <button
            type="button"
            className="pulso-secondary pulso-equiv-btn"
            onClick={() => void onSugerir()}
            disabled={ocupado !== ""}
            title="Propone emparejamientos por etiqueta, escala y orden. No se guardan sin confirmar."
          >
            <Sparkles size={14} aria-hidden="true" />
            Proponer emparejados
          </button>
          <label className="pulso-secondary pulso-equiv-btn pulso-equiv-btn-file">
            <Upload size={14} aria-hidden="true" />
            Subir matriz
            <input
              type="file"
              accept=".xlsx,.xls"
              disabled={ocupado !== ""}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void onSubir(file);
              }}
            />
          </label>
        </div>
      </header>

      {error && (
        <p className="pulso-equiv-error" role="alert">
          {error}
        </p>
      )}
      {aviso && !error && <p className="pulso-equiv-aviso">{aviso}</p>}

      {/* C3: el vacío vive dentro de este contenedor, que es el dueño de la
          capacidad. No se deja aire suelto en el panel. */}
      <div
        className="pulso-equiv-cuerpo"
        data-qa-geometry-capacity="owned"
        data-surface-contract="carga-equivalencias"
      >
        {filas.length > 0 ? (
          <>
            <div className="pulso-equiv-vistas" role="group" aria-label="Forma de ver la declaración">
              <button
                type="button"
                className={vista === "diapositivas" ? "is-active" : ""}
                aria-pressed={vista === "diapositivas"}
                onClick={() => setVista("diapositivas")}
              >
                Por diapositiva
              </button>
              <button
                type="button"
                className={vista === "tabla" ? "is-active" : ""}
                aria-pressed={vista === "tabla"}
                onClick={() => setVista("tabla")}
              >
                Lista
              </button>
              {/* Las dos acciones que operan sobre TODO el editor viven junto al
                  selector de vista y no en la cabecera: la cabecera declara qué
                  es la superficie y por dónde entran los datos; esto opera sobre
                  lo que ya está dentro. */}
              {sinDiapositiva > 0 && (
                <button
                  type="button"
                  className="pulso-equiv-accion-masiva"
                  onClick={onAgrupar}
                  title="Agrupa por la batería del formulario: los temas cuyas variables comparten raíz en algún público van a la misma diapositiva."
                >
                  <Layers size={13} aria-hidden="true" />
                  Agrupar {sinDiapositiva} sin diapositiva
                </button>
              )}
              {resumen.sugeridas > 0 && (
                <button
                  type="button"
                  className="pulso-equiv-accion-masiva"
                  onClick={onConfirmarTodas}
                >
                  <CheckCheck size={13} aria-hidden="true" />
                  Confirmar {resumen.sugeridas} propuestas
                </button>
              )}
              <span className="pulso-equiv-vistas-nota">
                {diapositivas.filter((l) => l.clave !== "").length} diapositivas · {filas.length} temas
              </span>
            </div>

            {vista === "diapositivas" ? (
              <EquivalenciasDiapositivas
                bases={bases.length ? bases : Object.keys(variablesPorBase)}
                diapositivas={diapositivas}
                catalogo={catalogo}
                variablesPorBase={variablesPorBase}
                onEditarFila={(id, campo, v) => { setFilas((p) => editarCampo(p, id, campo, v)); setSucio(true); }}
                onEditarDiapositiva={(clave, campo, v) => { setFilas((p) => editarCampoDeDiapositiva(p, clave, campo, v)); setSucio(true); }}
                onAsignar={(id, base, v) => { setFilas((p) => asignarVariable(p, id, base, v)); setSucio(true); }}
                onQuitar={(id) => { setFilas((p) => quitarFila(p, id)); setSucio(true); }}
                onConfirmar={(id) => { setFilas((p) => confirmarFila(p, id)); setSucio(true); }}
                onAgregarTema={(clave) => {
                  const diapo = diapositivas.find((l) => l.clave === clave);
                  setFilas((p) => [...p, filaVacia(diapo?.seccion ?? "", clave, diapo?.enunciado ?? "")]);
                  setSucio(true);
                }}
              />
            ) : (
              <EquivalenciasTabla
                bases={bases.length ? bases : Object.keys(variablesPorBase)}
                filas={filas}
                variablesPorBase={variablesPorBase}
                onAsignar={(id, base, v) => { setFilas((p) => asignarVariable(p, id, base, v)); setSucio(true); }}
                onEditar={(id, campo, v) => { setFilas((p) => editarCampo(p, id, campo, v)); setSucio(true); }}
                onQuitar={(id) => { setFilas((p) => quitarFila(p, id)); setSucio(true); }}
                onConfirmar={(id) => { setFilas((p) => confirmarFila(p, id)); setSucio(true); }}
                onAgregarFila={() => { setFilas((p) => [...p, filaVacia()]); setSucio(true); }}
              />
            )}
            <div className="pulso-equiv-pie-editor">
              <span>
                {`${resumen.confirmadas} confirmadas`
                  + (resumen.sugeridas ? ` · ${resumen.sugeridas} propuestas sin confirmar` : "")
                  + (resumen.sinEtiqueta ? ` · ${resumen.sinEtiqueta} sin etiqueta` : "")
                  + (resumen.conDiapositiva ? ` · ${resumen.conDiapositiva} con diapositiva` : "")}
              </span>
              <button
                type="button"
                className="pulso-primary pulso-equiv-btn"
                onClick={() => void onGuardar()}
                disabled={ocupado !== "" || !sucio}
              >
                <Save size={14} aria-hidden="true" />
                {sucio ? "Guardar cambios" : "Sin cambios"}
              </button>
            </div>
          </>
        ) : !declarada ? (
          // C5 categoría 1: vacío legítimo — el estudio todavía no la declaró.
          // El estado dice qué falta y cómo se llena, dentro de su propia caja.
          <div className="pulso-equiv-vacio">
            <p>
              <strong>Este estudio todavía no declara equivalencias.</strong>
            </p>
            <p>
              Genera la plantilla: sale con las variables y etiquetas de cada público ya
              puestas. Empareja las filas que son la misma pregunta, escribe su etiqueta
              estándar y súbela.
            </p>
            <p className="pulso-equiv-vacio-nota">
              Sin esto, comparar dos públicos exige recordar qué variable corresponde a
              cuál en cada uno.
            </p>
          </div>
        ) : (
          <>
            <ul className="pulso-equiv-resumen" aria-label="Cobertura por público">
              {bases.map((base) => {
                const cob = estado?.cobertura?.[base];
                const huerfanas = cob?.huerfanas ?? [];
                const desfasada = desfasadas.includes(base);
                return (
                  <li
                    key={base}
                    data-qa-geometry-group="carga-equivalencias-base"
                    data-qa-geometry-contract="equal"
                    className={desfasada || huerfanas.length > 0 ? "is-attention" : "is-ready"}
                  >
                    <span className="pulso-equiv-resumen-estado" aria-hidden="true">
                      {desfasada || huerfanas.length > 0 ? (
                        <AlertTriangle size={16} />
                      ) : (
                        <CheckCircle2 size={16} />
                      )}
                    </span>
                    <span className="pulso-equiv-resumen-copy">
                      <strong>{base}</strong>
                      <small>
                        {cob ? `${cob.n_calzan} de ${cob.n_declaradas} variables declaradas` : "—"}
                      </small>
                      {desfasada && (
                        <small className="pulso-equiv-alerta">
                          El formulario cambió desde que se importó: revisa esta columna.
                        </small>
                      )}
                      {huerfanas.length > 0 && (
                        <small className="pulso-equiv-alerta">
                          {huerfanas.length === 1
                            ? `${huerfanas[0]} ya no existe en el formulario.`
                            : `${huerfanas.length} variables ya no existen en el formulario.`}
                        </small>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>

            <p className="pulso-equiv-pie">
              {estado?.n_filas} preguntas declaradas
              {typeof estado?.n_sin_etiqueta === "number" && estado.n_sin_etiqueta > 0
                ? ` · ${estado.n_sin_etiqueta} todavía sin etiqueta estándar`
                : ""}
              {estado?.importada_en ? ` · importada el ${estado.importada_en.slice(0, 10)}` : ""}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
