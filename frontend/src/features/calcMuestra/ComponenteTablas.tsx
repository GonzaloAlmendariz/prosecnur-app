/**
 * Las dos tablas de un componente de muestra: sus estratos y su matriz de
 * celdas (volumen por cruce de dos dimensiones).
 *
 * Viven aquí y no en `CalcMuestraPage.tsx` porque ese archivo está congelado a
 * crecimiento y se había pasado de su línea base. Son presentacionales puras
 * —reciben el componente y un `onComponente`, no leen store ni API— y cada una
 * se monta en un solo sitio, así que sacarlas no cambia ninguna superficie.
 */

import { Plus, Trash2, Wand2 } from "lucide-react";
import type {
  CalcMuestraComponente,
  CalcMuestraEstrato,
  CalcMuestraMatrizOperativaCelda,
} from "../../api/client";
import { safeNumber, uid, type ComponentePatch } from "./sharedCore";
import { universityFacultyConfidence, universityFacultyError } from "./universidad/shared/study";
import { NumberCell } from "./universidad/aulas";

export function EstratosTable({
  comp,
  onComponente,
  variant = "estratos",
}: {
  comp: CalcMuestraComponente;
  onComponente: (id: string, patch: ComponentePatch) => void;
  variant?: "estratos" | "facultades";
}) {
  const estratos = comp.marco.estratos ?? [];
  const facultades = variant === "facultades";
  const title = facultades ? "Facultades del marco" : "Estratos del marco";
  const primaryLabel = facultades ? "Facultad" : "Estrato";
  const subALabel = facultades ? "Mujeres" : "Sub A";
  const subBLabel = facultades ? "Hombres" : "Sub B";
  const avgLabel = "Promedio unidad";
  // «Rendimiento» a secas nombraba tambien el rendimiento por tamano del
  // aula y el rendimiento del embudo historico, que son otras dos cosas.
  const tauLabel = "Tasa de la facultad";
  const addLabel = facultades ? "Agregar facultad" : "Agregar estrato";
  function update(index: number, patch: Partial<CalcMuestraEstrato>) {
    const next = estratos.map((e, i) => (i === index ? { ...e, ...patch } : e));
    const total = next.reduce((sum, e) => sum + safeNumber(e.N), 0);
    onComponente(comp.id, { marco: { estratos: next, marco_validado: total, universo_bruto: total, marco_contactable: total } });
  }
  return (
    <section className="cmv2-panel">
      <div className="cmv2-panel-head">
        <span className="cmv2-eyebrow">Tabla editable</span>
        <strong>{title}</strong>
      </div>
      <div className="cmv2-table-wrap">
        <table className="cmv2-table">
          <thead>
            <tr>
              <th>{primaryLabel}</th>
              <th>Total</th>
              <th>{subALabel}</th>
              <th>{subBLabel}</th>
              {facultades && <th>Error facultad</th>}
              {facultades && <th>Confianza</th>}
              {facultades && <th>p éxito</th>}
              {facultades && <th>+ aulas</th>}
              {!facultades && <th>{avgLabel}</th>}
              {!facultades && <th>{tauLabel}</th>}
              <th />
            </tr>
          </thead>
          <tbody>
            {estratos.map((e, i) => (
              <tr key={e.id}>
                <td><input className="cmv2-table-input" value={e.label} onChange={(ev) => update(i, { label: ev.currentTarget.value })} /></td>
                <td><NumberCell value={e.N} onChange={(v) => {
                  const N = Math.round(v);
                  update(i, facultades ? { N, e_facultad: universityFacultyError(N), confianza_facultad: universityFacultyConfidence(N) } : { N });
                }} /></td>
                <td><NumberCell value={e.N_a} onChange={(v) => update(i, { N_a: Math.round(v) })} /></td>
                <td><NumberCell value={e.N_b} onChange={(v) => update(i, { N_b: Math.round(v) })} /></td>
                {facultades && <td><NumberCell value={e.e_facultad} step={0.005} suffix="prop." onChange={(v) => update(i, { e_facultad: v })} /></td>}
                {facultades && <td><NumberCell value={e.confianza_facultad} step={0.01} suffix="prop." onChange={(v) => update(i, { confianza_facultad: v, z_facultad: undefined })} /></td>}
                {facultades && <td><NumberCell value={e.p_facultad} step={0.01} suffix="prop." onChange={(v) => update(i, { p_facultad: v })} /></td>}
                {facultades && <td><NumberCell value={e.aulas_extra_operativas} step={1} onChange={(v) => update(i, { aulas_extra_operativas: Math.max(0, Math.round(v)) })} /></td>}
                {!facultades && <td><NumberCell value={e.promedio_conglomerado} onChange={(v) => update(i, { promedio_conglomerado: v })} /></td>}
                {!facultades && <td><NumberCell value={e.tau} step={0.05} onChange={(v) => update(i, { tau: v, tau_origen: "manual" })} /></td>}
                <td>
                  <button
                    type="button"
                    className="cmv2-icon-button"
                    onClick={() => {
                      const next = estratos.filter((_, idx) => idx !== i);
                      const total = next.reduce((sum, item) => sum + safeNumber(item.N), 0);
                      onComponente(comp.id, { marco: { estratos: next, marco_validado: total, universo_bruto: total, marco_contactable: total } });
                    }}
                    aria-label={facultades ? "Eliminar facultad" : "Eliminar estrato"}
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="cmv2-inline-actions">
        <button
          type="button"
          className="cmv2-ghost"
          onClick={() => {
            const next = [
              ...estratos,
              estrato(facultades ? `Facultad ${estratos.length + 1}` : `Estrato ${estratos.length + 1}`, 0, {
                sub_a_label: facultades ? "Mujeres" : "Sub A",
                sub_b_label: facultades ? "Hombres" : "Sub B",
                e_facultad: facultades ? universityFacultyError(0) : undefined,
                confianza_facultad: facultades ? universityFacultyConfidence(0) : undefined,
                p_facultad: facultades ? 0.5 : undefined,
                aulas_extra_operativas: facultades ? 1 : undefined,
              }),
            ];
            onComponente(comp.id, { marco: { estratos: next } });
          }}
        >
          <Plus size={14} /> {addLabel}
        </button>
      </div>
    </section>
  );
}

export function MatrizServiciosTable({
  comp,
  onComponente,
}: {
  comp: CalcMuestraComponente;
  onComponente: (id: string, patch: ComponentePatch) => void;
}) {
  const matriz = comp.marco.matriz_operativa ?? [];
  function update(index: number, patch: Partial<CalcMuestraMatrizOperativaCelda>) {
    const next = matriz.map((m, i) => (i === index ? { ...m, ...patch } : m));
    const total = next.reduce((sum, item) => sum + safeNumber(item.N), 0);
    onComponente(comp.id, { marco: { matriz_operativa: next, marco_validado: total, universo_bruto: total, marco_contactable: total } });
  }
  return (
    <section className="cmv2-panel">
      <div className="cmv2-panel-head">
        <span className="cmv2-eyebrow">Tabla editable</span>
        <strong>Volumen por celda</strong>
      </div>
      <div className="cmv2-table-wrap">
        <table className="cmv2-table">
          <thead>
            <tr>
              <th>Territorio o grupo</th>
              <th>Servicio o categoría</th>
              <th>Volumen del marco</th>
              <th>Notas</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {matriz.map((row, i) => (
              <tr key={row.id}>
                <td><input className="cmv2-table-input" value={row.territorio} onChange={(e) => update(i, { territorio: e.currentTarget.value })} /></td>
                <td><input className="cmv2-table-input" value={row.servicio} onChange={(e) => update(i, { servicio: e.currentTarget.value })} /></td>
                <td><NumberCell value={row.N} onChange={(v) => update(i, { N: Math.round(v) })} /></td>
                <td><input className="cmv2-table-input" value={row.notas} onChange={(e) => update(i, { notas: e.currentTarget.value })} /></td>
                <td>
                  <button
                    type="button"
                    className="cmv2-icon-button"
                    onClick={() => {
                      const next = matriz.filter((_, idx) => idx !== i);
                      const total = next.reduce((sum, item) => sum + safeNumber(item.N), 0);
                      onComponente(comp.id, { marco: { matriz_operativa: next, marco_validado: total, universo_bruto: total, marco_contactable: total } });
                    }}
                    aria-label="Eliminar fila"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="cmv2-inline-actions">
        <button
          type="button"
          className="cmv2-ghost"
          onClick={() => onComponente(comp.id, { marco: { matriz_operativa: [...matriz, matrizCell()] } })}
        >
          <Plus size={14} /> Agregar celda
        </button>
        <button
          type="button"
          className="cmv2-ghost"
          onClick={() => {
            const next = matrizEjemplo();
            const total = next.reduce((sum, item) => sum + item.N, 0);
            onComponente(comp.id, { marco: { matriz_operativa: next, marco_validado: total, universo_bruto: total, marco_contactable: total } });
          }}
        >
          <Wand2 size={14} /> Cargar ejemplo
        </button>
      </div>
    </section>
  );
}

/* Semillas de ejemplo del componente. `estrato` y `matrizEjemplo` los usa
   además la mesa para sembrar un componente nuevo, por eso salen exportados. */
export function estrato(
  label: string,
  N: number,
  overrides: Partial<CalcMuestraEstrato> = {},
): CalcMuestraEstrato {
  const a = Math.floor(N / 2);
  return {
    id: uid("est"),
    label,
    N,
    N_a: a,
    N_b: N - a,
    sub_a_label: overrides.sub_a_label ?? "Sub A",
    sub_b_label: overrides.sub_b_label ?? "Sub B",
    e_facultad: overrides.e_facultad,
    p_facultad: overrides.p_facultad,
    confianza_facultad: overrides.confianza_facultad,
    z_facultad: overrides.z_facultad,
    cuota_fija: overrides.cuota_fija,
    sobremuestra_fija: overrides.sobremuestra_fija,
    aulas_base_fijas: overrides.aulas_base_fijas,
    aulas_extra_operativas: overrides.aulas_extra_operativas,
    promedio_conglomerado: overrides.promedio_conglomerado ?? 25,
    tau: overrides.tau ?? 0.7,
  };
}

function matrizCell(): CalcMuestraMatrizOperativaCelda {
  return {
    id: uid("cell"),
    territorio: "Territorio o grupo",
    servicio: "Servicio o categoría",
    N: 0,
    notas: "",
  };
}

/** Ejemplo ilustrativo con nombres genéricos: muestra la forma de la tabla, no datos de un estudio. */
export function matrizEjemplo(): CalcMuestraMatrizOperativaCelda[] {
  return [
    ["Territorio A", "Servicio 1", 280],
    ["Territorio A", "Servicio 2", 210],
    ["Territorio A", "Servicio 3", 110],
    ["Territorio B", "Servicio 1", 90],
    ["Territorio B", "Servicio 2", 460],
    ["Territorio B", "Servicio 3", 230],
    ["Territorio C", "Servicio 1", 165],
    ["Territorio C", "Servicio 2", 135],
    ["Territorio C", "Servicio 3", 145],
  ].map(([territorio, servicio, N]) => ({
    id: uid("cell"),
    territorio: String(territorio),
    servicio: String(servicio),
    N: Number(N),
    notas: "",
  }));
}
