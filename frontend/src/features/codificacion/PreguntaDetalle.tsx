import { useEffect, useState } from "react";
import { NavLink, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { apiCodifPreguntasAbiertas, arquetipoOf, PreguntaAbierta } from "../../api/client";
import { Panel } from "../../components/Panel";
import { LoadingBlock, ErrorBlock } from "../../components/States";
import { RespuestasCodificador } from "./RespuestasCodificador";
import { IntegerCodificador } from "./IntegerCodificador";

const TIPO_STYLE: Record<string, { bg: string; fg: string; border: string; label: string }> = {
  select_multiple: { bg: "var(--tipo-sm-bg)", fg: "var(--tipo-sm-fg)", border: "var(--tipo-sm-border)", label: "Múltiple" },
  select_one: { bg: "var(--tipo-so-bg)", fg: "var(--tipo-so-fg)", border: "var(--tipo-so-border)", label: "Opción única" },
  integer: { bg: "var(--tipo-int-bg)", fg: "var(--tipo-int-fg)", border: "var(--tipo-int-border)", label: "Numérica" },
  text: { bg: "var(--tipo-text-bg)", fg: "var(--tipo-text-fg)", border: "var(--tipo-text-border)", label: "Texto abierto" },
};

export default function PreguntaDetalle() {
  const { parent } = useParams<{ parent: string }>();
  const [pregunta, setPregunta] = useState<PreguntaAbierta | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!parent) return;
    (async () => {
      try {
        const r = await apiCodifPreguntasAbiertas();
        const found = r.preguntas.find((p) => p.parent === parent);
        if (!found) setError(`No se encontró la pregunta '${parent}'.`);
        else setPregunta(found);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [parent]);

  if (error) return <ErrorBlock label="No se pudo cargar la pregunta" detail={error} />;
  if (!pregunta) return <LoadingBlock label="Cargando pregunta…" />;

  const arq = arquetipoOf(pregunta);
  const ts = TIPO_STYLE[pregunta.tipo] ?? TIPO_STYLE.text;

  // Todos los arquetipos que codifican valores discretos o texto abierto
  // usan el mismo RespuestasCodificador. Quedan afuera SM (columnar) y
  // SO sin modo decidido.
  const codificableInline =
    arq === "solitaria" ||
    arq === "adoptada" ||
    arq === "huerfana" ||
    arq === "auto" || // integer
    (arq === "pareja-so" && (pregunta.modo_so === "hijo" || pregunta.modo_so === "padre"));

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <NavLink
          to="/codificacion"
          style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, color: "var(--pulso-text-soft)", textDecoration: "none" }}
        >
          <ArrowLeft size={14} /> Volver al listado
        </NavLink>
      </div>

      {/* Header — mismo patrón que CodificarWizard > CodificadorPane. */}
      <header style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
        <span
          aria-hidden="true"
          title={ts.label}
          style={{
            width: 34, height: 34, borderRadius: 8,
            background: ts.bg, color: ts.fg,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, fontSize: 11, fontWeight: 700,
            border: `1px solid ${ts.border ?? "transparent"}`,
          }}
        >
          {ts.label.slice(0, 2).toUpperCase()}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, fontSize: 16, lineHeight: 1.3, fontWeight: 700 }}>
              {pregunta.parent_label}
            </h2>
            <code
              title={`ID del XLSForm: ${pregunta.parent}`}
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: 11, fontWeight: 600,
                color: ts.fg, background: ts.bg,
                padding: "2px 8px", borderRadius: 4,
              }}
            >
              {pregunta.parent}
            </code>
            <span
              style={{
                padding: "2px 8px", borderRadius: 999,
                background: ts.bg, color: ts.fg,
                fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3,
              }}
            >
              {ts.label}
              {pregunta.modo_so === "hijo" && " · hijo"}
              {pregunta.modo_so === "padre" && " · padre"}
            </span>
          </div>
          {pregunta.section_label && (
            <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", marginTop: 4 }}>
              {pregunta.section_label}
            </div>
          )}
        </div>
      </header>

      {codificableInline ? (
        <Panel
          eyebrow="Codificador"
          title="Agrupa respuestas y asigna códigos"
          hint={`Marca las respuestas que pertenecen a un mismo concepto, agrúpalas y asígnales un código + etiqueta. Las respuestas con texto idéntico (tras normalizar acentos y mayúsculas) ya están agrupadas automáticamente. La columna que leemos es ${pregunta.col_efectiva}.`}
        >
          {arq === "auto"
            ? <IntegerCodificador parent={pregunta.parent} />
            : <RespuestasCodificador parent={pregunta.parent} />}
        </Panel>
      ) : (
        <Panel eyebrow={arq.replace("-", " ")} title="Esta vista llega en la próxima sub-parte">
          <div style={{ fontSize: 13, color: "var(--pulso-text-soft)", lineHeight: 1.6 }}>
            Esta pregunta tiene <strong>{pregunta.n_respuestas}</strong> respuestas
            ({<strong>{pregunta.n_unicas}</strong>} únicas) en la columna <code style={{ fontFamily: "monospace" }}>{pregunta.col_efectiva}</code>.
            <br /><br />
            {arq === "pareja-sm" && "Las preguntas de opción múltiple tienen su propia vista de codificación por opciones (próximo commit)."}
            {(arq === "pareja-so" && !pregunta.modo_so) && "Falta decidir modo padre/hijo. Vuelve al listado para emparejar con su 'Otros, especifique'."}
            {arq === "config-so" && "Configura esta pregunta desde el listado principal."}
            {arq === "no-aplica" && "Esta pregunta está desactivada."}
          </div>
          {pregunta.preview && pregunta.preview.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className="pulso-section-eyebrow">Respuestas más frecuentes</div>
              <ul style={{ fontSize: 13, paddingLeft: 20, marginTop: 8 }}>
                {pregunta.preview.map((p, i) => <li key={i}>“{p}”</li>)}
              </ul>
            </div>
          )}
        </Panel>
      )}
    </section>
  );
}
