// Mapa de bases (checklist OIGD 2026-10-15, G1): qué tiene cada base y qué le
// falta frente a las otras.
//
// Direccionable: `?panel=mapa-bases` muestra el resumen por base y la matriz con
// un indicador por base; `?panel=mapa-bases&foco=<base>` muestra las variables
// de esa base que no están en ninguna fila, con «Añadir a la matriz».
//
// Reusa la cáscara del sideover de armonización (`pulso-armon*`): un único
// dueño de scroll, el cuerpo del panel. La lógica vive en `mapaBasesModel`.

import { useCallback, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useInRouterContext, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  CircleSlash2,
  Grid3x3,
  Minus,
  Plus,
  Search,
  X,
} from "../../vendor/lucide-react";
import type { VariableDeBase } from "../../api/equivalencias";
import { usePanelDireccionable } from "../../lib/navegacion/paneles";
import { conNivel } from "../../lib/navegacion/direccion";
import { useSeccion } from "../../lib/navegacion/useDireccion";
import { formatoConteo, formatoConteoDe } from "../../lib/formatoNumero";
import { PulsoButton } from "../../components/PulsoButton";
import { seccionLegible, type FilaEditor } from "./equivalenciasEditorModel";
import { useDesbordeHorizontal } from "./useDesbordeHorizontal";
import { etiquetaLegible } from "./preguntaEquivalenteModel";
import { searchConVariablesBase } from "./variablesBase/variablesBaseModel";
import {
  PANEL_MAPA_BASES,
  filasDelMapa,
  resumenPorBase,
  textoFaltaEn,
  separarMetadatos,
  variablesFuera,
  type FilaDelMapa,
  type PresenciaEnBase,
  type ResumenDeBase,
} from "./mapaBasesModel";
import "./ArmonizacionFilaEditor.css";
import "./MapaBasesPanel.css";

// ---- Abrir --------------------------------------------------------------------

export function MapaBasesBoton({ disabled }: { disabled?: boolean }) {
  const panel = usePanelDireccionable(PANEL_MAPA_BASES);
  return (
    <PulsoButton
      variant="secondary"
      className="pulso-equiv-btn"
      onClick={panel.abrir}
      disabled={disabled}
      aria-haspopup="dialog"
      data-mapa-bases-abrir
    >
      <Grid3x3 size={14} aria-hidden="true" />
      Mapa de bases
    </PulsoButton>
  );
}

// ---- Panel --------------------------------------------------------------------

export type MapaBasesPanelProps = {
  cargando: boolean;
  /** Bases en el orden de la serie, las columnas de la tabla. */
  bases: readonly string[];
  /** La matriz tal como se ve, con sus cambios sin guardar. */
  filas: readonly FilaEditor[];
  variablesPorBase: Record<string, VariableDeBase[]>;
  /** Añade una fila con esa pregunta elegida en su base; devuelve el id de la fila. */
  onAnadir: (base: string, variable: string) => string;
};

export function MapaBasesPanel(props: MapaBasesPanelProps) {
  return useInRouterContext() ? <PanelConDireccion {...props} /> : null;
}

function enfocarFila(filaId: string) {
  const fila = document.querySelector<HTMLElement>(`tr[data-equiv-fila="${CSS.escape(filaId)}"]`);
  if (!fila) return;
  const reducido = typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  fila.scrollIntoView({ block: "center", behavior: reducido ? "auto" : "smooth" });
  const destino = fila.querySelector<HTMLElement>(".pulso-preg-disparador.is-vacio")
    ?? fila.querySelector<HTMLElement>("input, button");
  destino?.focus({ preventScroll: true });
}

function PanelConDireccion({ cargando, bases, filas, variablesPorBase, onAnadir }: MapaBasesPanelProps) {
  const panel = usePanelDireccionable(PANEL_MAPA_BASES);
  const { foco } = useSeccion("procesamiento");
  const location = useLocation();
  const navigate = useNavigate();
  const filaPorEnfocar = useRef<string | null>(null);

  const irA = useCallback(
    (base: string | null) =>
      navigate({ pathname: location.pathname, search: conNivel(location.search, "foco", base) }, { replace: true }),
    [location.pathname, location.search, navigate],
  );
  const cerrar = useCallback(() => {
    navigate(
      { pathname: location.pathname, search: conNivel(conNivel(location.search, "panel", null), "foco", null) },
      { replace: true },
    );
  }, [location.pathname, location.search, navigate]);

  // ADR 0106: lo que la base trae fuera del formulario se declara en su panel.
  const abrirVariables = useCallback(
    (base: string) =>
      navigate({ pathname: location.pathname, search: searchConVariablesBase(location.search, base) }, { replace: true }),
    [location.pathname, location.search, navigate],
  );

  const anadir = (base: string, variable: string) => {
    filaPorEnfocar.current = onAnadir(base, variable);
    cerrar();
  };

  return (
    <Dialog.Root open={panel.abierto} onOpenChange={(abierto) => { if (!abierto) cerrar(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="pulso-armon-velo" />
        <Dialog.Content
          className="pulso-armon pulso-mapa"
          {...panel.props}
          // Sin `false`: el panel se monta sobre una vista que ya publicó su
          // readiness; mientras la pestaña lee, su esqueleto la publica.
          data-audit-ready={cargando ? "false" : "true"}
          data-mapa-estado={cargando ? "leyendo" : "listo"}
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            const filaId = filaPorEnfocar.current;
            if (!filaId) return;
            filaPorEnfocar.current = null;
            event.preventDefault();
            requestAnimationFrame(() => enfocarFila(filaId));
          }}
        >
          <div className="pulso-armon-marco">
            <header className="pulso-armon-cabecera">
              <div className="pulso-armon-titular">
                <div>
                  <p className="pulso-armon-eyebrow">Equivalencias</p>
                  <Dialog.Title className="pulso-armon-titulo">Mapa de bases</Dialog.Title>
                </div>
                <Dialog.Close className="pulso-armon-cerrar" aria-label="Cerrar">
                  <X size={16} aria-hidden="true" />
                </Dialog.Close>
              </div>
              <p className="pulso-armon-regla">Qué tiene cada base y qué le falta frente a las otras.</p>
            </header>

            {/* C4: un único dueño de scroll, el cuerpo. La lista larga de una base crece aquí. */}
            <div
              className="pulso-armon-cuerpo"
              data-qa-geometry-group="carga-mapa-bases"
              data-qa-geometry-contract="intrinsic"
            >
              <MapaBasesCuerpo
                cargando={cargando}
                bases={bases}
                filas={filas}
                variablesPorBase={variablesPorBase}
                foco={foco}
                onIr={irA}
                onAnadir={anadir}
                onVariables={abrirVariables}
              />
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ---- Cuerpo -------------------------------------------------------------------

export type MapaBasesCuerpoProps = {
  cargando: boolean;
  bases: readonly string[];
  filas: readonly FilaEditor[];
  variablesPorBase: Record<string, VariableDeBase[]>;
  /** `foco` de la dirección: una base, o nada para la matriz. */
  foco: string | null;
  onIr: (base: string | null) => void;
  onAnadir: (base: string, variable: string) => void;
  /** Abre «Variables de la base» (ADR 0106); sin él no se ofrece. */
  onVariables?: (base: string) => void;
};

/** Lo que va dentro del dueño de scroll. Aparte del diálogo para poder renderizarlo sin portal. */
export function MapaBasesCuerpo({ cargando, bases, filas, variablesPorBase, foco, onIr, onAnadir, onVariables }: MapaBasesCuerpoProps) {
  const resumen = useMemo(() => resumenPorBase(bases, filas, variablesPorBase), [bases, filas, variablesPorBase]);
  const baseActiva = foco && bases.includes(foco) ? foco : null;
  if (cargando) {
    // C5: no es vacío, es la lectura en curso.
    return <p className="pulso-armon-vacio">Leyendo la matriz y las variables de cada base…</p>;
  }
  if (bases.length === 0) {
    // C5 categoría 1: vacío legítimo, el estudio no tiene bases separadas.
    return <p className="pulso-armon-vacio">Este estudio todavía no tiene bases que comparar.</p>;
  }
  return (
    <>
      <ResumenBases resumen={resumen} activa={baseActiva} onIr={onIr} onVariables={onVariables} />
      {foco && !baseActiva ? (
        <section className="pulso-armon-seccion" data-qa-geometry-member>
          <p className="pulso-armon-vacio">La base «{foco}» no está en este estudio.</p>
          <div>
            <PulsoButton variant="secondary" size="sm" className="pulso-armon-btn" onClick={() => onIr(null)}>
              <ArrowLeft size={13} aria-hidden="true" />
              Ver la matriz
            </PulsoButton>
          </div>
        </section>
      ) : baseActiva ? (
        <FueraDeLaMatriz
          key={baseActiva}
          base={baseActiva}
          filas={filas}
          variablesPorBase={variablesPorBase}
          total={resumen.find((r) => r.base === baseActiva)?.total ?? 0}
          onVolver={() => onIr(null)}
          onAnadir={onAnadir}
        />
      ) : (
        <MatrizPorBase bases={bases} filas={filas} />
      )}
    </>
  );
}

// ---- Resumen por base -------------------------------------------------------------

function ResumenBases({
  resumen,
  activa,
  onIr,
  onVariables,
}: {
  resumen: readonly ResumenDeBase[];
  activa: string | null;
  onIr: (base: string | null) => void;
  onVariables?: (base: string) => void;
}) {
  return (
    <ul className="pulso-mapa-resumen" aria-label="Resumen por base" data-qa-geometry-member>
      {resumen.map((r) => {
        const esActiva = r.base === activa;
        return (
          <li
            key={r.base}
            className={esActiva ? "is-activa" : undefined}
            data-qa-geometry-group="carga-mapa-bases-base"
            data-qa-geometry-contract="equal"
          >
            <strong>{r.base}</strong>
            <span className="pulso-mapa-resumen-total">
              {r.total > 0 ? formatoConteoDe(r.total, "variable", "variables") : "Sin variables en el catálogo"}
            </span>
            <span className="pulso-mapa-resumen-reparto">
              {formatoConteo(r.enMatriz)} en la matriz · {formatoConteo(r.fuera)} fuera
            </span>
            <button
              type="button"
              className="pulso-mapa-resumen-ir"
              aria-current={esActiva ? "true" : undefined}
              disabled={!esActiva && r.fuera === 0}
              onClick={() => onIr(esActiva ? null : r.base)}
            >
              {esActiva ? "Ver la matriz" : r.fuera === 0 ? "Todas en la matriz" : `Ver las ${formatoConteo(r.fuera)} fuera`}
            </button>
            {onVariables && (
              <button
                type="button"
                className="pulso-mapa-resumen-ir"
                aria-haspopup="dialog"
                aria-label={`Variables de la base ${r.base}`}
                data-plf-abrir={`variables-base:${r.base}`}
                onClick={() => onVariables(r.base)}
              >
                Variables de la base
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ---- Matriz con un indicador por base --------------------------------------------

const TEXTO_PRESENCIA: Record<PresenciaEnBase, string> = {
  presente: "Presente",
  falta: "Falta",
  "no-comparable": "No comparable",
};

function CeldaPresencia({ presencia, variable, base }: { presencia: PresenciaEnBase; variable: string; base: string }) {
  const icono = presencia === "presente"
    ? <CheckCircle2 size={12} aria-hidden="true" />
    : presencia === "no-comparable"
      ? <CircleSlash2 size={12} aria-hidden="true" />
      : <Minus size={12} aria-hidden="true" />;
  const texto = presencia === "presente" && variable && !variable.includes("(") ? variable : TEXTO_PRESENCIA[presencia];
  return (
    <span className={`pulso-mapa-presencia is-${presencia}`} title={`${TEXTO_PRESENCIA[presencia]} en ${base}`}>
      {icono}
      <span>{texto}</span>
      {texto !== TEXTO_PRESENCIA[presencia] && <span className="pulso-sr-only">{TEXTO_PRESENCIA[presencia]}</span>}
    </span>
  );
}

function MatrizPorBase({ bases, filas }: { bases: readonly string[]; filas: readonly FilaEditor[] }) {
  const [soloIncompletas, setSoloIncompletas] = useState(false);
  const [marcoRef, desborda] = useDesbordeHorizontal();
  const todas: FilaDelMapa[] = useMemo(() => filasDelMapa(bases, filas), [bases, filas]);
  const visibles = soloIncompletas ? todas.filter((f) => f.incompleta) : todas;
  return (
    <section className="pulso-armon-seccion" aria-labelledby="pulso-mapa-matriz" data-qa-geometry-member>
      <div className="pulso-armon-seccion-head">
        <div className="pulso-armon-seccion-titulo">
          <h3 id="pulso-mapa-matriz">Preguntas de la matriz</h3>
          <p className="pulso-armon-ayuda">
            {todas.length === 0
              ? "Todavía no hay preguntas en la matriz."
              : `${formatoConteoDe(todas.length, "pregunta", "preguntas")}. ${textoFaltaEn(todas)}`}
          </p>
        </div>
        {todas.some((f) => f.incompleta) && (
          <label className="pulso-mapa-filtro">
            <input
              type="checkbox"
              checked={soloIncompletas}
              onChange={(e) => setSoloIncompletas(e.currentTarget.checked)}
            />
            Sólo las que faltan en alguna base
          </label>
        )}
      </div>
      {todas.length === 0 ? (
        // C3: el vacío es de esta sección y dice cómo se llena.
        <p className="pulso-armon-vacio">Elige una base arriba para ver sus variables y añadirlas a la matriz.</p>
      ) : (
        <div
          ref={marcoRef}
          className={desborda ? "pulso-mapa-tabla-wrap is-desborda" : "pulso-mapa-tabla-wrap"}
          data-scroll-axis={desborda ? "x" : undefined}
          role={desborda ? "region" : undefined}
          aria-label={desborda ? "Preguntas de la matriz por base, desplázate a la derecha para ver todas" : undefined}
          tabIndex={desborda ? 0 : undefined}
        >
          <table className="pulso-mapa-tabla" style={{ minWidth: `${220 + bases.length * 130}px` }}>
            <thead>
              <tr>
                <th scope="col">Nombre estándar</th>
                {bases.map((b) => <th key={b} scope="col">{b}</th>)}
              </tr>
            </thead>
            <tbody>
              {visibles.map((f) => (
                <tr key={f.posicion} className={f.incompleta ? "is-incompleta" : undefined}>
                  <th scope="row">{f.etiqueta || <span className="pulso-armon-tenue">Sin nombre estándar</span>}</th>
                  {f.porBase.map((p) => (
                    <td key={p.base}>
                      <CeldaPresencia presencia={p.presencia} variable={p.variable} base={p.base} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ---- Variables fuera de la matriz -------------------------------------------------

function FueraDeLaMatriz({
  base,
  filas,
  variablesPorBase,
  total,
  onVolver,
  onAnadir,
}: {
  base: string;
  filas: readonly FilaEditor[];
  variablesPorBase: Record<string, VariableDeBase[]>;
  total: number;
  onVolver: () => void;
  onAnadir: (base: string, variable: string) => void;
}) {
  const [consulta, setConsulta] = useState("");
  const todas = useMemo(() => variablesFuera(base, filas, variablesPorBase), [base, filas, variablesPorBase]);
  const visibles = useMemo(
    () => variablesFuera(base, filas, variablesPorBase, consulta),
    [base, consulta, filas, variablesPorBase],
  );
  const conteo = consulta.trim()
    ? `${formatoConteo(visibles.length)} de ${formatoConteo(todas.length)}`
    : formatoConteoDe(todas.length, "variable", "variables");
  return (
    <section className="pulso-armon-seccion" aria-labelledby="pulso-mapa-fuera" data-qa-geometry-member>
      <div className="pulso-armon-seccion-head">
        <div className="pulso-armon-seccion-titulo">
          <h3 id="pulso-mapa-fuera">Fuera de la matriz en {base}</h3>
          <p className="pulso-armon-ayuda">Variables de {base} que todavía no están en ninguna fila.</p>
        </div>
        <PulsoButton variant="secondary" size="sm" className="pulso-armon-btn" onClick={onVolver}>
          <ArrowLeft size={13} aria-hidden="true" />
          Ver la matriz
        </PulsoButton>
      </div>

      {total === 0 ? (
        // C5 categoría 3: el catálogo de la base no llegó o está vacío.
        <p className="pulso-armon-vacio">No hay variables del instrumento de {base} para mostrar.</p>
      ) : todas.length === 0 ? (
        // C5 categoría 1: vacío legítimo.
        <p className="pulso-armon-vacio">Todas las variables de {base} están en la matriz.</p>
      ) : (
        <>
          <div className="pulso-mapa-buscar">
            <Search size={13} aria-hidden="true" />
            <input
              type="search"
              value={consulta}
              placeholder="Buscar por texto o código"
              aria-label={`Buscar entre las variables de ${base} fuera de la matriz`}
              onChange={(e) => setConsulta(e.target.value)}
            />
            <span className="pulso-mapa-buscar-conteo" aria-live="polite">{conteo}</span>
          </div>
          {visibles.length === 0 ? (
            <p className="pulso-armon-vacio">Ninguna variable de {base} fuera de la matriz casa con «{consulta.trim()}».</p>
          ) : (
            <>
            {separarMetadatos(visibles).preguntas.length > 0 && (
            <ul className="pulso-mapa-fuera" aria-label={`Variables de ${base} fuera de la matriz`}>
              {separarMetadatos(visibles).preguntas.map((v) => {
                const etiqueta = etiquetaLegible(v.label);
                return (
                  <li key={v.name}>
                    <code>{v.name}</code>
                    <span className="pulso-mapa-fuera-texto">
                      <span>{etiqueta || <span className="pulso-armon-tenue">Sin etiqueta</span>}</span>
                      {v.seccion && <small>{seccionLegible(v.seccion)}</small>}
                    </span>
                    <PulsoButton
                      variant="secondary"
                      size="sm"
                      className="pulso-armon-btn"
                      aria-label={`Añadir a la matriz: ${v.name} de ${base}`}
                      onClick={() => onAnadir(base, v.name)}
                    >
                      <Plus size={13} aria-hidden="true" />
                      Añadir a la matriz
                    </PulsoButton>
                  </li>
                );
              })}
            </ul>
            )}
            {separarMetadatos(visibles).metadatos.length > 0 && (
              <details className="pulso-mapa-metadatos">
                <summary>
                  Identificadores, fechas y consentimientos ({formatoConteo(separarMetadatos(visibles).metadatos.length)})
                </summary>
                <ul className="pulso-mapa-fuera" aria-label={`Metadatos de ${base}`}>
                  {separarMetadatos(visibles).metadatos.map((v) => (
                    <li key={v.name}>
                      <code>{v.name}</code>
                      <span className="pulso-mapa-fuera-texto">
                        <span>{etiquetaLegible(v.label) || <span className="pulso-armon-tenue">Sin etiqueta</span>}</span>
                      </span>
                      <PulsoButton
                        variant="secondary"
                        size="sm"
                        className="pulso-armon-btn"
                        aria-label={`Añadir a la matriz: ${v.name} de ${base}`}
                        onClick={() => onAnadir(base, v.name)}
                      >
                        <Plus size={13} aria-hidden="true" />
                        Añadir a la matriz
                      </PulsoButton>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            </>
          )}
        </>
      )}
    </section>
  );
}
