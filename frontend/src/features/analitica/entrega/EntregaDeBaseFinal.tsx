// Entrega › Base final (ADR 0144; viene de Bases e instrumentos). El prototipo
// no dibuja este panel: se arma con la forma del libro. Al centro, el formato
// (SAV, CSV o Excel, y las bases unidas cuando el estudio tiene bases
// independientes) con sus ajustes y "Generar"; con SAV, la lectura de cada
// variable para SPSS. A la derecha, de qué se construye y los archivos,
// incluidas las respuestas de la base sin el formato de análisis.

import { useEffect, useState, type ReactNode } from "react";

import {
  apiAnaliticaBasesCsv,
  apiAnaliticaBasesData,
  apiAnaliticaBasesMetadata,
  apiAnaliticaBasesSav,
  apiAnaliticaBasesXlsx,
  apiAnaliticaBasesXlsxUnificada,
  type BasesSavWriterInfo,
} from "../../../api/client";
import { GlidingRadioGroup } from "../../../components/GlidingRadioGroup";
import { PilaDeMesa } from "../../../components/procesamiento/MesaDePestana";
import { PanelDeMesa } from "../../../components/procesamiento/PanelDeMesa";
import { PulsoButton } from "../../../components/PulsoButton";
import { useSession } from "../../../lib/SessionContext";
import { formatoConteo } from "../../../lib/formatoNumero";
import { Play } from "../../../vendor/lucide-react";
import { InterruptorOpcion } from "../InterruptorOpcion";
import { MetadatosEditor } from "../MetadatosEditor";
import { useAnaliticaStore } from "../store";
import { SeccionDeAjustes } from "../tablas/SeccionDeAjustes";
import { useReporteRun } from "../useReporteRun";
import { UniversoAnalisis } from "../UniversoAnalisis";
import { SeConstruyeCon } from "../libro/SeConstruyeCon";
import { ArchivosDeEntrega } from "./ArchivosDeEntrega";
import { EleccionDeAjuste } from "./EleccionDeAjuste";

type Formato = "sav" | "csv" | "xlsx" | "unidas";
type MultiSelect = "codigos_crudos" | "etiquetas_unidas" | "dummy_01";

const ROTULO: Readonly<Record<Formato, string>> = { sav: "SAV", csv: "CSV", xlsx: "Excel", unidas: "Bases unidas" };

const VARIAS_OPCIONES = (etiquetasNoAplica?: string) => [
  { valor: "dummy_01" as const, rotulo: "Una columna por opción" },
  { valor: "etiquetas_unidas" as const, rotulo: "Unidas en una celda", noAplica: etiquetasNoAplica },
  { valor: "codigos_crudos" as const, rotulo: "Códigos originales" },
];

export function EntregaDeBaseFinal({ fuente }: { fuente: ReactNode }) {
  const bases = useAnaliticaStore((s) => s.config.bases);
  const overrides = useAnaliticaStore((s) => Object.keys(s.config.bases.overrides ?? {}).length);
  const setBasesSav = useAnaliticaStore((s) => s.setBasesSav);
  const setBasesCsv = useAnaliticaStore((s) => s.setBasesCsv);
  const setBasesXlsx = useAnaliticaStore((s) => s.setBasesXlsx);
  const { state } = useSession();
  const nBases = state?.n_bases ?? 0;
  const conUnidas = state?.estudio_processing_mode === "independent_siblings" && nBases > 1;
  const relacional = state?.estudio_processing_mode === "multibase" && nBases > 1;
  const version = state?.analitica_fuente?.startsWith("adaptados") ? "Codificada" : "Cargada";

  const [formato, setFormato] = useState<Formato>("sav");
  const formatos: Formato[] = conUnidas ? ["sav", "csv", "xlsx", "unidas"] : ["sav", "csv", "xlsx"];

  const runSav = useReporteRun("Base en SAV", { articulo: "la", formato: bases.sav.incluir_sps ? "zip" : "sav" });
  const runCsv = useReporteRun("Base en CSV", { articulo: "la", formato: "csv" });
  const runXlsx = useReporteRun("Base en Excel", { articulo: "la", formato: "xlsx" });
  const runUnidas = useReporteRun("Bases unidas en Excel", { articulo: "las", formato: "xlsx", porBase: false });
  const runTrazable = useReporteRun("Bases unidas con trazabilidad", { articulo: "las", formato: "xlsx", porBase: false });
  const runRespuestas = useReporteRun("Respuestas de la base", { articulo: "las", formato: "xlsx" });

  const [writer, setWriter] = useState<BasesSavWriterInfo | null>(null);
  useEffect(() => {
    let vivo = true;
    apiAnaliticaBasesMetadata()
      .then((r) => { if (vivo) setWriter(r.sav_writer ?? null); })
      .catch(() => { if (vivo) setWriter(null); });
    return () => { vivo = false; };
  }, []);
  const embebido = writer?.engine === "pyreadstat" && writer.ok !== false;

  const madreSmAplica = bases.xlsx.multi_select === "dummy_01";
  const incluirMadreSm = madreSmAplica && !!bases.xlsx.incluir_madre_sm;
  const unificada = (trazable: boolean) => apiAnaliticaBasesXlsxUnificada({
    valores: bases.xlsx.valores,
    multi_select: bases.xlsx.multi_select,
    incluir_madre_sm: incluirMadreSm,
    omitir_identificadores_directos: !trazable,
    omitir_metadatos_operativos: !trazable,
  });

  function generar() {
    if (formato === "sav") void runSav.runSync(() => apiAnaliticaBasesSav({ incluir_sps: bases.sav.incluir_sps }));
    if (formato === "csv") void runCsv.runSync(() => apiAnaliticaBasesCsv(bases.csv));
    if (formato === "xlsx") {
      void runXlsx.runSync(() => apiAnaliticaBasesXlsx({
        valores: relacional ? "ambos" : bases.xlsx.valores,
        multi_select: bases.xlsx.multi_select,
        incluir_madre_sm: incluirMadreSm,
      }));
    }
    if (formato === "unidas") void runUnidas.runSync(() => unificada(false));
  }
  const runDelFormato = { sav: runSav, csv: runCsv, xlsx: runXlsx, unidas: runUnidas }[formato];
  const resumenUnidas = runTrazable.lastResult?.unified ?? runUnidas.lastResult?.unified;

  return (
    <>
      <PanelDeMesa
        zona="base-final"
        titulo="Base final"
        acciones={(
          <>
            <GlidingRadioGroup
              value={formato}
              options={formatos}
              getOptionValue={(f) => f}
              onValueChange={setFormato}
              className="libro-formato"
              aria-label="Formato de la base final"
            >
              {(f) => <span>{ROTULO[f]}</span>}
            </GlidingRadioGroup>
            <PulsoButton variant="secondary" onClick={generar} disabled={runDelFormato.busy}>
              <Play size={14} aria-hidden="true" />
              Generar
            </PulsoButton>
          </>
        )}
      >
        <div className="entrega-ajustes" data-qa-geometry-group="analitica/entrega-ajustes" data-qa-geometry-contract="intrinsic">
          {formato === "sav" ? (
            <>
              <SeccionDeAjustes titulo="Archivo para SPSS">
                <p className="entrega-nota">
                  {embebido
                    ? "Las etiquetas de variables y respuestas y el tipo de medida van dentro del archivo."
                    : writer?.message && !/fallback|\.sps/i.test(writer.message)
                      ? writer.message
                      : "El motor que guarda la lectura dentro del SAV no está disponible: incluye el respaldo para SPSS."}
                </p>
                <InterruptorOpcion
                  variante="linea"
                  checked={bases.sav.incluir_sps}
                  onToggle={() => setBasesSav({ incluir_sps: !bases.sav.incluir_sps })}
                  titulo="Incluir respaldo para SPSS"
                  descripcion="Un archivo .sps con las instrucciones de lectura, junto al SAV"
                />
              </SeccionDeAjustes>
              <SeccionDeAjustes titulo={overrides === 0 ? "Lectura de cada variable" : `Lectura de cada variable, ${formatoConteo(overrides)} ${overrides === 1 ? "cambiada" : "cambiadas"}`}>
                <div className="entrega-metadatos"><MetadatosEditor /></div>
              </SeccionDeAjustes>
            </>
          ) : null}
          {formato === "csv" ? (
            <>
              <EleccionDeAjuste
                titulo="Contenido"
                valor={bases.csv.valores}
                opciones={[{ valor: "codigos", rotulo: "Códigos" }, { valor: "etiquetas", rotulo: "Etiquetas" }]}
                onCambio={(valores) => setBasesCsv({ valores })}
              />
              <EleccionDeAjuste<MultiSelect>
                titulo="Preguntas de varias opciones"
                valor={bases.csv.multi_select}
                opciones={VARIAS_OPCIONES(bases.csv.valores !== "etiquetas" ? "Solo con etiquetas" : undefined)}
                onCambio={(multi_select) => setBasesCsv({ multi_select })}
              />
              <EleccionDeAjuste
                titulo="Separador"
                valor={bases.csv.separador}
                opciones={[{ valor: ",", rotulo: "Coma" }, { valor: ";", rotulo: "Punto y coma" }]}
                onCambio={(separador) => setBasesCsv({ separador })}
              />
            </>
          ) : null}
          {formato === "xlsx" || formato === "unidas" ? (
            <>
              {!relacional || formato === "unidas" ? (
                <EleccionDeAjuste
                  titulo="Contenido"
                  valor={bases.xlsx.valores}
                  opciones={[
                    { valor: "ambos", rotulo: "Códigos y etiquetas" },
                    { valor: "codigos", rotulo: "Códigos" },
                    { valor: "etiquetas", rotulo: "Etiquetas" },
                  ]}
                  onCambio={(valores) => setBasesXlsx({ valores })}
                />
              ) : (
                <p className="entrega-nota">Un libro con las encuestas y cada grupo repetible, enlazados por sus llaves, con códigos y etiquetas.</p>
              )}
              <EleccionDeAjuste<MultiSelect>
                titulo="Preguntas de varias opciones"
                valor={bases.xlsx.multi_select}
                opciones={VARIAS_OPCIONES(bases.xlsx.valores === "codigos" ? "Solo con etiquetas" : undefined)}
                onCambio={(multi_select) => setBasesXlsx({ multi_select })}
              />
              <SeccionDeAjustes titulo="Columnas de varias opciones" tituloVisible={false}>
                <InterruptorOpcion
                  variante="linea"
                  checked={incluirMadreSm}
                  disabled={!madreSmAplica}
                  title={madreSmAplica ? undefined : "Solo con una columna por opción"}
                  onToggle={() => setBasesXlsx({ incluir_madre_sm: !incluirMadreSm })}
                  titulo="Columna con las respuestas escritas"
                  descripcion="Junto a las columnas 0 y 1, las opciones elegidas unidas en una celda"
                />
              </SeccionDeAjustes>
            </>
          ) : null}
          {formato === "unidas" ? (
            <SeccionDeAjustes titulo={`Las ${formatoConteo(nBases)} bases en una tabla`}>
              <p className="entrega-nota">
                Las variables comunes de cada base en una sola tabla. La versión con trazabilidad agrega identificadores, fechas y datos del recopilador.
                {resumenUnidas
                  ? ` La última: ${formatoConteo(resumenUnidas.n_filas)} filas y ${formatoConteo(resumenUnidas.n_variables_comunes)} variables comunes (${formatoConteo(resumenUnidas.n_variables_no_comunes)} no comunes).`
                  : ""}
              </p>
            </SeccionDeAjustes>
          ) : null}
        </div>
      </PanelDeMesa>
      <PilaDeMesa grupo="analitica/entrega-lateral">
        <SeConstruyeCon
          dependencias={[
            { clave: "base", titulo: "Versión de la base", detalle: fuente ?? version },
            { clave: "casos", titulo: "Casos que cuentan", detalle: <UniversoAnalisis /> },
            { clave: "etiquetas", titulo: "Etiquetas y secciones", detalle: "Variables", pestana: "datos" },
            { clave: "orden", titulo: "Orden de categorías", detalle: "Categorías", pestana: "orden" },
          ]}
        />
        <ArchivosDeEntrega
          archivos={[
            { clave: "sav", formato: bases.sav.incluir_sps ? "zip" : "sav", nombre: "Base final en SAV", run: runSav },
            { clave: "csv", formato: "csv", nombre: "Base final en CSV", run: runCsv },
            { clave: "xlsx", formato: "xlsx", nombre: relacional ? "Libro relacional en Excel" : "Base final en Excel", run: runXlsx },
            ...(conUnidas ? [
              { clave: "unidas", formato: "xlsx", nombre: "Bases unidas", run: runUnidas },
              {
                clave: "trazable",
                formato: "xlsx",
                nombre: "Bases unidas con trazabilidad",
                run: runTrazable,
                onGenerar: () => void runTrazable.runSync(() => unificada(true)),
              },
            ] : []),
            {
              clave: "respuestas",
              formato: "xlsx",
              nombre: "Respuestas sin formato de análisis",
              run: runRespuestas,
              onGenerar: () => void runRespuestas.runSync(apiAnaliticaBasesData),
            },
          ]}
        />
      </PilaDeMesa>
    </>
  );
}
