import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PulsoButton } from "../../../../components/PulsoButton";
import { serializarDireccion } from "../../../../lib/navegacion/direccion";
import { fmtN } from "./explorarModelo";

const VISIBLES = 20;

/** Codificación en la gramática v3; si el manifiesto no la resuelve, no hay enlace. */
const A_CODIFICACION = (() => {
  const href = serializarDireccion({ modulo: "procesamiento", seccion: "codificacion" });
  return href && href !== "/" ? href : null;
})();

/**
 * E6 — abierta: las respuestas iguales agrupadas (sin mayúsculas ni tildes,
 * lo hace el motor) con cuántas veces aparecen, y el paso a Codificación.
 */
export default function DistribucionTexto({ grupos }: { grupos: readonly { texto: string; n: number }[] }) {
  const [todas, setTodas] = useState(false);
  const navigate = useNavigate();
  const ordenados = [...grupos].sort((a, b) => b.n - a.n);
  const visibles = todas ? ordenados : ordenados.slice(0, VISIBLES);
  return (
    <div className="vx-barras">
      {ordenados.length === 0 ? (
        <p className="vx-pie">No hay respuestas abiertas no vacías para esta variable.</p>
      ) : (
        <ul className="vx-textos">
          {visibles.map((g) => (
            <li key={g.texto}>
              <span>{g.texto}</span>
              <span>× {fmtN(g.n)}</span>
            </li>
          ))}
        </ul>
      )}
      {ordenados.length > VISIBLES && (
        <button type="button" className="vx-ver-mas" aria-expanded={todas} onClick={() => setTodas((t) => !t)}>
          {todas ? "Ver menos" : `Ver las ${fmtN(ordenados.length)} respuestas distintas`}
        </button>
      )}
      {A_CODIFICACION && ordenados.length > 0 && (
        <PulsoButton variant="link" size="sm" nav onClick={() => navigate(A_CODIFICACION)}>
          Abrir Codificación
        </PulsoButton>
      )}
    </div>
  );
}
