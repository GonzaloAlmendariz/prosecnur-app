// Entrega › Ficha técnica (ADR 0144; viene de la pestaña Ficha técnica). El
// prototipo solo dice "Word" y "Faltan 3 campos por completar" en la lista: el
// panel se arma con la forma del libro. Al centro, el formato del documento y
// "Generar", y los campos por grupo con la sugerencia del motor; al pie,
// "Completar sugeridos". A la derecha, las fuentes y los indicadores de los que
// se construye, y el archivo.

import { useMemo } from "react";

import {
  apiAnaliticaConfigPut,
  apiAnaliticaFichaTecnicaExport,
  type AnaliticaFichaTecnicaField,
} from "../../../api/client";
import { CargaDeBloque } from "../../../components/CargaDeBloque";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { GlidingRadioGroup } from "../../../components/GlidingRadioGroup";
import { PilaDeMesa } from "../../../components/procesamiento/MesaDePestana";
import { PanelDeMesa } from "../../../components/procesamiento/PanelDeMesa";
import { PulsoButton } from "../../../components/PulsoButton";
import { FileText, Play, RefreshCw, Wand2 } from "../../../vendor/lucide-react";
import { useSession } from "../../../lib/SessionContext";
import { type FichaTecnicaConfig, useAnaliticaStore } from "../store";
import { SeccionDeAjustes } from "../tablas/SeccionDeAjustes";
import { useReporteRun } from "../useReporteRun";
import { SeConstruyeCon } from "../libro/SeConstruyeCon";
import { ArchivosDeEntrega } from "./ArchivosDeEntrega";
import { estadoDeEntregable } from "./modeloDeEntrega";
import { valorDelCampo, type FichaLayout, type FichaTecnica } from "./useFichaTecnica";

const FORMATOS: readonly { valor: FichaLayout; rotulo: string }[] = [
  { valor: "pulso_oficial", rotulo: "Pulso" },
  { valor: "template", rotulo: "Plantilla" },
  { valor: "simple", rotulo: "Simple" },
];

export function EntregaDeLaFicha({ lectura }: { lectura: FichaTecnica }) {
  const config = useAnaliticaStore((s) => s.config);
  const ficha = useAnaliticaStore((s) => s.config.ficha_tecnica);
  const setFichaTecnica = useAnaliticaStore((s) => s.setFichaTecnica);
  const run = useReporteRun("Ficha técnica", { articulo: "la", formato: "docx" });
  const { state } = useSession();
  const { info, leyendo, error, campos, sugerenciasPendientes, releer } = lectura;

  const porGrupo = useMemo(() => {
    const grupos = new Map<string, AnaliticaFichaTecnicaField[]>();
    for (const campo of campos) {
      const grupo = campo.group || "Ficha";
      grupos.set(grupo, [...(grupos.get(grupo) ?? []), campo]);
    }
    return Array.from(grupos.entries());
  }, [campos]);

  function cambiar(campo: AnaliticaFichaTecnicaField, valor: string) {
    setFichaTecnica({ [campo.key]: valor } as Partial<FichaTecnicaConfig>);
  }

  function completarSugeridos() {
    const cambio: Record<string, string> = {};
    for (const campo of campos) {
      if (valorDelCampo(ficha, campo).trim()) continue;
      const sugerida = (campo.suggested ?? "").trim();
      if (sugerida) cambio[campo.key] = sugerida;
    }
    if (Object.keys(cambio).length) setFichaTecnica(cambio as Partial<FichaTecnicaConfig>);
  }

  async function generar() {
    await run.runSync(async () => {
      await apiAnaliticaConfigPut({ ...config, ficha_tecnica: ficha });
      return apiAnaliticaFichaTecnicaExport(ficha as Record<string, unknown>);
    });
    await releer();
  }

  const fuentes = info?.sources ?? [];
  const indicadores = info?.kpis ?? [];

  return (
    <>
      <PanelDeMesa
        zona="ficha"
        titulo="Ficha técnica"
        ocupado={leyendo && campos.length > 0}
        acciones={(
          <>
            <GlidingRadioGroup
              value={ficha.layout ?? "pulso_oficial"}
              options={FORMATOS}
              getOptionValue={(o) => o.valor}
              onValueChange={(layout) => setFichaTecnica({ layout })}
              className="analitica-segmented libro-formato"
              getOptionProps={(_, { checked }) => ({ className: checked ? "is-on" : undefined })}
              aria-label="Formato de la ficha"
            >
              {(o) => <span>{o.rotulo}</span>}
            </GlidingRadioGroup>
            <PulsoButton variant="primary" onClick={() => void generar()} disabled={run.busy || leyendo}>
              <Play size={14} aria-hidden="true" />
              Generar
            </PulsoButton>
          </>
        )}
        pie={(
          <PulsoButton variant="secondary" onClick={completarSugeridos} disabled={sugerenciasPendientes === 0}>
            <Wand2 size={14} aria-hidden="true" />
            Completar sugeridos
          </PulsoButton>
        )}
      >
        {leyendo && campos.length === 0 ? <CargaDeBloque label="Leyendo la evidencia del proyecto" /> : null}
        {error ? <p className="libro-error entrega-nota" role="alert">No se pudo leer la ficha técnica: {error}</p> : null}
        {!leyendo && !error && campos.length === 0 ? (
          <EstadoVacio icono={<FileText size={16} />} titulo="La ficha no tiene campos" descripcion="El motor no devolvió campos para este proyecto." />
        ) : null}
        {campos.length > 0 ? (
          <div className="entrega-ajustes" data-qa-geometry-group="analitica/entrega-ficha" data-qa-geometry-contract="intrinsic">
            {porGrupo.map(([grupo, delGrupo]) => (
              <SeccionDeAjustes key={grupo} titulo={grupo}>
                <div className="entrega-campos">
                  {delGrupo.map((campo) => {
                    const valor = valorDelCampo(ficha, campo);
                    const sugerida = (campo.suggested ?? "").trim();
                    return (
                      <label className="entrega-campo" key={campo.key}>
                        <span className="entrega-campo-rotulo">
                          <b>{campo.label}</b>
                          {campo.hint ? <small>{campo.hint}</small> : null}
                        </span>
                        <textarea
                          className="entrega-campo-texto"
                          rows={Math.max(2, campo.min_lines ?? 2)}
                          value={valor}
                          onChange={(e) => cambiar(campo, e.target.value)}
                        />
                        {sugerida && sugerida !== valor.trim() ? (
                          <span className="entrega-sugerencia">
                            <span>{sugerida}</span>
                            <PulsoButton variant="ghost" size="sm" onClick={() => cambiar(campo, sugerida)}>Usar</PulsoButton>
                          </span>
                        ) : null}
                      </label>
                    );
                  })}
                </div>
              </SeccionDeAjustes>
            ))}
          </div>
        ) : null}
      </PanelDeMesa>
      <PilaDeMesa grupo="analitica/entrega-lateral">
        <SeConstruyeCon
          dependencias={[
            ...fuentes.map((f) => ({ clave: `fuente-${f.key}`, titulo: f.label, detalle: f.available ? f.detail : `Sin dato: ${f.detail}` })),
            ...indicadores.map((k) => ({ clave: `kpi-${k.source}-${k.label}`, titulo: `${k.label}: ${k.value}`, detalle: k.detail ? `${k.source}, ${k.detail}` : k.source })),
          ]}
        />
        <ArchivosDeEntrega
          archivos={[{
            clave: "docx",
            formato: "docx",
            nombre: "Ficha técnica en Word",
            run,
            estado: estadoDeEntregable("ficha", state),
            pie: (
              <PulsoButton variant="ghost" size="sm" onClick={() => void releer()}>
                <RefreshCw size={12} aria-hidden="true" /> Volver a leer la evidencia
              </PulsoButton>
            ),
          }]}
        />
      </PilaDeMesa>
    </>
  );
}
