// Campaña telefónica › Casos, Barrido y Entrega (P10). Material guarda sólo la
// configuración del barrido; nombres y teléfonos viven en el archivo del operativo,
// que Monitoreo telefónico lee como hoy.
//
// Contrato de Superficie: cada pieza es una tarjeta con título (C1) que contiene su
// vacío y su error (C3); el scroll es del panel de la sección (C4).

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { downloadUrl } from "../../../api/core";
import { apiMaterialTelefonicaPlantilla, type ClaseDeStatus, type ConfigTelefonica, type StatusDelBarrido } from "../../../api/materialTelefonica";
import { GlidingRadioGroup } from "../../../components/GlidingRadioGroup";
import { PulsoButton } from "../../../components/PulsoButton";
import { PulsoInput } from "../../../components/PulsoInput";
import { PulsoSwitch } from "../../../components/PulsoSwitch";
import { PulsoTable, type PulsoTableColumna } from "../../../components/PulsoTable";
import { CheckCircle2, ClipboardList, ListChecks, ShieldAlert, Table2 } from "../../../vendor/lucide-react";
import { partirLista } from "./modeloTelefonico";
import { serializarDireccion } from "../../../lib/navegacion/direccion";
import type { useConfigTelefonica } from "./useConfigTelefonica";

/** Donde Monitoreo telefónico conecta el Sheets del barrido. */
const A_MONITOREO_FUENTES_TELEFONICO = serializarDireccion({ modulo: "monitoreo", modo: "telefonico", seccion: "insumos", pestana: "fuentes" });

type Datos = ReturnType<typeof useConfigTelefonica>;

const TELEFONOS = [[1, "Uno"], [2, "Dos"], [3, "Tres"], [4, "Cuatro"]] as const;
// T13: RMS dice «Observaciones»; PDM, MDV y CBI, «Observación». Monitoreo no lee esa columna.
const OBSERVACIONES = ["Observación", "Observaciones"] as const;
const REEMPLAZO = ["Reemplaza a", "Reemplazado por", "¿Se reemplaza con el Backup?"];
const ROTULO_CLASE: Readonly<Record<ClaseDeStatus, string>> = {
  efectiva: "Efectiva",
  pendiente: "Pendiente",
  no_contacto: "No contacto",
  rechazo: "Rechazo",
  invalido: "Inválido",
};
const fmt = (n: number) => n.toLocaleString("es-PE");

function Cargando({ datos, titulo }: { datos: Datos; titulo: string }) {
  return (
    <article className="rec-terr-tarjeta" data-qa-geometry-member>
      <h3>{titulo}</h3>
      <p className={datos.error ? "rec-terr-error" : "rec-terr-nota"} role={datos.error ? "alert" : "status"}>
        {datos.error || "Leyendo la campaña…"}
      </p>
    </article>
  );
}

export function CasosTelefonicos({ datos }: { datos: Datos }) {
  const { config, guardando, guardar, error } = datos;
  const [llave, setLlave] = useState("");
  const [estratos, setEstratos] = useState("");
  const [muestra, setMuestra] = useState("0");
  const [backup, setBackup] = useState("0");
  const [responsables, setResponsables] = useState("");
  useEffect(() => {
    if (!config) return;
    setLlave(config.llave);
    setEstratos(config.estratos.join(", "));
    setMuestra(String(config.muestra));
    setBackup(String(config.backup));
    setResponsables(config.responsables.join(", "));
  }, [config]);
  if (!config) return <Cargando datos={datos} titulo="Casos del barrido" />;

  const nMuestra = Number(muestra); const nBackup = Number(backup);
  const casosValidos = Number.isInteger(nMuestra) && nMuestra >= 0 && Number.isInteger(nBackup) && nBackup >= 0;
  const cambio = {
    llave: llave.trim() || "Código",
    estratos: partirLista(estratos),
    muestra: nMuestra,
    backup: nBackup,
    responsables: partirLista(responsables),
  };
  const sucio = cambio.llave !== config.llave || cambio.muestra !== config.muestra || cambio.backup !== config.backup
    || cambio.estratos.join("|") !== config.estratos.join("|") || cambio.responsables.join("|") !== config.responsables.join("|");

  return (
    <>
      <article className="rec-terr-tarjeta rec-tel-tarjeta" data-qa-geometry-member>
        <h3><ClipboardList size={15} aria-hidden /> Casos del barrido</h3>
        <p className="rec-terr-nota">
          Cuántos casos entrega el cliente y cómo se identifican. Los nombres y teléfonos no pasan por la app: viven sólo en el archivo
          del operativo.
        </p>
        <div className="rec-terr-fila">
          <div className="rec-terr-campo">
            <span aria-hidden>Casos de muestra</span>
            <PulsoInput size="sm" type="number" min={0} aria-label="Casos de muestra" value={muestra} disabled={guardando} onChange={(e) => setMuestra(e.target.value)} />
          </div>
          <div className="rec-terr-campo">
            <span aria-hidden>Casos de backup</span>
            <PulsoInput size="sm" type="number" min={0} aria-label="Casos de backup" value={backup} disabled={guardando} onChange={(e) => setBackup(e.target.value)} />
          </div>
        </div>
        <div className="rec-terr-campo">
          <span aria-hidden>Llave del caso</span>
          <PulsoInput size="sm" aria-label="Llave del caso" maxLength={40} placeholder="Código" value={llave} disabled={guardando} onChange={(e) => setLlave(e.target.value)} />
        </div>
        <div className="rec-terr-campo">
          <span aria-hidden>Estratos (separados por coma)</span>
          <PulsoInput size="sm" aria-label="Estratos" placeholder="Por ejemplo: Periodo de Llegada, Sede" value={estratos} disabled={guardando} onChange={(e) => setEstratos(e.target.value)} />
        </div>
        <div className="rec-terr-campo">
          <span aria-hidden>Responsables (separados por coma)</span>
          <PulsoInput size="sm" aria-label="Responsables" placeholder="Sin lista: la columna queda libre" value={responsables} disabled={guardando} onChange={(e) => setResponsables(e.target.value)} />
        </div>
        <div className="rec-terr-fila rec-terr-guardar">
          <PulsoButton variant="primary" size="sm" disabled={!sucio || !casosValidos || guardando} onClick={() => void guardar(cambio)}>
            {guardando ? "Guardando…" : "Guardar casos"}
          </PulsoButton>
          {!casosValidos ? <span className="rec-terr-nota">Los casos son enteros desde cero.</span> : null}
          {error ? <span className="rec-terr-error" role="alert">{error}</span> : null}
        </div>
      </article>

      <article className="rec-terr-tarjeta rec-tel-tarjeta" data-qa-geometry-member>
        <h3><Table2 size={15} aria-hidden /> Contacto</h3>
        <p className="rec-terr-nota">Se guarda al elegir.</p>
        <span className="rec-terr-nota">Teléfonos por caso</span>
        <GlidingRadioGroup
          value={config.telefonos}
          options={TELEFONOS}
          getOptionValue={(o) => o[0]}
          onValueChange={(v) => void guardar({ telefonos: v })}
          className="rec-terr-opciones"
          aria-label="Teléfonos por caso"
          getOptionProps={() => ({ disabled: guardando })}
        >
          {(o) => <span>{o[1]}</span>}
        </GlidingRadioGroup>
        <PulsoSwitch size="sm" label="Con reemplazo desde el backup" checked={config.reemplazo} disabled={guardando} onCheckedChange={(v) => void guardar({ reemplazo: v })} />
        <span className="rec-terr-nota">Rótulo de la observación</span>
        <GlidingRadioGroup
          value={config.observacion}
          options={OBSERVACIONES}
          getOptionValue={(o) => o}
          onValueChange={(v) => void guardar({ observacion: v })}
          className="rec-terr-opciones"
          aria-label="Rótulo de la observación"
          getOptionProps={() => ({ disabled: guardando })}
        >
          {(o) => <span>{o}</span>}
        </GlidingRadioGroup>
      </article>

      {config.estratos.length ? (
        <article className="rec-terr-tarjeta rec-tel-tarjeta" data-qa-geometry-member>
          <h3><ShieldAlert size={15} aria-hidden /> Columnas sensibles</h3>
          <p className="rec-terr-nota">
            Una columna sensible, como el estatus legal, va marcada en rojo y no se copia al Sheets compartido ni sale en ningún
            artefacto. Se guarda al elegir.
          </p>
          {config.estratos.map((e) => (
            <PulsoSwitch
              key={e}
              size="sm"
              label={e}
              checked={config.sensibles.includes(e)}
              disabled={guardando}
              onCheckedChange={(v) => void guardar({ sensibles: v ? [...config.sensibles, e] : config.sensibles.filter((x) => x !== e) })}
            />
          ))}
        </article>
      ) : null}
    </>
  );
}

const COLUMNAS_STATUS: PulsoTableColumna<StatusDelBarrido>[] = [
  { id: "status", encabezado: "Status", ancho: 280, celda: (s) => s.status, valor: (s) => s.status },
  { id: "codigo", encabezado: "Código", ancho: 200, celda: (s) => <code>{s.codigo}</code>, valor: (s) => s.codigo },
  { id: "clase", encabezado: "Clase", ancho: 140, celda: (s) => ROTULO_CLASE[s.clase], valor: (s) => s.clase },
];

export function BarridoTelefonico({ datos, pestana, campaignId }: { datos: Datos; pestana: string; campaignId: string }) {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const { config } = datos;
  if (!config) return <Cargando datos={datos} titulo="Plantilla del barrido" />;
  if (pestana === "status") {
    return (
      <article className="rec-terr-tarjeta" data-qa-geometry-member>
        <h3><ListChecks size={15} aria-hidden /> Status del barrido</h3>
        <p className="rec-terr-nota">
          {config.status_propio
            ? "El catálogo propio del estudio."
            : "El catálogo del barrido del RMS 2026, con su ortografía exacta. La clase es una propuesta todavía sin confirmar con ACNUR."}
        </p>
        <PulsoTable columnas={COLUMNAS_STATUS} filas={config.status} idDeFila={(s) => s.codigo || s.status} ariaLabel="Status del barrido" densidad="compacta" altoMaximo={100000} />
      </article>
    );
  }
  const casos = config.muestra + config.backup;
  // Igual que la plantilla (collection_barrido_plantilla.R): «Cod pulso» primero; Origen y Tanda sólo con backup;
  // la cola de campo contigua y el reemplazo al final (T12).
  const columnas = ["Cod pulso", config.llave, ...(config.reemplazo ? ["Origen", "Tanda"] : []), "Nombre",
    ...Array.from({ length: config.telefonos }, (_, i) => `Teléfono ${i + 1}`), ...config.estratos];
  const cola = ["Responsable", "Status", "Teléfono de la encuesta", "Intentos", "Fecha", config.observacion,
    ...(config.reemplazo ? REEMPLAZO : [])];
  const descargar = () => {
    setOcupado(true);
    setError("");
    apiMaterialTelefonicaPlantilla(campaignId)
      .then((r) => window.open(downloadUrl(r.file_id), "_blank", "noopener,noreferrer"))
      .catch((e: unknown) => setError(e instanceof Error ? e.message.replace(/ · E_[A-Z_]+$/, "") : "No se pudo generar la plantilla."))
      .finally(() => setOcupado(false));
  };
  return (
    <article className="rec-terr-tarjeta" data-qa-geometry-member>
      <h3><Table2 size={15} aria-hidden /> Plantilla del barrido</h3>
      <p className="rec-terr-nota">
        Una fila por caso{casos ? ` (${fmt(casos)} filas: ${fmt(config.muestra)} de muestra y ${fmt(config.backup)} de backup)` : ""}. La identidad
        la pega el equipo desde la base del cliente; la cola, en ámbar, la llena quien llama.
      </p>
      <div className="rec-tel-columnas" aria-label="Columnas de la plantilla">
        {columnas.map((c) => <span key={c} className={config.sensibles.includes(c) ? "rec-tel-col is-sensible" : "rec-tel-col"}>{c}</span>)}
        {cola.map((c) => <span key={c} className="rec-tel-col is-campo">{c}</span>)}
      </div>
      <div className="rec-terr-fila">
        <PulsoButton variant="primary" size="sm" disabled={ocupado} onClick={descargar}>{ocupado ? "Generando…" : "Excel del barrido"}</PulsoButton>
      </div>
      {!casos ? <p className="rec-terr-nota">Sin casos declarados en Casos, la plantilla sale con 2.000 filas.</p> : null}
      {error ? <p className="rec-terr-error" role="alert">{error}</p> : null}
    </article>
  );
}

export function EntregaTelefonica({ config }: { config: ConfigTelefonica | null }) {
  const lee = config?.lee_monitoreo ?? [];
  return (
    <>
      <article className="rec-terr-tarjeta" data-qa-geometry-member>
        <h3><CheckCircle2 size={15} aria-hidden /> Lo que lee Monitoreo</h3>
        {/* R14 del mapa de responsabilidades (2 nov 2026): de dónde sale el Sheets y a dónde va. */}
        <p className="rec-terr-nota">
          La plantilla sale de Barrido; el equipo la copia al Sheets compartido del operativo y la llena. Monitoreo lo conecta en{" "}
          <Link to={A_MONITOREO_FUENTES_TELEFONICO}>Insumos › Fuentes</Link> y desde ahí sigue el avance. Estas columnas son la llave
          de esa lectura: no cambian de nombre.
        </p>
        {lee.length ? (
          <div className="rec-tel-columnas">{lee.map((c) => <span key={c} className="rec-tel-col">{c}</span>)}</div>
        ) : <p className="rec-terr-nota">Leyendo la campaña…</p>}
      </article>
      <article className="rec-terr-tarjeta" data-qa-geometry-member>
        <h3><ShieldAlert size={15} aria-hidden /> Antes de abrir el Sheets al equipo</h3>
        <ul className="rec-tel-lista">
          <li>No cambies los encabezados de la fila 1 ni la llave: Monitoreo deja de reconocer el barrido.</li>
          <li>Status es obligatorio en cuanto hay Intentos o Fecha: una fila sin Status sale del avance.</li>
          <li>Para filtrar, usa vistas de filtro; un filtro con orden reordena la hoja de todos.</li>
        </ul>
      </article>
    </>
  );
}
