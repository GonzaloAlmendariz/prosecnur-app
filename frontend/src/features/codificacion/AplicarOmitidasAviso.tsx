import { useEffect, useRef } from "react";
import { useInRouterContext } from "react-router-dom";
import { BotonCodificar } from "./SinRecodificarAviso";
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
  /**
   * Diagnósticos que fallaron en el backend. Sin esto, una lista vacía por
   * error se leería como «no se omitió nada» (verde por ausencia).
   */
  incompletos?: string[];
  /**
   * El aviso viene de una aplicación recién hecha: llevarlo a la vista y mover
   * el foco a su título (C4: con omitidas quedaba bajo el pliegue). Lo pide
   * el store dos veces como máximo: al llegar la respuesta y en el remontaje
   * que sigue al fin del job. Cualquier otro montaje llega en `false`.
   */
  enfocar?: boolean;
  /** Se llama una vez llevado a la vista, para consumir el pedido. */
  onEnfocado?: () => void;
};

/** Ancla del aviso, para que «Ver avisos» lo encuentre desde arriba. */
export const ID_AVISO_APLICAR = "codificacion-aplicar-omitidas";

type Desplazable = { scrollIntoView: (opciones: ScrollIntoViewOptions) => void };
type Enfocable = { focus: (opciones?: FocusOptions) => void };

/**
 * Lleva el aviso a la vista (lo mínimo, `nearest`) y pone el foco en su
 * título sin un segundo salto. Pura sobre sus dos objetivos: testeable sin DOM.
 */
export function revelarAviso(seccion: Desplazable | null, titulo: Enfocable | null): boolean {
  if (!seccion) return false;
  seccion.scrollIntoView({ block: "nearest" });
  // El scroll ya lo hizo scrollIntoView; el foco no debe volver a saltar.
  titulo?.focus({ preventScroll: true });
  return true;
}

/** Busca el aviso montado y lo revela; para el enlace «Ver avisos». */
export function irAlAviso(doc: Pick<Document, "getElementById">): boolean {
  const seccion = doc.getElementById(ID_AVISO_APLICAR);
  const titulo = seccion?.querySelector<HTMLElement>(".pulso-codif-omitidas-titulo[tabindex='-1']") ?? null;
  return revelarAviso(seccion, titulo);
}

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

export function AplicarOmitidasAviso({ omitidas, textosSinCodigo, incompletos = [], enfocar = false, onEnfocado }: Props) {
  const seccionRef = useRef<HTMLElement>(null);
  const tituloRef = useRef<HTMLElement>(null);
  const hayAlgo = omitidas.length > 0 || textosSinCodigo.length > 0 || incompletos.length > 0;
  const conRouter = useInRouterContext();

  useEffect(() => {
    if (!enfocar || !hayAlgo) return;
    revelarAviso(seccionRef.current, tituloRef.current);
    onEnfocado?.();
  }, [enfocar, hayAlgo, onEnfocado]);

  if (!hayAlgo) return null;

  return (
    <section
      ref={seccionRef}
      id={ID_AVISO_APLICAR}
      className="pulso-codif-omitidas"
      aria-label="Lo que la adaptación no aplicó"
      data-testid="codificacion-aplicar-omitidas"
    >
      {incompletos.length > 0 && (
        <div
          className="pulso-codif-omitidas-bloque pulso-codif-omitidas-bloque--fuerte"
          role="alert"
          data-testid="codificacion-aplicar-incompleto"
        >
          <div className="pulso-codif-omitidas-cabecera">
            <AlertTriangle size={16} aria-hidden="true" className="pulso-codif-omitidas-icono" />
            <strong className="pulso-codif-omitidas-incompleto">
              No se pudo revisar {incompletos.join(" ni ")}
            </strong>
          </div>
          <p className="pulso-codif-omitidas-incompleto-nota">
            Puede haber preguntas que no se aplicaron o textos sin código que no aparecen aquí.
          </p>
        </div>
      )}
      {omitidas.length > 0 && (
        <div className="pulso-codif-omitidas-bloque pulso-codif-omitidas-bloque--fuerte" role="alert">
          <div className="pulso-codif-omitidas-cabecera">
            <AlertTriangle size={16} aria-hidden="true" className="pulso-codif-omitidas-icono" />
            <div>
              <strong ref={tituloRef} tabIndex={-1} className="pulso-codif-omitidas-titulo">
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
              <strong
                ref={omitidas.length === 0 ? tituloRef : undefined}
                tabIndex={omitidas.length === 0 ? -1 : undefined}
                className="pulso-codif-omitidas-titulo"
              >
                {textosSinCodigo.length === 1
                  ? "1 pregunta tiene textos sin código"
                  : `${textosSinCodigo.length} preguntas tienen textos sin código`}
              </strong>
              <p>No están en ningún grupo de su pregunta. Agrégalos a un grupo y vuelve a adaptar.</p>
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
                <li key={`${t.pregunta}-${t.columna}-${i}`} className="pulso-codif-omitidas-fila pulso-codif-omitidas-fila--accion">
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
                  {conRouter ? <BotonCodificar pregunta={t.pregunta} texto={`Codificar ${t.pregunta}`} /> : null}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
