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
import { contar } from "../../fuentes/vocabulario";
import { ArrowRightLeft, ClipboardCheck, ClipboardList, Loader2, TriangleAlert } from "../../../../vendor/lucide-react";
import {
  apiMonitoreoAulasActivarReemplazo,
  apiMonitoreoAulasAgenda,
  type MonitoreoAulasPlanRow,
} from "../../../../api/monitoreo";
import { ESTADOS_OPERATIVOS, MOTIVOS_DE_REEMPLAZO } from "./aulasPresentation";
import "./registroDeCampo.css";

// Mudado a `aulasPresentation`, que es donde vive el vocabulario: acá sólo
// alimentaba este select y la tabla que pinta la misma columna no lo alcanzaba.
const ESTADOS = ESTADOS_OPERATIVOS;

// El vocabulario vive en `aulasPresentation`, que es donde están todos los
// rótulos: aquí se ofrecía en un select y la tabla de la cadena no lo alcanzaba,
// así que pintaba `docente_no_autoriza` en crudo.
const MOTIVOS = MOTIVOS_DE_REEMPLAZO;

// El motivo sólo se pide cuando el estado lo justifica. Pedirlo siempre sería
// ruido; no pedirlo nunca deja sin explicar por qué cayó un aula.
const ESTADOS_CON_MOTIVO = new Set(["sin_acceso", "cancelada", "reemplazo_pendiente", "reemplazada"]);

// Estados en los que el aula CAE y tiene sentido ofrecer su reemplazo. No
// incluye `reemplazada`: esa ya lo fue, y volver a activar consumiría otra
// reserva de la cadena sin que nadie lo haya pedido.
const ESTADOS_QUE_CAEN = new Set(["sin_acceso", "cancelada", "reemplazo_pendiente"]);

/** Si en este estado procede ofrecer la activación de la cadena. */
export function aulaPuedeReemplazarse(estado: string, row: MonitoreoAulasPlanRow | null): boolean {
  if (!row || !ESTADOS_QUE_CAEN.has(estado)) return false;
  // Sólo tiene cadena quien es titular o reserva de una: una unidad suelta no
  // tiene a quién llamar.
  const rol = String(row.sample_role ?? "");
  return rol === "titular" || rol === "chain_reserve";
}

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
  /**
   * La hoja de partes del libro, sólo para decir cuántas aulas YA lo tienen.
   * El registro no la edita: la escribe fila a fila con el formulario.
   */
  partes?: ReadonlyArray<Record<string, unknown>>;
  onGuardado: () => void;
};

export function RegistroDeCampo({ agenda, partes = [], onGuardado }: Props) {
  const [seleccion, setSeleccion] = useState<string>("");
  const [form, setForm] = useState<RegistroForm>(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [activando, setActivando] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  // La advertencia de ponderación de la reserva activada. Vive aparte de `ok`
  // porque no es el resultado de la acción: es lo que la activación OBLIGA a
  // hacer después, y no se limpia con el mismo gesto.
  const [avisoPeso, setAvisoPeso] = useState("");

  const filas = useMemo(
    () => agenda.filter((r) => String(r.sample_role ?? "") !== "extra_reserve_pool"),
    [agenda],
  );
  // Cuántas siguen sin pasar por aquí. Es lo que viene a saber quien abre la
  // pestaña, y sale de la misma lista que tiene al lado: `planificada` es el
  // estado con el que nacen y del que sólo salen al registrarlas.
  const porRegistrar = useMemo(
    () => filas.filter((r) => (String(r.operational_status ?? "") || "planificada") === "planificada").length,
    [filas],
  );
  const activa = useMemo(
    () => filas.find((r) => String(r.operational_code ?? r.classroom_id) === seleccion) ?? null,
    [filas, seleccion],
  );

  // Cuántas de estas aulas YA tienen parte en el libro.
  //
  // Se cuenta contra la hoja de partes y NO contra `operational_status`, que fue
  // el primer intento y estaba mal: ese campo lo mueve esta misma pantalla al
  // guardar, así que sobre un libro importado se queda en «planificada» aunque
  // el parte exista. El contador decía «0 con parte» a la vez que Consultas
  // enseñaba «210 partes» — dos superficies del mismo hecho con cero y 210.
  //
  // La clave es `operational_code`, la misma con la que el parte se une al plan
  // en `parteDeCampo`: si cada superficie uniera por su cuenta podrían discrepar
  // en qué aula tiene parte.
  const conRegistro = useMemo(() => {
    const conParte = new Set<string>();
    for (const fila of partes) {
      const codigo = String((fila as { operational_code?: unknown }).operational_code ?? "").trim();
      if (codigo) conParte.add(codigo);
    }
    if (!conParte.size) return 0;
    return filas.filter((r) => conParte.has(String(r.operational_code ?? "").trim())).length;
  }, [filas, partes]);

  const elegir = (row: MonitoreoAulasPlanRow) => {
    const clave = String(row.operational_code ?? row.classroom_id);
    setSeleccion(clave);
    setForm(formDesdeFila(row));
    setError("");
    setOk("");
  };

  const set = <K extends keyof RegistroForm>(campo: K, valor: RegistroForm[K]) =>
    setForm((prev) => ({ ...prev, [campo]: valor }));

  const activarReemplazo = async () => {
    if (!activa) return;
    const codigo = String(activa.operational_code ?? activa.classroom_id ?? "").trim();
    if (!codigo) return;
    setActivando(true);
    setError("");
    setOk("");
    setAvisoPeso("");
    try {
      // El motivo del formulario viaja con la activación: quien mire la reserva
      // después necesita saber POR QUÉ está en campo, no sólo que lo está.
      const res = await apiMonitoreoAulasActivarReemplazo({
        operational_code: codigo,
        // Sólo el motivo, nunca el estado como sustituto: son vocabularios
        // distintos —`sin_acceso` es un estado, `docente_no_autoriza` un
        // motivo— y colarlo aquí lo normalizaba a «otro», perdiendo el dato.
        motivo: form.motivo.trim(),
      });
      // El mensaje del motor dice la consecuencia —cuántas reservas quedan, o
      // que la cadena se agotó y esa meta se queda sin cubrir—, así que se
      // muestra tal cual en vez de resumirlo aquí.
      if (res.agotada) setError(res.mensaje);
      else setOk(res.mensaje);
      // La consecuencia METODOLÓGICA, aparte del mensaje operativo. La escribió
      // Cálculo de muestra para este momento —«usar peso analítico final sólo
      // si se activa en campo y se ajusta no respuesta»— y viajaba en el plan
      // sin que quien pulsa el botón la viera nunca. Va en su propio renglón:
      // «quedan 2 reservas» y «esta reserva cambia la ponderación» son dos
      // lecturas distintas y una frase sola las aplasta.
      setAvisoPeso(String(res.advertencia_peso ?? "").trim());
      onGuardado();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo activar el reemplazo.");
    } finally {
      setActivando(false);
    }
  };

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
      // Sin grupo en el `section`: con él, la CABECERA entra como miembro y sus
      // 5 px de holgura se leen como `capacity-drift` del panel. Es la trampa
      // que la norma describe —declarar el grupo en el `section` en vez del
      // wrapper de datos hace que el padding del encabezado se lea como
      // capacidad inflada— y salía igual en cinco paneles del perfil. Lo que hay
      // que vigilar es el contenedor de datos, que declara lo suyo más abajo.
    >
      <div className="mon-profile-panel-head">
        {/* Es la hoja «Aulas Aplicadas (Campo)» del libro, llenada aquí en vez
            de en Excel: asistentes, rechazos, duplicados, efectivas, aplicador,
            aula y momento son sus columnas. La pestaña sigue diciendo «Registro
            de campo» —lo que se hace—; el panel dice qué se está llenando. */}
        <h3>Aulas aplicadas (campo)</h3>
        {/* Cuántas de esas filas YA tienen registro. El panel se llama como su
            hoja —«Aulas Aplicadas (Campo)»— y sobre este corte enseña 196 aulas
            en «Planificada»: el nombre promete aplicadas y la lista entrega
            ninguna, y quien mira no sabe si es que no se ha aplicado nada o si
            el panel lista otra cosa. El contador lo zanja con dato: dice cuánto
            de la hoja está lleno, que además es lo que se viene a saber. */}
        <span>{filas.length
          ? `${filas.length} cursos-horario · ${conRegistro} con parte en el libro`
          : "sin agenda"}</span>
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
              // Un estado vacío de verdad y no una frase suelta arriba a la
              // izquierda: medido a 1440, este panel deja 1 030 px de ancho por
              // 436 de alto sin nada dentro hasta que se elige un aula, y una
              // línea de 13 px en la esquina de ese hueco se lee como que la
              // vista no cargó. Lleva además cuántas faltan por registrar, que
              // es lo que quien abre esta pestaña viene a saber y ya está en la
              // misma lista que tiene al lado.
              <div className="registro-campo-vacio">
                <ClipboardList size={22} aria-hidden="true" />
                <strong>Elige un curso-horario de la lista</strong>
                <p>
                  Aquí se registra cómo fue su aplicación: asistentes, rechazos,
                  duplicados y efectivas.
                </p>
                {porRegistrar ? (
                  <p className="registro-campo-vacio-cifra">
                    <strong>{porRegistrar}</strong> de {filas.length} todavía sin registrar
                  </p>
                ) : null}
              </div>
            ) : (
              <>
                <p className="registro-campo-contexto">
                  {etiquetaDeAula(activa)}
                  {activa.eligible_n ? ` · ${contar(activa.eligible_n, "matriculado", "matriculados")}` : ""}
                </p>

                {/* Estado y motivo comparten fila. Sueltos eran dos `label` de
                    bloque, así que cada uno ocupaba los 1 034 px del formulario
                    para un desplegable de once opciones cortas —medido—, y el
                    campo más ancho de la vista era el que menos texto lleva. Y
                    van juntos porque son una sola decisión: el motivo sólo se
                    pide cuando el estado lo justifica. */}
                <div className="registro-campo-decision">
                <label className="registro-campo-campo">
                  {/* NO es `STATUS DE APLICACION` del libro, aunque se parezca:
                      esa columna dice si el aula se aplicó, y este estado es el
                      operativo —lo deriva el motor y mueve los denominadores
                      del avance—. Ponerle el nombre de la columna haría creer
                      que se escribe en ella. */}
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
                </div>

                <div className="registro-campo-numeros">
                  <label className="registro-campo-campo">
                    <span>Cantidad de asistentes</span>
                    <input
                      type="number" min={0} inputMode="numeric"
                      value={form.aforo} onChange={(e) => set("aforo", e.target.value)}
                    />
                  </label>
                  <label className="registro-campo-campo">
                    {/* Se queda: el libro no tiene columna de repartidas. Sólo
                        cuenta asistentes, rechazos, duplicados y efectivas. */}
                    <span>Encuestas aplicadas</span>
                    <input
                      type="number" min={0} inputMode="numeric"
                      value={form.aplicadas} onChange={(e) => set("aplicadas", e.target.value)}
                    />
                  </label>
                  <label className="registro-campo-campo">
                    <span>Cantidad de rechazos</span>
                    <input
                      type="number" min={0} inputMode="numeric"
                      value={form.rechazos} onChange={(e) => set("rechazos", e.target.value)}
                    />
                  </label>
                </div>

                <div className="registro-campo-numeros">
                  <label className="registro-campo-campo">
                    <span>Duplicados (ya respondieron)</span>
                    <input
                      type="number" min={0} inputMode="numeric"
                      value={form.duplicados} onChange={(e) => set("duplicados", e.target.value)}
                    />
                  </label>
                  <label className="registro-campo-campo">
                    <span>Cantidad de efectivas</span>
                    <input
                      type="number" min={0} inputMode="numeric"
                      value={form.efectivas} onChange={(e) => set("efectivas", e.target.value)}
                    />
                  </label>
                  <label className="registro-campo-campo">
                    {/* La columna se llama `AULA` a secas, pero aquí «aula» ya
                        nombra la unidad entera: sin el «real» se leería como el
                        aula planificada, que es justo la que puede no ser. */}
                    <span>Aula real</span>
                    <input
                      type="text" value={form.aulaReal}
                      onChange={(e) => set("aulaReal", e.target.value)}
                    />
                  </label>
                </div>

                <div className="registro-campo-numeros">
                  <label className="registro-campo-campo">
                    {/* La columna es `APLICADOR` a secas; la app mantiene la
                        forma inclusiva, que es la única desviación deliberada
                        del vocabulario del libro. */}
                    <span>Aplicador/a</span>
                    <input
                      type="text" value={form.aplicador}
                      onChange={(e) => set("aplicador", e.target.value)}
                    />
                  </label>
                  <label className="registro-campo-campo">
                    <span>Fecha y hora de aplicación</span>
                    <input
                      type="text" placeholder="2026-08-16 10:15" value={form.momento}
                      onChange={(e) => set("momento", e.target.value)}
                    />
                  </label>
                </div>

                <label className="registro-campo-campo">
                  {/* `OBSERVACIONES SOBRE APLICACIONES` en el libro. */}
                  <span>Observaciones</span>
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
                  {aulaPuedeReemplazarse(form.estado, activa) ? (
                    <button
                      type="button"
                      className="registro-campo-reemplazo"
                      onClick={activarReemplazo}
                      disabled={guardando || activando}
                      title="Marca este curso-horario como reemplazado y pone en campo su siguiente reserva"
                    >
                      {activando ? <Loader2 size={14} className="registro-campo-spin" /> : <ArrowRightLeft size={14} />}
                      {activando ? "Activando…" : "Activar reemplazo"}
                    </button>
                  ) : null}
                  {ok ? <span className="registro-campo-ok">{ok}</span> : null}
                  {error ? <span className="registro-campo-error">{error}</span> : null}
                </div>
                {avisoPeso ? (
                  <p className="registro-campo-peso">
                    <TriangleAlert size={13} aria-hidden="true" />
                    {avisoPeso}
                  </p>
                ) : null}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
