import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Table2 } from "lucide-react";
import { EstadoChip } from "../../../../../components/EstadoChip";
import { tonoDeEstadoChip, type TonoDeAulas } from "../tonoDeEstadoChip";

import {
  apiMonitoreoAulasTablasConstruidas,
  type TablaDeMaterial,
  type TablasConstruidas,
} from "../../../../../api/monitoreoAulasTablas";

/** Material › Entrega, donde se construyen el libro y la distribución. */
export const RUTA_ENTREGA_DE_MATERIAL = "/material-campo?modo=aulas&campana=aulas.principal&seccion=entrega&pestana=traspaso";

type Lectura = { estado: string; tono: TonoDeAulas; nota: string; falta: boolean };

/** Qué dice la fila de una tabla de Material, sin red: se prueba aparte. */
export function lecturaDeTabla(t: TablaDeMaterial, faltan: string[] = []): Lectura {
  if (!t.destino) return { estado: "Sin construir", tono: "aviso", nota: "Material todavía no la construyó.", falta: true };
  if (t.existe === null) return { estado: "Sin leer", tono: "neutro", nota: "No se pudo leer el Sheets; se vuelve a comprobar al recargar.", falta: false };
  if (t.existe) return { estado: "Construida", tono: "ok", nota: "", falta: false };
  const detalle = faltan.length ? `Faltan ${faltan.join(", ")}.` : "No trae sus pestañas.";
  return { estado: "Incompleta", tono: "aviso", nota: detalle, falta: true };
}

function Fila({ nombre, trae, volumen, t, lectura }: {
  nombre: string;
  trae: string;
  volumen: string;
  t: TablaDeMaterial;
  lectura: Lectura;
}) {
  return (
    <tr>
      <th scope="row">
        <span className="aulas-ins-fuente">
          <Table2 size={15} aria-hidden="true" />
          <span>
            <b>{nombre}</b>
            {lectura.nota ? <small>{lectura.nota}</small> : null}
          </span>
        </span>
      </th>
      <td className="is-trae">{trae}</td>
      <td className="is-num">{volumen}</td>
      <td className="is-num">{t.url ? <a href={t.url} target="_blank" rel="noreferrer">Abrir</a> : "—"}</td>
      <td>
        {lectura.falta ? (
          <Link className="pulso-button pulso-button--secondary pulso-button--sm" to={RUTA_ENTREGA_DE_MATERIAL}>
            Construir en Material
          </Link>
        ) : (
          <EstadoChip label={lectura.estado} tone={tonoDeEstadoChip(lectura.tono)} />
        )}
      </td>
    </tr>
  );
}

/**
 * Las filas «Libro del operativo» y «Distribución de aplicadores» de Insumos ›
 * Fuentes (ADR 0125): Material las construye en el Sheets, Monitoreo comprueba
 * que existen —por los nombres de sus pestañas— y, si faltan, lleva a Material.
 */
export function TablasDeMaterial() {
  const [tablas, setTablas] = useState<TablasConstruidas | null>(null);
  useEffect(() => {
    let vivo = true;
    apiMonitoreoAulasTablasConstruidas().then((t) => { if (vivo) setTablas(t); }).catch(() => { if (vivo) setTablas(null); });
    return () => { vivo = false; };
  }, []);
  if (!tablas) return null;
  const { libro, distribucion } = tablas;
  return (
    <>
      <Fila
        nombre="Libro del operativo en Sheets"
        trae="agenda, campo y control"
        volumen="—"
        t={libro}
        lectura={lecturaDeTabla(libro, libro.faltan)}
      />
      <Fila
        nombre="Distribución de aplicadores en Sheets"
        trae="la semana de cada aplicador"
        volumen={distribucion.semanas.length ? `${distribucion.semanas.length} ${distribucion.semanas.length === 1 ? "semana" : "semanas"}` : "—"}
        t={distribucion}
        lectura={lecturaDeTabla(distribucion)}
      />
    </>
  );
}
