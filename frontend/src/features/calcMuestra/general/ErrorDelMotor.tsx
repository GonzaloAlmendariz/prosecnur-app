import { ErrorBlock } from "../../../components/States";
import type { ErrorGeneral } from "./modelo";

/**
 * El error del motor con su mensaje y, si vino, la muestra de filas que lo
 * causan (ids repetidos, filas sin id, tamaños inválidos). El motor manda
 * hasta 20: se muestran tal cual para que se puedan buscar en el archivo.
 */
export function ErrorDelMotor({ error, label }: { error: ErrorGeneral; label: string }) {
  const d = error.detalle;
  const listas: Array<{ titulo: string; valores: string[] }> = d
    ? [
        { titulo: "Ids repetidos", valores: d.ids_duplicados },
        { titulo: "Filas sin id", valores: d.filas_sin_id.map(String) },
        { titulo: "Ids con tamaño inválido", valores: d.ids },
      ].filter((l) => l.valores.length > 0)
    : [];
  return (
    <div className="cmg-error">
      <ErrorBlock label={label} detail={error.texto} />
      {listas.map((l) => (
        <div key={l.titulo} className="cmg-error-lista">
          <span>{l.titulo}</span>
          <ul aria-label={l.titulo}>
            {l.valores.map((v) => <li key={v}><code>{v}</code></li>)}
          </ul>
        </div>
      ))}
    </div>
  );
}
