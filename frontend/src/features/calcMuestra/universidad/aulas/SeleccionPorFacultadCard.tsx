/**
 * La selección leída como el operativo la usa: por facultad, cada titular con
 * su cadena de reemplazos plegada debajo (reemplazo 1, reemplazo 2…).
 *
 * Sustituye a la tabla plana con «mostrar 200 más» (pliego de Gonzalo,
 * 2026-08-20). La fila muestra elegibles Y esperadas — son cosas distintas y
 * la diferencia es el rendimiento del aula (T3 del mismo pliego).
 */
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { fmtInt } from "../../sharedCore";
import { tip, tipAria, useTooltipGrafico, type TooltipDatos } from "../shared/graficos/TooltipGrafico";
import { seleccionPorFacultad, type CadenaTitular } from "./seleccionPorFacultadModel";
import "./seleccionPorFacultad.css";

type Fila = Record<string, unknown>;

const texto = (v: unknown): string => String(v ?? "").trim();
const numOrNull = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function FilaAula({
  fila,
  esReemplazo = false,
  ordinal = 0,
  seleccionada,
  onSelect,
}: {
  fila: Fila;
  esReemplazo?: boolean;
  ordinal?: number;
  seleccionada: boolean;
  onSelect?: (fila: Fila) => void;
}) {
  const esperadas = numOrNull(fila.efectivas_esperadas);
  const el = numOrNull(fila.eligible_n) ?? 0;
  const p = numOrNull(fila.p_aplicada_ref);
  const r = numOrNull(fila.rendimiento_ref);
  // La cuenta del valor de validez, aula por aula — Gonzalo (2026-08-20): «de
  // veinticuatro elegibles van a haber doce; ese es el valor de validez, y
  // tiene que estar claro». La lee la delegación del <ul> padre.
  const factor = numOrNull(fila.factor_facultad) ?? 1;
  // V7: la cuenta del tooltip es CONDICIONAL (E × R × F); la tasa de
  // aplicación del docente va como línea operativa aparte, nunca en la
  // multiplicación.
  const desglose: TooltipDatos | null =
    esperadas != null && r != null
      ? {
          titulo: texto(fila.course_name) || texto(fila.course_id),
          filas: [
            { label: "Elegibles en lista", valor: fmtInt(el) },
            { label: `Tasa de su tramo (aula de ${fmtInt(el)})`, valor: `${Math.round(r * 100)} %` },
            ...(factor !== 1
              ? [{ label: "Ajuste de su facultad", valor: `× ${factor.toFixed(2).replace(".", ",")}` }]
              : []),
            { label: "Efectivas esperadas", valor: fmtInt(Math.round(esperadas)) },
          ],
          nota: `${fmtInt(el)} × ${r.toFixed(2).replace(".", ",")}${
            factor !== 1 ? ` × ${factor.toFixed(2).replace(".", ",")}` : ""
          } → ${fmtInt(Math.round(esperadas))} — el valor de validez si el aula entra a campo${
            p != null
              ? `; su docente aplica el ${Math.round(p * 100)} % (operativo: anticipa cadena)`
              : ""
          }`,
          tono: "efectiva",
        }
      : null;
  return (
    <button
      type="button"
      className="cmv2-selfac-fila"
      data-reemplazo={esReemplazo || undefined}
      data-activa={seleccionada || undefined}
      onClick={() => onSelect?.(fila)}
    >
      {esReemplazo ? <span className="cmv2-selfac-rol">R{ordinal}</span> : <span className="cmv2-selfac-rol" data-titular="true">T</span>}
      <span className="cmv2-selfac-curso">
        <b>{texto(fila.course_name) || texto(fila.course_id)}</b>
        <small>
          {texto(fila.course_id)} · {texto(fila.schedule)}
          {texto(fila.teacher) ? ` · ${texto(fila.teacher)}` : ""}
        </small>
      </span>
      <span
        className="cmv2-selfac-cifras"
        {...(desglose ? { ...tip(desglose), "aria-label": tipAria(desglose) } : {})}
      >
        <span>
          {fmtInt(el)} <small>elegibles</small>
        </span>
        <span>
          {esperadas != null ? fmtInt(Math.round(esperadas)) : "—"} <small>esperadas</small>
        </span>
      </span>
    </button>
  );
}

function CadenaFila({
  cadena,
  seleccionadaId,
  onSelect,
}: {
  cadena: CadenaTitular;
  seleccionadaId: string;
  onSelect?: (fila: Fila) => void;
}) {
  const [abierta, setAbierta] = useState(false);
  const id = texto(cadena.titular.classroom_id);
  return (
    <li className="cmv2-selfac-cadena">
      <div className="cmv2-selfac-cadena-titular">
        <FilaAula
          fila={cadena.titular}
          seleccionada={seleccionadaId === id}
          onSelect={onSelect}
        />
        {cadena.reemplazos.length > 0 && (
          <button
            type="button"
            className="cmv2-selfac-toggle"
            aria-expanded={abierta}
            onClick={() => setAbierta((v) => !v)}
          >
            {abierta ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />}
            {abierta ? "Ocultar" : "Ver"} {fmtInt(cadena.reemplazos.length)} reemplazos
          </button>
        )}
      </div>
      {abierta && (
        <ol className="cmv2-selfac-reemplazos">
          {cadena.reemplazos.map((r, i) => (
            <li key={texto(r.classroom_id) || i}>
              <FilaAula
                fila={r}
                esReemplazo
                ordinal={i + 1}
                seleccionada={seleccionadaId === texto(r.classroom_id)}
                onSelect={onSelect}
              />
            </li>
          ))}
        </ol>
      )}
    </li>
  );
}

export function SeleccionPorFacultadCard({
  rows,
  selectedRow = null,
  onSelectRow,
}: {
  rows: Fila[] | null;
  /** Fila activa del inspector (misma semántica que la tabla anterior). */
  selectedRow?: Fila | null;
  onSelectRow?: (fila: Fila) => void;
}) {
  const facultades = useMemo(() => seleccionPorFacultad(rows), [rows]);
  const [activa, setActiva] = useState<string>("");
  const [query, setQuery] = useState("");
  const { manejadores, tooltip } = useTooltipGrafico();
  if (!facultades.length) return null;
  const facultadActiva =
    facultades.find((f) => f.facultad === activa) ?? facultades[0];
  const q = query.trim().toLowerCase();
  const titularesVisibles = q
    ? facultadActiva.titulares.filter((c) =>
        [c.titular, ...c.reemplazos].some((f) =>
          `${texto(f.course_name)} ${texto(f.course_id)} ${texto(f.schedule)} ${texto(f.teacher)}`
            .toLowerCase()
            .includes(q),
        ),
      )
    : facultadActiva.titulares;
  const seleccionadaId = texto((selectedRow as Fila | null)?.classroom_id);

  return (
    <section className="cmv2-selfac" aria-label="Selección por facultad">
      <nav className="cmv2-selfac-chips" aria-label="Facultad">
        {facultades.map((f) => (
          <button
            key={f.facultad}
            type="button"
            data-activa={f.facultad === facultadActiva.facultad || undefined}
            onClick={() => setActiva(f.facultad)}
          >
            {f.facultad}
            <b>{fmtInt(f.titulares.length)}</b>
          </button>
        ))}
      </nav>
      <div className="cmv2-selfac-head">
        <strong>
          {facultadActiva.facultad}: {fmtInt(facultadActiva.titulares.length)} titulares ·{" "}
          {fmtInt(facultadActiva.nReemplazos)} reemplazos en cadena
        </strong>
        <label className="cmv2-compact-field">
          <span>Buscar en esta facultad</span>
          <input
            value={query}
            placeholder="curso, horario, docente…"
            onChange={(e) => setQuery(e.currentTarget.value)}
          />
        </label>
      </div>
      <ul className="cmv2-selfac-lista" {...manejadores}>
        {titularesVisibles.map((c) => (
          <CadenaFila
            key={texto(c.titular.classroom_id)}
            cadena={c}
            seleccionadaId={seleccionadaId}
            onSelect={onSelectRow}
          />
        ))}
      </ul>
      {q && titularesVisibles.length === 0 && (
        <p className="cmv2-selfac-vacio">
          Ningún titular de {facultadActiva.facultad} coincide con «{query}».
        </p>
      )}
      {tooltip}
    </section>
  );
}
