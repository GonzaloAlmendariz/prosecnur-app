// Recorrido de la serie (Carga › Equivalencias, estudios con 2 o más bases).
//
// Una banda de seis pasos numerados: cada uno dice su estado en dos palabras y
// lleva a donde se resuelve. No es un stepper (`Stepper`/`StageStepper`): no
// hay paso «actual» ni avance secuencial; es una lista de enlaces con estado.
// Con los seis hechos se pliega a una línea.
//
// La lógica vive en `recorridoSerieModel.ts`; aquí sólo se presenta.

import { useMemo, useState } from "react";
import { Link, useInRouterContext, useLocation } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  CircleDot,
  Loader2,
  Route,
} from "../../../vendor/lucide-react";
import type { EquivalenciaFila } from "../../../api/equivalencias";
import { useOptionalSession } from "../../../lib/SessionContext";
import { ponderacionDeLaSerie, type PonderacionEnSerie } from "../../analitica/ponderacionSerieModel";
import { ordenPorAnio } from "../nombreDeSerie";
import {
  TEXTO_ESTADO,
  hrefDeEnlace,
  pasosDelRecorrido,
  readinessRecorrido,
  resumenRecorrido,
  todoHecho,
  type EstadoPaso,
  type Lectura,
  type PasoRecorrido,
} from "./recorridoSerieModel";
import { useRecorridoSerie } from "./useRecorridoSerie";
import "./RecorridoSerie.css";

export type RecorridoSerieProps = {
  /** Bases en el orden de la serie. */
  bases: readonly string[];
  ordenDeclarado: boolean;
  ordenEditable: boolean;
  /** Filas guardadas de la matriz. */
  filas: readonly EquivalenciaFila[];
};

/** Montada en Carga › Equivalencias. Sin router (render aislado) no hay enlaces que resolver. */
export function RecorridoSerie(props: RecorridoSerieProps) {
  const conRouter = useInRouterContext();
  if (props.bases.length < 2 || !conRouter) return null;
  return <RecorridoConLecturas {...props} />;
}

function RecorridoConLecturas({ bases, ordenDeclarado, ordenEditable, filas }: RecorridoSerieProps) {
  const activa = useOptionalSession()?.state?.active_base ?? null;
  const clavesBases = bases.join("|");
  const lecturas = useRecorridoSerie(clavesBases, activa);
  const { pathname, search } = useLocation();

  const ponderacion = useMemo((): Lectura<readonly PonderacionEnSerie[]> => {
    const l = lecturas.ponderacionActiva;
    if (l.tipo === "cargando") return l;
    // Si la lectura de la activa falló, ninguna base se supone: todas quedan sin leer.
    return { tipo: "listo", datos: ponderacionDeLaSerie(bases, activa, l.tipo === "listo" ? l.datos : null) };
  }, [lecturas.ponderacionActiva, bases, activa]);

  const pasos = useMemo(
    () => pasosDelRecorrido({
      bases,
      ordenDeclarado,
      ordenPorAnio: ordenPorAnio(bases) !== null,
      ordenEditable,
      filas,
      variables: lecturas.variables,
      segmentos: lecturas.segmentos,
      ponderacion,
    }),
    [bases, ordenDeclarado, ordenEditable, filas, lecturas.variables, lecturas.segmentos, ponderacion],
  );

  return (
    <RecorridoSerieBanda
      pasos={pasos}
      hrefDe={(p) => hrefDeEnlace(p.enlace, pathname, search)}
    />
  );
}

const ICONO: Record<EstadoPaso, typeof Circle> = {
  hecho: CheckCircle2,
  falta: AlertTriangle,
  "no-empezado": Circle,
  leyendo: Loader2,
  "sin-lectura": CircleDot,
};

export type RecorridoSerieBandaProps = {
  pasos: readonly PasoRecorrido[];
  hrefDe: (paso: PasoRecorrido) => string;
};

/** Presentación pura: la prueban los tests de render sin red ni router. */
export function RecorridoSerieBanda({ pasos, hrefDe }: RecorridoSerieBandaProps) {
  const completo = todoHecho(pasos);
  // `null`: el usuario no eligió; se pliega sola sólo si todo está hecho.
  const [abiertaPorUsuario, setAbiertaPorUsuario] = useState<boolean | null>(null);
  const abierta = abiertaPorUsuario ?? !completo;
  const idPasos = "pulso-recorrido-pasos";

  return (
    <section
      className={`pulso-recorrido${completo ? " is-completo" : ""}`}
      aria-labelledby="pulso-recorrido-titulo"
      data-qa-geometry-member
      data-audit-ready={readinessRecorrido(pasos)}
      data-surface-contract="carga-recorrido-serie"
    >
      <header className="pulso-recorrido-head">
        <h3 id="pulso-recorrido-titulo" className="pulso-recorrido-titulo">
          <Route size={14} aria-hidden="true" />
          Recorrido de la serie
        </h3>
        <span className="pulso-recorrido-resumen">{resumenRecorrido(pasos)}</span>
        {completo && (
          <button
            type="button"
            className="pulso-recorrido-plegar"
            aria-expanded={abierta}
            aria-controls={idPasos}
            onClick={() => setAbiertaPorUsuario(!abierta)}
          >
            {abierta ? <ChevronUp size={13} aria-hidden="true" /> : <ChevronDown size={13} aria-hidden="true" />}
            {abierta ? "Ocultar pasos" : "Ver pasos"}
          </button>
        )}
      </header>
      {abierta && (
        <ol
          id={idPasos}
          className="pulso-recorrido-pasos"
          data-qa-geometry-group="carga-recorrido-serie"
          data-qa-geometry-contract="equal"
        >
          {pasos.map((p) => {
            const Icono = ICONO[p.estado];
            return (
              <li key={p.id} className={`pulso-recorrido-paso is-${p.estado}`} data-qa-geometry-member data-paso={p.id}>
                <Link className="pulso-recorrido-enlace" to={hrefDe(p)} title={`Ir a ${p.enlace.etiqueta}`}>
                  <span className="pulso-recorrido-cabeza">
                    <span className="pulso-recorrido-numero" aria-hidden="true">{p.numero}</span>
                    <strong className="pulso-recorrido-nombre">{p.titulo}</strong>
                    <Icono
                      size={14}
                      aria-hidden="true"
                      className={`pulso-recorrido-icono${p.estado === "leyendo" ? " pulso-spin" : ""}`}
                    />
                  </span>
                  <span className="pulso-recorrido-detalle">{p.detalle}</span>
                  <span className="pulso-sr-only">{`. ${TEXTO_ESTADO[p.estado]}. Ir a ${p.enlace.etiqueta}.`}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
