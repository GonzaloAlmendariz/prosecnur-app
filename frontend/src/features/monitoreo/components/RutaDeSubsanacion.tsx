/**
 * La ruta de decisión de subsanación, ahora navegable.
 *
 * Había dos rutas de tres pasos compitiendo en la misma pantalla: esta, sobre
 * la lista, y la de la ficha del caso. Ninguna era clicable, así que ninguna
 * mandaba. Esta se queda y filtra de verdad; la de la ficha pasa a ser texto
 * de apoyo del caso abierto.
 */

import { useCallback, useMemo, useState } from "react";

import type { MonitoreoInternalQueryCase } from "../../../api/monitoreo";
import { internalCaseCrossingValue, internalCaseResponseStateValue } from "../internalQueries";
import {
  GRUPOS_DE_SUBSANACION,
  motivoDeNoCruce,
  type PrioridadDeCaso,
} from "../core/motivoDeNoCruce";

import "./rutaDeSubsanacion.css";

export type PasoDeSubsanacion = "todos" | "prioriza" | "comprueba" | "decide";

export type PrioridadDeCasoFn = (item: MonitoreoInternalQueryCase) => PrioridadDeCaso;

/** Un caso trae evidencia asistida cuando hay algo concreto que comprobar. */
export function casoTieneEvidenciaAsistida(item: MonitoreoInternalQueryCase) {
  return Boolean(item.assisted_review);
}

/**
 * Espera constancia el caso que aún puede sumar —recuperable o revisable— y no
 * tiene decisión registrada. Lo esperable queda fuera: cerrarlo no cambia nada.
 */
export function casoEsperaConstancia(
  item: MonitoreoInternalQueryCase,
  prioridadDe: PrioridadDeCasoFn,
) {
  return prioridadDe(item) !== "esperable" && !item.assisted_review?.manual_decision;
}

export function filtrarPorPasoDeSubsanacion(
  cases: MonitoreoInternalQueryCase[],
  paso: PasoDeSubsanacion,
  prioridadDe: PrioridadDeCasoFn,
): MonitoreoInternalQueryCase[] {
  if (paso === "prioriza") return cases.filter((item) => prioridadDe(item) === "recuperable");
  if (paso === "comprueba") return cases.filter(casoTieneEvidenciaAsistida);
  if (paso === "decide") return cases.filter((item) => casoEsperaConstancia(item, prioridadDe));
  return cases;
}

export type ConteoDePasos = {
  todos: number;
  prioriza: number;
  comprueba: number;
  decide: number;
};

export function contarPasosDeSubsanacion(
  cases: MonitoreoInternalQueryCase[],
  prioridadDe: PrioridadDeCasoFn,
): ConteoDePasos {
  return {
    todos: cases.length,
    prioriza: cases.filter((item) => prioridadDe(item) === "recuperable").length,
    comprueba: cases.filter(casoTieneEvidenciaAsistida).length,
    decide: cases.filter((item) => casoEsperaConstancia(item, prioridadDe)).length,
  };
}

type PasoVisible = {
  clave: PasoDeSubsanacion;
  orden: string;
  titulo: string;
  detalle: string;
  total: number;
};

function pasosVisibles(conteo: ConteoDePasos): PasoVisible[] {
  return [
    {
      clave: "prioriza",
      orden: "1",
      titulo: "Prioriza",
      detalle: "completas sin cruce, recuperables",
      total: conteo.prioriza,
    },
    {
      clave: "comprueba",
      orden: "2",
      titulo: "Comprueba",
      detalle: "con evidencia de llave para contrastar",
      total: conteo.comprueba,
    },
    {
      clave: "decide",
      orden: "3",
      // Un 0 mudo aquí se lee como "no hay nada", cuando significa lo contrario:
      // que todo lo que podía sumar ya tiene su decisión registrada.
      titulo: "Decide",
      detalle: conteo.decide === 0 && conteo.todos > 0
        ? "todas con constancia registrada"
        : "esperan constancia",
      total: conteo.decide,
    },
  ];
}

export function useRutaDeSubsanacion(
  cases: MonitoreoInternalQueryCase[],
  prioridadDe: PrioridadDeCasoFn,
) {
  const [paso, setPaso] = useState<PasoDeSubsanacion>("todos");
  const conteo = useMemo(() => contarPasosDeSubsanacion(cases, prioridadDe), [cases, prioridadDe]);
  const visibles = useMemo(
    () => filtrarPorPasoDeSubsanacion(cases, paso, prioridadDe),
    [cases, paso, prioridadDe],
  );
  return { paso, setPaso, conteo, visibles };
}

export type GrupoDeBandeja = {
  title: string;
  detalle: string;
  rows: MonitoreoInternalQueryCase[];
};

/**
 * Todo el estado de la bandeja, fuera del page-file.
 *
 * Vive aquí y no en `AcreditacionMonitoreoPage.tsx` por las dos razones de la
 * casa: el page-file está congelado a crecimiento, y su contrato de readiness
 * se verifica resolviendo identificadores de forma transitiva sobre el AST
 * completo — cada nombre nuevo en ese archivo encarece esa búsqueda.
 */
export function useBandejaDeSubsanacion(cases: MonitoreoInternalQueryCase[]) {
  const motivoDe = useCallback(
    (item: MonitoreoInternalQueryCase) => motivoDeNoCruce(
      item,
      internalCaseResponseStateValue(item),
      internalCaseCrossingValue(item),
    ),
    [],
  );
  const prioridadDe = useCallback(
    (item: MonitoreoInternalQueryCase) => motivoDe(item).prioridad,
    [motivoDe],
  );
  const ruta = useRutaDeSubsanacion(cases, prioridadDe);
  const grupos = useMemo<GrupoDeBandeja[]>(
    () => GRUPOS_DE_SUBSANACION
      .map((grupo) => ({
        title: grupo.titulo,
        detalle: grupo.detalle,
        rows: ruta.visibles.filter((item) => prioridadDe(item) === grupo.prioridad),
      }))
      .filter((grupo) => grupo.rows.length > 0),
    [ruta.visibles, prioridadDe],
  );
  return { ...ruta, grupos, motivoDe };
}

export function RutaDeSubsanacion({
  paso,
  conteo,
  onPaso,
}: {
  paso: PasoDeSubsanacion;
  conteo: ConteoDePasos;
  onPaso: (paso: PasoDeSubsanacion) => void;
}) {
  const pasos = pasosVisibles(conteo);
  return (
    <div className="mon-acr-ruta" role="group" aria-label="Ruta de decisión de subsanación">
      {pasos.map((item) => {
        const activo = paso === item.clave;
        const vacio = item.total === 0;
        return (
          <button
            key={item.clave}
            type="button"
            className={`mon-acr-ruta-paso${activo ? " is-active" : ""}`}
            aria-pressed={activo}
            disabled={vacio && !activo}
            onClick={() => onPaso(activo ? "todos" : item.clave)}
          >
            <em>{item.orden}</em>
            <span>
              <strong>{item.titulo}</strong>
              <small>{item.detalle}</small>
            </span>
            <b>{item.total.toLocaleString("es-PE")}</b>
          </button>
        );
      })}
      {paso === "todos" ? null : (
        <button type="button" className="mon-acr-ruta-todos" onClick={() => onPaso("todos")}>
          Ver todos
          <b>{conteo.todos.toLocaleString("es-PE")}</b>
        </button>
      )}
    </div>
  );
}
