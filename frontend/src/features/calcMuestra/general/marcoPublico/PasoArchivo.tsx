import { useRef, useState } from "react";
import { Check, FileUp, Grid3X3, Pencil, Table, X } from "lucide-react";

import { apiUpload } from "../../../../api/estudio";
import { apiMarcoPublicoLeer, type HojaDelMarco } from "../../../../api/calcMuestraMarcoPublico";
import { Alert } from "../../../../components/Alert";
import { PanelDeMesa } from "../../../../components/procesamiento/PanelDeMesa";
import { PulsoButton } from "../../../../components/PulsoButton";
import { PulsoTable, type PulsoTableColumna } from "../../../../components/PulsoTable";
import { NumberCell } from "../../universidad/aulas";
import { ESTADO_MARCO_INICIAL, type EstadoMarco } from "./modeloMarco";
import { FuenteConteos } from "./FuenteConteos";
import { errorLegible, Formatos, Pastilla, cifra } from "./piezas";

const TIPO_HOJA: Record<HojaDelMarco["tipo"], string> = { datos: "Datos", consulta: "Consulta", notas: "Notas", vacia: "Vacía" };

/** Paso 1: el archivo del cliente y la hoja que tiene los datos. */
export function PasoArchivo({ estado, onCambio, poblacionManual, conteos }: {
  estado: EstadoMarco;
  onCambio: (e: EstadoMarco) => void;
  /** Sin base todavía: la población se escribe a mano y se guarda como marco del actor. */
  poblacionManual?: { valor: number; onGuardar: (n: number) => void };
  /** Una tabla de conteos como marco del actor (cuántos hay por categoría o por cruce). */
  conteos?: { componenteId: string; actor: string; onGuardado: () => void };
}) {
  const [manual, setManual] = useState<number | null>(null);
  const inputConteos = useRef<HTMLInputElement>(null);
  const [tablaConteos, setTablaConteos] = useState<{ fileId: string; nombre: string; hojas: HojaDelMarco[]; sugerida: string } | null>(null);

  async function subirConteos(file: File) {
    setLeyendo(true);
    setError(null);
    try {
      const subido = await apiUpload(file, "data");
      const lectura = await apiMarcoPublicoLeer({ fileId: subido.file_id });
      // Una tabla de conteos reemplaza a la base: lo leído de otro archivo ya no aplica.
      onCambio({ ...ESTADO_MARCO_INICIAL });
      setTablaConteos({ fileId: subido.file_id, nombre: subido.original_name || file.name, hojas: lectura.hojas, sugerida: lectura.sugerida });
    } catch (e) {
      setError(errorLegible(e));
    } finally {
      setLeyendo(false);
    }
  }
  const input = useRef<HTMLInputElement>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function leer(fileId: string, nombreArchivo: string, hoja?: string) {
    setLeyendo(true);
    setError(null);
    try {
      const lectura = await apiMarcoPublicoLeer({ fileId, hoja });
      // Otro archivo u otra hoja: lo decidido sobre las columnas anteriores ya no aplica.
      onCambio({ ...ESTADO_MARCO_INICIAL, fileId, nombreArchivo, hoja: lectura.hoja, lectura });
      setTablaConteos(null);
    } catch (e) {
      setError(errorLegible(e));
    } finally {
      setLeyendo(false);
    }
  }

  async function subir(file: File) {
    setLeyendo(true);
    setError(null);
    try {
      const subido = await apiUpload(file, "data");
      await leer(subido.file_id, subido.original_name || file.name);
    } catch (e) {
      setError(errorLegible(e));
      setLeyendo(false);
    }
  }

  const lectura = estado.lectura;
  const columnas: PulsoTableColumna<HojaDelMarco>[] = lectura ? [
    { id: "hoja", encabezado: "Hoja", ancho: 200, celda: (h) => <strong>{h.nombre || estado.nombreArchivo}</strong> },
    { id: "tipo", encabezado: "Contenido", ancho: 104, celda: (h) => <Pastilla tono={h.tipo === "datos" ? "ok" : undefined}>{TIPO_HOJA[h.tipo]}</Pastilla> },
    { id: "encabezado", encabezado: "Encabezados", ancho: 108, celda: (h) => `Fila ${h.encabezadoFila}` },
    { id: "filas", encabezado: "Filas", ancho: 76, tipo: "cifra", celda: (h) => cifra(h.filas) },
    { id: "columnas", encabezado: "Columnas", ancho: 84, tipo: "cifra", celda: (h) => cifra(h.columnas) },
    {
      id: "usa", encabezado: "Se usa", ancho: 130, celda: (h) => {
        const usada = h.nombre === lectura.hoja || (!h.nombre && lectura.hojas.length === 1);
        if (usada) return <Pastilla tono="acento" icono={<Check size={12} aria-hidden="true" />}>Esta</Pastilla>;
        if (h.tipo === "datos") {
          return <PulsoButton variant="link" size="sm" onClick={() => void leer(estado.fileId, estado.nombreArchivo, h.nombre)} disabled={leyendo}>Usar esta hoja</PulsoButton>;
        }
        return <Pastilla icono={<X size={12} aria-hidden="true" />}>No</Pastilla>;
      },
    },
  ] : [];

  return (
    <PanelDeMesa
      zona="marco-archivo"
      titulo="De dónde sale el marco"
      icono={<FileUp size={15} aria-hidden="true" />}
      ocupado={leyendo}
    >
      <input
        ref={input}
        type="file"
        hidden
        accept=".xlsx,.xls,.csv,.txt"
        onChange={(e) => { const f = e.currentTarget.files?.[0]; e.currentTarget.value = ""; if (f) void subir(f); }}
      />
      {/* Las fuentes del marco son filas iguales: qué es, qué admite y su acción a la derecha. */}
      <div className="cmmp-fuente">
        <span className="cmmp-fuente-icono" aria-hidden="true"><Table size={16} /></span>
        <div className="cmmp-fuente-cuerpo">
          <b>Base con una fila por persona</b>
          <span className="cmmp-fuente-detalle">
            <Formatos formatos={["XLSX", "XLS", "CSV"]} />
            <ul className="cmmp-capac">
              <li><Check size={12} aria-hidden="true" />Cuotas por cualquier columna</li>
              <li><Check size={12} aria-hidden="true" />Listado de envío</li>
            </ul>
          </span>
        </div>
        <PulsoButton variant={lectura ? "secondary" : "primary"} size="sm" onClick={() => input.current?.click()} disabled={leyendo}>
          <FileUp size={14} aria-hidden="true" /> {leyendo ? "Leyendo el archivo" : lectura ? "Cambiar archivo" : "Elegir archivo"}
        </PulsoButton>
      </div>
      {conteos ? (
        <div className="cmmp-fuente">
          <span className="cmmp-fuente-icono" aria-hidden="true"><Grid3X3 size={16} /></span>
          <div className="cmmp-fuente-cuerpo">
            <b>Tabla de conteos</b>
            <span className="cmmp-fuente-detalle">
              <Formatos formatos={["XLSX", "CSV"]} />
              <ul className="cmmp-capac">
                <li><Check size={12} aria-hidden="true" />Propuesta y cuotas</li>
                <li data-no="true"><X size={12} aria-hidden="true" />Listado de envío</li>
              </ul>
            </span>
          </div>
          <PulsoButton variant="secondary" size="sm" onClick={() => inputConteos.current?.click()} disabled={leyendo}>
            <FileUp size={14} aria-hidden="true" /> {tablaConteos ? "Cambiar tabla" : "Elegir tabla"}
          </PulsoButton>
          <input
            ref={inputConteos}
            type="file"
            hidden
            accept=".xlsx,.xls,.csv,.txt"
            onChange={(e) => { const f = e.currentTarget.files?.[0]; e.currentTarget.value = ""; if (f) void subirConteos(f); }}
          />
        </div>
      ) : null}
      {!lectura && poblacionManual ? (
        <div className="cmmp-fuente">
          <span className="cmmp-fuente-icono" aria-hidden="true"><Pencil size={16} /></span>
          <div className="cmmp-fuente-cuerpo">
            <b>Todavía no hay base</b>
            <label className="cmmp-manual">
              <span>Población</span>
              <NumberCell
                value={manual ?? poblacionManual.valor}
                ariaLabel="Población escrita a mano"
                onChange={(n) => setManual(Math.max(0, Math.round(n)))}
              />
            </label>
          </div>
          <PulsoButton
            variant="secondary"
            size="sm"
            disabled={manual == null || manual === poblacionManual.valor || !(manual > 0)}
            onClick={() => { if (manual != null && manual > 0) { poblacionManual.onGuardar(manual); setManual(null); } }}
          >
            Guardar la población
          </PulsoButton>
        </div>
      ) : null}
      {error ? <div className="cmmp-pad"><Alert kind="error">{error}</Alert></div> : null}
      {conteos && tablaConteos && !lectura ? (
        <FuenteConteos
          key={tablaConteos.fileId}
          componenteId={conteos.componenteId}
          actor={conteos.actor}
          fileId={tablaConteos.fileId}
          nombreArchivo={tablaConteos.nombre}
          hojas={tablaConteos.hojas}
          sugerida={tablaConteos.sugerida}
          onGuardado={conteos.onGuardado}
        />
      ) : null}
      {!lectura ? null : (
        <>
          <div className="cmmp-leido">
            <Pastilla icono={<Table size={12} aria-hidden="true" />}>{estado.nombreArchivo}</Pastilla>
            {lectura.formato === "csv" ? (
              <>
                <Pastilla>{lectura.separador === ";" ? "Separado por punto y coma" : lectura.separador === "\t" ? "Separado por tabulación" : "Separado por coma"}</Pastilla>
                <Pastilla>{lectura.codificacion === "latin1" ? "Latin-1" : "UTF-8"}</Pastilla>
              </>
            ) : null}
          </div>
          <PulsoTable columnas={columnas} filas={lectura.hojas} idDeFila={(h) => h.nombre || "csv"} ariaLabel="Hojas del libro" densidad="compacta" />
        </>
      )}
    </PanelDeMesa>
  );
}
