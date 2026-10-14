// «Entre formularios del proyecto»: qué listas de este formulario son iguales
// en los otros y con qué nombre común conviene dejarlas.
//
// Contrato de Superficie:
// - C1: `xlsform-listas-entre` y `xlsform-listas-codigos`, ambos `equal`
//   (filas de la misma variante).
// - C2: las filas de cada colección comparten alto (`grid-auto-rows: 1fr`).
// - C3: la carga y el vacío legítimo los posee `.pulso-xf-listas-vacio`.
// - C4: el scroll lo posee el cuerpo del diálogo, no esta sección.
// - C5: un formulario que no se pudo leer se declara (desconexión), no se omite.

import { useMemo, useState } from "react";
import { Check, CheckCheck, Link2, Loader2, TriangleAlert } from "../../../vendor/lucide-react";
import { PulsoButton } from "../../../components/PulsoButton";
import type { XlsformEditorWorkbook } from "../../../api/multiIntegrado";
import {
  compararListasEntreFormularios,
  describirAdvertencia,
  describirDondeSeRepite,
  describirNombresAlla,
  renombresSugeridos,
  type CoincidenciaEntreFormularios,
  type RenombreSugerido,
} from "./listasEntreFormularios";
import type { EstadoHermanos } from "./useFormulariosHermanos";

export const TEXTO_ENTRE_FORMULARIOS =
  "Si una lista es igual en otros formularios, dale el mismo nombre: así las mismas preguntas se analizan juntas entre públicos.";

export function EntreFormulariosSeccion({
  workbook,
  hermanos,
  onRenombrar,
  onRenombrarVarias,
}: {
  workbook: XlsformEditorWorkbook;
  hermanos: EstadoHermanos;
  onRenombrar: (lista: string, nombre: string) => string | null;
  onRenombrarVarias: (renombres: readonly RenombreSugerido[]) => string | null;
}) {
  const comparacion = useMemo(
    () => (hermanos.estado === "listo" ? compararListasEntreFormularios(workbook, hermanos.hermanos) : null),
    [hermanos, workbook],
  );
  const [error, setError] = useState<string | null>(null);
  if (hermanos.estado === "sin-otros") return null;

  const sugeridos = comparacion ? renombresSugeridos(comparacion) : [];
  const coincidencias = comparacion?.coincidencias ?? [];
  const advertencias = comparacion?.advertencias ?? [];

  return (
    <section className="pulso-xf-listas-seccion" aria-labelledby="xf-listas-entre" aria-busy={hermanos.estado === "cargando"}>
      <div className="pulso-xf-listas-entre-cabecera">
        <h3 id="xf-listas-entre" className="pulso-xf-listas-subtitulo">
          Entre formularios del proyecto
          {comparacion ? <span className="pulso-xf-listas-contador">{coincidencias.length}</span> : null}
        </h3>
        {sugeridos.length > 1 ? (
          <PulsoButton
            variant="secondary"
            size="sm"
            onClick={() => setError(onRenombrarVarias(sugeridos))}
          >
            <Link2 size={14} aria-hidden="true" />
            Aplicar los nombres comunes ({sugeridos.length})
          </PulsoButton>
        ) : null}
      </div>
      <p className="pulso-xf-listas-nota">{TEXTO_ENTRE_FORMULARIOS}</p>
      {error ? <p className="pulso-xf-listas-error" role="alert">{error}</p> : null}

      {hermanos.estado === "cargando" ? (
        <div className="pulso-xf-listas-vacio" data-qa-geometry-capacity="owned">
          <Loader2 size={18} aria-hidden="true" className="pulso-xf-listas-girando" />
          <p>Leyendo los otros formularios del proyecto…</p>
        </div>
      ) : null}

      {hermanos.estado === "listo" && hermanos.fallidos.length > 0 ? (
        <p className="pulso-xf-listas-error" role="alert">
          No se pudo leer {hermanos.fallidos.map((n) => `«${n}»`).join(", ")}; sus listas no entran en la comparación.
        </p>
      ) : null}

      {comparacion && coincidencias.length === 0 ? (
        <div className="pulso-xf-listas-vacio" data-qa-geometry-capacity="owned">
          <CheckCheck size={18} aria-hidden="true" />
          <p>
            <strong>Ninguna lista es idéntica a las de los otros formularios.</strong>{" "}
            {hermanos.estado === "listo" && hermanos.hermanos.length > 0
              ? `Se comparó con ${hermanos.hermanos.map((h) => h.nombre).join(", ")}.`
              : null}
          </p>
        </div>
      ) : null}

      {coincidencias.length > 0 ? (
        <ul
          className="pulso-xf-listas-entre"
          data-qa-geometry-group="xlsform-listas-entre"
          data-qa-geometry-contract="equal"
        >
          {coincidencias.map((c) => (
            <CoincidenciaFila
              key={c.lista}
              coincidencia={c}
              onRenombrar={(lista, nombre) => setError(onRenombrar(lista, nombre))}
            />
          ))}
        </ul>
      ) : null}

      {advertencias.length > 0 ? (
        <ul
          className="pulso-xf-listas-codigos"
          aria-label="Escalas con códigos distintos"
          data-qa-geometry-group="xlsform-listas-codigos"
          data-qa-geometry-contract="equal"
        >
          {advertencias.map((a) => (
            <li key={`${a.lista}::${a.formularioId}`} className="pulso-xf-listas-codigos-fila" data-qa-geometry-member="">
              <TriangleAlert size={14} aria-hidden="true" />
              <p>
                <code className="pulso-xf-listas-nombre">{a.lista}</code>{" "}
                {describirAdvertencia(a)}.{" "}
                <span className="pulso-xf-listas-codigos-nota">
                  No se cambia sola: cambiar códigos altera los datos ya recogidos.
                </span>
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function CoincidenciaFila({
  coincidencia: c,
  onRenombrar,
}: {
  coincidencia: CoincidenciaEntreFormularios;
  onRenombrar: (lista: string, nombre: string) => void;
}) {
  return (
    <li className="pulso-xf-listas-entre-fila" data-qa-geometry-member="">
      <div className="pulso-xf-listas-entre-texto">
        <code className="pulso-xf-listas-nombre">{c.lista}</code>
        <p>
          {describirDondeSeRepite(c.copias)} · {describirNombresAlla(c.copias)}
          {c.motivo ? <span className="pulso-xf-listas-entre-motivo"> {c.motivo}</span> : null}
        </p>
      </div>
      <div className="pulso-xf-listas-entre-accion">
        {c.estado === "coincide" ? (
          <span className="pulso-xf-listas-entre-ok">
            <Check size={14} aria-hidden="true" />
            Mismo nombre
          </span>
        ) : c.estado === "referencia" ? (
          <span className="pulso-xf-listas-entre-ok" title="Renómbrala en los otros formularios al abrirlos.">
            <Check size={14} aria-hidden="true" />
            Ya se llama «{c.nombreComun}» aquí
          </span>
        ) : c.estado === "renombrar" ? (
          <PulsoButton
            variant="ghost"
            size="sm"
            aria-label={`Renombrar la lista ${c.lista} como ${c.nombreComun}`}
            onClick={() => onRenombrar(c.lista, c.nombreComun)}
          >
            Renombrar como «{c.nombreComun}»
          </PulsoButton>
        ) : (
          <span className="pulso-xf-listas-entre-pendiente">Nombre común: «{c.nombreComun}»</span>
        )}
      </div>
    </li>
  );
}
