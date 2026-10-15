// Editor del indicador compuesto de la matriz de equivalencias (ADR 0105).
//
// Direccionable: `?panel=indicador-compuesto` abre uno nuevo y
// `?panel=indicador-compuesto&foco=<ref>` edita el guardado (`ref` es el `id`
// del bloque o su posición en la declaración guardada, como en la
// armonización). Guarda directo sobre la declaración GUARDADA: las ediciones
// pendientes de otras filas no se arrastran ni se pisan.
//
// Reusa la cáscara del sideover de armonización (`pulso-armon*`); lo propio
// del indicador está en `IndicadorCompuestoEditor.css`. La lógica vive en
// `indicadorCompuestoModel`.

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useInRouterContext, useLocation, useNavigate } from "react-router-dom";
import { Combine, Plus, Save, Search, X } from "../../vendor/lucide-react";
import {
  getConteosCompuesto,
  guardarEquivalencias,
  type ConteosCompuesto,
  type EquivalenciaFila,
  type EquivalenciasEstado,
  type EquivalenciasImportacion,
  type VariableDeBase,
} from "../../api/equivalencias";
import { usePanelDireccionable } from "../../lib/navegacion/paneles";
import { conNivel } from "../../lib/navegacion/direccion";
import { useSeccion } from "../../lib/navegacion/useDireccion";
import { SaveStatusIndicator, type SaveState } from "../../components/SaveStatusIndicator";
import { PulsoButton } from "../../components/PulsoButton";
import { indiceDeFoco } from "./armonizacionModel";
import { etiquetaLegible } from "./preguntaEquivalenteModel";
import {
  PANEL_INDICADOR_COMPUESTO,
  borradorCompuestoDesde,
  esCompuesta,
  filaDeCompuesto,
  filasConCompuesto,
  opcionesDeAyuda,
  parsearCodigos,
  reducirCompuesto,
  resultadosBusqueda,
  textoConteos,
  validarCompuesto,
  type AccionCompuesto,
  type BaseBorradorCompuesto,
} from "./indicadorCompuestoModel";
import "./ArmonizacionFilaEditor.css";
import "./IndicadorCompuestoEditor.css";

// ---- Abrir ------------------------------------------------------------------

/** Abre el editor: sin `foco` es uno nuevo; con `foco`, el guardado. */
export function useAbrirIndicadorCompuesto(): (foco?: string) => void {
  const location = useLocation();
  const navigate = useNavigate();
  return useCallback(
    (foco?: string) =>
      navigate(
        {
          pathname: location.pathname,
          search: conNivel(
            conNivel(location.search, "panel", PANEL_INDICADOR_COMPUESTO.id),
            "foco",
            foco ?? null,
          ),
        },
        { replace: true },
      ),
    [location.pathname, location.search, navigate],
  );
}

// ---- Panel ------------------------------------------------------------------

export type IndicadorCompuestoEditorProps = {
  estado: EquivalenciasEstado | null;
  cargandoEstado: boolean;
  /** Bases en el orden de la serie, las mismas columnas de la tabla. */
  bases: string[];
  variablesPorBase: Record<string, VariableDeBase[]>;
  /** `indice`: posición de la fila guardada en `out.estado.filas`. */
  onGuardado: (out: EquivalenciasImportacion, indice: number, mensaje: string) => void;
};

export function IndicadorCompuestoEditor(props: IndicadorCompuestoEditorProps) {
  return useInRouterContext() ? <PanelConDireccion {...props} /> : null;
}

function PanelConDireccion({ estado, cargandoEstado, bases, variablesPorBase, onGuardado }: IndicadorCompuestoEditorProps) {
  const panel = usePanelDireccionable(PANEL_INDICADOR_COMPUESTO);
  const { foco } = useSeccion("procesamiento");
  const location = useLocation();
  const navigate = useNavigate();
  const guardadas = useMemo(() => estado?.filas ?? [], [estado?.filas]);
  const indice = indiceDeFoco(guardadas, foco);
  const fila = indice === null ? null : guardadas[indice];
  const ultimoFoco = useRef<string | null>(null);
  if (panel.abierto) ultimoFoco.current = foco;

  const cerrar = useCallback(() => {
    navigate(
      { pathname: location.pathname, search: conNivel(conNivel(location.search, "panel", null), "foco", null) },
      { replace: true },
    );
  }, [location.pathname, location.search, navigate]);

  // Sin foco es uno nuevo; con foco, sólo una fila compuesta guardada se edita.
  const vacio = !foco
    ? null
    : !estado
      ? cargandoEstado ? "Revisando la declaración del estudio…" : "No se pudo leer la declaración del estudio."
      : !fila
        ? "Esta fila no está en la declaración guardada."
        : !esCompuesta(fila)
          ? "Esta fila es una pregunta equivalente, no un indicador compuesto."
          : null;

  return (
    <Dialog.Root open={panel.abierto} onOpenChange={(abierto) => { if (!abierto) cerrar(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="pulso-armon-velo" />
        <Dialog.Content
          className="pulso-armon pulso-compuesto"
          {...panel.props}
          // Sin `false`: el panel se monta sobre una vista que ya publicó su
          // readiness y un `false` anidado la bloquearía.
          data-audit-ready={vacio ? "vacio:sin-fila" : "true"}
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            const f = ultimoFoco.current;
            const disparador = document.querySelector<HTMLElement>(
              f ? `button[data-compuesto-abrir="${CSS.escape(f)}"]` : "button[data-compuesto-nuevo]",
            );
            if (!disparador) return;
            event.preventDefault();
            disparador.focus();
          }}
        >
          {vacio === null ? (
            <EditorCompuesto
              key={`${indice ?? "nuevo"}:${estado?.revision ?? ""}`}
              fila={fila}
              indice={indice}
              guardadas={guardadas}
              bases={bases}
              variablesPorBase={variablesPorBase}
              onGuardado={(out, i, mensaje) => {
                onGuardado(out, i, mensaje);
                cerrar();
              }}
              onCerrar={cerrar}
            />
          ) : (
            <div className="pulso-armon-marco">
              <header className="pulso-armon-cabecera">
                <div className="pulso-armon-titular">
                  <Dialog.Title className="pulso-armon-titulo">Indicador compuesto</Dialog.Title>
                  <Dialog.Close className="pulso-armon-cerrar" aria-label="Cerrar">
                    <X size={16} aria-hidden="true" />
                  </Dialog.Close>
                </div>
              </header>
              {/* C5: vacío legítimo, el enlace nombra una fila que no se puede editar aquí. */}
              <div className="pulso-armon-cuerpo">
                <p className="pulso-armon-vacio">{vacio}</p>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ---- Editor -----------------------------------------------------------------

function EditorCompuesto({
  fila,
  indice,
  guardadas,
  bases,
  variablesPorBase,
  onGuardado,
  onCerrar,
}: {
  fila: EquivalenciaFila | null;
  indice: number | null;
  guardadas: readonly EquivalenciaFila[];
  bases: string[];
  variablesPorBase: Record<string, VariableDeBase[]>;
  onGuardado: (out: EquivalenciasImportacion, indice: number, mensaje: string) => void;
  onCerrar: () => void;
}) {
  const [borrador, despachar] = useReducer(reducirCompuesto, undefined, () => borradorCompuestoDesde(fila, bases));
  const [envio, setEnvio] = useState<{ guardando: boolean; error: string; sucio: boolean }>({
    guardando: false,
    error: "",
    sucio: false,
  });
  const errores = validarCompuesto(borrador, bases);

  // ADR 0105: conteos de la fila GUARDADA por base. Una fila nueva no los
  // tiene; con cambios sin guardar no se muestran, porque serían de otra cosa.
  const [conteos, setConteos] = useState<Record<string, ConteosCompuesto | "error">>({});
  const referencia = fila && indice !== null ? fila.id ?? String(indice) : null;
  const basesGuardadas = Object.keys(fila?.derivada?.por_base ?? {}).join("|");
  useEffect(() => {
    if (!referencia || !basesGuardadas) return undefined;
    let vigente = true;
    for (const base of basesGuardadas.split("|")) {
      getConteosCompuesto(referencia, base)
        .then((c) => {
          if (!vigente || !c) return;
          setConteos((prev) => ({ ...prev, [base]: c }));
        })
        .catch(() => {
          if (vigente) setConteos((prev) => ({ ...prev, [base]: "error" }));
        });
    }
    return () => {
      vigente = false;
    };
  }, [referencia, basesGuardadas]);
  const conteoDe = (base: string): string | null => {
    const c = conteos[base];
    if (envio.sucio || !c) return null;
    return c === "error" ? "No se pudieron contar los casos." : textoConteos(c, base);
  };

  const estadoGuardado: SaveState = envio.guardando ? "saving" : envio.error ? "error" : envio.sucio ? "dirty" : "idle";

  const despacharSucio = (a: AccionCompuesto) => {
    despachar(a);
    setEnvio((e) => ({ ...e, sucio: true }));
  };

  const guardar = async () => {
    setEnvio((e) => ({ ...e, guardando: true, error: "" }));
    try {
      const nueva = filaDeCompuesto(borrador, bases, fila);
      const out = await guardarEquivalencias(filasConCompuesto(guardadas, indice, nueva));
      const destino = indice ?? guardadas.length;
      onGuardado(out, destino, `Indicador «${nueva.etiqueta_estandar}» guardado.`);
    } catch (e) {
      setEnvio((x) => ({ ...x, guardando: false, error: e instanceof Error ? e.message : String(e) }));
    }
  };

  return (
    <div className="pulso-armon-marco">
      <header className="pulso-armon-cabecera">
        <div className="pulso-armon-titular">
          <div>
            <p className="pulso-armon-eyebrow">Indicador compuesto</p>
            <Dialog.Title className="pulso-armon-titulo">
              {fila ? fila.etiqueta_estandar || "Indicador sin nombre" : "Nuevo indicador compuesto"}
            </Dialog.Title>
          </div>
          <Dialog.Close className="pulso-armon-cerrar" aria-label="Cerrar">
            <X size={16} aria-hidden="true" />
          </Dialog.Close>
        </div>
        <p className="pulso-armon-regla">
          Vale «Sí» si alguna de las preguntas elegidas tiene uno de los códigos indicados.
        </p>
      </header>

      {/* C4: un único dueño de scroll; cabecera y pie quedan fuera. */}
      <div
        className="pulso-armon-cuerpo"
        data-qa-geometry-group="carga-indicador-compuesto"
        data-qa-geometry-contract="intrinsic"
      >
        <section className="pulso-armon-seccion pulso-compuesto-datos" aria-label="Nombre y sección" data-qa-geometry-member>
          <label className="pulso-compuesto-campo">
            <span>Nombre estándar</span>
            <input
              value={borrador.etiqueta}
              placeholder="Cómo se llama en el informe"
              onChange={(e) => despacharSucio({ tipo: "etiqueta", valor: e.target.value })}
            />
          </label>
          <label className="pulso-compuesto-campo">
            <span>Sección</span>
            <input
              value={borrador.seccion}
              placeholder="Opcional"
              onChange={(e) => despacharSucio({ tipo: "seccion", valor: e.target.value })}
            />
          </label>
        </section>

        {bases.length === 0 ? (
          <p className="pulso-armon-vacio">El estudio todavía no tiene bases con instrumento.</p>
        ) : (
          bases.map((base) => (
            <BaseCompuesta
              key={base}
              base={base}
              entrada={borrador.porBase[base] ?? { variables: [], codigosTexto: "1" }}
              opciones={variablesPorBase[base] ?? []}
              conteo={conteoDe(base)}
              despachar={despacharSucio}
            />
          ))
        )}
      </div>

      <footer className="pulso-armon-pie">
        <div className="pulso-armon-pie-estado" aria-live="polite">
          <SaveStatusIndicator state={estadoGuardado} variant="badge" />
          {envio.error ? (
            <span className="pulso-armon-error" role="alert">{envio.error}</span>
          ) : envio.sucio && errores.length > 0 ? (
            <span className="pulso-armon-error">{errores[0]}</span>
          ) : null}
        </div>
        <PulsoButton variant="secondary" className="pulso-armon-btn" onClick={onCerrar}>
          Cerrar
        </PulsoButton>
        <PulsoButton
          variant="primary"
          className="pulso-armon-btn"
          disabled={envio.guardando || !envio.sucio || errores.length > 0}
          onClick={() => void guardar()}
        >
          <Save size={14} aria-hidden="true" />
          {envio.guardando ? "Guardando…" : "Guardar indicador"}
        </PulsoButton>
      </footer>
    </div>
  );
}

// ---- Una base -----------------------------------------------------------------

export function BaseCompuesta({
  base,
  entrada,
  opciones,
  conteo,
  despachar,
}: {
  base: string;
  entrada: BaseBorradorCompuesto;
  opciones: readonly VariableDeBase[];
  /** Conteos de lo guardado; `null` o ausente no pinta nada. */
  conteo?: string | null;
  despachar: (a: AccionCompuesto) => void;
}) {
  const [consulta, setConsulta] = useState("");
  const { visibles, resto } = resultadosBusqueda(opciones, consulta, entrada.variables);
  const ayuda = opcionesDeAyuda(opciones, entrada.variables);
  const codigos = parsearCodigos(entrada.codigosTexto);
  const etiquetaDe = (nombre: string) => etiquetaLegible(opciones.find((o) => o.name === nombre)?.label);
  const sinPreguntas = entrada.variables.length === 0;

  return (
    <section
      className={`pulso-armon-seccion pulso-compuesto-base${sinPreguntas ? " is-vacia" : ""}`}
      aria-label={`Base ${base}`}
      data-qa-geometry-member
    >
      <div className="pulso-armon-seccion-head">
        <h3>
          {base} <small>{sinPreguntas ? "sin declarar" : `${entrada.variables.length} ${entrada.variables.length === 1 ? "pregunta" : "preguntas"}`}</small>
        </h3>
      </div>

      {/* C3: el vacío de la base vive en su propia sección. */}
      {sinPreguntas ? (
        <p className="pulso-armon-vacio">Sin preguntas elegidas: {base} queda sin declarar.</p>
      ) : (
        <ul className="pulso-compuesto-elegidas" aria-label={`Preguntas de ${base}`}>
          {entrada.variables.map((v) => (
            <li key={v}>
              <code>{v}</code>
              {etiquetaDe(v) && <span className="pulso-compuesto-etiqueta">{etiquetaDe(v)}</span>}
              <button
                type="button"
                className="pulso-icon pulso-icon-danger"
                aria-label={`Quitar ${v} de ${base}`}
                onClick={() => despachar({ tipo: "quitar", base, variable: v })}
              >
                <X size={12} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {!sinPreguntas && conteo && <p className="pulso-compuesto-conteos">{conteo}</p>}

      {opciones.length === 0 ? (
        <p className="pulso-armon-nota">Esta base no tiene preguntas en su instrumento.</p>
      ) : (
        <div className="pulso-compuesto-busqueda">
          <label className="pulso-compuesto-buscar">
            <Search size={13} aria-hidden="true" />
            <span className="pulso-sr-only">Buscar pregunta en {base}</span>
            <input
              type="search"
              value={consulta}
              placeholder="Buscar pregunta…"
              onChange={(e) => setConsulta(e.target.value)}
            />
          </label>
          {consulta.trim() && (
            visibles.length === 0 ? (
              <p className="pulso-armon-nota">Ninguna pregunta casa con «{consulta.trim()}».</p>
            ) : (
              <ul className="pulso-compuesto-resultados" aria-label={`Resultados en ${base}`}>
                {visibles.map((o) => (
                  <li key={o.name}>
                    <button
                      type="button"
                      onClick={() => despachar({ tipo: "agregar", base, variable: o.name })}
                      aria-label={`Agregar ${etiquetaLegible(o.label) || o.name} (${o.name})`}
                    >
                      <Plus size={12} aria-hidden="true" />
                      <code>{o.name}</code>
                      <span className="pulso-compuesto-etiqueta">{etiquetaLegible(o.label)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          )}
          {resto > 0 && <p className="pulso-armon-nota">{resto} más: afina la búsqueda.</p>}
        </div>
      )}

      {!sinPreguntas && (
        <div className="pulso-compuesto-codigos">
          <label className="pulso-compuesto-campo">
            <span>Códigos «sí»</span>
            <input
              value={entrada.codigosTexto}
              inputMode="numeric"
              aria-invalid={codigos.length === 0 || undefined}
              onChange={(e) => despachar({ tipo: "codigos", base, valor: e.target.value })}
            />
          </label>
          {ayuda.length > 0 && (
            <div className="pulso-compuesto-ayuda" role="group" aria-label={`Opciones de ${entrada.variables[0]}`}>
              {ayuda.map((o) => (
                <button
                  key={o.codigo}
                  type="button"
                  className="pulso-compuesto-opcion"
                  aria-pressed={codigos.includes(o.codigo)}
                  onClick={() => despachar({ tipo: "alternar-codigo", base, codigo: o.codigo })}
                >
                  <code>{o.codigo}</code> {o.etiqueta}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ---- Botón ------------------------------------------------------------------

/** «Añadir indicador compuesto»: abre el panel sin foco. */
export function AnadirIndicadorCompuestoBoton({ onAbrir, size }: { onAbrir: () => void; size?: "sm" }) {
  return (
    <PulsoButton
      variant="secondary"
      size={size}
      className="pulso-equiv-btn"
      onClick={onAbrir}
      aria-haspopup="dialog"
      data-compuesto-nuevo=""
    >
      <Combine size={size ? 13 : 14} aria-hidden="true" />
      Añadir indicador compuesto
    </PulsoButton>
  );
}
