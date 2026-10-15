// Equivalencias entre públicos (ADR 0062).
//
// Declara qué pregunta de un público es la misma que la de otro. Sin esa tabla,
// comparar públicos depende de la memoria del analista frente a un selector que
// muestra la misma etiqueta —«Servicio de salud»— para tres preguntas distintas,
// y el error no da ninguna señal: en el PPT medido, un grupo comparaba «¿Conoce
// bienestar psicológico?» de docentes contra «¿Ha utilizado…?» de estudiantes,
// 90 % contra 31 %.
//
// ADR 0104: la matriz se arma aquí, por la persona, fila por fila: «Añadir
// pregunta equivalente», elegir la pregunta de cada base buscándola por su
// texto y, si las escalas no coinciden, armonizar en la misma fila. No hay
// plantilla, subida de Excel ni emparejado automático. «Traer una serie de
// mediciones ya armada» queda sólo para series largas de la misma pregunta.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Layers,
  Plus,
  Save,
} from "../../vendor/lucide-react";
import {
  getEquivalencias,
  getVariablesEquivalencias,
  guardarEquivalencias,
  type EquivalenciasEstado,
  type EquivalenciasImportacion,
  type ImportacionBloques,
  type VariableDeBase,
} from "../../api/equivalencias";
import { ArmonizacionFilaEditor, useAbrirArmonizacion } from "./ArmonizacionFilaEditor";
import { ArmonizacionPeriodos } from "./ArmonizacionPeriodos";
import { ImportarBloquesBoton, ImportarBloquesDialog } from "./ImportarBloquesDialog";
import {
  AnadirIndicadorCompuestoBoton,
  IndicadorCompuestoEditor,
  useAbrirIndicadorCompuesto,
} from "./IndicadorCompuestoEditor";
import { fusionarCompuestoGuardado } from "./indicadorCompuestoModel";
import { EquivalenciasTabla } from "./EquivalenciasTabla";
import { EquivalenciasEsqueleto, EquivalenciasTitulo } from "./EquivalenciasEsqueleto";
import {
  aFilasEditor,
  asignarPregunta,
  confirmarFila,
  editarCampo,
  filaVacia,
  filasParaGuardar,
  ordenarBasesPorSerie,
  quitarFila,
  resumenEditor,
  type FilaEditor,
} from "./equivalenciasEditorModel";
import { etiquetaDePregunta } from "./preguntaEquivalenteModel";
import "./EquivalenciasPanel.css";
import { PulsoButton } from "../../components/PulsoButton";
import { SaveStatusIndicator } from "../../components/SaveStatusIndicator";
import { EstadoVacio } from "../../components/EstadoVacio";
import { formatoConteo, formatoConteoDe } from "../../lib/formatoNumero";

export type EquivalenciasPanelProps = {
  /**
   * Reporta cuántas preguntas hay declaradas, no cuántas veces se importó. El
   * chip de la pestaña decía «1 pregunta emparejada» tras subir una matriz de
   * 300 filas porque contaba importaciones. `"error"`: no se pudo leer, y la
   * pestaña no debe seguir diciendo «Revisando…» ni afirmar «Pendiente».
   */
  onDeclaradas?: (n: number | "error") => void;
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
  const [ocupado, setOcupado] = useState<"" | "guardar">("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [filas, setFilas] = useState<FilaEditor[]>([]);
  const [variablesPorBase, setVariablesPorBase] = useState<Record<string, VariableDeBase[]>>({});
  const [sucio, setSucio] = useState(false);
  // M14: «Guardado» sólo justo después de guardar desde aquí; al editar vuelve a
  // «Cambios sin guardar» y al recargar, a «Sin cambios».
  const [guardadoAhora, setGuardadoAhora] = useState(false);
  const observadorBarra = useRef<ResizeObserver | null>(null);

  // La barra de vistas queda fija arriba del dueño de scroll y la cabecera de la
  // Lista se pega justo debajo. Su alto se mide en vez de suponerse: la barra
  // envuelve cuando no cabe y un `top` fijo dejaría la cabecera tapada. Ref de
  // callback y no efecto: la barra aparece cuando llegan filas, en un render que
  // ninguna dependencia del efecto distingue.
  const barraRef = useCallback((barra: HTMLDivElement | null) => {
    observadorBarra.current?.disconnect();
    observadorBarra.current = null;
    const seccion = barra?.closest<HTMLElement>(".pulso-equiv");
    if (!barra || !seccion) return;
    const aplicar = () =>
      seccion.style.setProperty("--pulso-equiv-barra-alto", `${barra.offsetHeight}px`);
    aplicar();
    if (typeof ResizeObserver === "undefined") return;
    observadorBarra.current = new ResizeObserver(aplicar);
    observadorBarra.current.observe(barra);
  }, []);

  const abrirArmonizacion = useAbrirArmonizacion();
  const abrirCompuesto = useAbrirIndicadorCompuesto();

  // ADR 0105: el indicador compuesto se guarda desde su panel, sobre la
  // declaración guardada. Con cambios pendientes, sólo entra esa fila.
  const onCompuestoGuardado = useCallback(
    (out: EquivalenciasImportacion, indice: number, mensaje: string) => {
      setEstado(out.estado);
      const guardadas = out.estado.filas ?? [];
      setFilas((prev) => (sucio ? fusionarCompuestoGuardado(prev, guardadas, indice) : aFilasEditor(guardadas)));
      onDeclaradas?.(out.estado.n_filas ?? 0);
      setError("");
      setAviso(mensaje);
    },
    [onDeclaradas, sucio],
  );

  // Guardar una armonización (o el orden de la serie) reescribe la declaración
  // del servidor con sus filas tal como estaban guardadas. Si el editor tiene
  // cambios pendientes en otras filas no se pisan: sólo se trae la armonización
  // de cada fila guardada, por su posición.
  const onArmonizacionGuardada = useCallback(
    (out: EquivalenciasImportacion, mensaje: string) => {
      setEstado(out.estado);
      const guardadas = out.estado.filas ?? [];
      if (!sucio) {
        setFilas(aFilasEditor(guardadas));
      } else {
        setFilas((prev) =>
          prev.map((f) => {
            if (typeof f.indice_declarado !== "number") return f;
            const arm = guardadas[f.indice_declarado]?.armonizacion;
            const { armonizacion: _previa, ...resto } = f;
            return arm ? { ...resto, armonizacion: arm } : resto;
          }),
        );
      }
      onDeclaradas?.(out.estado.n_filas ?? 0);
      setError("");
      setAviso(mensaje);
    },
    [onDeclaradas, sucio],
  );

  const onBloquesAplicados = useCallback(
    (res: ImportacionBloques) => {
      if (!res.estado) return;
      setEstado(res.estado);
      setFilas(aFilasEditor(res.estado.filas ?? []));
      setSucio(false);
      onDeclaradas?.(res.estado.n_filas ?? 0);
      setError("");
      const r = res.resumen;
      setAviso(
        `Serie de mediciones aplicada: ${r.nuevas} filas nuevas y ${r.actualizadas} actualizadas`
          + (r.n_con_armonizacion ? `, ${r.n_con_armonizacion} con armonización.` : "."),
      );
    },
    [onDeclaradas],
  );

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
      onDeclaradas?.("error");
    } finally {
      setCargando(false);
    }
  }, [onDeclaradas]);

  useEffect(() => {
    void refrescar();
  }, [refrescar]);

  const onGuardar = useCallback(async () => {
    setOcupado("guardar");
    setError("");
    try {
      const out = await guardarEquivalencias(filasParaGuardar(filas));
      setEstado(out.estado);
      setFilas(aFilasEditor(out.estado.filas ?? []));
      setSucio(false);
      setGuardadoAhora(true);
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

  const resumen = useMemo(() => resumenEditor(filas), [filas]);

  const onAgregarFila = useCallback(() => {
    setFilas((p) => [...p, filaVacia()]);
    setSucio(true);
  }, []);

  // Al elegir una pregunta, la fila sin nombre toma su etiqueta (ADR 0104).
  const onAsignar = useCallback(
    (id: string, base: string, v: string) => {
      const etiqueta = v ? etiquetaDePregunta(variablesPorBase[base] ?? [], v) : "";
      setFilas((p) => asignarPregunta(p, id, base, v, etiqueta === v ? "" : etiqueta));
      setSucio(true);
    },
    [variablesPorBase],
  );

  // Las columnas siguen la serie declarada (2024, 2025, 2026), no el orden en
  // que se cargaron las bases.
  const bases = ordenarBasesPorSerie(estado?.bases ?? [], estado?.armonizacion_periodos);
  // Antes de guardar la primera fila el estado aún no trae las bases: la tabla y su columna «Escala» las toman del
  // catálogo de variables, para que la escala se vea desde la primera pregunta elegida.
  const basesDeTabla = bases.length ? bases : Object.keys(variablesPorBase);

  // Overlays direccionables: van en portal, fuera de la geometría de la
  // superficie. Se montan también durante la lectura, para que un enlace a
  // `panel=armonizacion` muestre su propio estado de carga desde el principio.
  const overlays = (
    <>
      <ArmonizacionFilaEditor
        estado={estado}
        cargandoEstado={cargando}
        variablesPorBase={variablesPorBase}
        onGuardado={onArmonizacionGuardada}
      />
      <ImportarBloquesDialog bases={bases} onAplicado={onBloquesAplicados} />
      <IndicadorCompuestoEditor
        estado={estado}
        cargandoEstado={cargando}
        bases={basesDeTabla}
        variablesPorBase={variablesPorBase}
        onGuardado={onCompuestoGuardado}
      />
    </>
  );

  // P-A8: la lectura inicial trae la declaración Y el catálogo de variables.
  // Hasta que llegan las dos, la superficie es su esqueleto y su readiness es
  // `false`: antes la tabla se pintaba sin catálogo y se daba por lista.
  if (cargando) {
    return (
      <>
        <EquivalenciasEsqueleto />
        {overlays}
      </>
    );
  }

  const declarada = Boolean(estado?.declarada);
  const desfasadas = estado?.desfasadas ?? [];

  // C1: seccion independiente, no una coleccion de pares. Su alto es intrinseco
  // a proposito — medido, el contenedor de Carga usa filas `auto` con
  // `align-content: start`, asi que estirar esta superficie fabricaria vacio
  // interior en vez de mostrar mas datos. El espacio de abajo pertenece al area
  // de scroll, igual que en sus hermanas.
  //
  // C4: el dueño del scroll es el de Carga (`.pulso-carga-scrollarea`, o el
  // cuerpo del marco en escritorio bajo), no esta superficie. Con un scroll
  // propio, la grilla de Carga la encogía al alto sobrante y a 1024x600 la
  // región de datos mostraba 2 filas de 52. La barra de vistas, la cabecera de
  // la Lista y el pie con Guardar se pegan a ese dueño.
  return (
    <section
      className="pulso-equiv"
      aria-label="Equivalencias entre bases"
      // Terminal: la lectura terminó, con datos, vacía o con error a la vista.
      data-audit-ready="true"
      data-qa-geometry-group="carga-equivalencias"
      data-qa-geometry-contract="intrinsic"
    >
      {/* C1: los miembros son la cabecera y el cuerpo. El aviso y el error son
          estado transitorio de la última acción, no secciones de la superficie. */}
      <header className="pulso-equiv-head" data-qa-geometry-member>
        <EquivalenciasTitulo />
        {/* ADR 0104: la única importación que queda, y sólo para series de mediciones. */}
        <div className="pulso-equiv-actions">
          <ImportarBloquesBoton disabled={ocupado !== ""} />
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
        data-qa-geometry-member
        data-qa-geometry-capacity="owned"
        data-surface-contract="carga-equivalencias"
      >
        {filas.length > 0 ? (
          <>
            {estado && declarada && bases.length > 1 && (
              <ArmonizacionPeriodos estado={estado} onGuardado={onArmonizacionGuardada} />
            )}
            {/* ADR 0103: la matriz es una lista de equivalencias; las láminas se arman en Gráficos. */}
            <div ref={barraRef} className="pulso-equiv-vistas" role="group" aria-label="Resumen de la declaración">
              <span className="pulso-equiv-vistas-nota">{formatoConteoDe(filas.length, "pregunta equivalente", "preguntas equivalentes")}</span>
            </div>

            <EquivalenciasTabla
              bases={basesDeTabla}
              filas={filas}
              variablesPorBase={variablesPorBase}
              onAsignar={onAsignar}
              onEditar={(id, campo, v) => { setFilas((p) => editarCampo(p, id, campo, v)); setSucio(true); }}
              onQuitar={(id) => { setFilas((p) => quitarFila(p, id)); setSucio(true); }}
              onConfirmar={(id) => { setFilas((p) => confirmarFila(p, id)); setSucio(true); }}
              onArmonizar={basesDeTabla.length > 1 ? abrirArmonizacion : undefined}
              onAgregarFila={onAgregarFila}
              onIndicadorCompuesto={abrirCompuesto}
            />
            <div className="pulso-equiv-pie-editor">
              <SaveStatusIndicator
                state={
                  ocupado === "guardar" ? "saving"
                    : sucio ? "dirty"
                    : guardadoAhora ? "saved" : "idle"
                }
                variant="badge"
              />
              <span className="pulso-equiv-pie-resumen">
                {`${formatoConteo(resumen.confirmadas)} confirmadas`
                  + (resumen.sugeridas ? ` · ${formatoConteo(resumen.sugeridas)} sin confirmar` : "")
                  + (resumen.sinEtiqueta ? ` · ${formatoConteo(resumen.sinEtiqueta)} sin nombre estándar` : "")}
              </span>
              <PulsoButton
                variant="primary"
                className="pulso-equiv-btn"
                onClick={() => void onGuardar()}
                disabled={ocupado !== "" || !sucio}
              >
                <Save size={14} aria-hidden="true" />
                Guardar cambios
              </PulsoButton>
            </div>
          </>
        ) : !declarada ? (
          // C5 categoría 1: vacío legítimo — el estudio todavía no la declaró.
          // El estado dice qué falta y cómo se llena, dentro de su propia caja.
          // M4: la receta compartida de vacío.
          <EstadoVacio
            tamano="normal"
            icono={<Layers size={18} />}
            titulo="Este estudio todavía no declara equivalencias"
            descripcion="La matriz dice qué pregunta de cada base es la misma, para poder compararlas entre públicos."
            accion={
              <div className="pulso-compuesto-acciones-tabla">
                <PulsoButton variant="primary" size="sm" onClick={onAgregarFila}>
                  <Plus size={13} aria-hidden="true" />
                  Añadir pregunta equivalente
                </PulsoButton>
                <AnadirIndicadorCompuestoBoton size="sm" onAbrir={() => abrirCompuesto()} />
              </div>
            }
          />
        ) : (
          <>
            <ul className="pulso-equiv-resumen" aria-label="Cobertura por base">
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
                        {cob ? `${formatoConteo(cob.n_calzan)} de ${formatoConteoDe(cob.n_declaradas, "variable declarada", "variables declaradas")}` : "—"}
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
              {formatoConteoDe(estado?.n_filas, "pregunta declarada", "preguntas declaradas")}
              {typeof estado?.n_sin_etiqueta === "number" && estado.n_sin_etiqueta > 0
                ? ` · ${estado.n_sin_etiqueta} todavía sin etiqueta estándar`
                : ""}
              {estado?.importada_en ? ` · importada el ${estado.importada_en.slice(0, 10)}` : ""}
            </p>
          </>
        )}
      </div>

      {overlays}
    </section>
  );
}
