import { useEffect, useMemo, useState } from "react";
import { Link2, X } from "lucide-react";
import { apiCodifColumnas, PreguntaAbierta } from "../../api/client";

export type PairingResult = {
  child_col: string;
  modo_so?: "padre" | "hijo";
  dummy_col?: string;
};

type Props = {
  pregunta: PreguntaAbierta;
  preselectedChild?: string;
  onConfirm: (r: PairingResult) => void;
  onCancel: () => void;
};

export function PairingDialog({ pregunta, preselectedChild, onConfirm, onCancel }: Props) {
  const [childCol, setChildCol] = useState<string>(() => {
    if (preselectedChild) return preselectedChild;
    const pj = pregunta.pareja;
    if (pj && typeof pj === "object" && "child_col" in pj && pj.child_col) return pj.child_col;
    if (pregunta.candidatos_texto && pregunta.candidatos_texto.length > 0) return pregunta.candidatos_texto[0].col;
    return "";
  });
  const [modoSo, setModoSo] = useState<"padre" | "hijo">(() => {
    if (pregunta.modo_so === "padre" || pregunta.modo_so === "hijo") return pregunta.modo_so;
    return "padre";
  });
  const [dummyCol, setDummyCol] = useState<string>(() => {
    const pj = pregunta.pareja;
    if (pj && typeof pj === "object" && "dummy_col" in pj && pj.dummy_col) return pj.dummy_col;
    return "";
  });
  const [columnas, setColumnas] = useState<string[]>([]);
  const [showAllCols, setShowAllCols] = useState(() => {
    if (!preselectedChild) return false;
    const candsCols = (pregunta.candidatos_texto ?? []).map((c) => c.col);
    return !candsCols.includes(preselectedChild);
  });

  useEffect(() => {
    (async () => {
      try {
        const r = await apiCodifColumnas();
        setColumnas(r.columnas);
      } catch {
        // silent — fallback a los candidatos sugeridos
      }
    })();
  }, []);

  const candidatosCols = useMemo(
    () => (pregunta.candidatos_texto ?? []).map((c) => c.col),
    [pregunta.candidatos_texto]
  );

  // Dummy candidates para SM: columnas con patrón "<parent>/<N>" o similar
  const dummyCandidates = useMemo(() => {
    if (pregunta.tipo !== "select_multiple") return [];
    const rx = new RegExp(`^${escapeRegex(pregunta.parent)}[/_.]\\d+$`);
    return columnas.filter((c) => rx.test(c));
  }, [columnas, pregunta]);

  const isSO = pregunta.tipo === "select_one";
  const isSM = pregunta.tipo === "select_multiple";

  function onConfirmClick() {
    if (!childCol) return;
    const result: PairingResult = { child_col: childCol };
    if (isSO) result.modo_so = modoSo;
    if (isSM && dummyCol) result.dummy_col = dummyCol;
    onConfirm(result);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pairing-title"
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(15, 23, 42, 0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white", borderRadius: 10, padding: 20,
          width: 520, maxWidth: "calc(100vw - 32px)", maxHeight: "calc(100vh - 32px)",
          overflowY: "auto", boxShadow: "var(--pulso-shadow-med)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Link2 size={16} color="var(--pulso-primary)" />
          <h2 id="pairing-title" style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
            Emparejar pregunta
          </h2>
          <div style={{ flex: 1 }} />
          <button type="button" onClick={onCancel} className="pulso-icon" aria-label="Cerrar">
            <X size={14} />
          </button>
        </div>
        <div style={{ fontSize: 13, color: "var(--pulso-text-soft)", marginBottom: 16 }}>
          <code style={{ fontFamily: "monospace", color: "var(--pulso-primary)" }}>{pregunta.parent}</code> · {pregunta.parent_label}
        </div>

        {/* Paso 1: columna hija */}
        <div style={{ marginBottom: 16 }}>
          <div className="pulso-section-eyebrow" style={{ marginBottom: 6 }}>Paso 1 · Columna "Otros, especifique"</div>
          <div style={{ fontSize: 12, color: "var(--pulso-text-soft)", marginBottom: 10 }}>
            ¿Qué columna del dataset contiene el texto abierto de esta pregunta?
          </div>

          {candidatosCols.length > 0 && !showAllCols && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {pregunta.candidatos_texto.slice(0, 5).map((c) => (
                <label key={c.col} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", border: `1px solid ${childCol === c.col ? "var(--pulso-primary)" : "var(--pulso-border)"}`, borderRadius: 6, cursor: "pointer", background: childCol === c.col ? "var(--pulso-primary-soft)" : "white" }}>
                  <input
                    type="radio"
                    checked={childCol === c.col}
                    onChange={() => setChildCol(c.col)}
                  />
                  <code style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 600 }}>{c.col}</code>
                  <div style={{ flex: 1 }} />
                  <ConfLabel conf={c.confianza} />
                </label>
              ))}
              <button
                type="button"
                onClick={() => setShowAllCols(true)}
                style={{ fontSize: 11, padding: "4px 8px", marginTop: 4, alignSelf: "flex-start" }}
              >
                No está acá — buscar en todas las columnas
              </button>
            </div>
          )}

          {(candidatosCols.length === 0 || showAllCols) && (
            <div>
              <input
                list="all-cols"
                value={childCol}
                onChange={(e) => setChildCol(e.target.value)}
                placeholder="nombre de columna"
                style={{ width: "100%", fontSize: 13, fontFamily: "monospace", padding: "6px 10px" }}
                autoFocus
              />
              <datalist id="all-cols">
                {columnas.map((c) => <option key={c} value={c} />)}
              </datalist>
              {showAllCols && candidatosCols.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAllCols(false)}
                  style={{ fontSize: 11, padding: "4px 8px", marginTop: 6 }}
                >
                  ← Volver a candidatos sugeridos
                </button>
              )}
            </div>
          )}
        </div>

        {/* Paso 2 SO: qué codificar */}
        {isSO && childCol && (
          <div style={{ marginBottom: 16 }}>
            <div className="pulso-section-eyebrow" style={{ marginBottom: 6 }}>Paso 2 · ¿Qué vas a codificar?</div>
            <div style={{ fontSize: 12, color: "var(--pulso-text-soft)", marginBottom: 10 }}>
              Una pregunta de opción única con "Otros, especifique" tiene dos datos: las opciones originales (1, 2, 3…) y el texto libre de quienes marcaron "Otros". Elige qué vas a agrupar y codificar.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <ModoOption
                value="padre"
                current={modoSo}
                onChange={setModoSo}
                title="Integrar el texto a las opciones originales (recomendado)"
                description={`Los textos de "${childCol}" se vuelven nuevas opciones de ${pregunta.parent}. Ejemplo: si alguien eligió "Otra" y escribió "Venezolana", esa persona queda con código 2 "Venezolana" en ${pregunta.parent}. Lo no categorizable queda como "Otros".`}
              />
              <ModoOption
                value="hijo"
                current={modoSo}
                onChange={setModoSo}
                title="Codificar el texto como campo separado"
                description={`Los textos de "${childCol}" se codifican en un campo aparte (${childCol}_recod) con sus propias categorías. Las opciones originales de ${pregunta.parent} no cambian. Útil cuando el texto representa otra dimensión distinta.`}
              />
            </div>
          </div>
        )}

        {/* Paso 2 SM: dummy col — SM no tiene modo padre/hijo, solo dummy */}
        {isSM && childCol && (
          <div style={{ marginBottom: 16 }}>
            <div className="pulso-section-eyebrow" style={{ marginBottom: 6 }}>Paso 2 · ¿Cuál opción es "Otros, especifique"?</div>
            <div style={{ fontSize: 12, color: "var(--pulso-text-soft)", marginBottom: 10, lineHeight: 1.5 }}>
              A diferencia de opción única, en preguntas múltiples solo vas a codificar el texto libre
              (<code style={{ fontFamily: "monospace" }}>{childCol}</code>). Pero primero indícanos cuál de las
              opciones de {pregunta.parent} corresponde a "Otros, especifique". La app solo considera los
              registros donde esa opción fue marcada — el resto no tiene texto para codificar.
            </div>
            <input
              list="dummy-cols"
              value={dummyCol}
              onChange={(e) => setDummyCol(e.target.value)}
              placeholder={`ej. ${pregunta.parent}/99`}
              style={{ width: "100%", fontSize: 13, fontFamily: "monospace", padding: "6px 10px" }}
            />
            <datalist id="dummy-cols">
              {dummyCandidates.map((c) => <option key={c} value={c} />)}
              {columnas.map((c) => <option key={c + "-all"} value={c} />)}
            </datalist>
            {dummyCandidates.length > 0 && (
              <div style={{ fontSize: 10, color: "var(--pulso-text-soft)", marginTop: 4 }}>
                Sugeridas por la app: {dummyCandidates.slice(0, 4).join(" · ")}
              </div>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <button type="button" onClick={onCancel}>Cancelar</button>
          <button
            type="button"
            className="pulso-primary"
            disabled={!childCol}
            onClick={onConfirmClick}
          >
            {pregunta.pareja && typeof pregunta.pareja === "object" && "child_col" in pregunta.pareja ? "Actualizar" : "Confirmar emparejamiento"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModoOption({ value, current, onChange, title, description }: { value: "padre" | "hijo"; current: "padre" | "hijo"; onChange: (v: "padre" | "hijo") => void; title: string; description: string }) {
  const active = current === value;
  return (
    <label
      style={{
        display: "flex", gap: 10, padding: 10,
        border: `1px solid ${active ? "var(--pulso-primary)" : "var(--pulso-border)"}`,
        borderRadius: 6,
        background: active ? "var(--pulso-primary-soft)" : "white",
        cursor: "pointer",
        alignItems: "flex-start",
      }}
    >
      <input type="radio" checked={active} onChange={() => onChange(value)} style={{ marginTop: 3 }} />
      <div>
        <div style={{ fontWeight: 600, fontSize: 13, color: active ? "var(--pulso-primary)" : "var(--pulso-text)" }}>{title}</div>
        <div style={{ fontSize: 12, color: "var(--pulso-text-soft)", marginTop: 2, lineHeight: 1.4 }}>{description}</div>
      </div>
    </label>
  );
}

function ConfLabel({ conf }: { conf: number }) {
  if (conf >= 1.0) return <span style={{ fontSize: 10, fontWeight: 700, color: "var(--pulso-success-fg)", letterSpacing: 0.3, textTransform: "uppercase" }}>Match fuerte</span>;
  if (conf >= 0.6) return <span style={{ fontSize: 10, fontWeight: 700, color: "var(--pulso-warn-fg)", letterSpacing: 0.3, textTransform: "uppercase" }}>Prefijo</span>;
  return <span style={{ fontSize: 10, fontWeight: 600, color: "var(--pulso-status-empty)", letterSpacing: 0.3, textTransform: "uppercase" }}>Misma sección</span>;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
