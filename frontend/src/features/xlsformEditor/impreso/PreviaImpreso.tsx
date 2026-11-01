// «Así queda»: la previa real del cuestionario impreso, embebida. La genera «Previsualizar» con el mismo job que
// «Exportar PDF»; es la última versión generada, no una vista en vivo, y lo dice cuando las opciones o el formulario
// cambiaron después.

import { AlertTriangle, Check, FileText, Loader2, RotateCcw } from "../../../vendor/lucide-react";
import { useRef } from "react";
import { GlidingRadioGroup } from "../../../components/GlidingRadioGroup";
import { PulsoButton } from "../../../components/PulsoButton";
import { PulsoSelect } from "../../../components/PulsoSelect";
import type { EstadoPrevia, LecturaPrevia } from "./storePrevia";
import type { PdfDialogState } from "../shell/pdfExportPreference";
import { MaquetaPagina } from "./MaquetaPagina";
import type { PrimeraPagina } from "./primeraPagina";

type Paso = { clave: string; rotulo: string; estado: "hecho" | "en-curso" | "pendiente" };

const LECTURAS: ReadonlyArray<{ id: LecturaPrevia; rotulo: string }> = [
  { id: "pdf", rotulo: "PDF" },
  { id: "word", rotulo: "Páginas del Word" },
];

function pasosDe(previa: Pick<EstadoPrevia, "fase" | "detalle" | "lectura">): Paso[] {
  const generando = previa.fase === "generando";
  if (previa.lectura === "word") {
    return [{ clave: "word", rotulo: generando && previa.detalle ? `Armando las páginas del Word · ${previa.detalle}` : "Armando las páginas del Word", estado: "en-curso" }];
  }
  return [
    { clave: "pdf", rotulo: generando && previa.detalle ? `Generando el PDF · ${previa.detalle}` : "Generando el PDF", estado: generando ? "en-curso" : "hecho" },
    { clave: "leer", rotulo: "Leyendo el archivo", estado: previa.fase === "descargando" ? "en-curso" : "pendiente" },
  ];
}

export function PreviaImpreso({ previa, vieja, motivo, onGenerar, onLectura, estado, hayMatrices, pagina, bloqueElegido = null, onElegirBloque }: {
  previa: EstadoPrevia;
  /** Variable de la pregunta abierta en «Papel por pregunta»: su bloque queda marcado (L36 · DOC.3). */
  bloqueElegido?: string | null;
  /** Elegir una pregunta sobre la página abre sus ajustes de papel. */
  onElegirBloque?: (nombre: string) => void;
  /** Cambia entre el PDF embebido y las páginas reales del Word (L36 · DOC.2). */
  onLectura: (lectura: LecturaPrevia) => void;
  /** Opciones actuales: dibujan el esquema de página mientras no hay PDF. */
  estado: PdfDialogState;
  hayMatrices: boolean;
  /** El título y las primeras preguntas reales (L36): la página se dibuja con ellas y no con barras. */
  pagina: PrimeraPagina | null;
  vieja: boolean;
  /** Si no se puede previsualizar (p. ej. una exportación en curso), por qué. */
  motivo: string | null;
  onGenerar: () => void;
}) {
  const ocupada = previa.fase === "generando" || previa.fase === "descargando";
  // Lo generado con la otra lectura no se muestra: para esta lectura todavía no hay previa.
  const fase = previa.fase === "lista" && previa.lecturaGenerada !== previa.lectura ? "inactiva" : previa.fase;
  const paginasRef = useRef<HTMLDivElement | null>(null);
  // Sólo se desplaza la columna de páginas (scrollIntoView movería también la pestaña) y después de que el menú se
  // cierra: Radix devuelve el foco al disparador al cerrar y eso cancelaba un desplazamiento lanzado antes.
  const irAPagina = (n: number) => {
    window.setTimeout(() => {
      const columna = paginasRef.current;
      const hoja = columna?.querySelector<HTMLElement>(`[data-pagina="${n}"]`);
      if (!columna || !hoja) return;
      const destino = columna.scrollTop + hoja.getBoundingClientRect().top - columna.getBoundingClientRect().top - 8;
      columna.scrollTo({ top: Math.max(0, destino), behavior: "smooth" });
    }, 0);
  };
  const ubicadas = previa.word?.mapa.filter((m) => m.pagina !== null) ?? [];
  return (
    <aside className="pulso-xf-imp-previa" aria-label="Así queda" data-qa-surface="xlsform/impreso-previa">
      <div className="pulso-xf-imp-previa-cabeza">
        <span className="pulso-xf-imp-eyebrow">Así queda</span>
        <GlidingRadioGroup
          value={previa.lectura}
          options={LECTURAS}
          getOptionValue={(o) => o.id}
          onValueChange={onLectura}
          className="pulso-segmented pulso-xf-imp-lectura"
          aria-label="Cómo leer la previa"
          getOptionProps={() => ({ disabled: ocupada })}
        >
          {(o) => o.rotulo}
        </GlidingRadioGroup>
        {fase === "lista" && (
          <PulsoButton variant="ghost" size="sm" onClick={onGenerar} disabled={Boolean(motivo)} title={motivo ?? undefined}>
            <RotateCcw size={13} aria-hidden="true" /> Volver a generar
          </PulsoButton>
        )}
      </div>
      <div className="pulso-xf-imp-previa-marco" data-qa-geometry-capacity="owned">
        {fase === "inactiva" && (
          <div className="pulso-xf-imp-previa-esquema">
            <MaquetaPagina estado={estado} hayMatrices={hayMatrices} pagina={pagina} />
            <div className="pulso-xf-imp-previa-esquema-pie">
              <p>{pagina?.preguntas.length ? "Primera página, en baja resolución." : "Esquema de la primera página."}</p>
              <PulsoButton variant="secondary" size="sm" onClick={onGenerar} disabled={Boolean(motivo)} title={motivo ?? (previa.lectura === "word" ? "Arma el Word con estas opciones y muestra sus páginas" : "Genera el PDF con estas opciones")}>
                <FileText size={13} aria-hidden="true" /> Previsualizar
              </PulsoButton>
            </div>
          </div>
        )}
        {ocupada && (
          <ol className="pulso-xf-imp-previa-pasos" role="status" aria-live="polite">
            {pasosDe(previa).map((p) => (
              <li key={p.clave} className={`is-${p.estado}`}>
                <span className="pulso-xf-imp-previa-paso-icono" aria-hidden="true">
                  {p.estado === "hecho" ? <Check size={13} /> : p.estado === "en-curso" ? <Loader2 size={13} className="pulso-xf-imp-gira" /> : null}
                </span>
                {p.rotulo}
              </li>
            ))}
          </ol>
        )}
        {fase === "error" && (
          <div className="pulso-xf-imp-previa-vacia is-error" role="alert">
            <span className="pulso-xf-imp-previa-icono" aria-hidden="true"><AlertTriangle size={20} /></span>
            <strong>No se pudo generar la previa</strong>
            <p>{previa.error}</p>
            <PulsoButton variant="secondary" size="sm" onClick={onGenerar} disabled={Boolean(motivo)}>Reintentar</PulsoButton>
          </div>
        )}
        {fase === "lista" && previa.lectura === "word" && previa.word && (
          <>
            {vieja && (
              <p className="pulso-xf-imp-previa-vieja" role="status">
                <AlertTriangle size={14} aria-hidden="true" />
                Cambiaste opciones o el formulario después de estas páginas: vuelve a generarlas para ver lo que saldrá.
              </p>
            )}
            {ubicadas.length > 0 && (
              <div className="pulso-xf-imp-ir">
                <PulsoSelect
                  size="sm"
                  value={undefined}
                  placeholder="Ir a la pregunta…"
                  ariaLabel="Ir a la página de una pregunta"
                  options={ubicadas.map((m) => ({ value: m.numero, label: `${m.numero} · página ${m.pagina}` }))}
                  onValueChange={(numero) => {
                    const destino = ubicadas.find((m) => m.numero === numero)?.pagina;
                    if (destino) irAPagina(destino);
                  }}
                />
              </div>
            )}
            <div className="pulso-xf-imp-word-paginas" ref={paginasRef}>
              {previa.word.paginas.map((src, i) => (
                <figure key={i} className="pulso-xf-imp-word-hoja" data-pagina={i + 1}>
                  <div className="pulso-xf-imp-word-lienzo">
                    <img src={src} alt={`Página ${i + 1} de ${previa.word?.paginas.length ?? 0} del Word`} loading="lazy" />
                    {onElegirBloque && previa.word?.mapa.map((m) => (m.pagina === i + 1 && m.caja && m.nombre ? (
                      <button
                        key={m.numero}
                        type="button"
                        className="pulso-xf-imp-word-bloque"
                        style={{ left: `${m.caja.x * 100}%`, top: `${m.caja.y * 100}%`, width: `${m.caja.ancho * 100}%`, height: `${m.caja.alto * 100}%` }}
                        aria-pressed={m.nombre === bloqueElegido}
                        aria-label={`Pregunta ${m.numero}: abrir sus ajustes de papel`}
                        title={`Pregunta ${m.numero} · ${m.nombre}`}
                        onClick={() => onElegirBloque(m.nombre)}
                      />
                    ) : null))}
                  </div>
                  <figcaption>{`Página ${i + 1}`}</figcaption>
                </figure>
              ))}
            </div>
          </>
        )}
        {fase === "lista" && previa.lectura === "pdf" && previa.url && (
          <>
            {vieja && (
              <p className="pulso-xf-imp-previa-vieja" role="status">
                <AlertTriangle size={14} aria-hidden="true" />
                Cambiaste opciones o el formulario después de esta previa: vuelve a generarla para ver lo que saldrá.
              </p>
            )}
            <iframe className="pulso-xf-imp-previa-pdf" src={previa.url} title="Previa del cuestionario impreso (PDF)" />
          </>
        )}
      </div>
    </aside>
  );
}
