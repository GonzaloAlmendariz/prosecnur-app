// Analítica › cuántos casos cuentan. Si una base declara en Validación «Qué
// caso cuenta», las tablas, la base y el libro trabajan con ese universo: esta
// línea lo dice con su condición y lleva a donde se cambia. Sin criterio
// declarado no pinta nada.

import { useEffect, useState } from "react";
import { useInRouterContext, useNavigate } from "react-router-dom";
import { apiAnaliticaUniverso } from "../../api/analitica";
import { useSession } from "../../lib/SessionContext";
import { lineasUniverso, type LineaUniverso } from "./universoModel";
import "./universoAnalisis.css";

function Cambiar() {
  const navigate = useNavigate();
  return (
    <button type="button" className="pulso-universo-cambiar" onClick={() => navigate("/validacion?pestana=instrumento")}>
      Cambiar
    </button>
  );
}

export function UniversoAnalisis() {
  const { state } = useSession();
  const conRouter = useInRouterContext();
  const [lineas, setLineas] = useState<LineaUniverso[]>([]);
  // Se vuelve a leer cuando cambia la base activa o la fuente de Analítica.
  const clave = `${state?.active_base ?? ""}|${state?.analitica_fuente ?? ""}`;
  useEffect(() => {
    let vivo = true;
    apiAnaliticaUniverso()
      .then((b) => { if (vivo) setLineas(lineasUniverso(b)); })
      .catch(() => { if (vivo) setLineas([]); });
    return () => { vivo = false; };
  }, [clave]);
  if (!lineas.length) return null;
  return (
    <div className="pulso-universo" role="status" aria-label="Casos que cuentan en el análisis">
      {lineas.map((l) => (
        <p key={l.base} className={l.aviso ? "is-aviso" : undefined}>{l.texto}</p>
      ))}
      {conRouter ? <Cambiar /> : null}
    </div>
  );
}
