// El Excel con el que campo asigna y reasigna (checklist-formatos-campo C1/C3): el
// equipo de campo no usa la app, así que se le da un Excel con el desplegable de la
// lista de Monitoreo y luego se sube lleno. Leerlo no guarda nada: se muestra qué se
// leyó y qué filas no, y «Aplicar» reemplaza la asignación guardada.

import { useRef, useState } from "react";

import { downloadUrl } from "../../../api/core";
import { descargarArchivo } from "../../../lib/descargas";
import {
  apiMaterialTerritorialExcelAsignacion,
  apiMaterialTerritorialImportarAsignacion,
  type EstadoDeclarado,
  type ImportacionAsignacion,
} from "../../../api/materialTerritorial";
import { PulsoButton } from "../../../components/PulsoButton";
import { AlertTriangle } from "../../../vendor/lucide-react";

const MAX_PROBLEMAS = 8;

type Props = {
  campaignId: string | null;
  deshabilitado: boolean;
  aplicar: (propuesta: { id_manzana: string; codigo: string }[], estados?: EstadoDeclarado[]) => Promise<boolean>;
};

export function ExcelDeAsignacion({ campaignId, deshabilitado, aplicar }: Props) {
  const entrada = useRef<HTMLInputElement>(null);
  const [ocupado, setOcupado] = useState<"" | "generar" | "leer" | "aplicar">("");
  const [lectura, setLectura] = useState<ImportacionAsignacion | null>(null);
  const [error, setError] = useState("");
  if (!campaignId) return null;

  const generar = () => {
    setOcupado("generar");
    setError("");
    apiMaterialTerritorialExcelAsignacion(campaignId)
      .then((r) => descargarArchivo(downloadUrl(r.file_id)))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "No se pudo generar el Excel"))
      .finally(() => setOcupado(""));
  };
  const leer = (archivo: File) => {
    setOcupado("leer");
    setError("");
    setLectura(null);
    apiMaterialTerritorialImportarAsignacion(campaignId, archivo)
      .then(setLectura)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "No se pudo leer el Excel"))
      .finally(() => setOcupado(""));
  };

  return (
    <div className="rec-asig-excel">
      <div className="rec-asig-excel-acciones">
        <PulsoButton size="sm" variant="secondary" disabled={deshabilitado || ocupado !== ""} onClick={generar}>
          {ocupado === "generar" ? "Generando…" : "Excel para campo"}
        </PulsoButton>
        <PulsoButton size="sm" variant="secondary" disabled={deshabilitado || ocupado !== ""} onClick={() => entrada.current?.click()}>
          {ocupado === "leer" ? "Leyendo…" : "Subir Excel llenado"}
        </PulsoButton>
        <input
          ref={entrada}
          type="file"
          accept=".xlsx"
          hidden
          aria-label="Excel de asignación llenado por campo"
          onChange={(e) => {
            const archivo = e.target.files?.[0];
            e.target.value = "";
            if (archivo) leer(archivo);
          }}
        />
      </div>
      {error ? <p className="rec-terr-nota" role="alert">{error}</p> : null}
      {lectura ? (
        <section className="rec-asig-lectura" aria-label="Lo que se leyó del Excel">
          <p>
            <strong>
              {lectura.titulares_con_encuestador} de {lectura.titulares} UMP titulares con encuestador
            </strong>
            {lectura.filas_sin_encuestador ? ` · ${lectura.filas_sin_encuestador} filas sin encuestador` : ""}
            {lectura.estados_declarados ? ` · ${lectura.estados_declarados} UMP con estado declarado` : ""}
            {lectura.conteos_declarados ? ` · ${lectura.conteos_declarados} con conteos de consolidado` : ""}
          </p>
          <ul className="rec-asig-lectura-equipo">
            {lectura.por_encuestador
              .filter((p) => p.umps > 0)
              .map((p) => (
                <li key={p.codigo}>
                  {p.codigo}
                  {p.nombre ? ` · ${p.nombre}` : ""} <b>{p.umps}</b>
                </li>
              ))}
          </ul>
          {lectura.otra_muestra ? (
            <p className="rec-asig-aviso" role="status">
              <AlertTriangle size={14} aria-hidden /> Este Excel se generó con otra muestra enviada: sólo se leen las UMP que siguen en la actual.
            </p>
          ) : null}
          {lectura.problemas.length ? (
            <div className="rec-asig-aviso" role="status">
              <AlertTriangle size={14} aria-hidden />
              <div>
                <p>{lectura.problemas.length === 1 ? "1 fila no se pudo leer:" : `${lectura.problemas.length} filas no se pudieron leer:`}</p>
                <ul>
                  {lectura.problemas.slice(0, MAX_PROBLEMAS).map((p) => (
                    <li key={`${p.fila}-${p.id_manzana}`}>
                      Fila {p.fila}
                      {p.valor ? ` («${p.valor}»)` : ""}: {p.motivo}
                    </li>
                  ))}
                  {lectura.problemas.length > MAX_PROBLEMAS ? <li>y {lectura.problemas.length - MAX_PROBLEMAS} más</li> : null}
                </ul>
              </div>
            </div>
          ) : null}
          {lectura.pierden_encuestador ? (
            <p className="rec-asig-aviso" role="status">
              <AlertTriangle size={14} aria-hidden />{" "}
              {lectura.pierden_encuestador === 1 ? "1 UMP que hoy tiene encuestador quedaría sin él" : `${lectura.pierden_encuestador} UMP que hoy tienen encuestador quedarían sin él`}: en el Excel su fila está vacía o no se pudo leer.
            </p>
          ) : null}
          {!lectura.propuesta.length ? (
            <p className="rec-asig-aviso" role="status">
              <AlertTriangle size={14} aria-hidden /> El Excel no trae ningún encuestador reconocido; no hay nada que aplicar.
            </p>
          ) : null}
          <p className="rec-terr-nota">{lectura.nota} Aplicar reemplaza la asignación guardada.</p>
          <div className="rec-asig-excel-acciones">
            <PulsoButton
              size="sm"
              variant="primary"
              disabled={ocupado !== "" || deshabilitado || !lectura.propuesta.length}
              onClick={() => {
                setOcupado("aplicar");
                void aplicar(lectura.propuesta, lectura.estados).then((ok) => {
                  setOcupado("");
                  if (ok) setLectura(null);
                });
              }}
            >
              {ocupado === "aplicar" ? "Guardando…" : "Aplicar y guardar"}
            </PulsoButton>
            <PulsoButton size="sm" variant="ghost" disabled={ocupado !== ""} onClick={() => setLectura(null)}>
              Descartar
            </PulsoButton>
          </div>
        </section>
      ) : null}
    </div>
  );
}
