// La pestaña "Respuestas" del detalle de Aplicar: cada texto de la pregunta, sus veces y el código con que
// entra a la base. Lee lo mismo que Codificar; mientras llega, la silueta en su lugar.

import { useEffect, useState } from "react";
import { apiCodifRespuestas } from "../../../api/codificacion";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { ErrorBlock, LoadingBlock } from "../../../components/States";
import { formatoConteo } from "../../../lib/formatoNumero";
import { MessageSquare } from "../../../vendor/lucide-react";
import { respuestasAplicadas, type FilaDeRespuestaAplicada } from "./modeloRespuestasDeAplicar";

type Lectura = { filas: FilaDeRespuestaAplicada[] | null; error: string };

export function RespuestasDeAplicar({ parent }: { parent: string }) {
  const [lectura, setLectura] = useState<Lectura>({ filas: null, error: "" });
  useEffect(() => {
    let vivo = true;
    setLectura({ filas: null, error: "" });
    apiCodifRespuestas(parent).then(
      (r) => {
        if (vivo) setLectura({ filas: respuestasAplicadas(r.respuestas ?? [], r.grupos ?? []), error: "" });
      },
      (e: unknown) => {
        if (vivo) setLectura({ filas: null, error: e instanceof Error ? e.message : String(e) });
      },
    );
    return () => {
      vivo = false;
    };
  }, [parent]);

  if (lectura.error) {
    return <ErrorBlock label="No se pudieron leer las respuestas de la pregunta" detail={lectura.error} queda="La codificación sigue como estaba." />;
  }
  if (!lectura.filas) return <LoadingBlock label="Cargando las respuestas de la pregunta" />;
  if (lectura.filas.length === 0) {
    return <EstadoVacio icono={<MessageSquare size={16} />} titulo="Sin respuestas" descripcion="La pregunta no tiene textos en la base." />;
  }
  return (
    <div className="pulso-aplicar-codigos pulso-aplicar-respuestas-tabla" role="table" aria-label={`Respuestas de ${parent} y su código`} aria-rowcount={lectura.filas.length + 1} tabIndex={0}>
      <div role="rowgroup" className="pulso-aplicar-codigos-cab">
        <div role="row" className="pulso-aplicar-codigos-fila">
          <span role="columnheader">Respuesta</span>
          <span role="columnheader" className="pulso-aplicar-col-veces">Veces</span>
          <span role="columnheader">Código</span>
        </div>
      </div>
      <div role="rowgroup" className="pulso-aplicar-codigos-cuerpo" data-qa-geometry-group="codificacion/aplicar-respuestas" data-qa-geometry-contract="intrinsic">
        {lectura.filas.map((f) => (
          <div key={f.clave} role="row" className="pulso-aplicar-codigos-fila">
            <span role="cell" title={f.titulo}>{f.texto}</span>
            <span role="cell" className="pulso-aplicar-col-veces">{formatoConteo(f.veces)}</span>
            <span role="cell" data-sin-codigo={f.codigos.length ? undefined : ""}>{f.codigos.length ? f.codigos.join(", ") : "Sin código"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
