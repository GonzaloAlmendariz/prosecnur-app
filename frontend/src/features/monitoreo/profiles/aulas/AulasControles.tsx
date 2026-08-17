import { useMemo } from "react";

import { AlertCircle, CheckCircle2, ShieldAlert } from "../../../../vendor/lucide-react";
import { aulasCheckLabel, aulasStatusLabel, presentDetail } from "./aulasPresentation";

/**
 * Los controles de Validación, leídos como avisos y no como una tabla.
 *
 * Eran nueve filas de «Control · Estado · Detalle» en una tabla de tres
 * columnas, y el detalle es lo que de verdad se lee: frases enteras —«CH 31: 26
 * asistentes menos 1 rechazos y 3 duplicados dan 22, pero el parte declara 21
 * efectivas»— aplastadas en una celda, con los tres que piden decisión mezclados
 * entre los cinco que están bien.
 *
 * El patrón ya existe y está **en esta misma sección**: `CalidadDeCampo`, el
 * bloque compartido que el chrome pone arriba, agrupa sus alertas por severidad
 * y las escribe como avisos. Tener dos listas de señales de calidad, una encima
 * de la otra y en dos lenguajes visuales distintos, era la incoherencia.
 *
 * Lo que pide decisión va primero. Un control correcto no desaparece —el gate
 * es «verde por conformidad, no por ausencia»— pero se lee en un renglón.
 */

type Severidad = "revisar" | "advertencia" | "correcto";

const SEVERIDAD: Record<string, Severidad> = {
  review: "revisar",
  warning: "advertencia",
  ok: "correcto",
};

const ORDEN: Record<Severidad, number> = { revisar: 0, advertencia: 1, correcto: 2 };

const ICONO = {
  revisar: ShieldAlert,
  advertencia: AlertCircle,
  correcto: CheckCircle2,
} as const;

function clave(valor: unknown) {
  return typeof valor === "string" ? valor.trim().toLowerCase() : "";
}

export type ControlDeAulas = {
  control: string;
  detalle: string;
  estado: string;
  /** Un estado que el motor añada mañana no se pierde: cae en «advertencia». */
  severidad: Severidad;
};

export function controlesDeAulas(filas: ReadonlyArray<Record<string, unknown>>) {
  const controles: ControlDeAulas[] = filas.map((fila) => {
    const estado = clave(fila.status);
    return {
      // Por los MISMOS helpers que usaba la tabla. Pintar `check` y `detail` en
      // crudo devolvía a la pantalla «field_report_reconciliation» y «El tablero
      // agrega por aula/collector/link»: la jerga del motor que la traducción
      // existe para tapar. Cambiar de superficie no puede saltarse la capa de
      // presentación.
      control: aulasCheckLabel(fila.check ?? fila.control),
      detalle: presentDetail(fila.detail ?? fila.detalle ?? ""),
      estado: aulasStatusLabel(fila.status),
      // Lista cerrada con salida declarada: si el engine emite un estado nuevo,
      // se ve como advertencia en vez de desaparecer en silencio.
      severidad: SEVERIDAD[estado] ?? "advertencia",
    };
  });
  controles.sort((a, b) => ORDEN[a.severidad] - ORDEN[b.severidad]
    || a.control.localeCompare(b.control, "es"));
  return {
    controles,
    revisar: controles.filter((c) => c.severidad === "revisar").length,
    advertencias: controles.filter((c) => c.severidad === "advertencia").length,
    correctos: controles.filter((c) => c.severidad === "correcto").length,
  };
}

export function AulasControles({ filas }: { filas: ReadonlyArray<Record<string, unknown>> }) {
  const { controles, revisar, advertencias, correctos } = useMemo(
    () => controlesDeAulas(filas),
    [filas],
  );

  if (!controles.length) {
    return <p className="mon-profile-muted">No hay controles de validación para este corte.</p>;
  }

  return (
    <div className="aulas-controles">
      <p className="aulas-controles-lectura">
        <strong>{revisar}</strong> piden revisión · <strong>{advertencias}</strong>{" "}
        {advertencias === 1 ? "advertencia" : "advertencias"} ·{" "}
        <strong>{correctos}</strong> {correctos === 1 ? "correcto" : "correctos"}
      </p>
      <ul className="aulas-controles-lista">
        {controles.map((control) => {
          const Icono = ICONO[control.severidad];
          return (
            <li key={control.control} className={`aulas-control es-${control.severidad}`}>
              <Icono size={15} aria-hidden="true" />
              <div>
                <p className="aulas-control-titulo">
                  {control.control}
                  <span>{control.estado}</span>
                </p>
                {/* Sin recorte: el detalle es la mitad que dice qué hacer, y un
                    dato operativo cortado es un rechazo del contrato (C4). */}
                {control.detalle ? <p className="aulas-control-detalle">{control.detalle}</p> : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
