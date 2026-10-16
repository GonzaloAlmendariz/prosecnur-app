// Editor de armonización de una fila de la matriz de equivalencias
// (contrato E4-E7, R3).
//
// Direccionable: `?panel=armonizacion&foco=<ref>`, donde `ref` es el `id` del
// bloque o la posición de la fila en la declaración guardada. Un enlace
// reproduce la fila que se estaba armonizando, y el QA visual lo abre sin
// clics. Trabaja sobre la declaración GUARDADA: el preview del backend cuenta
// casos con lo guardado y guardar aquí no arrastra ediciones pendientes de
// otras filas.
//
// La lógica vive en `armonizacionModel`; aquí sólo hay render y eventos.

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useInRouterContext, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  CircleSlash2,
  GitCompareArrows,
  Plus,
  Save,
  Trash2,
  Wand2,
  X,
} from "../../vendor/lucide-react";
import { ApiError } from "../../api/core";
import {
  getArmonizacionPreview,
  guardarEquivalencias,
  type CategoriaEscalaComun,
  type EquivalenciaFila,
  type EquivalenciasEstado,
  type EquivalenciasImportacion,
  type VariableDeBase,
} from "../../api/equivalencias";
import { getCodigosObservados } from "../../api/codigosObservados";
import { usePanelDireccionable } from "../../lib/navegacion/paneles";
import { usePlegadoRecordado } from "../../lib/plegadoRecordado";
import { formatoConteo } from "../../lib/formatoNumero";
import { SaveStatusIndicator, type SaveState } from "../../components/SaveStatusIndicator";
import { conNivel } from "../../lib/navegacion/direccion";
import { useSeccion } from "../../lib/navegacion/useDireccion";
import {
  PANEL_ARMONIZACION,
  aArmonizacion,
  borradorDesde,
  estadoDeBase,
  filasConArmonizacion,
  filasDeMapa,
  indiceDeFoco,
  mapaExplicito,
  TEXTO_ESTADO_BASE,
  ordenEfectivo,
  reducirArmonizacion,
  resumenMapa,
  textoResumenMapa, resumenEsAviso,
  validarArmonizacion,
  type BorradorArmonizacion,
  type EntradaBorrador,
} from "./armonizacionModel";
import { nombreDeSerieDeBases, type NombreDeSerie } from "./nombreDeSerie";
import { rotuloDeVariable } from "./indicadorCompuestoModel";
import {
  accionAsignarMarcados,
  alternarMarca,
  codigosSinMapa,
  marcadosVigentes,
  marcarSinMapa,
} from "./armonizacionMasaModel";
import { ArmonizacionAsignarEnMasa } from "./ArmonizacionAsignarEnMasa";
import { ArmonizacionTextosInforme } from "./ArmonizacionTextosInforme";
import { EscalaCompartidaAviso, EscalaCompartidaLista } from "./ArmonizacionEscalaCompartida";
import {
  candidatosDeEscala,
  filasConEscalaAplicada,
  marcadosPorDefecto,
  textoAplicarA,
} from "./escalaCompartidaModel";
import type { FilaEditor } from "./equivalenciasEditorModel";
import {
  codigosDeBase,
  conObservados,
  observadosDesde,
  type CargaBase,
  type CodigoBase,
  type CodigosDeBase,
} from "./armonizacionCodigosModel";
import "./ArmonizacionFilaEditor.css";
import { PulsoButton } from "../../components/PulsoButton";

// ---- Abrir sobre una fila ---------------------------------------------------
//
// El indicador por fila vive en la columna «Escala» de `EquivalenciasTabla`
// (ADR 0104): dice si las escalas coinciden y abre este editor.

/** Abre el editor sobre una fila: escribe `panel` y `foco` en la dirección. */
export function useAbrirArmonizacion(): (foco: string) => void {
  const location = useLocation();
  const navigate = useNavigate();
  return useCallback(
    (foco: string) =>
      navigate(
        {
          pathname: location.pathname,
          search: conNivel(conNivel(location.search, "panel", PANEL_ARMONIZACION.id), "foco", foco),
        },
        { replace: true },
      ),
    [location.pathname, location.search, navigate],
  );
}

// ---- Panel ------------------------------------------------------------------

export type ArmonizacionFilaEditorProps = {
  estado: EquivalenciasEstado | null;
  /** La declaración se está leyendo. Sin estado y sin carga, la lectura falló. */
  cargandoEstado: boolean;
  variablesPorBase: Record<string, VariableDeBase[]>;
  /**
   * Filas de la tabla tal como se ven. Las guardadas que tienen cambios sin
   * guardar no reciben una escala aplicada desde aquí (G3).
   */
  filasEditor?: readonly FilaEditor[] | null;
  onGuardado: (out: EquivalenciasImportacion, mensaje: string) => void;
};

export function ArmonizacionFilaEditor(props: ArmonizacionFilaEditorProps) {
  return useInRouterContext() ? <PanelConDireccion {...props} /> : null;
}

function PanelConDireccion({ estado, cargandoEstado, variablesPorBase, filasEditor = null, onGuardado }: ArmonizacionFilaEditorProps) {
  const panel = usePanelDireccionable(PANEL_ARMONIZACION);
  const procesamiento = useSeccion("procesamiento");
  const location = useLocation();
  const navigate = useNavigate();
  const guardadas = useMemo(() => estado?.filas ?? [], [estado?.filas]);
  const indice = indiceDeFoco(guardadas, procesamiento.foco);
  const fila = indice === null ? null : guardadas[indice];
  const ultimoFoco = useRef<string | null>(null);
  if (panel.abierto) ultimoFoco.current = procesamiento.foco;

  const cerrar = useCallback(() => {
    navigate(
      { pathname: location.pathname, search: conNivel(conNivel(location.search, "panel", null), "foco", null) },
      { replace: true },
    );
  }, [location.pathname, location.search, navigate]);

  const bases = useMemo(
    () => ordenEfectivo(estado?.armonizacion_periodos ?? [], estado?.bases ?? []),
    [estado?.armonizacion_periodos, estado?.bases],
  );

  return (
    <Dialog.Root open={panel.abierto} onOpenChange={(abierto) => { if (!abierto) cerrar(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="pulso-armon-velo" />
        <Dialog.Content
          className="pulso-armon"
          {...panel.props}
          // Sin `false`: el panel se monta sobre una vista que ya publicó su
          // propia readiness, y un `false` anidado la bloquearía (AD6). Lo que
          // todavía carga se publica aparte en `data-armon-conteos` para que el
          // QA espere con `--post-click-wait-selector`.
          data-audit-ready={estado ? "true" : "vacio:sin-declaracion"}
          data-armon-conteos={estado ? undefined : cargandoEstado ? "leyendo" : "sin-declaracion"}
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            const foco = ultimoFoco.current;
            if (!foco) return;
            const disparador = document.querySelector<HTMLElement>(
              `button[data-armon-abrir="${CSS.escape(foco)}"]`,
            );
            if (!disparador) return;
            event.preventDefault();
            disparador.focus();
          }}
        >
          {fila && indice !== null ? (
            <EditorFila
              // Otra fila, u otra revisión guardada, es otro borrador.
              key={`${indice}:${estado?.revision ?? ""}`}
              fila={fila}
              indice={indice}
              guardadas={guardadas}
              bases={bases}
              variablesPorBase={variablesPorBase}
              filasEditor={filasEditor}
              onGuardado={onGuardado}
              onCerrar={cerrar}
            />
          ) : (
            <div className="pulso-armon-marco">
              <header className="pulso-armon-cabecera">
                <div className="pulso-armon-titular">
                  <Dialog.Title className="pulso-armon-titulo">
                    Armonizar entre {nombreDeSerieDeBases(bases).plural}
                  </Dialog.Title>
                  <Dialog.Close className="pulso-armon-cerrar" aria-label="Cerrar">
                    <X size={16} aria-hidden="true" />
                  </Dialog.Close>
                </div>
              </header>
              {/* C5: vacío legítimo. El enlace nombra una fila que la
                  declaración guardada ya no tiene, o el estado todavía carga. */}
              <div className="pulso-armon-cuerpo">
                <p className="pulso-armon-vacio">
                  {estado
                    ? "Esta fila no está en la declaración guardada. Ábrela desde la tabla de equivalencias."
                    : cargandoEstado
                      ? "Revisando la declaración del estudio…"
                      : "No se pudo leer la declaración del estudio. Cierra el panel y revisa el aviso de Equivalencias."}
                </p>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ---- Editor de una fila ------------------------------------------------------

function opcionesDelInstrumento(
  variablesPorBase: Record<string, VariableDeBase[]>,
  base: string,
  variable: string,
): CodigoBase[] {
  const v = (variablesPorBase[base] ?? []).find((x) => x.name === variable);
  return (v?.opciones ?? []).map((o) => ({ codigo: o.codigo, etiqueta: o.etiqueta, n: null }));
}

function motivoSinPreview(e: unknown): string {
  const code = e instanceof ApiError ? e.code : "";
  switch (code) {
    case "E_EQUIV_SIN_ARMONIZACION":
      return "Guarda la escala para ver cuántos casos caen en cada código.";
    case "E_EQUIV_ARMONIZACION_VARIABLE_AUSENTE":
      return "La variable no está en los datos de esta base. Se muestra la lista del instrumento.";
    case "E_NO_DATA":
      return "Esta base todavía no tiene datos cargados. Se muestra la lista del instrumento.";
    default:
      return e instanceof Error ? e.message : String(e);
  }
}

function EditorFila({
  fila,
  indice,
  guardadas,
  bases,
  variablesPorBase,
  filasEditor,
  onGuardado,
  onCerrar,
}: {
  fila: EquivalenciaFila;
  indice: number;
  guardadas: readonly EquivalenciaFila[];
  bases: string[];
  variablesPorBase: Record<string, VariableDeBase[]>;
  filasEditor: readonly FilaEditor[] | null;
  onGuardado: (out: EquivalenciasImportacion, mensaje: string) => void;
  onCerrar: () => void;
}) {
  const serie = nombreDeSerieDeBases(bases);
  const conVariable = bases.filter((b) => fila.variables[b]);
  const sinVariable = bases.filter((b) => !fila.variables[b]);
  const [borrador, despachar] = useReducer(
    reducirArmonizacion,
    undefined,
    () => borradorDesde(fila.armonizacion, conVariable, fila),
  );
  const [cargas, setCargas] = useState<Record<string, CargaBase>>(
    () => Object.fromEntries(conVariable.map((b) => [b, { tipo: "cargando" } as CargaBase])),
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [sucio, setSucio] = useState(false);

  const referencia = fila.id ?? String(indice);
  const clavesBases = conVariable.join("|");
  const clavesVariables = conVariable.map((b) => fila.variables[b] ?? "").join("|");
  const tieneArmonizacion = Boolean(fila.armonizacion);
  useEffect(() => {
    let vigente = true;
    const bases = clavesBases ? clavesBases.split("|") : [];
    const variables = clavesVariables.split("|");
    const desdeInstrumento = (motivo: string): CargaBase => ({ tipo: "instrumento", motivo, observados: { estado: "leyendo" } });
    // F4: sin preview, los valores observados en la data dan los códigos y
    // sus casos a una variable que el instrumento no lista.
    const leerObservados = (base: string, variable: string) => {
      getCodigosObservados(base, variable)
        .then((d) => {
          if (vigente) setCargas((prev) => conObservados(prev, base, observadosDesde(d)));
        })
        .catch((e: unknown) => {
          const mensaje = e instanceof Error ? e.message : String(e);
          if (vigente) setCargas((prev) => conObservados(prev, base, { estado: "error", mensaje }));
        });
    };
    if (!tieneArmonizacion) {
      // Sin armonización guardada el preview responde 409: no hay nada que
      // contar con la escala todavía. Se muestra la lista del instrumento, o
      // lo observado en la data, sin pedirlo.
      setCargas(Object.fromEntries(bases.map((b) => [
        b,
        desdeInstrumento("Guarda la escala para ver cuántos casos caen en cada código."),
      ])));
      bases.forEach((b, i) => leerObservados(b, variables[i] ?? ""));
      return () => {
        vigente = false;
      };
    }
    bases.forEach((base, i) => {
      getArmonizacionPreview(referencia, base)
        .then((p) => {
          if (!vigente) return;
          setCargas((prev) => ({
            ...prev,
            [base]: {
              tipo: "listo",
              nTotal: p.n_total,
              codigos: p.codigos.map((c) => ({ codigo: c.codigo, etiqueta: c.etiqueta, n: c.n })),
            },
          }));
        })
        .catch((e: unknown) => {
          if (!vigente) return;
          setCargas((prev) => ({ ...prev, [base]: desdeInstrumento(motivoSinPreview(e)) }));
          leerObservados(base, variables[i] ?? "");
        });
    });
    return () => {
      vigente = false;
    };
  }, [clavesBases, clavesVariables, referencia, tieneArmonizacion]);

  const despacharSucio: typeof despachar = (a) => {
    despachar(a);
    setSucio(true);
  };

  const errores = validarArmonizacion(borrador);
  const vistas: Record<string, CodigosDeBase> = Object.fromEntries(conVariable.map((base) => {
    const variable = fila.variables[base] ?? "";
    const instrumento = opcionesDelInstrumento(variablesPorBase, base, variable);
    return [base, codigosDeBase(cargas[base], instrumento, base, variable, tieneArmonizacion)];
  }));
  const cargando = Object.values(vistas).some((v) => v.fuente === "cargando");
  const [comoAbierto, setComoAbierto] = usePlegadoRecordado("armonizacion-como", false);
  const [guardadoAhora, setGuardadoAhora] = useState(false);
  const estadoGuardado: SaveState = guardando ? "saving"
    : error ? "error"
    : sucio ? "dirty"
    : guardadoAhora ? "saved" : "idle";

  // G3: la misma armonización, llevada a las otras preguntas con esta escala.
  const [vista, setVista] = useState<"editar" | "compartir">("editar");
  const [elegidos, setElegidos] = useState<ReadonlySet<number>>(() => new Set());
  const armonizacionActual = useMemo(() => aArmonizacion(borrador), [borrador]);
  const compartidas = useMemo(
    () => errores.length > 0
      ? { candidatos: [], parciales: 0 }
      : candidatosDeEscala({
        indiceOrigen: indice,
        origen: armonizacionActual,
        guardadas,
        editor: filasEditor,
        bases,
        variablesPorBase,
      }),
    [armonizacionActual, bases, errores.length, filasEditor, guardadas, indice, variablesPorBase],
  );
  const verCompartidas = () => {
    setElegidos(marcadosPorDefecto(compartidas.candidatos));
    setVista("compartir");
  };
  const enCompartir = vista === "compartir" && compartidas.candidatos.length > 0;
  // Cambiar de vista desmonta el control que tenía el foco: se lleva al título
  // de la lista al entrar y al botón que la abre al volver.
  const vistaPrevia = useRef(vista);
  useEffect(() => {
    if (vistaPrevia.current === vista) return;
    vistaPrevia.current = vista;
    const destino = vista === "compartir"
      ? document.getElementById("pulso-armon-compartida-titulo")
      : document.querySelector<HTMLElement>("button[data-armon-compartir]");
    destino?.focus();
  }, [vista]);

  const aplicarACompartidas = async () => {
    setGuardando(true);
    setError("");
    try {
      const conOrigen = filasConArmonizacion(guardadas, indice, armonizacionActual, borrador.textos);
      const out = await guardarEquivalencias(filasConEscalaAplicada(conOrigen, compartidas.candidatos, elegidos));
      const n = compartidas.candidatos.filter((c) => elegidos.has(c.indice)).length;
      onGuardado(
        out,
        n === 1
          ? `La escala de «${fila.etiqueta_estandar}» se aplicó a 1 pregunta más.`
          : `La escala de «${fila.etiqueta_estandar}» se aplicó a ${n} preguntas más.`,
      );
      setSucio(false);
      setGuardadoAhora(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  };

  const guardar = async (borrar: boolean) => {
    setGuardando(true);
    setError("");
    try {
      const arm = borrar ? null : aArmonizacion(borrador);
      const out = await guardarEquivalencias(filasConArmonizacion(guardadas, indice, arm, borrador.textos));
      onGuardado(
        out,
        borrar || !arm
          ? `Se quitó la armonización de «${fila.etiqueta_estandar}».`
          : `Armonización de «${fila.etiqueta_estandar}» guardada.`,
      );
      setSucio(false);
      setGuardadoAhora(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="pulso-armon-marco" data-armon-conteos={cargando ? "contando" : "listos"}>
      <header className="pulso-armon-cabecera">
        <div className="pulso-armon-titular">
          <div>
            <p className="pulso-armon-eyebrow">Armonizar entre {serie.plural}</p>
            <Dialog.Title className="pulso-armon-titulo">
              {fila.etiqueta_estandar || "Pregunta sin etiqueta"}
            </Dialog.Title>
          </div>
          <Dialog.Close className="pulso-armon-cerrar" aria-label="Cerrar">
            <X size={16} aria-hidden="true" />
          </Dialog.Close>
        </div>
        {/* M10: una línea y el detalle plegable. El párrafo completo ocupaba el
            27 % del alto a 1024x600 y se repetía en cada apertura; quien ya lo
            leyó lo pliega una vez y queda plegado. */}
        <p className="pulso-armon-regla">
          Indica qué respuesta de cada base es la misma, para comparar lo mismo en {serie.todas}.
        </p>
        <details
          className="pulso-armon-como"
          open={comoAbierto}
          onToggle={(e) => setComoAbierto(e.currentTarget.open)}
        >
          <summary>Cómo armonizar</summary>
          <p className="pulso-armon-regla">
            Primero arma la escala común, que es la lista de respuestas con la que se compara. Después,
            en cada base, elige en «Destino en la escala» a qué respuesta de esa lista corresponde cada
            código. Guíate por el texto de la respuesta y no por el número, porque el mismo código puede
            significar otra cosa en otra base.
          </p>
        </details>
      </header>

      {/* C4: un único dueño de scroll. Cabecera y pie quedan fuera de él. */}
      <div
        className="pulso-armon-cuerpo"
        data-qa-geometry-group="carga-armonizacion"
        data-qa-geometry-contract="intrinsic"
      >
        {enCompartir ? (
          <EscalaCompartidaLista
            candidatos={compartidas.candidatos}
            parciales={compartidas.parciales}
            elegidos={elegidos}
            guardaOrigen={sucio}
            onAlternar={(i, marcado) =>
              setElegidos((prev) => {
                const next = new Set(prev);
                if (marcado) next.add(i);
                else next.delete(i);
                return next;
              })}
            onTodas={(marcadas) =>
              setElegidos(marcadas ? new Set(compartidas.candidatos.map((c) => c.indice)) : new Set())}
          />
        ) : (
        <>
        {conVariable.length > 1 && <IndiceDeBases bases={conVariable} borrador={borrador} />}

        <EscalaCompartidaAviso n={compartidas.candidatos.length} onVer={verCompartidas} />

        <ArmonizacionTextosInforme
          textos={borrador.textos}
          nombreEstandar={fila.etiqueta_estandar}
          onCambiar={(campo, valor) => despacharSucio({ tipo: "texto", campo, valor })}
        />

        <EscalaComun borrador={borrador} serie={serie} despachar={despacharSucio} />

        {conVariable.map((base) => (
          <MapaDeBase
            key={base}
            anclaId={anclaDeBase(base)}
            base={base}
            rotulo={rotuloDeVariable(fila, base)}
            entrada={borrador.porBase[base]}
            escala={borrador.escala}
            vista={vistas[base] ?? codigosDeBase(undefined, [], base, "", tieneArmonizacion)}
            sucio={sucio}
            despachar={despacharSucio}
          />
        ))}

        {sinVariable.length > 0 && (
          <p className="pulso-armon-nota">
            {sinVariable.length === 1
              ? `${sinVariable[0]} no tiene esta pregunta: no hay nada que armonizar ahí.`
              : `${sinVariable.join(", ")} no tienen esta pregunta: no hay nada que armonizar ahí.`}
          </p>
        )}
        </>
        )}
      </div>

      <footer className="pulso-armon-pie">
        {/* M14: el mismo patrón de guardado que Equivalencias y Agrupar
            categorías: chip de estado y botón con verbo fijo. */}
        <div className="pulso-armon-pie-estado" aria-live="polite">
          <SaveStatusIndicator state={estadoGuardado} variant="badge" />
          {error ? (
            <span className="pulso-armon-error" role="alert">{error}</span>
          ) : errores.length > 0 ? (
            <span className="pulso-armon-error">{errores[0]}</span>
          ) : null}
        </div>
        {enCompartir ? (
          <>
            <PulsoButton variant="secondary" className="pulso-armon-btn" onClick={() => setVista("editar")}>
              Volver
            </PulsoButton>
            <PulsoButton
              variant="primary"
              className="pulso-armon-btn"
              disabled={guardando || elegidos.size === 0}
              onClick={() => void aplicarACompartidas()}
            >
              <Save size={14} aria-hidden="true" />
              {guardando ? "Aplicando…" : textoAplicarA(elegidos.size)}
            </PulsoButton>
          </>
        ) : (
        <>
        {fila.armonizacion && (
          <PulsoButton
            variant="secondary"
            className="pulso-armon-btn"
            disabled={guardando}
            onClick={() => void guardar(true)}
          >
            <Trash2 size={14} aria-hidden="true" />
            Quitar armonización
          </PulsoButton>
        )}
        <PulsoButton variant="secondary" className="pulso-armon-btn" onClick={onCerrar}>
          Cerrar
        </PulsoButton>
        <PulsoButton
          variant="primary"
          className="pulso-armon-btn"
          disabled={guardando || !sucio || errores.length > 0}
          onClick={() => void guardar(false)}
        >
          <Save size={14} aria-hidden="true" />
          {guardando ? "Guardando…" : "Guardar armonización"}
        </PulsoButton>
        </>
        )}
      </footer>
    </div>
  );
}

// ---- Índice de bases ----------------------------------------------------------

/** Id del encabezado de una base en el editor. Sólo letras, números y guiones. */
function anclaDeBase(base: string): string {
  return `pulso-armon-base-${base.replace(/[^A-Za-z0-9_-]/g, "_")}`;
}

/**
 * Los mapas de las bases se apilan bajo la escala y, con muchas, la última
 * queda a varias pantallas. El índice dice el estado de cada base y salta a su
 * sección. Se muestra igual con dos bases que con veinte: envuelve. Son anclas dentro del panel, no navegación: no cambian
 * la dirección.
 */
function IndiceDeBases({ bases, borrador }: { bases: string[]; borrador: BorradorArmonizacion }) {
  const ir = (id: string) => {
    const destino = document.getElementById(id);
    if (!destino) return;
    const reducido = typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    destino.scrollIntoView({ block: "start", behavior: reducido ? "auto" : "smooth" });
    destino.focus({ preventScroll: true });
  };
  return (
    <nav className="pulso-armon-indice" aria-label="Ir a una base de esta pregunta">
      <span className="pulso-armon-indice-titulo">{bases.length} bases</span>
      <ul>
        <li>
          <button type="button" onClick={() => ir("pulso-armon-escala")}>Escala común</button>
        </li>
        {bases.map((base) => {
          const estado = estadoDeBase(borrador.porBase[base]);
          return (
            <li key={base}>
              <button
                type="button"
                className={`is-${estado}`}
                onClick={() => ir(anclaDeBase(base))}
                aria-label={`${base}, ${TEXTO_ESTADO_BASE[estado]}`}
              >
                {estado === "comparable" ? (
                  <CheckCircle2 size={11} aria-hidden="true" />
                ) : estado === "no-comparable" ? (
                  <CircleSlash2 size={11} aria-hidden="true" />
                ) : (
                  <GitCompareArrows size={11} aria-hidden="true" />
                )}
                <span>{base}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// ---- Escala común -------------------------------------------------------------

function EscalaComun({
  borrador,
  serie,
  despachar,
}: {
  borrador: BorradorArmonizacion;
  serie: NombreDeSerie;
  despachar: (a: Parameters<typeof reducirArmonizacion>[1]) => void;
}) {
  return (
    <section className="pulso-armon-seccion" aria-labelledby="pulso-armon-escala" data-qa-geometry-member>
      <div className="pulso-armon-seccion-head">
        <div className="pulso-armon-seccion-titulo">
          <h3 id="pulso-armon-escala" tabIndex={-1}>Escala común</h3>
          <p className="pulso-armon-ayuda">
            La lista de respuestas con la que se compara esta pregunta en {serie.todas}.
          </p>
        </div>
        <PulsoButton
          variant="secondary"
          className="pulso-armon-btn"
          onClick={() => despachar({ tipo: "agregar" })}
        >
          <Plus size={14} aria-hidden="true" />
          Agregar categoría
        </PulsoButton>
      </div>
      {borrador.escala.length === 0 ? (
        // C3: el vacío es de esta sección y dice cómo se llena.
        <p className="pulso-armon-vacio">
          Todavía no hay escala. Agrega categorías o copia la lista de una base desde su tabla.
        </p>
      ) : (
        <ol className="pulso-armon-escala">
          {borrador.escala.map((c, i) => (
            <li key={c.clave}>
              <span className="pulso-armon-escala-pos" aria-hidden="true">{i + 1}</span>
              <input
                className="pulso-armon-escala-codigo"
                value={c.codigo}
                aria-label={`Código de la categoría ${i + 1}`}
                onChange={(e) => despachar({ tipo: "codigo", clave: c.clave, valor: e.target.value })}
              />
              <input
                className="pulso-armon-escala-etiqueta"
                value={c.etiqueta}
                placeholder="Etiqueta de la categoría"
                aria-label={`Etiqueta de la categoría ${i + 1}`}
                onChange={(e) => despachar({ tipo: "etiqueta", clave: c.clave, valor: e.target.value })}
              />
              <button
                type="button"
                className="pulso-icon"
                aria-label={`Subir ${c.etiqueta || c.codigo}`}
                disabled={i === 0}
                onClick={() => despachar({ tipo: "mover", clave: c.clave, delta: -1 })}
              >
                <ArrowUp size={13} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="pulso-icon"
                aria-label={`Bajar ${c.etiqueta || c.codigo}`}
                disabled={i === borrador.escala.length - 1}
                onClick={() => despachar({ tipo: "mover", clave: c.clave, delta: 1 })}
              >
                <ArrowDown size={13} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="pulso-icon pulso-icon-danger"
                aria-label={`Quitar ${c.etiqueta || c.codigo}`}
                onClick={() => despachar({ tipo: "quitar", clave: c.clave })}
              >
                <Trash2 size={13} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

// ---- Mapa de una base -----------------------------------------------------------

function MapaDeBase({
  anclaId,
  base,
  rotulo,
  entrada,
  escala,
  vista,
  sucio,
  despachar,
}: {
  anclaId: string;
  base: string;
  /** Los códigos de la base y de dónde salen sus casos. */
  vista: CodigosDeBase;
  /** «variable P12», o los componentes de un indicador compuesto (ADR 0105). */
  rotulo: string;
  entrada: EntradaBorrador | undefined;
  escala: readonly CategoriaEscalaComun[];
  sucio: boolean;
  despachar: (a: Parameters<typeof reducirArmonizacion>[1]) => void;
}) {
  const codigos = vista.codigos;
  const filas = filasDeMapa(codigos, entrada, escala);
  const resumen = resumenMapa(filas);
  // F2: lo marcado es estado de la pantalla, no del borrador; se descarta al
  // asignar y nunca viaja al backend.
  const [marcados, setMarcados] = useState<ReadonlySet<string>>(() => new Set());
  const vigentes = marcadosVigentes(marcados, filas);
  const conocidos = codigos.map((c) => c.codigo);
  const asignarMarcados = (eleccion: string) => {
    const accion = accionAsignarMarcados(base, vigentes, eleccion, conocidos);
    if (!accion) return;
    despachar(accion);
    setMarcados(new Set());
  };
  const explicito = mapaExplicito(entrada);
  const comparable = entrada?.comparable ?? null;
  const opciones = codigos
    .filter((c) => c.etiqueta)
    .map((c) => ({ codigo: c.codigo, etiqueta: c.etiqueta ?? c.codigo }));
  const nombreGrupo = `pulso-armon-comparable-${base}`;

  return (
    <section
      className={`pulso-armon-seccion pulso-armon-base is-${comparable === null ? "sin-declarar" : comparable ? "comparable" : "no-comparable"}`}
      aria-label={`Base ${base}`}
      data-qa-geometry-member
    >
      <div className="pulso-armon-seccion-head">
        <h3 id={anclaId} tabIndex={-1}>
          {base} <small>{rotulo}</small>
        </h3>
        <div className="pulso-armon-comparable" role="radiogroup" aria-label={`¿${base} es comparable?`}>
          <label>
            <input
              type="radio"
              name={nombreGrupo}
              checked={comparable === true}
              onChange={() => despachar({ tipo: "comparable", base, valor: true })}
            />
            Comparable
          </label>
          <label>
            <input
              type="radio"
              name={nombreGrupo}
              checked={comparable === false}
              onChange={() => despachar({ tipo: "comparable", base, valor: false })}
            />
            No comparable
          </label>
        </div>
      </div>

      <label className="pulso-armon-nota-campo">
        <span>Nota</span>
        <input
          value={entrada?.nota ?? ""}
          placeholder={comparable === false ? "Por qué no se compara esta medición" : "Opcional"}
          onChange={(e) => despachar({ tipo: "nota", base, valor: e.target.value })}
        />
      </label>

      {comparable === null && (
        <div className="pulso-armon-base-acciones">
          <p className="pulso-armon-aviso">
            Sin declarar. Una base no se presume comparable: elige una opción para que entre a la serie.
          </p>
          {escala.length === 0 && opciones.length > 0 && (
            <PulsoButton
              variant="secondary"
              className="pulso-armon-btn"
              onClick={() => despachar({ tipo: "sembrar", opciones })}
            >
              <Plus size={14} aria-hidden="true" />
              Usar esta lista como escala
            </PulsoButton>
          )}
        </div>
      )}

      {comparable === true && (
        <>
          <div className="pulso-armon-base-acciones">
            {escala.length === 0 && opciones.length > 0 && (
              <PulsoButton
                variant="secondary"
                className="pulso-armon-btn"
                onClick={() => despachar({ tipo: "sembrar", opciones })}
              >
                <Plus size={14} aria-hidden="true" />
                Usar esta lista como escala
              </PulsoButton>
            )}
            {/* Secundario siempre (P-A5): el único primario del panel es
                «Guardar armonización». La etiqueta distinta ya la anuncia el
                resumen de al lado, con texto y no con el peso del botón. */}
            {escala.length > 0 && opciones.length > 0 && (
              <PulsoButton
                variant="secondary"
                className="pulso-armon-btn"
                title={explicito
                  ? "Lleva cada código a la categoría de la escala con la misma etiqueta. No toca lo ya asignado."
                  : "Reemplaza la correspondencia por número con un mapa explícito: cada código va a la categoría con su misma etiqueta y lo que no casa queda sin mapa."}
                onClick={() => despachar({ tipo: "emparejar", base, opciones })}
              >
                <Wand2 size={14} aria-hidden="true" />
                {explicito ? "Emparejar por etiqueta" : "Convertir en mapa por etiqueta"}
              </PulsoButton>
            )}
            {/* Mientras cuenta no se resume: con la tabla vacía el resumen afirmaría
                «todos caen en su etiqueta» sin haberlo medido. */}
            {vista.fuente !== "cargando" && filas.length > 0 && (
              <span
                className={`pulso-armon-base-resumen${resumenEsAviso(resumen, vista.conConteos) ? " is-aviso" : ""}`}
                aria-live="polite"
              >
                {textoResumenMapa(resumen, explicito)}
              </span>
            )}
          </div>

          {vista.aviso && <p className="pulso-armon-aviso">{vista.aviso}</p>}
          {vista.nota && <p className="pulso-armon-nota">{vista.nota}</p>}
          {vista.fuente === "preview" && sucio && (
            <p className="pulso-armon-nota">Los conteos son de lo guardado. Los destinos ya reflejan tus cambios.</p>
          )}

          {vista.fuente === "cargando" ? (
            <p className="pulso-armon-vacio">Contando casos en {base}…</p>
          ) : filas.length === 0 ? (
            <p className="pulso-armon-vacio">{vista.vacio}</p>
          ) : (
            <>
            {escala.length > 0 && (
              <ArmonizacionAsignarEnMasa
                base={base}
                escala={escala}
                nMarcados={vigentes.length}
                nSinMapa={codigosSinMapa(filas).length}
                onAsignar={asignarMarcados}
                onMarcarSinMapa={() => setMarcados((m) => marcarSinMapa(m, filas))}
                onLimpiar={() => setMarcados(new Set())}
              />
            )}
            <div className="pulso-armon-tabla-wrap">
              <table className="pulso-armon-tabla">
                <thead>
                  <tr>
                    <th scope="col"><span className="pulso-sr-only">Marcar</span></th>
                    <th scope="col">Código</th>
                    <th scope="col">Etiqueta en {base}</th>
                    <th scope="col" className="is-num">Casos</th>
                    <th
                      scope="col"
                      title="A qué respuesta de la escala común corresponde este código de la base. Sin mapa, el código no entra a la comparación."
                    >
                      Destino en la escala
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f) => (
                    <tr
                      key={f.codigo}
                      className={[
                        f.sinMapa ? "is-sin-mapa" : f.etiquetaDistinta ? "is-etiqueta-distinta" : "",
                        marcados.has(f.codigo) ? "is-marcado" : "",
                      ].filter(Boolean).join(" ") || undefined}
                    >
                      <td className="pulso-armon-marca">
                        <input
                          type="checkbox"
                          checked={marcados.has(f.codigo)}
                          disabled={escala.length === 0}
                          aria-label={`Marcar el código ${f.codigo} de ${base}`}
                          onChange={(e) => {
                            const marcado = e.currentTarget.checked;
                            setMarcados((m) => alternarMarca(m, f.codigo, marcado));
                          }}
                        />
                      </td>
                      <td className="pulso-armon-codigo">{f.codigo}</td>
                      <td>{f.etiqueta ?? <span className="pulso-armon-tenue">sin etiqueta</span>}</td>
                      <td className="is-num">
                        {f.n === null ? <span className="pulso-armon-tenue">sin conteo</span> : formatoConteo(f.n)}
                      </td>
                      <td>
                        <select
                          value={f.destino ?? ""}
                          aria-label={`Destino del código ${f.codigo} de ${base}`}
                          onChange={(e) =>
                            despachar({
                              tipo: "destino",
                              base,
                              codigo: f.codigo,
                              destino: e.target.value || null,
                              conocidos,
                            })
                          }
                        >
                          <option value="">Sin mapa</option>
                          {escala.filter((c) => c.codigo).map((c) => (
                            <option key={c.codigo} value={c.codigo}>
                              {c.codigo} {c.etiqueta}
                            </option>
                          ))}
                        </select>
                        {f.etiquetaDistinta && (
                          <span
                            className="pulso-armon-etiqueta-distinta"
                            title={`«${f.etiqueta ?? ""}» cae en «${f.etiquetaDestino ?? ""}»`}
                          >
                            Etiqueta distinta
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
