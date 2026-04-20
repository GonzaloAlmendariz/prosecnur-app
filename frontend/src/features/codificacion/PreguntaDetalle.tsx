import { useEffect, useState } from "react";
import { NavLink, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { apiCodifPreguntasAbiertas, arquetipoOf, PreguntaAbierta } from "../../api/client";
import { Alert } from "../../components/Alert";
import { Panel } from "../../components/Panel";
import { RespuestasCodificador } from "./RespuestasCodificador";

const TIPO_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  select_multiple: { bg: "var(--tipo-sm-bg)", fg: "var(--tipo-sm-fg)", label: "Múltiple" },
  select_one: { bg: "var(--tipo-so-bg)", fg: "var(--tipo-so-fg)", label: "Opción única" },
  integer: { bg: "var(--tipo-int-bg)", fg: "var(--tipo-int-fg)", label: "Numérica" },
  text: { bg: "var(--tipo-text-bg)", fg: "var(--tipo-text-fg)", label: "Texto abierto" },
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

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!pregunta) return <Alert kind="info">Cargando…</Alert>;

  const arq = arquetipoOf(pregunta);
  const ts = TIPO_STYLE[pregunta.tipo] ?? TIPO_STYLE.text;

  // Arquetipos donde el analista codifica agrupando texto:
  //  - solitaria: text puro (Pulso_code)
  //  - pareja-so con modo_so=hijo: text_col del "Otros" recodifica
  //  - adoptada: la hija (text) de una SO/SM — su vista de codificación también va acá
  const codificableTexto =
    arq === "solitaria" ||
    arq === "adoptada" ||
    (arq === "pareja-so" && pregunta.modo_so === "hijo");

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

      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
        <h1 className="pulso-page-title" style={{ fontFamily: "monospace", fontSize: 28, margin: 0 }}>{pregunta.parent}</h1>
        <span style={{ padding: "3px 8px", borderRadius: 4, background: ts.bg, color: ts.fg, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
          {ts.label}
          {pregunta.modo_so === "hijo" && " · hijo"}
          {pregunta.modo_so === "padre" && " · padre"}
        </span>
        {pregunta.section_label && (
          <span style={{ fontSize: 12, color: "var(--pulso-text-soft)" }}>
            {pregunta.section_label}
          </span>
        )}
      </div>
      <p className="pulso-page-lead">{pregunta.parent_label}</p>

      {codificableTexto ? (
        <Panel
          eyebrow="Codificador"
          title="Agrupá respuestas y asigná códigos"
          hint={`Marcá las respuestas que pertenecen a un mismo concepto, agrupalas y asignales un código + etiqueta. Las respuestas con texto idéntico (tras normalizar acentos y mayúsculas) ya están agrupadas automáticamente. La columna que leemos es ${pregunta.col_efectiva}.`}
        >
          <RespuestasCodificador parent={pregunta.parent} />
        </Panel>
      ) : (
        <Panel eyebrow={arq.replace("-", " ")} title="Esta vista llega en la próxima sub-parte">
          <div style={{ fontSize: 13, color: "var(--pulso-text-soft)", lineHeight: 1.6 }}>
            Esta pregunta tiene <strong>{pregunta.n_respuestas}</strong> respuestas
            ({<strong>{pregunta.n_unicas}</strong>} únicas) en la columna <code style={{ fontFamily: "monospace" }}>{pregunta.col_efectiva}</code>.
            <br /><br />
            {arq === "auto" && "Las preguntas numéricas (integer) se recodifican con un flujo específico que llega en B3.3."}
            {arq === "pareja-sm" && "Las preguntas de opción múltiple tienen su propia vista de codificación por opciones en B3.4."}
            {(arq === "pareja-so" && pregunta.modo_so === "padre") && "El modo padre recodifica los valores originales — llega en B3.3."}
            {(arq === "pareja-so" && !pregunta.modo_so) && "Falta decidir modo padre/hijo. Volvé al listado para emparejar con su 'Otros especifique'."}
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
