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
import { EstadoChip } from "../../../components/EstadoChip";
import type { ChromeStatusTone } from "../../../components/ModuleCommandBar";
import { Panel } from "../../../components/Panel";
import { PulsoButton } from "../../../components/PulsoButton";
import { PulsoInput } from "../../../components/PulsoInput";
import { PulsoSwitch } from "../../../components/PulsoSwitch";
import { PulsoTable, type PulsoTableColumna } from "../../../components/PulsoTable";
import { CheckCircle2, ClipboardList, ListChecks, Route, ShieldAlert, Table2 } from "../../../vendor/lucide-react";
import { formatoConteo } from "../../../lib/formatoNumero";
import { RecorridoDelTraspaso } from "../TraspasoTablero";
import { DocumentoDelBarrido } from "./DocumentoDelBarrido";
import { partirLista } from "./modeloTelefonico";
import { serializarDireccion } from "../../../lib/navegacion/direccion";
import type { useConfigTelefonica } from "./useConfigTelefonica";
import { CargaDeBloque } from "../../../components/CargaDeBloque";

/** Donde Monitoreo telefónico conecta el Sheets del barrido. */
const A_MONITOREO_FUENTES_TELEFONICO = serializarDireccion({ modulo: "monitoreo", modo: "telefonico", seccion: "insumos", pestana: "fuentes" });

type Datos = ReturnType<typeof useConfigTelefonica>;

const TELEFONOS = [[1, "Uno"], [2, "Dos"], [3, "Tres"], [4, "Cuatro"]] as const;
// T13: RMS dice «Observaciones»; PDM, MDV y CBI, «Observación». Monitoreo no lee esa columna.
const OBSERVACIONES = ["Observación", "Observaciones"] as const;
const REEMPLAZO = ["Reemplaza a", "Reemplazado por", "¿Se reemplaza con el Backup?"];
const TONO_CLASE: Readonly<Record<ClaseDeStatus, ChromeStatusTone>> = {
  efectiva: "success",
  pendiente: "neutral",
  no_contacto: "info",
  rechazo: "danger",
  invalido: "warn",
};

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
    <Panel data-qa-geometry-member title={titulo}>
      {datos.error ? <p className="rec-terr-error" role="alert">{datos.error}</p> : <CargaDeBloque label="Leyendo la campaña…" />}
    </Panel>
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
      <Panel className="rec-tel-tarjeta" data-qa-geometry-member title={<><ClipboardList size={16} aria-hidden /> Casos del barrido</>}>
        <p className="rec-terr-nota">
          Cuántos casos entrega el cliente y cómo se identifican. Los nombres y teléfonos no pasan por la app: viven sólo en el archivo
          del operativo.
        </p>
        <div className="rec-tel-campos">
          <div className="rec-terr-campo">
            <span aria-hidden>Casos de muestra</span>
            <PulsoInput size="sm" type="number" min={0} aria-label="Casos de muestra" value={muestra} disabled={guardando} onChange={(e) => setMuestra(e.target.value)} />
          </div>
          <div className="rec-terr-campo">
            <span aria-hidden>Casos de backup</span>
            <PulsoInput size="sm" type="number" min={0} aria-label="Casos de backup" value={backup} disabled={guardando} onChange={(e) => setBackup(e.target.value)} />
          </div>
          <div className="rec-terr-campo">
            <span aria-hidden>Llave del caso</span>
            <PulsoInput size="sm" aria-label="Llave del caso" maxLength={40} placeholder="Código" value={llave} disabled={guardando} onChange={(e) => setLlave(e.target.value)} />
          </div>
        </div>
        <div className="rec-terr-campo">
          <span aria-hidden>Estratos (separados por coma)</span>
          <PulsoInput size="sm" aria-label="Estratos" placeholder="Por ejemplo: Periodo de Llegada, Sede" value={estratos} disabled={guardando} onChange={(e) => setEstratos(e.target.value)} />
        </div>
        <div className="rec-terr-campo">
          <span aria-hidden>Responsables (separados por coma)</span>
          <PulsoInput size="sm" aria-label="Responsables" placeholder="Sin lista: la columna queda libre" value={responsables} disabled={guardando} onChange={(e) => setResponsables(e.target.value)} />
          {config.responsables_del_padron ? <small className="rec-terr-nota">Del equipo de Monitoreo. Si escribes otra lista y la guardas, manda la tuya.</small> : null}
        </div>
        <div className="rec-tel-pie">
          {error ? <span className="rec-terr-error" role="alert">{error}</span>
            : !casosValidos ? <span className="rec-terr-nota">Los casos son enteros desde cero.</span>
            : <span className="rec-terr-nota">{sucio ? "Hay cambios sin guardar." : "Sin cambios."}</span>}
          <PulsoButton variant="primary" size="sm" disabled={!sucio || !casosValidos || guardando} onClick={() => void guardar(cambio)}>
            {guardando ? "Guardando…" : "Guardar casos"}
          </PulsoButton>
        </div>
      </Panel>

      <Panel className="rec-tel-tarjeta" data-qa-geometry-member title={<><Table2 size={16} aria-hidden /> Contacto</>}>
        <p className="rec-terr-nota">Cómo se llama a cada caso. Se guarda al elegir.</p>
        <div className="rec-tel-ajuste">
        <span>Teléfonos por caso</span>
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
        </div>
        <div className="rec-tel-ajuste">
        <span>Reemplazo</span>
        <PulsoSwitch size="sm" label="Desde el backup" checked={config.reemplazo} disabled={guardando} onCheckedChange={(v) => void guardar({ reemplazo: v })} />
        </div>
        <div className="rec-tel-ajuste">
        <span>Rótulo de la observación</span>
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
        </div>
      </Panel>

      {config.estratos.length ? (
        <Panel className="rec-tel-tarjeta" data-qa-geometry-member title={<><ShieldAlert size={16} aria-hidden /> Columnas sensibles</>}>
          <p className="rec-terr-nota">
            Una columna sensible, como el estatus legal, el documento o el correo, va marcada en rojo y no va al Sheets de los
            enumeradores, donde de los datos personales sólo van nombre y teléfono; tampoco sale en ningún artefacto. Se guarda al elegir.
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
        </Panel>
      ) : null}
    </>
  );
}

const COLUMNAS_STATUS: PulsoTableColumna<StatusDelBarrido>[] = [
  { id: "status", encabezado: "Status", ancho: 280, celda: (s) => s.status, valor: (s) => s.status },
  { id: "codigo", encabezado: "Código", ancho: 200, celda: (s) => <code>{s.codigo}</code>, valor: (s) => s.codigo },
  // Pasada de diseño: la clase como estado con tono, para escanear la tabla de un vistazo.
  { id: "clase", encabezado: "Clase", ancho: 140, celda: (s) => <EstadoChip label={ROTULO_CLASE[s.clase]} tone={TONO_CLASE[s.clase]} />, valor: (s) => s.clase },
];

export function BarridoTelefonico({ datos, pestana, campaignId, hrefCasos }: { datos: Datos; pestana: string; campaignId: string; hrefCasos: string }) {
  const { config } = datos;
  if (!config) return <Cargando datos={datos} titulo="Plantilla del barrido" />;
  if (pestana === "status") {
    return (
      <Panel data-qa-geometry-member title={<><ListChecks size={16} aria-hidden /> Status del barrido</>}>
        <p className="rec-terr-nota">
          {config.status_propio
            ? "El catálogo propio del estudio."
            : "El catálogo del barrido del RMS 2026, con su ortografía exacta. La clase es una propuesta todavía sin confirmar con ACNUR."}
        </p>
        <PulsoTable columnas={COLUMNAS_STATUS} filas={config.status} idDeFila={(s) => s.codigo || s.status} ariaLabel="Status del barrido" densidad="compacta" altoMaximo={100000} />
      </Panel>
    );
  }
  // Igual que la plantilla (collection_barrido_plantilla.R): «Cod pulso» primero; Origen y Tanda sólo con backup;
  // la cola de campo contigua y el reemplazo al final (T12). Las columnas se arman en DocumentoDelBarrido.
  return (
    <DocumentoDelBarrido
      config={config}
      campaignId={campaignId}
      hrefCasos={hrefCasos}
      hrefFuentes={A_MONITOREO_FUENTES_TELEFONICO}
      onCambio={() => { void datos.recargar(); }}
    />
  );
}

export function EntregaTelefonica({ config }: { config: ConfigTelefonica | null }) {
  const lee = config?.lee_monitoreo ?? [];
  const casos = config ? config.muestra + config.backup : 0;
  return (
    <>
      {/* Pasada de diseño (2 nov 2026): la entrega se lee como un recorrido, con la pieza del Traspaso de aulas. */}
      {config ? (
        <Panel className="rec-tel-recorrido" data-qa-geometry-member title={<><Route size={16} aria-hidden /> Recorrido de la entrega</>}>
          <RecorridoDelTraspaso
            pasos={[
              {
                id: "casos", titulo: "Casos declarados", hecho: casos > 0,
                detalle: casos > 0 ? `${formatoConteo(config.muestra)} de muestra y ${formatoConteo(config.backup)} de backup` : "Se declaran en Casos.",
              },
              {
                id: "documento", titulo: "Documento construido", hecho: config.barrido.construido,
                detalle: config.barrido.construido ? `Pestaña «${config.barrido.pestana ?? "Barrido"}» del Sheets del estudio` : "Se construye en Barrido.",
              },
              {
                id: "monitoreo", titulo: "Conectado en Monitoreo", hecho: config.barrido.conectado_en_monitoreo,
                detalle: config.barrido.conectado_en_monitoreo ? "Monitoreo ya lee el avance." : <>Se conecta en <Link to={A_MONITOREO_FUENTES_TELEFONICO}>Insumos › Fuentes</Link>.</>,
              },
            ]}
          />
        </Panel>
      ) : null}
      <Panel data-qa-geometry-member title={<><CheckCircle2 size={16} aria-hidden /> Lo que lee Monitoreo</>}>
        {/* R14 del mapa de responsabilidades (2 nov 2026): de dónde sale el Sheets y a dónde va. */}
        <p className="rec-terr-nota">
          La base sale de Barrido: Material la construye en el Sheets del estudio, o la entrega en Excel para copiarla ahí, y el
          equipo la llena. Monitoreo conecta ese Sheets en{" "}
          <Link to={A_MONITOREO_FUENTES_TELEFONICO}>Insumos › Fuentes</Link> y desde ahí sigue el avance. Estas columnas son la llave
          de esa lectura: no cambian de nombre.
        </p>
        {lee.length ? (
          <div className="rec-tel-columnas">{lee.map((c) => <span key={c} className="rec-tel-col">{c}</span>)}</div>
        ) : config ? (
          <p className="rec-terr-nota">Esta campaña no declara columnas de lectura para Monitoreo.</p>
        ) : <CargaDeBloque label="Leyendo la campaña…" />}
      </Panel>
      <Panel data-qa-geometry-member title={<><ShieldAlert size={16} aria-hidden /> Antes de abrir el Sheets al equipo</>}>
        <ul className="rec-tel-lista">
          <li>No cambies los encabezados de la fila 1 ni la llave: Monitoreo deja de reconocer el barrido.</li>
          <li>Status es obligatorio en cuanto hay Intentos o Fecha: una fila sin Status sale del avance.</li>
          <li>Para filtrar, usa vistas de filtro; un filtro con orden reordena la hoja de todos.</li>
        </ul>
      </Panel>
    </>
  );
}
