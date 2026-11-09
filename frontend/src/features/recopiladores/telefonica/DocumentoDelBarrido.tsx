// Telefónica › Barrido › Plantilla (revamp v5, ADR 0125 §4 y A2): en primer plano el
// documento de los enumeradores y los cuatro pasos en orden, cada uno con su estado; las
// columnas y las reglas del documento van al costado, como segundo nivel.
//
// Los pasos 1, 2 y 4 se leen del backend (config y `barrido`); el 3 —pegar nombres y
// teléfonos— ocurre en el Sheets y la app no lo ve: se dice así, sin fingir un estado.
//
// Contrato de Superficie: C1 `material-campo/telefonica/barrido` (intrinsic); las columnas
// son dueñas de su scroll (C3/C4).

import { useState } from "react";
import { Link } from "react-router-dom";

import { downloadUrl } from "../../../api/core";
import { descargarArchivo } from "../../../lib/descargas";
import { apiMaterialTelefonicaPlantilla, type ConfigTelefonica } from "../../../api/materialTelefonica";
import { PulsoButton, PulsoButtonEnlace } from "../../../components/PulsoButton";
import { Check, ExternalLink, FileSpreadsheet } from "../../../vendor/lucide-react";
import { fechaDelEnvio } from "../territorial/modeloUnidades";
import { BarridoEnSheets } from "./BarridoEnSheets";
import "./barrido.css";

const fmt = (n: number) => n.toLocaleString("es-PE");
const REEMPLAZO = ["Reemplaza a", "Reemplazado por", "¿Se reemplaza con el Backup?"];

type Props = {
  config: ConfigTelefonica;
  campaignId: string;
  hrefCasos: string;
  hrefFuentes: string;
  onCambio: () => void;
};

type Paso = { titulo: string; detalle: string; hecho: boolean | null; accion?: { texto: string; href: string } };

export function DocumentoDelBarrido({ config, campaignId, hrefCasos, hrefFuentes, onCambio }: Props) {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const { barrido } = config;
  const casos = config.muestra + config.backup;
  const identidad = ["Cod pulso", config.llave, ...(config.reemplazo ? ["Origen", "Tanda"] : []), "Nombre",
    ...Array.from({ length: config.telefonos }, (_, i) => `Teléfono ${i + 1}`), ...config.estratos.filter((e) => !config.sensibles.includes(e))];
  const cola = ["Responsable", "Status", "Teléfono de la encuesta", "Intentos", "Fecha", config.observacion, ...(config.reemplazo ? REEMPLAZO : [])];
  const cuando = fechaDelEnvio(barrido.actualizado_en);
  const pasos: Paso[] = [
    {
      titulo: "Pestaña de esta campaña construida",
      detalle: barrido.construido ? `"${barrido.pestana ?? "Barrido"}"${cuando ? `, el ${cuando}` : ""}` : "Encabezados, Cod pulso y desplegables de Status",
      hecho: barrido.construido,
    },
    {
      titulo: casos ? `${fmt(config.muestra)} casos y ${fmt(config.backup)} de backup declarados` : "Casos declarados",
      detalle: `Llave ${config.llave}, ${config.telefonos === 1 ? "un teléfono" : `${config.telefonos} teléfonos`} por caso`,
      hecho: casos > 0,
      accion: casos ? undefined : { texto: "Ir a Casos", href: hrefCasos },
    },
    { titulo: "Nombres y teléfonos pegados en el Sheets", detalle: "Desde la base del cliente; la app no los guarda", hecho: null },
    {
      titulo: "Conectado como fuente en Monitoreo",
      detalle: "Así Monitoreo cuenta casos y mide cuotas",
      hecho: barrido.conectado_en_monitoreo,
      accion: barrido.conectado_en_monitoreo ? undefined : { texto: "Ir a Insumos › Fuentes", href: hrefFuentes },
    },
  ];
  const descargar = () => {
    setOcupado(true);
    setError("");
    apiMaterialTelefonicaPlantilla(campaignId)
      .then((r) => descargarArchivo(downloadUrl(r.file_id)))
      .catch((e: unknown) => setError(e instanceof Error ? e.message.replace(/ · E_[A-Z_]+$/, "") : "No se pudo generar la plantilla."))
      .finally(() => setOcupado(false));
  };

  return (
    <div className="rec-tel-barrido" data-qa-geometry-group="material-campo/telefonica/barrido" data-qa-geometry-contract="intrinsic">
      <section className="rec-tel-barrido-principal" aria-labelledby="rec-tel-doc-titulo" data-qa-geometry-member>
        <h2 id="rec-tel-doc-titulo">Documento de los enumeradores</h2>
        {barrido.construido && barrido.url ? (
          <div className="rec-tel-doc">
            <span className="rec-tel-doc-icono" aria-hidden><FileSpreadsheet size={18} /></span>
            <span className="rec-tel-doc-texto">
              <strong>Barrido en el Sheets del estudio</strong>
              <small>Pestaña "{barrido.pestana}", con Listas y Léeme</small>
            </span>
            <PulsoButtonEnlace variant="primary" size="md" href={barrido.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={14} aria-hidden /> Abrir el Sheets
            </PulsoButtonEnlace>
          </div>
        ) : null}
        <BarridoEnSheets campaignId={campaignId} sensibles={config.sensibles} construido={barrido.construido} onHecho={onCambio} />
        <ol className="rec-tel-pasos" aria-label="Pasos del barrido">
          {pasos.map((p, i) => (
            <li key={p.titulo} data-estado={p.hecho === true ? "hecho" : p.hecho === null ? "fuera" : "pendiente"}>
              <span className="rec-tel-paso-num" aria-hidden>{p.hecho ? <Check size={13} /> : i + 1}</span>
              <span className="rec-tel-paso-texto"><strong>{p.titulo}</strong><small>{p.detalle}</small></span>
              {p.accion ? (
                <Link className="pulso-button pulso-button--secondary pulso-button--sm" to={p.accion.href}>{p.accion.texto}</Link>
              ) : p.hecho === null ? (
                <span className="rec-tel-paso-estado">En el Sheets</span>
              ) : p.hecho ? (
                <span className="rec-tel-paso-estado" data-estado="hecho">Listo</span>
              ) : null}
            </li>
          ))}
        </ol>
        <p className="rec-tel-alterno">
          Sin Sheets:{" "}
          <PulsoButton variant="ghost" size="sm" disabled={ocupado} onClick={descargar}>
            {ocupado ? "Generando…" : `Excel del barrido${casos ? ` (${fmt(casos)} filas)` : " (2,000 filas)"}`}
          </PulsoButton>
        </p>
        {error ? <p className="rec-terr-error" role="alert">{error}</p> : null}
      </section>

      <aside className="rec-tel-barrido-lado" aria-label="Columnas de la plantilla" data-qa-geometry-member>
        <h3>Columnas <small>{fmt(identidad.length + cola.length)} en el Sheets</small></h3>
        <div className="rec-tel-barrido-lado-cuerpo" data-qa-geometry-capacity="owned">
          <div className="rec-tel-grupo">
            <span>Identidad <small>la pega el analista</small></span>
            <div className="rec-tel-columnas">{identidad.map((c) => <span key={c} className="rec-tel-col">{c}</span>)}</div>
          </div>
          <div className="rec-tel-grupo">
            <span>Cola <small>la llena quien llama</small></span>
            <div className="rec-tel-columnas">{cola.map((c) => <span key={c} className="rec-tel-col is-campo">{c}</span>)}</div>
          </div>
          {config.sensibles.length ? (
            <div className="rec-tel-grupo">
              <span>Fuera del Sheets <small>datos sensibles</small></span>
              <div className="rec-tel-columnas">{config.sensibles.map((c) => <span key={c} className="rec-tel-col is-sensible">{c}</span>)}</div>
            </div>
          ) : null}
          <div className="rec-tel-grupo rec-tel-reglas">
            <span>Reglas del documento</span>
            <small>No cambiar la fila 1 ni la llave. Status obligatorio con Intentos o Fecha. Filtrar con vistas de filtro.</small>
          </div>
        </div>
      </aside>
    </div>
  );
}
