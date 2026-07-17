/**
 * Pestaña Cobertura (sección Marco): cuántos alumnos y cuántos cursos-horario
 * por facultad PASAN los criterios de inclusión y cuántos no, con su
 * distribución. Dos gráficos independientes (§4.4 de la inspección):
 *   1) Alumnos por facultad: elegibles vs. no elegibles.
 *   2) Cursos-horario por facultad: incluidos vs. excluidos.
 * Todo sale del marco construido (aulasState.frame); sin datos duros no deja
 * la vista vacía: explica qué falta.
 */
import { useMemo } from "react";
import { GraduationCap, LayoutGrid } from "lucide-react";
import type { CalcMuestraAulasState } from "../../../../api/client";
import type { PerfilInstitucional } from "../../dominio";
import { fmtInt, fmtPct, rowsFrom, safeNumber } from "../../sharedCore";
import { AvisoModulo } from "../../universidad/shared/AvisoModulo";
import "./cobertura.css";

type FilaCob = {
  id: string;
  nombre: string;
  incluidos: number;
  excluidos: number;
  total: number;
};

const FACULTY_KEYS = ["faculty", "facultad", "unidad_academica", "escuela", "unidad"];

function leerTexto(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const raw = Array.isArray(row[key]) ? (row[key] as unknown[])[0] : row[key];
    if (raw != null && String(raw).trim()) return String(raw).trim();
  }
  return "";
}

function esVerdad(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === "number") return value > 0;
  const s = String(value ?? "").trim().toLowerCase();
  return s === "true" || s === "1" || s === "si" || s === "sí" || s === "yes" || s === "incluido";
}

/** Agrupa filas por facultad contando incluidos vs. total. `incluye` decide si
 *  la fila cuenta como incluida (para population todas cuentan como incluidas
 *  frente al pool; para aula_frame se lee el flag `included`). */
function agrupaPorFacultad(
  filas: Array<Record<string, unknown>>,
  incluye: (row: Record<string, unknown>) => boolean,
): Map<string, { incluidos: number; total: number }> {
  const mapa = new Map<string, { incluidos: number; total: number }>();
  for (const fila of filas) {
    const fac = leerTexto(fila, FACULTY_KEYS) || "Sin facultad";
    const acc = mapa.get(fac) ?? { incluidos: 0, total: 0 };
    acc.total += 1;
    if (incluye(fila)) acc.incluidos += 1;
    mapa.set(fac, acc);
  }
  return mapa;
}

function filasCobertura(
  totalPorFac: Map<string, { incluidos: number; total: number }>,
): FilaCob[] {
  const out: FilaCob[] = [];
  for (const [nombre, { incluidos, total }] of totalPorFac) {
    out.push({ id: nombre, nombre, incluidos, excluidos: Math.max(total - incluidos, 0), total });
  }
  return out.sort((a, b) => b.total - a.total);
}

function GraficoCobertura({
  titulo,
  descripcion,
  icon,
  filas,
  etiquetaIncluidos,
  etiquetaExcluidos,
}: {
  titulo: string;
  descripcion: string;
  icon: React.ReactNode;
  filas: FilaCob[];
  etiquetaIncluidos: string;
  etiquetaExcluidos: string;
}) {
  const maxTotal = Math.max(1, ...filas.map((f) => f.total));
  const totIncl = filas.reduce((s, f) => s + f.incluidos, 0);
  const totAll = filas.reduce((s, f) => s + f.total, 0);
  const pct = totAll > 0 ? totIncl / totAll : null;
  return (
    <section className="cmv2-cob-card">
      <header className="cmv2-cob-card-head">
        <span className="cmv2-cob-card-icon" aria-hidden="true">{icon}</span>
        <div className="cmv2-cob-card-title">
          <h3>{titulo}</h3>
          <p>{descripcion}</p>
        </div>
        <div className="cmv2-cob-card-kpi">
          <strong>{fmtPct(pct)}</strong>
          <span>{fmtInt(totIncl)} / {fmtInt(totAll)}</span>
        </div>
      </header>
      <div className="cmv2-cob-legend" aria-hidden="true">
        <span className="cmv2-cob-legend-item" data-kind="in"><i /> {etiquetaIncluidos}</span>
        <span className="cmv2-cob-legend-item" data-kind="out"><i /> {etiquetaExcluidos}</span>
      </div>
      <ul className="cmv2-cob-bars" role="list">
        {filas.map((fila) => {
          const w = (fila.total / maxTotal) * 100;
          const inPct = fila.total > 0 ? (fila.incluidos / fila.total) * 100 : 0;
          return (
            <li key={fila.id} className="cmv2-cob-row">
              <span className="cmv2-cob-row-name" title={fila.nombre}>{fila.nombre}</span>
              <span className="cmv2-cob-row-track" style={{ width: `${w}%` }}>
                <span className="cmv2-cob-seg" data-kind="in" style={{ width: `${inPct}%` }} />
                <span className="cmv2-cob-seg" data-kind="out" style={{ width: `${100 - inPct}%` }} />
              </span>
              <span className="cmv2-cob-row-val">
                <b>{fmtInt(fila.incluidos)}</b>
                <em>de {fmtInt(fila.total)}</em>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function TabCobertura({
  perfil,
  aulasState,
}: {
  perfil: PerfilInstitucional;
  aulasState: CalcMuestraAulasState | null;
}) {
  const frame = aulasState?.frame ?? null;

  const { alumnos, cursos, alumnosSinDetalle } = useMemo(() => {
    const pool = rowsFrom<Record<string, unknown>>(frame?.population_pool);
    const elegibles = rowsFrom<Record<string, unknown>>(frame?.population);
    const aulas = rowsFrom<Record<string, unknown>>(frame?.aula_frame);
    const clave = (nombre: string) => nombre.trim().toLocaleUpperCase("es");

    // Elegibles por facultad. Fuente primaria: `population` (fresca tras
    // construir el marco). Al guardar el .pulso el backend PODA frame$population
    // (project_pulso.R) — el fallback es el perfil agregado persistido:
    // perfil.facultades[].n ES el conteo de elegibles por facultad. Lectura
    // defensiva: el payload viene de R y puede traer formas creativas.
    const elegiblesPorFac = new Map<string, { nombre: string; n: number }>();
    if (elegibles.length > 0) {
      for (const [fac, { total }] of agrupaPorFacultad(elegibles, () => true)) {
        elegiblesPorFac.set(clave(fac), { nombre: fac, n: total });
      }
    } else {
      for (const fila of rowsFrom<Record<string, unknown>>(frame?.perfil?.facultades)) {
        const nombre = leerTexto(fila, ["nombre", "id", ...FACULTY_KEYS]);
        const n = safeNumber(fila.n, Number.NaN);
        if (!nombre || !Number.isFinite(n) || n < 0) continue;
        elegiblesPorFac.set(clave(nombre), { nombre, n });
      }
    }
    // Sin population NI perfil utilizable: no hay dato de elegibles — jamás
    // pintar ceros como si fueran dato (estado honesto en el render).
    const sinDetalle = pool.length > 0 && elegiblesPorFac.size === 0;

    const poolPorFac = agrupaPorFacultad(pool, () => true);
    const alumnosMap = new Map<string, { incluidos: number; total: number }>();
    if (!sinDetalle) {
      for (const [fac, { total }] of poolPorFac) {
        alumnosMap.set(fac, { incluidos: elegiblesPorFac.get(clave(fac))?.n ?? 0, total });
      }
      // Facultades presentes solo en elegibles (por si el pool no las trae).
      for (const { nombre, n } of elegiblesPorFac.values()) {
        const yaContada = [...alumnosMap.keys()].some((fac) => clave(fac) === clave(nombre));
        if (!yaContada) alumnosMap.set(nombre, { incluidos: n, total: n });
      }
    }

    const cursosMap = agrupaPorFacultad(aulas, (row) => esVerdad(row.included));
    return {
      alumnos: filasCobertura(alumnosMap),
      cursos: filasCobertura(cursosMap),
      alumnosSinDetalle: sinDetalle,
    };
  }, [frame?.population, frame?.population_pool, frame?.aula_frame, frame?.perfil]);

  if (!alumnos.length && !cursos.length) {
    return (
      <div className="rec-cap">
        <p className="rec-chip-ilustrativo">
          La cobertura contrasta, por {perfil.etiquetaUnidad}, cuántos alumnos y cuántos cursos-horario
          pasan los criterios de inclusión y cuántos no. Construye el marco desde tus fuentes (pestañas
          Población y Cursos-horario) para verla.
        </p>
      </div>
    );
  }

  return (
    <div className="rec-cap cmv2-cob">
      {alumnosSinDetalle ? (
        <AvisoModulo tone="info" title={`Reconstruye el marco para ver la cobertura de alumnos por ${perfil.etiquetaUnidad}.`}>
          Este proyecto guardado no conserva el detalle de elegibles por estudiante ni el perfil agregado
          del marco; al reconstruirlo desde tus fuentes, la cobertura vuelve a calcularse con datos reales.
        </AvisoModulo>
      ) : alumnos.length > 0 && (
        <GraficoCobertura
          titulo={`Alumnos por ${perfil.etiquetaUnidad}`}
          descripcion="Elegibles que entran al marco frente a los que quedan fuera por los criterios de inclusión."
          icon={<GraduationCap size={18} />}
          filas={alumnos}
          etiquetaIncluidos="Elegibles"
          etiquetaExcluidos="No elegibles"
        />
      )}
      <GraficoCobertura
        titulo={`Cursos-horario por ${perfil.etiquetaUnidad}`}
        descripcion="Cursos-horario incluidos en el marco frente a los excluidos por los criterios."
        icon={<LayoutGrid size={18} />}
        filas={cursos}
        etiquetaIncluidos="Incluidos"
        etiquetaExcluidos="Excluidos"
      />
    </div>
  );
}
