import { useCalcMuestraStore } from "../store/calcMuestraStore";
import type {
  CalcMuestraActorCategoria,
  CalcMuestraCanalRecojo,
  CalcMuestraComponente,
  CalcMuestraEstadoMarco,
  CalcMuestraEstrato,
  CalcMuestraInferenciaAcreditacion,
  CalcMuestraMatrizOperativaCelda,
  CalcMuestraTecnica,
} from "../../../api/client";
import { Panel } from "../../../components/Panel";
import {
  GraduationCap,
  HelpCircle,
  Mail,
  MonitorSmartphone,
  Phone,
  Plus,
  School,
  Trash2,
  User,
  UserCog,
  Users,
} from "lucide-react";
import { NaturalezaBadge } from "../components/Badges";

// ---------------------------------------------------------------------------
// Catálogos de UI
// ---------------------------------------------------------------------------

const ACTOR_META: Record<
  CalcMuestraActorCategoria,
  { label: string; icon: typeof Users; hint: string; cuantitativo: boolean }
> = {
  estudiantes: {
    label: "Estudiantes",
    icon: GraduationCap,
    hint: "Pregrado matriculados",
    cuantitativo: true,
  },
  docentes: {
    label: "Docentes",
    icon: School,
    hint: "TC, TPA y TPC",
    cuantitativo: true,
  },
  administrativos: {
    label: "Administrativos",
    icon: UserCog,
    hint: "Personal administrativo",
    cuantitativo: true,
  },
  egresados: {
    label: "Egresados",
    icon: User,
    hint: "Cohortes recientes",
    cuantitativo: true,
  },
  empleadores: {
    label: "Empleadores",
    icon: Users,
    hint: "Cualitativo (no cálculo)",
    cuantitativo: false,
  },
  comite_consultivo: {
    label: "Comité Consultivo",
    icon: Users,
    hint: "Cualitativo (no cálculo)",
    cuantitativo: false,
  },
  otros: {
    label: "Otro / sin clasificar",
    icon: HelpCircle,
    hint: "Configuración manual",
    cuantitativo: true,
  },
};

const CANAL_META: Record<
  CalcMuestraCanalRecojo,
  { label: string; icon: typeof Mail; hint: string; aplicableA: CalcMuestraActorCategoria[] }
> = {
  aula_qr: {
    label: "Aula con QR",
    icon: GraduationCap,
    hint: "Barrido o conglomerados en cursos-horario",
    aplicableA: ["estudiantes"],
  },
  telefonico: {
    label: "Telefónico",
    icon: Phone,
    hint: "Encuestas telefónicas",
    aplicableA: ["egresados", "otros"],
  },
  online_email: {
    label: "Online (correo)",
    icon: Mail,
    hint: "Encuesta online enviada por correo",
    aplicableA: ["docentes", "administrativos", "egresados", "estudiantes", "otros"],
  },
  presencial: {
    label: "Presencial",
    icon: MonitorSmartphone,
    hint: "Taller, sesión o intercept",
    aplicableA: ["empleadores", "comite_consultivo", "otros"],
  },
  mixto: {
    label: "Mixto",
    icon: MonitorSmartphone,
    hint: "Telefónico + correo + WhatsApp",
    aplicableA: ["egresados", "otros"],
  },
  sin_definir: {
    label: "Sin definir",
    icon: HelpCircle,
    hint: "Define el canal antes de calcular",
    aplicableA: ["otros"],
  },
};

const ESTADO_MARCO_OPTS: { value: CalcMuestraEstadoMarco; label: string }[] = [
  { value: "no_definido", label: "Sin definir" },
  { value: "bruto", label: "Bruto (no validado)" },
  { value: "validado", label: "Validado (limpio)" },
  { value: "contactable", label: "Contactable (con canal útil)" },
  { value: "operativo", label: "Operativo (sin marco probabilístico)" },
];

// ---------------------------------------------------------------------------
// Pane principal
// ---------------------------------------------------------------------------

export function ComponentePane() {
  const { estudio, componenteActivoId, upsertComponente } = useCalcMuestraStore();
  if (!componenteActivoId) {
    return (
      <Panel eyebrow="Componente" title="Sin selección">
        <div style={emptyStyle}>
          Selecciona un componente en la pestaña "Componentes" o agrega uno nuevo.
        </div>
      </Panel>
    );
  }
  const comp = estudio.componentes.find((c) => c.id === componenteActivoId);
  if (!comp) {
    return (
      <Panel eyebrow="Componente" title="No encontrado">
        <div style={emptyStyle}>Componente no encontrado.</div>
      </Panel>
    );
  }

  function patch(p: Partial<CalcMuestraComponente>) {
    if (!comp) return;
    upsertComponente({ ...comp, ...p });
  }
  function patchMarco(p: Partial<CalcMuestraComponente["marco"]>) {
    if (!comp) return;
    upsertComponente({ ...comp, marco: { ...comp.marco, ...p } });
  }
  function patchMatrizOperativa(matriz_operativa: CalcMuestraMatrizOperativaCelda[]) {
    if (!comp) return;
    const total = matriz_operativa.reduce((s, c) => s + (Number.isFinite(c.N) ? c.N : 0), 0);
    patchMarco({
      matriz_operativa,
      universo_bruto: total,
      marco_validado: total,
      marco_contactable: total,
      estado: total > 0 ? "validado" : comp.marco.estado,
    });
  }

  const actorMeta = ACTOR_META[comp.actor_categoria];
  const canalMeta = CANAL_META[comp.canal_recojo];
  const inferencia = comp.inferencia_acreditacion;
  const tieneInferencia = inferencia && inferencia.tecnica != null;
  const estadoMarcoOpts = comp.marco.estado === "listado_externo"
    ? [{ value: "listado_externo" as CalcMuestraEstadoMarco, label: "Base/listado cerrado (fuera del calculador)" }, ...ESTADO_MARCO_OPTS]
    : ESTADO_MARCO_OPTS;

  return (
    <div className="cm-cp-workbench">
      {/* COLUMNA IZQUIERDA · configuración */}
      <div className="cm-cp-config">
        <Panel eyebrow="1. Identidad del actor" title="¿Quién se encuesta?" hint="Esta categoría ayuda a elegir la técnica y la meta mínima que corresponde.">
          <div className="cm-cp-cards">
            {(Object.keys(ACTOR_META) as CalcMuestraActorCategoria[]).map((id) => {
              const meta = ACTOR_META[id];
              const active = comp.actor_categoria === id;
              const Icon = meta.icon;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => patch({ actor_categoria: id, actor: meta.label })}
                  className={`cm-cp-card ${active ? "is-active" : ""} ${!meta.cuantitativo ? "is-disabled" : ""}`}
                  disabled={!meta.cuantitativo}
                  title={!meta.cuantitativo ? "Actor cualitativo: no entra al cálculo" : meta.hint}
                >
                  <Icon size={18} />
                  <span className="cm-cp-card-label">{meta.label}</span>
                  <span className="cm-cp-card-hint">{meta.hint}</span>
                </button>
              );
            })}
          </div>
          <label className="cm-cp-field" style={{ marginTop: 10 }}>
            <span className="cm-cp-field-label">Nombre visible del componente</span>
            <input
              type="text"
              value={comp.actor}
              onChange={(e) => patch({ actor: e.target.value })}
              className="cm-cp-input"
              placeholder={actorMeta.label}
            />
          </label>
        </Panel>

        <Panel
          eyebrow="2. Canal de recojo"
          title="¿Cómo se aplica la encuesta?"
          hint="Cada canal determina la técnica operativa apropiada para el actor."
        >
          <div className="cm-cp-cards">
            {(Object.keys(CANAL_META) as CalcMuestraCanalRecojo[]).map((id) => {
              const meta = CANAL_META[id];
              const active = comp.canal_recojo === id;
              const Icon = meta.icon;
              const aplica = id === "sin_definir" || meta.aplicableA.includes(comp.actor_categoria);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => patch({ canal_recojo: id })}
                  className={`cm-cp-card ${active ? "is-active" : ""} ${!aplica ? "is-warned" : ""}`}
                  title={!aplica ? `Inusual para ${actorMeta.label}` : meta.hint}
                >
                  <Icon size={18} />
                  <span className="cm-cp-card-label">{meta.label}</span>
                  <span className="cm-cp-card-hint">{meta.hint}</span>
                </button>
              );
            })}
          </div>
        </Panel>

        <Panel
          eyebrow="3. Marco muestral"
          title="Tres niveles del marco"
          hint="Universo bruto: todos los registros. Validado: tras limpieza. Contactable: con canal útil."
        >
          <div className="cm-cp-grid-3">
            <NumFieldCp label="Universo bruto" value={comp.marco.universo_bruto}
              onChange={(v) => patchMarco({ universo_bruto: v })} />
            <NumFieldCp label="Marco validado" value={comp.marco.marco_validado}
              onChange={(v) => patchMarco({ marco_validado: v })} />
            <NumFieldCp label="Marco contactable" value={comp.marco.marco_contactable}
              onChange={(v) => patchMarco({ marco_contactable: v })} />
          </div>
          <label className="cm-cp-field" style={{ marginTop: 10 }}>
            <span className="cm-cp-field-label">Estado del marco</span>
            <select
              value={comp.marco.estado}
              onChange={(e) => patchMarco({ estado: e.target.value as CalcMuestraEstadoMarco })}
              className="cm-cp-input"
            >
              {estadoMarcoOpts.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        </Panel>

        {/* Editor de estratos: solo si conglomerados o conveniencia */}
        {(comp.tecnica === "prob_conglomerado_multietapico" ||
          comp.tecnica === "no_prob_conveniencia") && (
          <EstratosPanel
            tecnica={comp.tecnica}
            estratos={comp.marco.estratos ?? []}
            onChange={(estratos) => patchMarco({ estratos })}
          />
        )}

        {(estudio.macro_familia === "linea_base_servicios" ||
          (comp.marco.matriz_operativa?.length ?? 0) > 0) && (
          <MatrizOperativaPanel
            celdas={comp.marco.matriz_operativa ?? []}
            onChange={patchMatrizOperativa}
          />
        )}
      </div>

      {/* COLUMNA DERECHA · resultado en vivo */}
      <aside className="cm-cp-side">
        <Panel eyebrow="Inferencia · cuadro maestro Marzo 2026" title="Técnica aplicada">
          {tieneInferencia ? (
            <div style={{ display: "grid", gap: 8 }}>
              <NaturalezaBadge naturaleza={comp.naturaleza} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: "var(--pulso-text)", textTransform: "uppercase", letterSpacing: 0.3 }}>
                  Técnica
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--pulso-primary)", marginTop: 2 }}>
                  {labelTecnica(comp.tecnica)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: "var(--pulso-text-soft)", textTransform: "uppercase", letterSpacing: 0.3 }}>
                  Justificación
                </div>
                <div style={{ fontSize: 12, color: "var(--pulso-text)", marginTop: 3, lineHeight: 1.5 }}>
                  {inferencia.justificacion}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "var(--pulso-text-soft)", lineHeight: 1.5 }}>
              Selecciona tipo de actor y canal de recojo para que el sistema infiera la técnica
              automáticamente según el cuadro maestro PULSO.
            </div>
          )}
        </Panel>

        <Panel eyebrow="Mínimo a cumplir" title="Cálculo en vivo">
          {comp.resultado ? (
            <ResultadoEnVivo resultado={comp.resultado} />
          ) : (
            <div style={{ fontSize: 12, color: "var(--pulso-text-soft)" }}>
              Completa el marco (N validado) y usa "Calcular" en la barra superior para ver el mínimo.
            </div>
          )}
        </Panel>
      </aside>

      {/* Tablas de resultado debajo (full-width) */}
      {comp.resultado && comp.resultado.distribucion_estratos && comp.resultado.distribucion_estratos.length > 0 && (
        <div className="cm-cp-full">
          <DistribucionEstratos resultado={comp.resultado} />
        </div>
      )}
      {comp.resultado && comp.resultado.aulas_por_estrato && comp.resultado.aulas_por_estrato.length > 0 && (
        <div className="cm-cp-full">
          <AulasPorEstrato resultado={comp.resultado} />
        </div>
      )}
      {comp.resultado && comp.resultado.cuotas_matriz && comp.resultado.cuotas_matriz.length > 0 && (
        <div className="cm-cp-full">
          <CuotasMatriz resultado={comp.resultado} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponentes
// ---------------------------------------------------------------------------

function fmtNum(x: number | null | undefined): string {
  return typeof x === "number" && Number.isFinite(x) ? x.toLocaleString() : "—";
}

function isNum(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

function ResultadoEnVivo({ resultado }: { resultado: NonNullable<CalcMuestraComponente["resultado"]> }) {
  const tieneTeorico = isNum(resultado.n_teorico);
  const tienePrecision = isNum(resultado.precision_alcanzada);
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <MetricBig label="Mínimo a cumplir" value={fmtNum(resultado.n_objetivo)} highlight />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <MetricSmall label="Operativo" value={fmtNum(resultado.n_operativo)} />
        {tieneTeorico && <MetricSmall label="Teórico" value={fmtNum(resultado.n_teorico)} />}
        {tienePrecision && <MetricSmall label="Precisión" value={`±${((resultado.precision_alcanzada as number) * 100).toFixed(2)}%`} />}
        {isNum(resultado.aulas_total) && <MetricSmall label="Aulas total" value={fmtNum(resultado.aulas_total)} />}
        {isNum(resultado.cobertura_objetivo) && <MetricSmall label="Cobertura" value={`${(resultado.cobertura_objetivo * 100).toFixed(0)}%`} />}
      </div>
      {resultado.advertencia && (
        <div className="cm-cp-warning">{resultado.advertencia}</div>
      )}
    </div>
  );
}

function MetricBig({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{
      padding: "12px 14px",
      background: highlight ? "var(--pulso-primary)" : "var(--pulso-surface-2)",
      color: highlight ? "white" : "var(--pulso-text)",
      borderRadius: 8,
      border: "1px solid",
      borderColor: highlight ? "var(--pulso-primary)" : "var(--pulso-border)",
    }}>
      <div style={{ fontSize: 10, fontWeight: 800, opacity: 0.8, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, marginTop: 4, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
        {value}
      </div>
    </div>
  );
}

function MetricSmall({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      padding: "8px 10px",
      background: "var(--pulso-surface)",
      borderRadius: 6,
      border: "1px solid var(--pulso-border)",
    }}>
      <div style={{ fontSize: 9, fontWeight: 800, color: "var(--pulso-text-soft)", textTransform: "uppercase", letterSpacing: 0.3 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--pulso-text)", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
    </div>
  );
}

function DistribucionEstratos({ resultado }: { resultado: NonNullable<CalcMuestraComponente["resultado"]> }) {
  const dist = resultado.distribucion_estratos ?? [];
  const tieneRegla = dist.some((d) => !!d.regla);
  const tienePrecision = dist.some((d) => typeof d.precision_e === "number" && Number.isFinite(d.precision_e));
  const totalN = dist.reduce((s, d) => s + d.N, 0);
  const totalNum = dist.reduce((s, d) => s + d.n, 0);
  return (
    <Panel eyebrow="Distribución por estrato" title={`Mínimos por carrera/grupo (${dist.length} estratos)`}>
      <div style={{ overflowX: "auto" }}>
        <table className="cm-table">
          <thead>
            <tr>
              <th>Estrato</th>
              <th>N</th>
              <th>Mínimo</th>
              <th>%</th>
              {tieneRegla && <th>Regla aplicada</th>}
              {tienePrecision && <th>Precisión</th>}
            </tr>
          </thead>
          <tbody>
            {dist.map((d, i) => (
              <tr key={i}>
                <td>{d.estrato}</td>
                <td className="num">{d.N.toLocaleString()}</td>
                <td className="num highlight">{d.n.toLocaleString()}</td>
                <td className="num">{((d.n / Math.max(d.N, 1)) * 100).toFixed(1)}%</td>
                {tieneRegla && <td className="muted">{formatRegla(d.regla)}</td>}
                {tienePrecision && <td className="num">{typeof d.precision_e === "number" && Number.isFinite(d.precision_e) ? `±${(d.precision_e * 100).toFixed(2)}%` : "—"}</td>}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="total">
              <td>Total</td>
              <td className="num">{totalN.toLocaleString()}</td>
              <td className="num highlight">{totalNum.toLocaleString()}</td>
              <td className="num">{((totalNum / Math.max(totalN, 1)) * 100).toFixed(1)}%</td>
              {tieneRegla && <td aria-hidden></td>}
              {tienePrecision && <td aria-hidden></td>}
            </tr>
          </tfoot>
        </table>
      </div>
    </Panel>
  );
}

function AulasPorEstrato({ resultado }: { resultado: NonNullable<CalcMuestraComponente["resultado"]> }) {
  const aulas = resultado.aulas_por_estrato ?? [];
  return (
    <Panel
      eyebrow="Operación de campo"
      title={`Aulas / unidades operativas (base ${resultado.aulas_base_total} + bolsa = ${resultado.aulas_total})`}
    >
      <div style={{ overflowX: "auto" }}>
        <table className="cm-table">
          <thead>
            <tr>
              <th>Estrato</th><th>Mínimo</th><th>Prom.</th><th>τ</th>
              <th>Aulas</th><th>Bolsa</th><th>Total</th><th>Tipo</th>
            </tr>
          </thead>
          <tbody>
            {aulas.map((a, i) => (
              <tr key={i}>
                <td>{a.estrato}</td>
                <td className="num">{a.cuota.toLocaleString()}</td>
                <td className="num">{a.avg_conglomerado.toFixed(1)}</td>
                <td className="num">{a.tau.toFixed(2)}</td>
                <td className="num">{a.aulas_base}</td>
                <td className="num">+{a.aulas_reemplazo}</td>
                <td className="num highlight">{a.aulas_total}</td>
                <td className="muted">{a.tipo_aula}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function CuotasMatriz({ resultado }: { resultado: NonNullable<CalcMuestraComponente["resultado"]> }) {
  const cuotas = resultado.cuotas_matriz ?? [];
  const totalN = cuotas.reduce((s, c) => s + c.N, 0);
  const totaln = cuotas.reduce((s, c) => s + c.n, 0);
  return (
    <Panel eyebrow="Matriz operativa" title={`Cuotas por territorio y servicio (${cuotas.length} celdas)`}>
      <div style={{ overflowX: "auto" }}>
        <table className="cm-table">
          <thead>
            <tr>
              <th>Territorio</th>
              <th>Servicio</th>
              <th>Marco</th>
              <th>Cuota</th>
              <th>Regla</th>
            </tr>
          </thead>
          <tbody>
            {cuotas.map((c, i) => (
              <tr key={`${c.territorio}-${c.servicio}-${i}`}>
                <td>{c.territorio}</td>
                <td>{c.servicio}</td>
                <td className="num">{c.N.toLocaleString()}</td>
                <td className="num highlight">{c.n.toLocaleString()}</td>
                <td className="muted">{formatRegla(c.regla)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="total">
              <td colSpan={2}>Total</td>
              <td className="num">{totalN.toLocaleString()}</td>
              <td className="num highlight">{totaln.toLocaleString()}</td>
              <td aria-hidden></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Panel>
  );
}

function MatrizOperativaPanel({
  celdas,
  onChange,
}: {
  celdas: CalcMuestraMatrizOperativaCelda[];
  onChange: (celdas: CalcMuestraMatrizOperativaCelda[]) => void;
}) {
  function nueva(): CalcMuestraMatrizOperativaCelda {
    return {
      id: `mat-${Math.random().toString(36).slice(2, 10)}`,
      territorio: "",
      servicio: "",
      N: 0,
      notas: "",
    };
  }
  function actualizar(i: number, p: Partial<CalcMuestraMatrizOperativaCelda>) {
    onChange(celdas.map((c, idx) => (idx === i ? { ...c, ...p } : c)));
  }
  function eliminar(i: number) {
    onChange(celdas.filter((_, idx) => idx !== i));
  }
  const total = celdas.reduce((s, c) => s + c.N, 0);
  return (
    <Panel
      eyebrow="4. Matriz operativa"
      title="Territorio x servicio"
      hint="Úsala cuando el marco son volúmenes de atención por servicio y territorio. El sistema calcula n por territorio y cuotas por servicio con piso mínimo."
      actions={
        <button type="button" onClick={() => onChange([...celdas, nueva()])} className="cm-cp-btn-primary">
          <Plus size={13} /> Agregar celda
        </button>
      }
    >
      {celdas.length === 0 ? (
        <div style={emptyStyle}>
          Sin matriz. Para un caso tipo GIZ, agrega filas como Municipalidad, Servicio y volumen de atenciones.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="cm-table">
            <thead>
              <tr>
                <th>Territorio</th>
                <th>Servicio</th>
                <th>Volumen</th>
                <th aria-label="acciones"></th>
              </tr>
            </thead>
            <tbody>
              {celdas.map((c, i) => (
                <tr key={c.id}>
                  <td>
                    <input
                      type="text"
                      value={c.territorio}
                      onChange={(ev) => actualizar(i, { territorio: ev.target.value })}
                      placeholder="Municipalidad"
                      className="cm-cp-input-inline"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={c.servicio}
                      onChange={(ev) => actualizar(i, { servicio: ev.target.value })}
                      placeholder="Servicio"
                      className="cm-cp-input-inline"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      value={c.N}
                      onChange={(ev) => actualizar(i, { N: Number(ev.target.value) || 0 })}
                      className="cm-cp-input-inline num"
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => eliminar(i)}
                      className="cm-cp-btn-danger"
                      aria-label={`Eliminar fila ${i + 1}`}
                    >
                      <Trash2 size={11} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="total">
                <td colSpan={2}>{celdas.length} celdas</td>
                <td className="num">{total.toLocaleString()}</td>
                <td aria-hidden></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Panel>
  );
}

function EstratosPanel({
  tecnica, estratos, onChange,
}: {
  tecnica: CalcMuestraTecnica;
  estratos: CalcMuestraEstrato[];
  onChange: (estratos: CalcMuestraEstrato[]) => void;
}) {
  const esConglomerado = tecnica === "prob_conglomerado_multietapico";
  function nuevo(): CalcMuestraEstrato {
    return {
      id: `est-${Math.random().toString(36).slice(2, 10)}`,
      label: "", N: 0, N_a: 0, N_b: 0,
      sub_a_label: "Mujeres", sub_b_label: "Hombres",
      promedio_conglomerado: 0, tau: 0,
    };
  }
  function actualizar(i: number, p: Partial<CalcMuestraEstrato>) {
    onChange(estratos.map((e, idx) => (idx === i ? { ...e, ...p } : e)));
  }
  function eliminar(i: number) {
    onChange(estratos.filter((_, idx) => idx !== i));
  }
  const N_total = estratos.reduce((s, e) => s + e.N, 0);
  return (
    <Panel
      eyebrow="4. Marco estratificado (opcional)"
      title="Estratos por carrera / sub-grupo"
      hint={esConglomerado
        ? "Para conglomerados con aulas: agrega facultades con N, promedio por aula y τ."
        : "Para conveniencia con estratos: agrega carreras con N. El sistema calcula una meta por carrera según cobertura, mínimo y tope."}
      actions={
        <button type="button" onClick={() => onChange([...estratos, nuevo()])} className="cm-cp-btn-primary">
          <Plus size={13} /> Agregar
        </button>
      }
    >
      {estratos.length === 0 ? (
        <div style={emptyStyle}>Sin estratos. Sin estratos, el cálculo aplica el N total como un solo grupo.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="cm-table">
            <thead>
              <tr>
                <th>Estrato</th>
                <th>N</th>
                {esConglomerado && <th>Prom. aula</th>}
                {esConglomerado && <th>τ</th>}
                <th aria-label="acciones"></th>
              </tr>
            </thead>
            <tbody>
              {estratos.map((e, i) => (
                <tr key={e.id}>
                  <td><input type="text" value={e.label}
                    onChange={(ev) => actualizar(i, { label: ev.target.value })}
                    placeholder="Carrera" className="cm-cp-input-inline" /></td>
                  <td><input type="number" min={0} value={e.N}
                    onChange={(ev) => actualizar(i, { N: Number(ev.target.value) || 0 })}
                    className="cm-cp-input-inline num" /></td>
                  {esConglomerado && (
                    <td><input type="number" step={0.1} min={0} value={e.promedio_conglomerado}
                      onChange={(ev) => actualizar(i, { promedio_conglomerado: Number(ev.target.value) || 0 })}
                      className="cm-cp-input-inline num" /></td>
                  )}
                  {esConglomerado && (
                    <td><input type="number" step={0.05} min={0} max={1} value={e.tau}
                      onChange={(ev) => actualizar(i, { tau: Number(ev.target.value) || 0 })}
                      className="cm-cp-input-inline num" /></td>
                  )}
                  <td>
                    <button type="button" onClick={() => eliminar(i)} className="cm-cp-btn-danger"
                      aria-label={`Eliminar ${e.label}`}>
                      <Trash2 size={11} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="total">
                <td>{estratos.length} estratos</td>
                <td className="num">{N_total.toLocaleString()}</td>
                {esConglomerado && <td aria-hidden></td>}
                {esConglomerado && <td aria-hidden></td>}
                <td aria-hidden></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Panel>
  );
}

function NumFieldCp({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="cm-cp-field">
      <span className="cm-cp-field-label">{label}</span>
      <input type="number" min={0} value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="cm-cp-input" />
    </label>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function labelTecnica(t: CalcMuestraTecnica): string {
  const m: Record<CalcMuestraTecnica, string> = {
    prob_aleatorio_simple: "Muestreo aleatorio simple (MAS)",
    prob_estratificado: "Estratificado",
    prob_estratificado_independiente: "Dominios independientes",
    prob_conglomerado_multietapico: "Conglomerados multietápico",
    sistematico: "Sistemático",
    medicion_recurrente: "Medición recurrente",
    barrido: "Barrido operativo",
    intencion_censal: "Intención censal",
    listado_externo_meta_fija: "Listado externo meta fija",
    no_prob_conveniencia: "Conveniencia (no probabilístico)",
    no_prob_cuotas: "Cuotas (no probabilístico)",
  };
  return m[t] ?? t;
}

function formatRegla(regla?: string): string {
  if (!regla) return "";
  if (regla === "censal") return "Censal";
  if (regla === "proporcional") return "Proporcional";
  if (regla.startsWith("piso_n_min_")) return `Piso · mín. ${regla.replace("piso_n_min_", "")}`;
  if (regla.startsWith("piso_")) return `Piso · mín. ${regla.replace("piso_", "")}`;
  if (regla.startsWith("formula_clasica_y_cuotas_piso_")) {
    return `Fórmula clásica + cuotas · piso ${regla.replace("formula_clasica_y_cuotas_piso_", "")}`;
  }
  if (regla.startsWith("cobertura_")) return `Cobertura ${regla.replace("cobertura_", "")}`;
  if (regla.startsWith("tope_")) return `Tope · ${regla.replace("tope_", "")}`;
  return regla;
}

const emptyStyle: React.CSSProperties = {
  padding: 16,
  textAlign: "center",
  background: "var(--pulso-bg)",
  border: "1px dashed var(--pulso-border)",
  borderRadius: 8,
  color: "var(--pulso-text-soft)",
  fontSize: 12,
};
