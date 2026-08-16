// Registro de campo por curso-horario.
//
// Es la superficie que faltaba: hasta ahora lo que pasaba dentro del aula
// —cuántos asistieron, cuántas encuestas se repartieron, quién dijo que no, por
// qué no se pudo aplicar— se anotaba en la ficha impresa y ahí se quedaba. El
// backend sabía guardarlo (`/api/monitoreo/aulas/agenda`) pero no lo llamaba
// nadie: la hoja de papel ERA la planilla paralela.
//
// Vive en Monitoreo y no en Recopiladores porque lo que se registra aquí es el
// estado operativo, y el estado operativo mueve los denominadores del avance.
//
// Contrato de superficie: C1 declarado abajo; C2 el marco no depende de cuántas
// aulas haya; C3 el vacío vive dentro del panel; C4 la lista scrollea dentro de
// su propio contenedor; C5 entrega lo que su título promete — el registro
// completo de una aplicación, no un subconjunto cómodo.
import { useMemo, useState } from "react";
import { ClipboardCheck, Loader2 } from "../../../../vendor/lucide-react";
import {
  apiMonitoreoAulasAgenda,
  type MonitoreoAulasPlanRow,
} from "../../../../api/monitoreo";
import "./registroDeCampo.css";

// El vocabulario es el del motor (`monitoreo_aulas_estados()`), traducido una
// sola vez aquí. La clave viaja; la etiqueta se queda en la pantalla.
const ESTADOS: Array<{ value: string; label: string }> = [
  { value: "planificada", label: "Planificada" },
  { value: "contactada", label: "Contactada" },
  { value: "agendada", label: "Agendada" },
  { value: "en_campo", label: "En campo" },
  { value: "aplicada", label: "Aplicada" },
  { value: "parcial", label: "Parcial" },
  { value: "sin_acceso", label: "Sin acceso" },
  { value: "cancelada", label: "Cancelada" },
  { value: "reemplazo_pendiente", label: "Reemplazo pendiente" },
  { value: "reemplazada", label: "Reemplazada" },
  { value: "cerrada", label: "Cerrada" },
];

const MOTIVOS: Array<{ value: string; label: string }> = [
  { value: "docente_no_autoriza", label: "El docente no autoriza" },
  { value: "aula_no_existe", label: "El aula no existe" },
  { value: "horario_cambio", label: "Cambió el horario" },
  { value: "virtual_no_presencial", label: "Es virtual, no presencial" },
  { value: "baja_asistencia", label: "Muy baja asistencia" },
  { value: "cruce_logistico", label: "Cruce logístico" },
  { value: "aula_ya_aplicada", label: "El aula ya se aplicó" },
  { value: "incidencia_etica", label: "Incidencia ética" },
  { value: "otro", label: "Otro" },
];

// El motivo sólo se pide cuando el estado lo justifica. Pedirlo siempre sería
// ruido; no pedirlo nunca deja sin explicar por qué cayó un aula.
const ESTADOS_CON_MOTIVO = new Set(["sin_acceso", "cancelada", "reemplazo_pendiente", "reemplazada"]);

export function aulaNecesitaMotivo(estado: string): boolean {
  return ESTADOS_CON_MOTIVO.has(estado);
}

/** Etiqueta de un aula en la lista: su código operativo y de qué curso es. */
export function etiquetaDeAula(row: MonitoreoAulasPlanRow): string {
  const codigo = String(row.operational_code ?? row.classroom_id ?? "").trim();
  const curso = String(row.course_name ?? row.label ?? "").trim();
  if (codigo && curso) return `${codigo} · ${curso}`;
  return codigo || curso || "Curso-horario sin identificar";
}

/**
 * Lo que se manda al backend. Se envían sólo los campos que el usuario tocó,
 * más el identificador — un PATCH, no un reemplazo: mandar el resto en blanco
 * borraría lo que otro registró antes.
 */
export function cambiosDelRegistro(
  row: MonitoreoAulasPlanRow,
  form: RegistroForm,
): Partial<MonitoreoAulasPlanRow> {
  const cambios: Partial<MonitoreoAulasPlanRow> = {};
  const id = String(row.collection_unit_id ?? "").trim();
  if (id) cambios.collection_unit_id = id;
  cambios.classroom_id = String(row.classroom_id ?? "");
  cambios.operational_code = String(row.operational_code ?? "");

  if (form.estado) cambios.operational_status = form.estado;
  if (aulaNecesitaMotivo(form.estado) && form.motivo) cambios.replacement_reason = form.motivo;
  for (const [campo, valor] of [
    ["observed_students", form.aforo],
    ["applied_surveys", form.aplicadas],
    ["refusals", form.rechazos],
    // Duplicados y efectivas no son adorno: sin ellos el cuadre del parte
    // —asistentes − rechazos − duplicados = efectivas— no se puede comprobar
    // sobre lo que la app captura, y ese control ya existe en Validación.
    ["duplicates", form.duplicados],
    ["effective_surveys", form.efectivas],
  ] as const) {
    const n = Number(valor);
    if (valor.trim() !== "" && Number.isFinite(n) && n >= 0) cambios[campo] = n;
  }
  if (form.aplicador.trim()) cambios.applied_by = form.aplicador.trim();
  // El aula REAL: el parte del estudio de 2025 la registra porque una aplicación
  // se muda de salón con frecuencia y el aula planificada deja de describirla.
  if (form.aulaReal.trim()) cambios.actual_room = form.aulaReal.trim();
  if (form.momento.trim()) cambios.applied_at = form.momento.trim();
  if (form.nota.trim()) cambios.field_note = form.nota.trim();
  return cambios;
}

export type RegistroForm = {
  estado: string;
  motivo: string;
  aforo: string;
  aplicadas: string;
  rechazos: string;
  duplicados: string;
  efectivas: string;
  aplicador: string;
  aulaReal: string;
  momento: string;
  nota: string;
};

const FORM_VACIO: RegistroForm = {
  estado: "",
  motivo: "",
  aforo: "",
  aplicadas: "",
  rechazos: "",
  duplicados: "",
  efectivas: "",
  aplicador: "",
  aulaReal: "",
  momento: "",
  nota: "",
};

function formDesdeFila(row: MonitoreoAulasPlanRow | null): RegistroForm {
  if (!row) return FORM_VACIO;
  const txt = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  const num = (v: unknown) => (v === null || v === undefined || v === "" ? "" : String(v));
  return {
    estado: txt(row.operational_status) || "planificada",
    motivo: txt(row.replacement_reason),
    aforo: num(row.observed_students),
    aplicadas: num(row.applied_surveys),
    rechazos: num(row.refusals),
    duplicados: num(row.duplicates),
    efectivas: num(row.effective_surveys),
    aplicador: txt(row.applied_by),
    aulaReal: txt(row.actual_room),
    momento: txt(row.applied_at),
    nota: txt(row.field_note),
  };
}

type Props = {
  agenda: MonitoreoAulasPlanRow[];
  onGuardado: () => void;
};

export function RegistroDeCampo({ agenda, onGuardado }: Props) {
  const [seleccion, setSeleccion] = useState<string>("");
  const [form, setForm] = useState<RegistroForm>(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const filas = useMemo(
    () => agenda.filter((r) => String(r.sample_role ?? "") !== "extra_reserve_pool"),
    [agenda],
  );
  const activa = useMemo(
    () => filas.find((r) => String(r.operational_code ?? r.classroom_id) === seleccion) ?? null,
    [filas, seleccion],
  );

  const elegir = (row: MonitoreoAulasPlanRow) => {
    const clave = String(row.operational_code ?? row.classroom_id);
    setSeleccion(clave);
    setForm(formDesdeFila(row));
    setError("");
    setOk("");
  };

  const set = <K extends keyof RegistroForm>(campo: K, valor: RegistroForm[K]) =>
    setForm((prev) => ({ ...prev, [campo]: valor }));

  const guardar = async () => {
    if (!activa) return;
    setGuardando(true);
    setError("");
    setOk("");
    try {
      await apiMonitoreoAulasAgenda(cambiosDelRegistro(activa, form));
      setOk(`Registro guardado para ${etiquetaDeAula(activa)}.`);
      onGuardado();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar el registro.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <section
      className="mon-profile-panel registro-campo"
      data-qa-geometry-group="monitoring-aulas-registro"
      data-qa-geometry-contract="intrinsic"
    >
      <div className="mon-profile-panel-head">
        <h3>Registro de campo</h3>
        <span>{filas.length ? `${filas.length} cursos-horario` : "sin agenda"}</span>
      </div>

      {filas.length === 0 ? (
        <p className="registro-campo-vacio">
          No hay agenda de cursos-horario. Importa el plan desde el cálculo de muestra
          para registrar lo que pasa en cada aula.
        </p>
      ) : (
        <div className="registro-campo-cuerpo">
          <ul className="registro-campo-lista" data-qa-geometry-capacity="owned">
            {filas.map((row) => {
              const clave = String(row.operational_code ?? row.classroom_id);
              const estado = String(row.operational_status ?? "planificada");
              return (
                <li key={clave}>
                  <button
                    type="button"
                    className={`registro-campo-item${clave === seleccion ? " is-activa" : ""}`}
                    onClick={() => elegir(row)}
                    aria-pressed={clave === seleccion}
                  >
                    <span className="registro-campo-item-titulo">{etiquetaDeAula(row)}</span>
                    <span className={`registro-campo-estado is-${estado}`}>
                      {ESTADOS.find((e) => e.value === estado)?.label ?? estado}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="registro-campo-form">
            {!activa ? (
              <p className="registro-campo-vacio">
                Elige un curso-horario de la lista para registrar cómo fue su aplicación.
              </p>
            ) : (
              <>
                <p className="registro-campo-contexto">
                  {etiquetaDeAula(activa)}
                  {activa.eligible_n ? ` · ${activa.eligible_n} matriculados` : ""}
                </p>

                <label className="registro-campo-campo">
                  <span>Estado</span>
                  <select value={form.estado} onChange={(e) => set("estado", e.target.value)}>
                    {ESTADOS.map((e) => (
                      <option key={e.value} value={e.value}>{e.label}</option>
                    ))}
                  </select>
                </label>

                {aulaNecesitaMotivo(form.estado) ? (
                  <label className="registro-campo-campo">
                    <span>Motivo</span>
                    <select value={form.motivo} onChange={(e) => set("motivo", e.target.value)}>
                      <option value="">Sin especificar</option>
                      {MOTIVOS.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </label>
                ) : null}

                <div className="registro-campo-numeros">
                  <label className="registro-campo-campo">
                    <span>Alumnos en aula</span>
                    <input
                      type="number" min={0} inputMode="numeric"
                      value={form.aforo} onChange={(e) => set("aforo", e.target.value)}
                    />
                  </label>
                  <label className="registro-campo-campo">
                    <span>Encuestas aplicadas</span>
                    <input
                      type="number" min={0} inputMode="numeric"
                      value={form.aplicadas} onChange={(e) => set("aplicadas", e.target.value)}
                    />
                  </label>
                  <label className="registro-campo-campo">
                    <span>Rechazos</span>
                    <input
                      type="number" min={0} inputMode="numeric"
                      value={form.rechazos} onChange={(e) => set("rechazos", e.target.value)}
                    />
                  </label>
                </div>

                <div className="registro-campo-numeros">
                  <label className="registro-campo-campo">
                    <span>Ya respondieron</span>
                    <input
                      type="number" min={0} inputMode="numeric"
                      value={form.duplicados} onChange={(e) => set("duplicados", e.target.value)}
                    />
                  </label>
                  <label className="registro-campo-campo">
                    <span>Efectivas</span>
                    <input
                      type="number" min={0} inputMode="numeric"
                      value={form.efectivas} onChange={(e) => set("efectivas", e.target.value)}
                    />
                  </label>
                  <label className="registro-campo-campo">
                    <span>Aula real</span>
                    <input
                      type="text" value={form.aulaReal}
                      onChange={(e) => set("aulaReal", e.target.value)}
                    />
                  </label>
                </div>

                <div className="registro-campo-numeros">
                  <label className="registro-campo-campo">
                    <span>Aplicador/a</span>
                    <input
                      type="text" value={form.aplicador}
                      onChange={(e) => set("aplicador", e.target.value)}
                    />
                  </label>
                  <label className="registro-campo-campo">
                    <span>Fecha y hora</span>
                    <input
                      type="text" placeholder="2026-08-16 10:15" value={form.momento}
                      onChange={(e) => set("momento", e.target.value)}
                    />
                  </label>
                </div>

                <label className="registro-campo-campo">
                  <span>Nota</span>
                  <input
                    type="text" value={form.nota}
                    onChange={(e) => set("nota", e.target.value)}
                  />
                </label>

                <div className="registro-campo-acciones">
                  <button type="button" onClick={guardar} disabled={guardando}>
                    {guardando ? <Loader2 size={14} className="registro-campo-spin" /> : <ClipboardCheck size={14} />}
                    {guardando ? "Guardando…" : "Guardar registro"}
                  </button>
                  {ok ? <span className="registro-campo-ok">{ok}</span> : null}
                  {error ? <span className="registro-campo-error">{error}</span> : null}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
