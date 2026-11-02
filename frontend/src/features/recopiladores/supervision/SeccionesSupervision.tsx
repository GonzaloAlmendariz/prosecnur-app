// Las secciones de la campaña de supervisión (ADR 0125 A3): Columnas y Entrega.
//
// Gonzalo: «te pregunta qué variable de cada uno quieres usar con un selector profesional no el del browser
// por defecto». El selector es el del kit que ya elige columnas en Material (PulsoSwitch, como «Columnas
// sensibles»), con búsqueda para las variables del instrumento, que pueden ser cientos.

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { downloadUrl } from "../../../api/core";
import { apiSupervisionExcel, type ColumnasDeSupervision } from "../../../api/materialSupervision";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { PulsoButton } from "../../../components/PulsoButton";
import { PulsoInput } from "../../../components/PulsoInput";
import { PulsoSwitch } from "../../../components/PulsoSwitch";
import { serializarDireccion } from "../../../lib/navegacion/direccion";
import { CheckCircle2, ListChecks, PhoneCall, Search, ShieldCheck, Table2 } from "../../../vendor/lucide-react";
import { SupervisionEnSheets } from "./SupervisionEnSheets";

/** Dónde Monitoreo arma los lotes de supervisión. */
const A_MONITOREO_SUPERVISION = serializarDireccion({ modulo: "monitoreo", modo: "telefonico", seccion: "control", pestana: "supervision" });

type Elegidas = { barrido: string[]; resultados: string[] };

function alternar(lista: string[], valor: string, on: boolean): string[] {
  return on ? [...lista.filter((x) => x !== valor), valor] : lista.filter((x) => x !== valor);
}

export function ColumnasSupervision({ columnas, guardando, onGuardar }: {
  columnas: ColumnasDeSupervision;
  guardando: boolean;
  onGuardar: (elegidas: Elegidas) => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const { elegidas } = columnas;
  const filtro = busqueda.trim().toLocaleLowerCase("es-PE");
  const variables = useMemo(
    () => columnas.disponibles.resultados.filter((v) => !filtro || v.nombre.toLocaleLowerCase("es-PE").includes(filtro) || v.etiqueta.toLocaleLowerCase("es-PE").includes(filtro)),
    [columnas.disponibles.resultados, filtro],
  );
  return (
    <>
      <article className="rec-terr-tarjeta rec-tel-tarjeta" data-qa-geometry-member>
        <h3><PhoneCall size={15} aria-hidden /> Del barrido</h3>
        <p className="rec-terr-nota">Lo que el supervisor necesita del barrido para volver a llamar. Se guarda al elegir.</p>
        {columnas.disponibles.barrido.length ? columnas.disponibles.barrido.map((c) => (
          <PulsoSwitch
            key={c}
            size="sm"
            label={c}
            checked={elegidas.barrido.includes(c)}
            disabled={guardando}
            onCheckedChange={(on) => onGuardar({ ...elegidas, barrido: alternar(elegidas.barrido, c, on) })}
          />
        )) : <p className="rec-terr-nota">La campaña telefónica todavía no declara su plantilla: configúrala en Casos.</p>}
      </article>

      <article className="rec-terr-tarjeta rec-tel-tarjeta" data-qa-geometry-member>
        <h3><ListChecks size={15} aria-hidden /> De los resultados</h3>
        <p className="rec-terr-nota">Las preguntas que el supervisor vuelve a hacer para comprobar la llamada.</p>
        {columnas.disponibles.resultados.length ? (
          <>
            <label className="rec-terr-buscar">
              <Search size={14} aria-hidden />
              <PulsoInput type="search" aria-label="Buscar variable" placeholder="Variable o pregunta" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            </label>
            {variables.map((v) => (
              <PulsoSwitch
                key={v.nombre}
                size="sm"
                label={v.etiqueta ? `${v.nombre} · ${v.etiqueta}` : v.nombre}
                checked={elegidas.resultados.includes(v.nombre)}
                disabled={guardando}
                onCheckedChange={(on) => onGuardar({ ...elegidas, resultados: alternar(elegidas.resultados, v.nombre, on) })}
              />
            ))}
            {!variables.length ? <p className="rec-terr-nota">Ninguna variable coincide con «{busqueda}».</p> : null}
          </>
        ) : <p className="rec-terr-nota">El proyecto no tiene un formulario cargado: sin él no hay variables que repreguntar.</p>}
      </article>

      <article className="rec-terr-tarjeta rec-tel-tarjeta" data-qa-geometry-member>
        <h3><ShieldCheck size={15} aria-hidden /> De la supervisión</h3>
        <p className="rec-terr-nota">Van siempre, con este nombre, porque Monitoreo las lee para dar el veredicto de cada caso.</p>
        <div className="rec-tel-columnas">{columnas.fijas.map((c) => <span key={c} className="rec-tel-col is-campo">{c}</span>)}</div>
        <p className="rec-terr-nota">Veredicto: {columnas.veredictos.join(", ")}.</p>
      </article>
    </>
  );
}

export function EntregaSupervision({ campaignId, columnas, casos, sinLote, loteId = "" }: {
  campaignId: string;
  loteId?: string;
  columnas: ColumnasDeSupervision;
  casos: number;
  sinLote: boolean;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  if (sinLote) {
    return (
      <EstadoVacio
        tamano="normal"
        icono={<ShieldCheck size={22} />}
        titulo="Monitoreo ya no tiene este lote"
        descripcion="La base se arma con el lote vigente. Si Monitoreo lo rehízo, crea la campaña del lote nuevo."
        accion={<Link className="rec-terr-enlace" to={A_MONITOREO_SUPERVISION}>Ir a Monitoreo</Link>}
      />
    );
  }
  const orden = [columnas.llave, "Enumerador", "Fecha de la llamada", ...columnas.elegidas.barrido, ...columnas.elegidas.resultados];
  const descargar = () => {
    setOcupado(true);
    setError("");
    apiSupervisionExcel(campaignId)
      .then((r) => window.open(downloadUrl(r.file_id), "_blank", "noopener,noreferrer"))
      .catch((e: unknown) => setError(e instanceof Error ? e.message.replace(/ · E_[A-Z_]+$/, "") : "No se pudo generar la base."))
      .finally(() => setOcupado(false));
  };
  return (
    <>
      <article className="rec-terr-tarjeta" data-qa-geometry-member>
        <h3><Table2 size={15} aria-hidden /> Base del lote</h3>
        <p className="rec-terr-nota">
          Una fila por caso del lote ({casos.toLocaleString("es-PE")} {casos === 1 ? "caso" : "casos"}). La llave, quién llamó y cuándo salen del
          lote; las columnas del barrido y de los resultados se completan buscando por «{columnas.llave}».
        </p>
        <div className="rec-tel-columnas" aria-label="Columnas de la base">
          {orden.map((c) => <span key={c} className="rec-tel-col">{c}</span>)}
          {columnas.fijas.map((c) => <span key={c} className="rec-tel-col is-campo">{c}</span>)}
        </div>
        <div className="rec-terr-fila">
          <PulsoButton variant="primary" size="sm" disabled={ocupado || !casos} onClick={descargar}>{ocupado ? "Generando…" : "Excel de la supervisión"}</PulsoButton>
        </div>
        {error ? <p className="rec-terr-error" role="alert">{error}</p> : null}
      </article>
      <SupervisionEnSheets campaignId={campaignId} loteId={loteId} />
      <article className="rec-terr-tarjeta" data-qa-geometry-member>
        <h3><CheckCircle2 size={15} aria-hidden /> Lo que lee Monitoreo</h3>
        <p className="rec-terr-nota">
          Monitoreo lee por «{columnas.llave}» las tres columnas de la supervisión y sabe de qué lote y de qué campaña viene cada caso. No les
          cambies el nombre. Los lotes se arman en <Link to={A_MONITOREO_SUPERVISION}>Monitoreo › Supervisión</Link>.
        </p>
      </article>
    </>
  );
}
