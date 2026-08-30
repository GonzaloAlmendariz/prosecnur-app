/**
 * La carga de campo, en un libro que Excel abre con formato.
 *
 * Un CSV plano —el patrón del resto del perfil— pierde justo lo que hace legible
 * esta vista: la malla se lee por INTENSIDAD, y sin color son ciento ochenta
 * números sueltos donde no se distingue el pico. Excel abre una tabla HTML
 * respetando fondo, negrita y ancho, así que el libro se ve como la pantalla sin
 * añadir una dependencia de xlsx al bundle.
 *
 * Dos hojas en un solo archivo no son posibles por esta vía; en su lugar el
 * libro lleva la malla arriba y el detalle por aula debajo, que es el orden en
 * que se usa: primero se decide la franja, después se mira qué aulas caen ahí.
 *
 * El libro sale con el MISMO eje que la pantalla —semanal o calendario—: si el
 * Excel volviera siempre al patrón semanal, quien lo abriera leería un pico que
 * la vista no muestra y no habría forma de saber cuál de los dos manda.
 */
import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { DIAS, calcularCarga, comoHora, sesionesDelPlan, type OpcionesDeCarga } from "./cargaDeCampo";
import { fmt } from "./kpisDeAulas";

const esc = (v: unknown): string =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** El mismo degradado de la pantalla, resuelto a hex porque Excel no entiende `color-mix`. */
function fondo(n: number, tope: number): string {
  if (n <= 0) return "#F2F0EC";
  const t = Math.min(1, n / Math.max(1, tope));
  const from = [226, 233, 243];
  const to = [31, 56, 100];
  const c = from.map((f, i) => Math.round(f + (to[i] - f) * t));
  return `#${c.map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

export function libroDeCargaDeCampo(
  plan: readonly MonitoreoAulasPlanRow[],
  opciones: OpcionesDeCarga = { duracionMin: 30 },
): string {
  const malla = calcularCarga(plan, opciones);
  const esCalendario = malla.eje === "calendario";
  const vivas = malla.franjas.map((_, j) => j).filter((j) => malla.filas.some((__, d) => malla.aulas[d][j] > 0));
  const total = (d: number, j: number) => malla.firmes[d][j] + malla.plausibles[d][j];
  const tope = Math.max(1, ...malla.filas.map((_, d) => malla.franjas.map((__, j) => total(d, j))).flat());

  const th = "border:1px solid #C4BCB0;background:#1F3864;color:#FFFFFF;font-weight:bold;padding:5px 7px;font-size:10pt";
  const td = "border:1px solid #DDD8D0;padding:4px 7px;font-size:10pt";
  const carril = "border:1px solid #C4BCB0;background:#E8E4DC;color:#4B515A;font-weight:bold;padding:4px 7px;font-size:9.5pt;text-align:left";

  const cabecera = `<tr><th style="${th}">${esCalendario ? "Fecha" : "Día"}</th>${vivas
    .map((j) => `<th style="${th}">${comoHora(malla.franjas[j])}</th>`)
    .join("")}</tr>`;
  const primeraPorAgendar = malla.filas.findIndex((f) => f.porAgendar);
  const cuerpo = malla.filas
    .map((fila, d) => {
      // El carril de lo que falta agendar se rotula: son días de la semana entre
      // fechas, y sin decirlo se leen como una fecha más.
      const separador =
        esCalendario && d === primeraPorAgendar
          ? `<tr><th style="${carril}" colspan="${vivas.length + 1}">Por agendar · todavía sin fecha, sobre el horario del curso</th></tr>`
          : "";
      const celdas = vivas
        .map((j) => {
          const firme = malla.firmes[d][j];
          const n = total(d, j);
          // Lo que aún no se agendó va en cursiva y con fondo pálido: en Excel
          // no hay tramas, y sin la distinción un techo se lee como un hecho.
          const col = n / tope > 0.45 && firme > 0 ? "#FFFFFF" : "#191C20";
          const bg = firme > 0 ? fondo(n, tope) : "#F2F0EC";
          const it = firme === 0 && n > 0 ? ";font-style:italic;color:#4B515A" : "";
          return `<td style="${td};background:${bg};color:${col};text-align:center${it}">${n || ""}</td>`;
        })
        .join("");
      return `${separador}<tr><th style="${th};text-align:left">${esc(fila.etiqueta)}</th>${celdas}</tr>`;
    })
    .join("");

  const detalle = sesionesDelPlan(plan)
    .sort((a, b) => a.dia - b.dia || a.desde - b.desde || a.salon.localeCompare(b.salon))
    .map(
      (s) =>
        `<tr>${[
          DIAS[s.dia],
          comoHora(s.desde),
          comoHora(s.hasta),
          s.salon,
          s.aula.toUpperCase(),
          s.curso,
          s.facultad,
          fmt(s.elegibles),
        ]
          .map((v, i) => `<td style="${td}${i === 7 ? ";text-align:right" : ""}">${esc(v)}</td>`)
          .join("")}</tr>`,
    )
    .join("");

  const pico = malla.pico
    ? `${fmt(malla.pico.firmes)} confirmados y hasta ${fmt(malla.pico.firmes + malla.pico.plausibles)} · ${malla.pico.fila.etiqueta} ${comoHora(malla.pico.franja)} · ${fmt(malla.pico.aulas)} cursos-horario en curso`
    : "sin datos";
  const lectura = esCalendario
    ? `Calendario: una fila por fecha agendada, sobre ${fmt(malla.fechas)} días de campo.`
    : "Patrón semanal: cada curso-horario en el día de su horario recurrente.";
  const sinFecha =
    esCalendario && malla.agendadasSinFecha > 0
      ? ` ${fmt(malla.agendadasSinFecha)} cursos-horario tienen hora pero no fecha y no caben en el calendario.`
      : "";

  return `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8">
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>Carga de campo</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
</head><body style="font-family:Calibri,Arial,sans-serif;color:#191C20">
<h2 style="margin:0 0 4px;font-size:15pt">Carga de campo</h2>
<p style="margin:0 0 3px;font-size:10pt;color:#4B515A">Cuántos aplicadores hacen falta a la vez, sobre el rango horario de cada curso.</p>
<p style="margin:0 0 4px;font-size:9.5pt;color:#7C838D">${esc(lectura)} Aplicación de ${fmt(opciones.duracionMin)} minutos · pico: ${esc(pico)}.</p>
<p style="margin:0 0 14px;font-size:9.5pt;color:#7C838D">En <b>negrita sobre color</b>, los cursos-horario con hora ya agendada. En <i>cursiva sobre fondo claro</i>, el rango posible de las que faltan agendar: ahí la aplicación puede caer en cualquier punto de la clase. ${fmt(malla.agendadas)} de ${fmt(malla.agendadas + malla.porAgendar)} cursos-horario ya tienen hora.${esc(sinFecha)}</p>
<table cellspacing="0" cellpadding="0">${cabecera}${cuerpo}</table>
<p style="margin:18px 0 6px;font-size:11pt;font-weight:bold">Detalle por sesión</p>
<table cellspacing="0" cellpadding="0"><tr>${[
    "Día", "Inicio", "Fin", "Salón", "Curso-horario", "Curso", "Facultad", "Elegibles",
  ]
    .map((h) => `<th style="${th}">${h}</th>`)
    .join("")}</tr>${detalle}</table>
</body></html>`;
}

export function descargarCargaDeCampo(
  plan: readonly MonitoreoAulasPlanRow[],
  opciones?: OpcionesDeCarga,
): void {
  if (typeof document === "undefined" || typeof URL === "undefined" || typeof Blob === "undefined") return;
  const html = libroDeCargaDeCampo(plan, opciones);
  const blob = new Blob([`﻿${html}`], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  // El nombre dice la lectura: dos descargas del mismo plan con ejes distintos
  // se pisaban en la carpeta de descargas y no había cómo distinguirlas.
  a.download = opciones?.eje === "calendario" ? "carga-de-campo-calendario.xls" : "carga-de-campo.xls";
  a.click();
  URL.revokeObjectURL(url);
}
