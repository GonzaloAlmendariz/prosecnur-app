import { AlertTriangle, Tags } from "lucide-react";
import type { CodifOmitida, CodifTextosSinCodigo } from "../../api/codificacion";
import "./AplicarOmitidasAviso.css";

// ADR 0100, P1: lo que `/aplicar` no aplicó. Dos daños distintos que hasta
// aquí ocurrían en silencio:
//   1. una pregunta del catálogo que se omitió entera (le falta la columna de
//      texto, no tiene modo…) y cuya variable `_recod` no se crea;
//   2. textos de una pregunta aplicada que no están en ningún grupo y quedan
//      sin código.
// Avisa fuerte (ADR 0077) y no bloquea: el job ya está corriendo. Con las dos
// listas vacías no pinta nada; un «0 omitidas» sería ruido.

type Props = {
  omitidas: CodifOmitida[];
  textosSinCodigo: CodifTextosSinCodigo[];
};

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

export function AplicarOmitidasAviso({ omitidas, textosSinCodigo }: Props) {
  if (omitidas.length === 0 && textosSinCodigo.length === 0) return null;

  return (
    <section
      className="pulso-codif-omitidas"
      aria-label="Lo que la adaptación no aplicó"
      data-testid="codificacion-aplicar-omitidas"
    >
      {omitidas.length > 0 && (
        <div className="pulso-codif-omitidas-bloque pulso-codif-omitidas-bloque--fuerte" role="alert">
          <div className="pulso-codif-omitidas-cabecera">
            <AlertTriangle size={16} aria-hidden="true" className="pulso-codif-omitidas-icono" />
            <div>
              <strong>
                {omitidas.length === 1
                  ? "1 pregunta del catálogo no se aplicó"
                  : `${omitidas.length} preguntas del catálogo no se aplicaron`}
              </strong>
              <p>Su codificación no llega a la base adaptada. Corrige la causa y vuelve a adaptar.</p>
            </div>
          </div>
          <ul
            className="pulso-codif-omitidas-lista"
            data-qa-geometry-group="codificacion/aplicar-omitidas"
            data-qa-geometry-contract="intrinsic"
          >
            {omitidas.map((o, i) => (
              <li
                key={`${o.pregunta}-${o.variable_nueva ?? ""}-${i}`}
                className="pulso-codif-omitidas-fila"
                data-motivo={o.motivo}
              >
                <code className="pulso-codif-omitidas-pregunta">{o.pregunta}</code>
                <span className="pulso-codif-omitidas-mensaje">
                  {o.mensaje}
                  {o.variable_nueva && (
                    <>
                      {" "}
                      No se crea <code>{o.variable_nueva}</code>.
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {textosSinCodigo.length > 0 && (
        <div className="pulso-codif-omitidas-bloque">
          <div className="pulso-codif-omitidas-cabecera">
            <Tags size={16} aria-hidden="true" className="pulso-codif-omitidas-icono" />
            <div>
              <strong>
                {textosSinCodigo.length === 1
                  ? "1 pregunta tiene textos sin código"
                  : `${textosSinCodigo.length} preguntas tienen textos sin código`}
              </strong>
              <p>No están en ningún grupo de su pregunta. Agrégalos en Codificar y vuelve a adaptar.</p>
            </div>
          </div>
          <ul
            className="pulso-codif-omitidas-lista"
            data-qa-geometry-group="codificacion/aplicar-sin-codigo"
            data-qa-geometry-contract="intrinsic"
          >
            {textosSinCodigo.map((t, i) => {
              const restantes = t.textos - t.ejemplos.length;
              return (
                <li key={`${t.pregunta}-${t.columna}-${i}`} className="pulso-codif-omitidas-fila">
                  <code className="pulso-codif-omitidas-pregunta">{t.pregunta}</code>
                  <div className="pulso-codif-omitidas-detalle">
                    <span className="pulso-codif-omitidas-mensaje">
                      {plural(t.casos, "caso", "casos")} · {plural(t.textos, "texto distinto", "textos distintos")}
                      {t.columna && t.columna !== t.pregunta && (
                        <>
                          {" "}en <code>{t.columna}</code>
                        </>
                      )}
                    </span>
                    {t.ejemplos.length > 0 && (
                      <ul className="pulso-codif-omitidas-ejemplos" aria-label={`Ejemplos de ${t.pregunta}`}>
                        {t.ejemplos.map((e, j) => (
                          <li key={`${j}-${e}`}>«{e}»</li>
                        ))}
                        {restantes > 0 && (
                          <li className="pulso-codif-omitidas-mas">y {restantes} más</li>
                        )}
                      </ul>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
