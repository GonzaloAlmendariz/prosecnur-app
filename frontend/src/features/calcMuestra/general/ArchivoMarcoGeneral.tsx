import { useReducer, useRef } from "react";
import { FileSpreadsheet, Loader2, RefreshCw, Upload } from "lucide-react";

import { apiCalcMuestraMarcoInspeccionarArchivo, type CalcMuestraComponente } from "../../../api/calcMuestra";
import { apiCalcMuestraGeneralDeclararMarco } from "../../../api/calcMuestraGeneral";
import { apiUpload } from "../../../api/estudio";
import { EmptyState } from "../../../components/States";
import { useCalcMuestraStore } from "../store";
import { ErrorDelMotor } from "./ErrorDelMotor";
import { ResumenMarcoDeclarado } from "./ResumenMarcoDeclarado";
import {
  ARCHIVO_MARCO_INICIAL,
  archivoDesdeInspeccion,
  archivoMarcoReducer,
  columnasDeHoja,
  errorGeneralDesde,
  motivoNoDeclarar,
  puedeDeclarar,
  reconciliarEstudio,
  type ColumnasElegidas,
} from "./modelo";
import { useMuestraGeneralStore } from "./store";
import { guardarEstudioPendiente, useMuestraGeneral } from "./useMuestraGeneral";
import "./general.css";

const ROLES: Array<{ rol: keyof ColumnasElegidas; label: string; ayuda: string; vacio: string | null }> = [
  { rol: "id", label: "Id de la unidad", ayuda: "Clave única de cada fila. Ordena el marco antes de seleccionar.", vacio: null },
  { rol: "estrato", label: "Estrato", ayuda: "Reparte la muestra entre grupos y selecciona dentro de cada uno.", vacio: "Sin estrato" },
  { rol: "tamano", label: "Tamaño", ayuda: "Medida de tamaño para seleccionar con probabilidad proporcional (PPS).", vacio: "Sin tamaño" },
];

/** Id del botón de subida: el vacío de la Selección de un actor lleva el foco aquí. */
export const ID_SUBIR_ARCHIVO_MARCO = "cmg-archivo-subir";

/**
 * Muestra general › Marco › «Archivo del marco» (ADR 0090). Sube el padrón,
 * elige hoja y columnas y lo declara: el motor escribe N y N_h en el
 * componente, que es lo que Resultados y Selección leen después.
 */
export function ArchivoMarcoGeneral({ componente }: { componente: CalcMuestraComponente | null }) {
  const componenteId = componente?.id ?? null;
  const { cargado, marco } = useMuestraGeneral(componenteId);
  const setMarco = useMuestraGeneralStore((s) => s.setMarco);
  const [estado, dispatch] = useReducer(archivoMarcoReducer, ARCHIVO_MARCO_INICIAL);
  const inputRef = useRef<HTMLInputElement>(null);

  const formularioAbierto = !marco || estado.editando;
  const columnas = columnasDeHoja(estado.archivo, estado.hoja);
  const ocupado = estado.fase === "subiendo" || estado.fase === "declarando";
  const motivoDeclarar = motivoNoDeclarar(estado);

  async function subir(file: File) {
    dispatch({ tipo: "subiendo" });
    try {
      const subido = await apiUpload(file, "data");
      const res = await apiCalcMuestraMarcoInspeccionarArchivo(subido.file_id);
      const { archivo, hoja } = archivoDesdeInspeccion(subido.file_id, subido.original_name || file.name, res.inspection);
      dispatch({ tipo: "subido", archivo, hoja });
    } catch (e) {
      dispatch({ tipo: "fallo", error: errorGeneralDesde(e) });
    }
  }

  async function declarar() {
    if (!componenteId || !estado.archivo || !puedeDeclarar(estado)) return;
    dispatch({ tipo: "declarando" });
    try {
      await guardarEstudioPendiente();
      const enviado = useCalcMuestraStore.getState().estudio;
      const res = await apiCalcMuestraGeneralDeclararMarco({
        componente_id: componenteId,
        file_id: estado.archivo.file_id,
        hoja: estado.archivo.esLibro ? estado.hoja : undefined,
        columnas: estado.columnas,
      });
      const store = useCalcMuestraStore.getState();
      const reconciliado = reconciliarEstudio({
        componenteId,
        actual: store.estudio,
        enviado,
        estudioRespuesta: res.estudio,
        componenteRespuesta: res.componente,
      });
      if (reconciliado?.limpio) store.hydrate(reconciliado.estudio);
      else if (reconciliado) store.replaceEstudio(reconciliado.estudio);
      setMarco(componenteId, res.marco);
      dispatch({ tipo: "declarado" });
    } catch (e) {
      dispatch({ tipo: "fallo", error: errorGeneralDesde(e) });
    }
  }

  return (
    <section
      className="cmv2-panel cmg-archivo"
      aria-labelledby="cmg-archivo-titulo"
      data-audit-ready={cargado ? "true" : "false"}
    >
      <div className="cmv2-panel-head">
        <div>
          <span className="cmv2-eyebrow">Archivo del marco</span>
          <h3 className="cmg-panel-titulo" id="cmg-archivo-titulo">{marco ? "Marco declarado" : "Declara el listado de unidades"}</h3>
        </div>
        {marco && !estado.editando && (
          <div className="cmv2-panel-head-actions">
            <button type="button" className="cmv2-ghost" onClick={() => dispatch({ tipo: "editar" })}>
              <RefreshCw size={14} aria-hidden="true" /> Cambiar archivo o columnas
            </button>
          </div>
        )}
      </div>

      {!componente ? (
        <EmptyState
          variant="inline"
          icon={<FileSpreadsheet size={18} aria-hidden="true" />}
          title="Aún no hay componente"
          hint="Elige la forma del marco para crearlo; luego declara su archivo."
        />
      ) : (
        <>
          {marco && <ResumenMarcoDeclarado marco={marco} />}

          {formularioAbierto && (
            <div className="cmg-archivo-form">
              <div className="cmg-archivo-fila">
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  hidden
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={(e) => {
                    const file = e.currentTarget.files?.[0];
                    e.currentTarget.value = "";
                    if (file) void subir(file);
                  }}
                />
                <button
                  id={ID_SUBIR_ARCHIVO_MARCO}
                  type="button"
                  className="cmv2-ghost"
                  onClick={() => inputRef.current?.click()}
                  disabled={ocupado}
                >
                  {estado.fase === "subiendo"
                    ? <Loader2 size={14} className="pulso-spin" aria-hidden="true" />
                    : <Upload size={14} aria-hidden="true" />}
                  {estado.archivo ? "Subir otro archivo" : "Subir archivo"}
                </button>
                <span className="cmg-archivo-nombre" aria-live="polite">
                  {estado.fase === "subiendo"
                    ? "Leyendo el archivo…"
                    : estado.archivo?.nombre ?? "Excel o CSV, una fila por unidad."}
                </span>
              </div>

              {estado.archivo && estado.archivo.esLibro && estado.archivo.hojas.length > 1 && (
                <div className="cmg-campo cmg-campo--hoja">
                  <label htmlFor="cmg-hoja">Hoja</label>
                  <select
                    id="cmg-hoja"
                    value={estado.hoja}
                    onChange={(e) => dispatch({ tipo: "hoja", hoja: e.currentTarget.value })}
                    disabled={ocupado}
                  >
                    {estado.archivo.hojas.map((h) => (
                      <option key={h.nombre} value={h.nombre}>{h.nombre}</option>
                    ))}
                  </select>
                </div>
              )}

              {estado.archivo && (
                <div
                  className="cmg-columnas"
                  data-qa-geometry-group="calc-muestra/general-columnas-marco"
                  data-qa-geometry-contract="equal"
                >
                  {ROLES.map(({ rol, label, ayuda, vacio }) => (
                    <div key={rol} className="cmg-campo" data-qa-geometry-member>
                      <label htmlFor={`cmg-columna-${rol}`}>
                        {label}
                        {vacio === null && <em className="cmg-requerido"> · obligatorio</em>}
                      </label>
                      <select
                        id={`cmg-columna-${rol}`}
                        value={estado.columnas[rol]}
                        onChange={(e) => dispatch({ tipo: "columna", rol, valor: e.currentTarget.value })}
                        disabled={ocupado}
                        aria-describedby={`cmg-ayuda-${rol}`}
                        aria-required={vacio === null}
                      >
                        <option value="">{vacio ?? "Elige una columna"}</option>
                        {columnas.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <small id={`cmg-ayuda-${rol}`}>
                        {ayuda}
                        {estado.propuestas[rol] !== "" && estado.columnas[rol] === estado.propuestas[rol] && " Propuesta por el nombre de la columna."}
                      </small>
                    </div>
                  ))}
                </div>
              )}

              {estado.error && <ErrorDelMotor error={estado.error} label="No se pudo declarar el marco" />}

              <div className="cmv2-inline-actions">
                <button
                  type="button"
                  className="cmv2-primary"
                  onClick={() => void declarar()}
                  disabled={!puedeDeclarar(estado) || ocupado}
                  aria-describedby={motivoDeclarar ? "cmg-declarar-porque" : undefined}
                >
                  {estado.fase === "declarando" && <Loader2 size={14} className="pulso-spin" aria-hidden="true" />}
                  Declarar marco
                </button>
                {marco && (
                  <button type="button" className="cmv2-ghost" onClick={() => dispatch({ tipo: "cancelar" })} disabled={ocupado}>
                    Cancelar
                  </button>
                )}
                {motivoDeclarar && <small id="cmg-declarar-porque" className="cmg-motivo">{motivoDeclarar}</small>}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
