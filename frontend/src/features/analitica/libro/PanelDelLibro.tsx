// El panel "Libro de códigos" (prototipo, Analítica › Entrega): el formato y
// "Generar" en su cabecera; en el cuerpo, las variables que entran al libro por
// sección con su pregunta, su tipo, sus códigos y con cuánto dato llegaron; al
// pie, "Resaltar recodificadas". Las variables salen de la lectura de Datos con
// las etiquetas confirmadas: el motor no publica la vista del archivo.

import type { DataReviewVariable } from "../../../api/analitica";
import { CargaDeBloque } from "../../../components/CargaDeBloque";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { GlidingRadioGroup } from "../../../components/GlidingRadioGroup";
import { FichaPregunta } from "../../../components/procesamiento/FichaPregunta";
import { PanelDeMesa } from "../../../components/procesamiento/PanelDeMesa";
import { PulsoButton } from "../../../components/PulsoButton";
import { formatoConteo } from "../../../lib/formatoNumero";
import { textoPlano } from "../../../lib/textoPlano";
import { BookOpen, Play } from "../../../vendor/lucide-react";
import { InterruptorOpcion } from "../InterruptorOpcion";
import { CodigoConCortes } from "../datos/CodigoConCortes";
import { tipoDeVariable } from "../datos/modeloDeVariables";
import { codigosEnTexto, resumenDelLibro, type SeccionDelLibro } from "./modeloDelLibro";

export type FormatoDelLibro = "xlsx" | "pdf";

const FORMATOS: readonly { valor: FormatoDelLibro; rotulo: string }[] = [
  { valor: "xlsx", rotulo: "Excel" },
  { valor: "pdf", rotulo: "PDF" },
];

export function PanelDelLibro({
  secciones, etiquetaDe, etiquetaDeOpcion, baseComun, cargando, error, formato, generando, colorRecods,
  onFormato, onGenerar, onColorRecods,
}: {
  secciones: SeccionDelLibro[];
  etiquetaDe: (variable: DataReviewVariable) => string;
  etiquetaDeOpcion: (variable: DataReviewVariable, code: string) => string;
  baseComun: number | null;
  cargando: boolean;
  error: string;
  formato: FormatoDelLibro;
  generando: boolean;
  colorRecods: boolean;
  onFormato: (formato: FormatoDelLibro) => void;
  onGenerar: () => void;
  onColorRecods: () => void;
}) {
  return (
    <PanelDeMesa
      zona="libro"
      titulo="Libro de códigos"
      ocupado={cargando && secciones.length > 0}
      acciones={(
        <>
          <GlidingRadioGroup
            value={formato}
            options={FORMATOS}
            getOptionValue={(o) => o.valor}
            onValueChange={onFormato}
            className="libro-formato"
            aria-label="Formato del libro"
          >
            {(o) => <span>{o.rotulo}</span>}
          </GlidingRadioGroup>
          <PulsoButton variant="secondary" onClick={onGenerar} disabled={generando}>
            <Play size={14} aria-hidden="true" />
            Generar
          </PulsoButton>
        </>
      )}
      pie={(
        <InterruptorOpcion
          variante="linea"
          className="libro-recods"
          checked={colorRecods}
          onToggle={onColorRecods}
          titulo="Resaltar recodificadas"
          descripcion="Con color en el instrumento, la base de datos y el libro"
        />
      )}
    >
      <div className="libro-hoja">
        <h4>Variables del libro</h4>
        {cargando && secciones.length === 0 ? null : <p>{resumenDelLibro(secciones)}, con las etiquetas confirmadas en Variables.</p>}
        {cargando && secciones.length === 0 ? <CargaDeBloque label="Leyendo las variables de la base" /> : null}
        {error ? <p className="libro-error" role="alert">No se pudieron leer las variables de la base: {error}</p> : null}
        {!cargando && !error && secciones.length === 0 ? (
          <EstadoVacio
            icono={<BookOpen size={16} />}
            titulo="Ninguna variable entra al libro"
            descripcion="Inclúyelas en Variables: el libro lleva las variables incluidas."
          />
        ) : null}
        {secciones.length > 0 ? (
          <div className="libro-tabla" role="table" aria-label="Variables del libro">
            <div role="rowgroup" className="libro-tabla-cabecera">
              <div role="row" className="libro-fila libro-fila--cabecera">
                <span role="columnheader">Variable</span>
                <span role="columnheader">Pregunta</span>
                <span role="columnheader">Tipo</span>
                <span role="columnheader">Códigos</span>
                <span role="columnheader" className="libro-n">Con dato{baseComun !== null ? <> <small>de {formatoConteo(baseComun)}</small></> : null}</span>
              </div>
            </div>
            {/* C1: cada sección mide lo que sus variables. */}
            <div className="libro-secciones" data-qa-geometry-group="analitica/libro-secciones" data-qa-geometry-contract="intrinsic">
              {secciones.map((s) => (
                <div
                  key={s.id}
                  role="rowgroup"
                  className="libro-grupo"
                  aria-label={textoPlano(s.nombre)}
                  data-qa-geometry-group="analitica/libro-filas"
                  data-qa-geometry-contract="intrinsic"
                >
                  <div role="row" className="libro-seccion"><span role="rowheader" aria-colspan={5}>{textoPlano(s.nombre)}</span></div>
                  {s.variables.map((v) => {
                    const tipo = tipoDeVariable(v);
                    const casos = Math.max(0, v.n_non_missing ?? 0) + Math.max(0, v.n_missing ?? 0);
                    return (
                      <div key={v.name} role="row" className="libro-fila">
                        <span role="cell"><code className="libro-codigo"><CodigoConCortes nombre={v.name} /></code></span>
                        <span role="cell" className="libro-pregunta">{etiquetaDe(v)}</span>
                        <span role="cell">{tipo.tono ? <FichaPregunta tipo={tipo.tono} etiqueta={tipo.nombre} /> : <span className="libro-tipo">{tipo.nombre}</span>}</span>
                        <span role="cell" className="libro-codigos">{codigosEnTexto(v.opciones, (code) => etiquetaDeOpcion(v, code))}</span>
                        <span role="cell" className="libro-n">
                          {casos === 0 ? "" : formatoConteo(v.n_non_missing)}
                          {casos > 0 && baseComun === null ? <small> de {formatoConteo(casos)}</small> : null}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </PanelDeMesa>
  );
}
