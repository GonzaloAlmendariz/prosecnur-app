import type { ReactNode } from "react";

import { esColumnaDeHora, esColumnaDeLugar, sesionYLugar, tonoDePabellon } from "./sistemaPabellon";
import "./sistemaPabellon.css";

/**
 * «Sistema Pabellón» — los chips de identidad del perfil de aulas (B33).
 *
 * Tres piezas y nada más, las mismas que aprobó el dictado de B31:
 * - `ChipLugar`: el pabellón/salón, con color DERIVADO de su letra
 *   (`tonoDePabellon`, determinista) — el mismo A206 se pinta igual en la
 *   Agenda, en la ficha, en el registro y en el popover de reemplazo.
 * - `ChipHora`: la hora o ventana, sobria y con números tabulares.
 * - `ChipDato`: el neutro para lo demás (fecha, momento, nombres).
 *
 * El color vive en la hoja (`sistemaPabellon.css`, clases `es-tono-*` sobre
 * tokens `--pulso-*`); aquí sólo se elige el índice. Los nombres de componente
 * y de clase son los que acuñó el paquete de Carga (B31): sus vistas importan
 * de aquí desde la unificación (P8).
 */

export function ChipLugar({ lugar }: { lugar: string }) {
  const tono = tonoDePabellon(lugar);
  return (
    <span className={`aulas-chip aulas-chip-lugar${tono === null ? "" : ` es-tono-${tono}`}`}>
      {lugar}
    </span>
  );
}

export function ChipHora({ children }: { children: ReactNode }) {
  return <span className="aulas-chip aulas-chip-hora">{children}</span>;
}

export function ChipDato({ children }: { children: ReactNode }) {
  return <span className="aulas-chip">{children}</span>;
}

/**
 * B72/B73 (dictado 2026-09-03: «esto debería salir como un box como el resto
 * de cosas»): la secuencia de preparación —recojo y salida al aula— como chip
 * del sistema, en tenue con borde punteado: es protocolo previo, no
 * identidad, y no compite con el chip firme de la hora pactada.
 */
export function ChipPrep({ children }: { children: ReactNode }) {
  return <span className="aulas-chip aulas-chip-prep">{children}</span>;
}

/**
 * La celda de una tabla del perfil, cuando su columna es de IDENTIDAD: lugar,
 * hora o el texto «Sesiones y aula» del equipo. Devuelve `null` para todo lo
 * demás y la tabla pinta el texto tal cual — el chip va en las columnas de
 * identidad, no en todas: una tabla de 174 filas no se llena de arcoíris.
 *
 * `label` sólo se chipifica cuando trae el patrón descriptivo día + hora +
 * aula («LUN 16:00 A206»): en planes del sorteo esa columna trae el código
 * académico, y un código no es un lugar (ver `sesionYLugar`).
 */
export function identidadEnCelda(columna: string, valor: string): ReactNode | null {
  const texto = valor.trim();
  if (!texto || texto === "—") return null;
  if (esColumnaDeLugar(columna)) return <ChipLugar lugar={texto} />;
  if (esColumnaDeHora(columna)) return <ChipHora>{texto}</ChipHora>;
  if (columna === "label") {
    const partes = sesionYLugar(texto);
    if (!partes) return null;
    // El texto ENTERO del Excel queda en el title: el vocabulario del equipo
    // no se pierde, sólo se ordena — mismo criterio que el frente del operativo.
    return (
      <span className="aulas-chip-sesion" title={texto}>
        <ChipHora>{partes.sesion}</ChipHora>
        <ChipLugar lugar={partes.lugar} />
      </span>
    );
  }
  return null;
}
