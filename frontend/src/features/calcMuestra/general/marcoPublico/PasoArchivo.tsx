import { useRef, useState } from "react";
import { Check, FileUp, Pencil, Table, X } from "lucide-react";

import { apiUpload } from "../../../../api/estudio";
import { apiMarcoPublicoLeer, type HojaDelMarco } from "../../../../api/calcMuestraMarcoPublico";
import { Alert } from "../../../../components/Alert";
import { EstadoVacio } from "../../../../components/EstadoVacio";
import { PanelDeMesa } from "../../../../components/procesamiento/PanelDeMesa";
import { PulsoButton } from "../../../../components/PulsoButton";
import { PulsoTable, type PulsoTableColumna } from "../../../../components/PulsoTable";
import { NumberCell } from "../../universidad/aulas";
import { ESTADO_MARCO_INICIAL, type EstadoMarco } from "./modeloMarco";
import { errorLegible, Formatos, Pastilla, cifra } from "./piezas";

const TIPO_HOJA: Record<HojaDelMarco["tipo"], string> = { datos: "Datos", consulta: "Consulta", notas: "Notas", vacia: "Vacía" };

/** Paso 1: el archivo del cliente y la hoja que tiene los datos. */
export function PasoArchivo({ estado, onCambio, poblacionManual }: {
  estado: EstadoMarco;
  onCambio: (e: EstadoMarco) => void;
  /** Sin base todavía: la población se escribe a mano y se guarda como marco del actor. */
  poblacionManual?: { valor: number; onGuardar: (n: number) => void };
}) {
  const [manual, setManual] = useState<number | null>(null);
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
      acciones={lectura ? (
        <PulsoButton variant="secondary" size="sm" onClick={() => input.current?.click()} disabled={leyendo}>
          <FileUp size={14} aria-hidden="true" /> Cambiar archivo
        </PulsoButton>
      ) : undefined}
    >
      <input
        ref={input}
        type="file"
        hidden
        accept=".xlsx,.xls,.csv,.txt"
        onChange={(e) => { const f = e.currentTarget.files?.[0]; e.currentTarget.value = ""; if (f) void subir(f); }}
      />
      <div className="cmmp-fuente">
        <b><Table size={15} aria-hidden="true" /> Base con una fila por persona</b>
        <Formatos formatos={["XLSX", "XLS", "CSV"]} />
        <ul className="cmmp-capac">
          <li><Check size={12} aria-hidden="true" />Cuotas por cualquier columna</li>
          <li><Check size={12} aria-hidden="true" />Listado de envío</li>
        </ul>
      </div>
      {error ? <div className="cmmp-pad"><Alert kind="error">{error}</Alert></div> : null}
      {!lectura && poblacionManual ? (
        <div className="cmmp-fuente cmmp-fuente--manual">
          <b><Pencil size={15} aria-hidden="true" /> Todavía no hay base</b>
          <label className="cmmp-manual">
            <small>Población</small>
            <NumberCell
              value={manual ?? poblacionManual.valor}
              ariaLabel="Población escrita a mano"
              onChange={(n) => setManual(Math.max(0, Math.round(n)))}
            />
          </label>
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
      {!lectura ? (
        <EstadoVacio
          icono={<FileUp size={22} aria-hidden="true" />}
          titulo={leyendo ? "Leyendo el archivo" : "Sube la base del público"}
          accion={(
            <PulsoButton variant="primary" size="sm" onClick={() => input.current?.click()} disabled={leyendo}>
              <FileUp size={14} aria-hidden="true" /> Elegir archivo
            </PulsoButton>
          )}
        />
      ) : (
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
