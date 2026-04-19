import { useEffect, useState } from "react";
import { NavLink, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { apiCodifPreguntasAbiertas, PreguntaAbierta } from "../../api/client";
import { Alert } from "../../components/Alert";
import { Panel } from "../../components/Panel";

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

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <NavLink
          to="/codificacion"
          style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, color: "var(--pulso-text-soft)", textDecoration: "none" }}
        >
          <ArrowLeft size={14} /> Volver a preguntas
        </NavLink>
      </div>

      <h1 className="pulso-page-title" style={{ fontFamily: "monospace", fontSize: 28 }}>{pregunta.parent}</h1>
      <p className="pulso-page-lead">{pregunta.parent_label}</p>

      <Panel eyebrow={pregunta.subtipo.replace(/_/g, " ")} title="Próximamente: vista de codificación por respuesta">
        <div style={{ fontSize: 13, color: "var(--pulso-text-soft)", lineHeight: 1.6 }}>
          Esta pregunta tiene <strong>{pregunta.n_respuestas}</strong> respuestas
          ({<strong>{pregunta.n_unicas}</strong>} únicas) en la columna <code style={{ fontFamily: "monospace" }}>{pregunta.col_efectiva}</code>.
          <br /><br />
          La vista detallada con agrupamiento, sugerencias por similitud y asignación de códigos llega en la próxima sub-parte del rediseño (B3.2–B3.4).
          Mientras tanto, podés usar el <strong>Modo avanzado</strong> desde el listado para editar en tabla.
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
    </section>
  );
}
