import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ChevronDown, ChevronRight, ExternalLink, Phone, Plus, Trash2, Users, X } from "lucide-react";
import {
  apiAnaliticaColumnValues,
  apiAnaliticaEnumeradores,
  apiAnaliticaVariables,
  apiSystemDiagnostic,
  DiagnosticInfo,
  ValorColumna,
  VariableInstrumento,
} from "../../../api/client";
import { Panel } from "../../../components/Panel";
import {
  CondicionOperador,
  CondicionRegla,
  MODALIDADES_PULSO,
  ModalidadRegla,
  ModalidadValor,
  useAnaliticaStore,
} from "../store";
import { VariableSelect } from "../VariableSelect";
import { Section, GenerateFooter } from "../PaneKit";
import { useReporteRun } from "../useReporteRun";

// EnumeradoresPane — rediseñado.
// Flujo:
// 1. Quién: dropdown de variable con los nombres del enumerador.
// 2. Modalidad: tres opciones de resolución:
//    - "Ninguna": se reporta solo producción total.
//    - "Por columna": apunta a una columna del dataset que ya trae
//      la modalidad por fila.
//    - "Por reglas": query builder. Cada regla = condiciones AND
//      (columna, operador, valor) → modalidad. Primera regla que
//      matchea gana; si no matchea ninguna → default.
// 3. Desagregación: multiselect de cortes (sexo, aula, turno, etc.).
// 4. Ordenación + mínimo + título + mostrar vacías.
// 5. Generar.

type ModoModalidad = "ninguna" | "columna" | "reglas";

function detectarModo(
  colModalidad: string | undefined,
  reglas: ModalidadRegla[],
): ModoModalidad {
  if (reglas.length > 0) return "reglas";
  if (colModalidad && colModalidad.length > 0) return "columna";
  return "ninguna";
}

export function EnumeradoresPane() {
  const enumer = useAnaliticaStore((s) => s.config.enumeradores);
  const setEnumer = useAnaliticaStore((s) => s.setEnumeradores);
  const run = useReporteRun();

  // Quarto es dependencia opcional para PDF de enumeradores. Lo
  // chequeamos al montar la pantalla para mostrar un banner claro y
  // deshabilitar el botón antes de que el user dispare la generación
  // y se choque con un error críptico de R en el subprocess callr.
  const [diag, setDiag] = useState<DiagnosticInfo | null>(null);
  useEffect(() => {
    let cancel = false;
    apiSystemDiagnostic()
      .then((d) => { if (!cancel) setDiag(d); })
      .catch(() => { /* fallar silencioso — el banner solo aparece si tenemos info */ });
    return () => { cancel = true; };
  }, []);
  const quartoOk = diag?.quarto?.available ?? null;

  const [variables, setVariables] = useState<VariableInstrumento[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const r = await apiAnaliticaVariables();
        setVariables(r.variables);
      } catch {/* no-op */}
    })();
  }, []);

  const [modo, setModo] = useState<ModoModalidad>(() =>
    detectarModo(enumer.col_modalidad, enumer.modalidad_reglas),
  );

  // Cambiar de modo limpia los campos incompatibles (sin sorprender al
  // analista: al volver a un modo previo el store ya tiene el estado).
  function cambiarModo(nuevo: ModoModalidad) {
    setModo(nuevo);
    if (nuevo === "ninguna") {
      setEnumer({ col_modalidad: undefined, modalidad_reglas: [] });
    } else if (nuevo === "columna") {
      setEnumer({ modalidad_reglas: [] });
    } else if (nuevo === "reglas") {
      setEnumer({ col_modalidad: undefined });
    }
  }

  async function onGenerate() {
    await run.runAsync(() => apiAnaliticaEnumeradores(enumer.col_enumerador));
  }

  const puedeGenerar = !!enumer.col_enumerador && (modo !== "reglas" || enumer.modalidad_reglas.length > 0);

  return (
    <Panel
      eyebrow="Reporte"
      title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Users size={16} /> Enumeradores</span>}
      hint={<>PDF con la producción de cada enumerador. Si defines una modalidad (<strong>Presencial</strong> / <strong>Telefónica</strong>), el reporte genera además una página por modalidad.</>}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* 1. Columna del enumerador */}
        <Section title="1. Identificación del enumerador" subtitle="La columna que guarda el nombre o ID de quién levantó la encuesta.">
          <VariableSelect
            variables={variables}
            value={enumer.col_enumerador}
            onChange={(v) => setEnumer({ col_enumerador: v })}
            placeholder="Seleccionar columna del enumerador…"
          />
        </Section>

        {/* 2. Modalidad */}
        <Section
          title="2. Modalidad de levantamiento"
          subtitle="Define cómo asignar Presencial / Telefónica a cada encuesta. Si no tiene sentido para tu proyecto, elige «Sin modalidad» y el reporte mostrará solo el total por enumerador."
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(
                [
                  { key: "ninguna", label: "Sin modalidad", icon: "—" },
                  { key: "columna", label: "Por columna existente", icon: "→" },
                  { key: "reglas", label: "Por reglas", icon: "≡" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => cambiarModo(opt.key)}
                  style={{
                    padding: "8px 14px", borderRadius: 6,
                    border: `1px solid ${modo === opt.key ? "var(--pulso-primary)" : "var(--pulso-border)"}`,
                    background: modo === opt.key ? "var(--pulso-primary-soft)" : "white",
                    color: modo === opt.key ? "var(--pulso-primary)" : "var(--pulso-text)",
                    cursor: "pointer", fontSize: 12, fontWeight: 600,
                    display: "inline-flex", alignItems: "center", gap: 6,
                  }}
                >
                  <span style={{ fontSize: 11, opacity: 0.7 }}>{opt.icon}</span>
                  {opt.label}
                </button>
              ))}
            </div>

            {modo === "ninguna" && (
              <div style={{ fontSize: 12, color: "var(--pulso-text-soft)", lineHeight: 1.5, padding: "8px 12px", background: "var(--pulso-surface)", borderRadius: 6 }}>
                El reporte tendrá una sola página con la producción total por enumerador. Sin desglose por modalidad.
              </div>
            )}

            {modo === "columna" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 12, color: "var(--pulso-text-soft)", lineHeight: 1.5 }}>
                  Selecciona una columna del dataset que indique la modalidad por fila. Los valores que no coincidan con las modalidades esperadas se agrupan como "otras".
                </div>
                <VariableSelect
                  variables={variables}
                  value={enumer.col_modalidad ?? ""}
                  onChange={(v) => setEnumer({ col_modalidad: v || undefined })}
                  allowClear
                  placeholder="Seleccionar columna de modalidad…"
                />
              </div>
            )}

            {modo === "reglas" && (
              <ReglasBuilder
                reglas={enumer.modalidad_reglas}
                modalidadDefault={enumer.modalidad_default}
                variables={variables}
                onReglas={(reglas) => setEnumer({ modalidad_reglas: reglas })}
                onDefault={(d) => setEnumer({ modalidad_default: d })}
              />
            )}
          </div>
        </Section>

        {/* 3. Desagregación */}
        <Section
          title="3. Cortes adicionales (opcional)"
          subtitle="Agrupa la producción por otra dimensión además de modalidad (p. ej. distrito, turno)."
        >
          <CortesPicker
            seleccionados={enumer.cols_corte}
            variables={variables.filter((v) => v.name !== enumer.col_enumerador && v.name !== enumer.col_modalidad)}
            onToggle={(name) => {
              const next = enumer.cols_corte.includes(name)
                ? enumer.cols_corte.filter((x) => x !== name)
                : [...enumer.cols_corte, name];
              setEnumer({ cols_corte: next });
            }}
            onClear={() => setEnumer({ cols_corte: [] })}
          />
        </Section>

        {/* 4. Detalles del reporte */}
        <Section title="4. Detalles del reporte">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 220 }}>
              <span className="pulso-section-eyebrow">Título</span>
              <input
                type="text"
                value={enumer.titulo}
                onChange={(e) => setEnumer({ titulo: e.target.value })}
                style={{ fontSize: 13, padding: "6px 10px" }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="pulso-section-eyebrow">Mínimo de encuestas</span>
              <input
                type="number"
                value={enumer.min_encuestas}
                onChange={(e) => setEnumer({ min_encuestas: Number(e.target.value) || 0 })}
                min={0}
                style={{ width: 110, fontSize: 13, padding: "6px 10px" }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="pulso-section-eyebrow">Ordenar por</span>
              <select
                value={enumer.ordenar_por}
                onChange={(e) => setEnumer({ ordenar_por: e.target.value as "total" | "nombre" })}
                style={{ fontSize: 13, padding: "6px 10px" }}
              >
                <option value="total">Producción total</option>
                <option value="nombre">Nombre</option>
              </select>
            </label>
          </div>
          {modo !== "ninguna" && (
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer", marginTop: 10 }}>
              <input
                type="checkbox"
                checked={enumer.mostrar_vacias}
                onChange={(e) => setEnumer({ mostrar_vacias: e.target.checked })}
              />
              <span style={{ color: "var(--pulso-text-soft)" }}>
                Mostrar modalidades sin encuestas en el reporte
              </span>
            </label>
          )}
        </Section>

        {/* Quarto check — la generación de PDF requiere Quarto CLI.
            Si falta, mostramos un banner claro con link de instalación
            y deshabilitamos el botón antes de disparar el job. */}
        {quartoOk === false && diag && (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: 8,
              border: "1px solid var(--pulso-warn-border)",
              background: "var(--pulso-warn-bg)",
              color: "var(--pulso-warn-fg)",
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
              fontSize: 13,
              lineHeight: 1.45,
              marginBottom: 12,
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <strong>Falta Quarto CLI</strong> — el reporte de enumeradores
              se renderiza con Quarto + Typst para PDF. {!diag.quarto.r_package && "También falta el paquete R "}
              {!diag.quarto.r_package && <code style={{ fontFamily: "ui-monospace, monospace" }}>quarto</code>}
              {!diag.quarto.r_package && " (instálalo con "}
              {!diag.quarto.r_package && <code style={{ fontFamily: "ui-monospace, monospace" }}>install.packages("quarto")</code>}
              {!diag.quarto.r_package && "). "}
              <br/>
              Instala Quarto CLI desde{" "}
              <a
                href={diag.quarto.install_url}
                target="_blank"
                rel="noreferrer"
                style={{ color: "var(--pulso-warn-fg)", display: "inline-flex", alignItems: "center", gap: 3 }}
              >
                quarto.org
                <ExternalLink size={11} />
              </a>{" "}
              y reabre Prosecnur. Las demás fases (Validación, Codificación,
              Codebook, Frecuencias, Cruces, Bases, Gráficos) funcionan sin Quarto.
            </div>
          </div>
        )}

        {/* 5. Generar */}
        <GenerateFooter
          label="Generar reporte"
          busy={run.busy}
          jobId={run.jobId}
          fileId={run.fileId}
          downloadName="enumeradores.pdf"
          error={run.error}
          onGenerate={onGenerate}
          disabled={!puedeGenerar || quartoOk === false}
          disabledHint={
            quartoOk === false
              ? "Falta Quarto CLI — instálalo desde quarto.org y reabre Prosecnur."
              : !enumer.col_enumerador
              ? "Selecciona primero la columna del enumerador."
              : "Agrega al menos una regla o cambia el modo a «Sin modalidad» / «Por columna»."}
          onJobDone={run.onJobDone}
          onJobError={run.onJobError}
          onJobCancelled={run.onJobCancelled}
          perBase={run.perBase}
        />
      </div>
    </Panel>
  );
}

// ---- Reglas builder --------------------------------------------------------

function ReglasBuilder({
  reglas, modalidadDefault, variables, onReglas, onDefault,
}: {
  reglas: ModalidadRegla[];
  modalidadDefault: string;
  variables: VariableInstrumento[];
  onReglas: (r: ModalidadRegla[]) => void;
  onDefault: (d: string) => void;
}) {
  function addRegla() {
    onReglas([
      ...reglas,
      {
        id: `r_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        condiciones: [],
        modalidad: "Presencial",
      },
    ]);
  }
  function updateRegla(id: string, patch: Partial<ModalidadRegla>) {
    onReglas(reglas.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function removeRegla(id: string) {
    onReglas(reglas.filter((r) => r.id !== id));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.5 }}>
        Cada regla tiene una o más <strong>condiciones</strong> (todas deben cumplirse). Las reglas se evalúan en orden;
        la primera que se cumple asigna la modalidad. Si ninguna matchea, se usa la modalidad <strong>por defecto</strong>.
      </div>

      {reglas.length === 0 && (
        <div style={{ padding: 14, border: "1px dashed var(--pulso-border)", borderRadius: 6, textAlign: "center", fontSize: 12, color: "var(--pulso-text-soft)" }}>
          Aún no hay reglas. Haz click en <strong>+ Agregar regla</strong> para empezar.
        </div>
      )}

      {reglas.map((regla, idx) => (
        <ReglaCard
          key={regla.id}
          regla={regla}
          index={idx}
          variables={variables}
          onUpdate={(patch) => updateRegla(regla.id, patch)}
          onRemove={() => removeRegla(regla.id)}
        />
      ))}

      <div>
        <button type="button" onClick={addRegla} style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
          <Plus size={12} /> Agregar regla
        </button>
      </div>

      <div
        style={{
          display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
          background: "var(--pulso-surface)", borderRadius: 6, border: "1px solid var(--pulso-border)",
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, color: "var(--pulso-text-soft)" }}>
          Si ninguna regla matchea →
        </span>
        <ModalidadPills value={modalidadDefault} onChange={onDefault} />
      </div>
    </div>
  );
}

function ReglaCard({
  regla, index, variables, onUpdate, onRemove,
}: {
  regla: ModalidadRegla;
  index: number;
  variables: VariableInstrumento[];
  onUpdate: (patch: Partial<ModalidadRegla>) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(true);

  function addCond() {
    onUpdate({
      condiciones: [...regla.condiciones, { columna: "", operador: "==", valor: "" }],
    });
  }
  function updateCond(i: number, patch: Partial<CondicionRegla>) {
    onUpdate({
      condiciones: regla.condiciones.map((c, idx) => (idx === i ? { ...c, ...patch } : c)),
    });
  }
  function removeCond(i: number) {
    onUpdate({ condiciones: regla.condiciones.filter((_, idx) => idx !== i) });
  }

  const resumen = regla.condiciones.length === 0
    ? "sin condiciones"
    : regla.condiciones.map((c) => `${c.columna || "?"} ${c.operador} ${Array.isArray(c.valor) ? `[${c.valor.length}]` : (c.valor || "?")}`).join(" Y ");

  return (
    <article
      style={{
        border: "1px solid var(--pulso-border)",
        borderRadius: 8,
        background: "white",
      }}
    >
      <header
        style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "8px 12px",
          background: "var(--pulso-surface)",
          borderBottom: open ? "1px solid var(--pulso-border)" : "none",
          borderRadius: "8px 8px 0 0",
        }}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="pulso-icon"
          aria-label={open ? "Colapsar" : "Expandir"}
        >
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--pulso-text-soft)", textTransform: "uppercase", letterSpacing: 0.3 }}>
          Regla {index + 1}
        </span>
        <span style={{ fontSize: 11, color: "var(--pulso-text-soft)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {resumen} → <ModalidadPrint v={regla.modalidad} />
        </span>
        <button type="button" onClick={onRemove} className="pulso-icon pulso-icon-danger" title="Eliminar regla" aria-label="Eliminar">
          <Trash2 size={12} />
        </button>
      </header>

      {open && (
        <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
          {regla.condiciones.map((cond, i) => (
            <CondicionRow
              key={i}
              cond={cond}
              variables={variables}
              onUpdate={(patch) => updateCond(i, patch)}
              onRemove={() => removeCond(i)}
              showAnd={i > 0}
            />
          ))}
          <button type="button" onClick={addCond} style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4, alignSelf: "flex-start" }}>
            <Plus size={11} /> {regla.condiciones.length === 0 ? "Agregar condición" : "Agregar otra condición (Y)"}
          </button>

          <div
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 0 0", borderTop: "1px dashed var(--pulso-border)",
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, color: "var(--pulso-text-soft)" }}>
              entonces modalidad →
            </span>
            <ModalidadPills
              value={regla.modalidad}
              onChange={(m) => onUpdate({ modalidad: m })}
            />
          </div>
        </div>
      )}
    </article>
  );
}

function CondicionRow({
  cond, variables, onUpdate, onRemove, showAnd,
}: {
  cond: CondicionRegla;
  variables: VariableInstrumento[];
  onUpdate: (patch: Partial<CondicionRegla>) => void;
  onRemove: () => void;
  showAnd: boolean;
}) {
  const [valores, setValores] = useState<ValorColumna[]>([]);
  const [loadingVals, setLoadingVals] = useState(false);

  // Al cambiar `columna`, precargamos sus valores únicos para sugerir.
  useEffect(() => {
    if (!cond.columna) { setValores([]); return; }
    let cancelled = false;
    setLoadingVals(true);
    (async () => {
      try {
        const r = await apiAnaliticaColumnValues(cond.columna);
        if (!cancelled) setValores(r.values);
      } catch {/* no-op */}
      finally { if (!cancelled) setLoadingVals(false); }
    })();
    return () => { cancelled = true; };
  }, [cond.columna]);

  const isMulti = cond.operador === "in" || cond.operador === "not_in";
  const valorArray = Array.isArray(cond.valor) ? cond.valor : (cond.valor ? [cond.valor] : []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {showAnd && (
        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--pulso-primary)", textTransform: "uppercase", letterSpacing: 0.5 }}>
          Y
        </span>
      )}
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <VariableSelect
            variables={variables}
            value={cond.columna}
            onChange={(v) => onUpdate({ columna: v, valor: isMulti ? [] : "" })}
            placeholder="Columna…"
          />
        </div>
        <select
          value={cond.operador}
          onChange={(e) => {
            const nuevo = e.target.value as CondicionOperador;
            const nuevoEsMulti = nuevo === "in" || nuevo === "not_in";
            const mismoTipo = nuevoEsMulti === isMulti;
            onUpdate({
              operador: nuevo,
              valor: mismoTipo ? cond.valor : (nuevoEsMulti ? [] : ""),
            });
          }}
          style={{ fontSize: 12, padding: "6px 8px", minWidth: 100 }}
        >
          <option value="==">es igual a</option>
          <option value="!=">es distinto de</option>
          <option value="in">está en</option>
          <option value="not_in">no está en</option>
        </select>
        <div style={{ flex: 1, minWidth: 200 }}>
          <ValorInput
            isMulti={isMulti}
            valor={isMulti ? valorArray : (valorArray[0] ?? "")}
            valores={valores}
            loading={loadingVals}
            disabled={!cond.columna}
            onChange={(v) => onUpdate({ valor: v })}
          />
        </div>
        <button type="button" onClick={onRemove} className="pulso-icon pulso-icon-danger" title="Quitar condición" aria-label="Quitar">
          <X size={11} />
        </button>
      </div>
    </div>
  );
}

function ValorInput({
  isMulti, valor, valores, loading, disabled, onChange,
}: {
  isMulti: boolean;
  valor: string | string[];
  valores: ValorColumna[];
  loading: boolean;
  disabled: boolean;
  onChange: (v: string | string[]) => void;
}) {
  if (disabled) {
    return (
      <input
        type="text"
        value=""
        disabled
        placeholder="Selecciona una columna…"
        style={{ width: "100%", fontSize: 12, padding: "6px 10px", background: "var(--pulso-surface-2)" }}
      />
    );
  }

  if (isMulti) {
    const lista = valor as string[];
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center", padding: "4px 6px", border: "1px solid var(--pulso-border)", borderRadius: 6, background: "white", minHeight: 32 }}>
        {lista.map((v) => (
          <span
            key={v}
            style={{
              display: "inline-flex", alignItems: "center", gap: 2,
              padding: "1px 4px 1px 8px", borderRadius: 999,
              background: "var(--pulso-primary-soft)",
              border: "1px solid var(--pulso-primary)",
              fontSize: 11, fontFamily: "monospace", color: "var(--pulso-primary)",
            }}
          >
            {v}
            <button type="button" onClick={() => onChange(lista.filter((x) => x !== v))} className="pulso-icon" aria-label={`Quitar ${v}`} style={{ minWidth: 16, minHeight: 16 }}>
              <X size={10} />
            </button>
          </span>
        ))}
        <select
          value=""
          onChange={(e) => {
            const v = e.target.value;
            if (v && !lista.includes(v)) onChange([...lista, v]);
          }}
          style={{ fontSize: 12, padding: "4px 6px", border: "none", background: "transparent", flex: 1, minWidth: 100 }}
          disabled={loading}
        >
          <option value="">{loading ? "Cargando…" : "+ añadir valor…"}</option>
          {valores.filter((v) => !lista.includes(v.value)).map((v) => (
            <option key={v.value} value={v.value}>
              {v.value}{v.label ? ` — ${v.label}` : ""}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // Operador ==/!=: select simple (si hay pocos valores únicos) o input.
  if (valores.length > 0 && valores.length <= 50) {
    return (
      <select
        value={valor as string}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", fontSize: 12, padding: "6px 10px" }}
      >
        <option value="">{loading ? "Cargando…" : "— seleccionar —"}</option>
        {valores.map((v) => (
          <option key={v.value} value={v.value}>
            {v.value}{v.label ? ` — ${v.label}` : ""}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      type="text"
      value={valor as string}
      onChange={(e) => onChange(e.target.value)}
      placeholder={loading ? "Cargando…" : "Valor"}
      list="vals-hint"
      style={{ width: "100%", fontSize: 12, padding: "6px 10px" }}
    />
  );
}

// ---- Modalidades (pills + iconos) ------------------------------------------

function ModalidadPills({ value, onChange }: { value: string; onChange: (v: ModalidadValor) => void }) {
  return (
    <div style={{ display: "inline-flex", gap: 5, flexWrap: "wrap" }}>
      {MODALIDADES_PULSO.map((m) => {
        const active = value === m;
        const icon = m === "Telefónica"
          ? <Phone size={11} />
          : m === "Presencial"
          ? <Users size={11} />
          : <span style={{ fontSize: 11, color: "var(--pulso-text-soft)", display: "inline-flex", alignItems: "center" }}>—</span>;
        return (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "4px 11px", borderRadius: 999,
              border: `1px solid ${active ? "var(--pulso-primary)" : "var(--pulso-border)"}`,
              background: active ? "var(--pulso-primary-soft)" : "white",
              color: active ? "var(--pulso-primary)" : "var(--pulso-text)",
              cursor: "pointer", fontSize: 11,
              fontWeight: active ? 600 : 500,
              transition: "background 120ms ease, border-color 120ms ease, color 120ms ease",
            }}
          >
            {icon}
            {m}
          </button>
        );
      })}
    </div>
  );
}

function ModalidadPrint({ v }: { v: string }) {
  // Usa tipo-so (azul) para telefónica, tipo-sm (verde) para presencial,
  // text-soft para "sin modalidad" (fallback).
  const color =
    v === "Telefónica" ? "var(--tipo-so-fg)"
    : v === "Presencial" ? "var(--tipo-sm-fg)"
    : "var(--pulso-text-soft)";
  return <strong style={{ color, fontWeight: 700 }}>{v}</strong>;
}

// ---- Cortes picker ---------------------------------------------------------

function CortesPicker({
  seleccionados, variables, onToggle, onClear,
}: {
  seleccionados: string[];
  variables: VariableInstrumento[];
  onToggle: (name: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const seleccionadosSet = useMemo(() => new Set(seleccionados), [seleccionados]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {seleccionados.length === 0 && (
          <span style={{ fontSize: 11, color: "var(--pulso-text-soft)", fontStyle: "italic" }}>
            Sin cortes adicionales.
          </span>
        )}
        {seleccionados.map((c) => {
          const v = variables.find((x) => x.name === c);
          return (
            <span
              key={c}
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "3px 4px 3px 10px", borderRadius: 999,
                background: "var(--pulso-primary-soft)",
                border: "1px solid var(--pulso-primary)",
                fontSize: 11, color: "var(--pulso-primary)",
                maxWidth: 260,
              }}
              title={v?.label}
            >
              <code style={{ fontFamily: "monospace", fontWeight: 700 }}>{c}</code>
              <button type="button" onClick={() => onToggle(c)} className="pulso-icon" aria-label={`Quitar ${c}`} style={{ minWidth: 16, minHeight: 16 }}>
                <X size={10} />
              </button>
            </span>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button type="button" onClick={() => setOpen((v) => !v)} style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
          <Plus size={12} /> {open ? "Cerrar selector" : "Agregar corte"}
        </button>
        {seleccionados.length > 0 && (
          <button type="button" onClick={onClear} style={{ fontSize: 12 }}>Quitar todos</button>
        )}
      </div>
      {open && (
        <div style={{ border: "1px solid var(--pulso-border)", borderRadius: 6, padding: 6, maxHeight: 240, overflowY: "auto", scrollbarWidth: "thin", scrollbarColor: "var(--pulso-border) transparent" }}>
          {variables.length === 0 ? (
            <div style={{ padding: 10, fontSize: 12, color: "var(--pulso-text-soft)", textAlign: "center" }}>Sin variables disponibles.</div>
          ) : (
            variables.map((v) => {
              const active = seleccionadosSet.has(v.name);
              return (
                <label
                  key={v.name}
                  style={{
                    display: "grid", gridTemplateColumns: "14px 1fr auto", alignItems: "center", gap: 8,
                    padding: "4px 6px", borderRadius: 4, cursor: "pointer",
                    background: active ? "var(--pulso-primary-soft)" : "transparent",
                  }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "var(--pulso-surface-2)"; }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
                >
                  <input type="checkbox" checked={active} onChange={() => onToggle(v.name)} style={{ margin: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <code style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 12, color: active ? "var(--pulso-primary)" : "var(--pulso-text)" }}>{v.name}</code>
                    <span style={{ marginLeft: 6, fontSize: 11, color: "var(--pulso-text-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.label}</span>
                  </div>
                  <span style={{ fontSize: 9, color: "var(--pulso-text-soft)", textTransform: "uppercase", letterSpacing: 0.3 }}>{v.tipo}</span>
                </label>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
