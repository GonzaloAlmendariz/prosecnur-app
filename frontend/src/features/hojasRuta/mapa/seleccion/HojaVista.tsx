import { useEffect, useState } from "react";
import { PulsoButton } from "../../../../components/PulsoButton";
import { downloadUrl } from "../../../../api/core";
import { Printer } from "../../../../vendor/lucide-react";
import { apiHojasRutaFichaUmp } from "../../../../api/hojasRuta";

/**
 * Vista previa de la hoja de ruta de una UMP (U15), dentro de su ficha. La dirección
 * ya es `?seccion=seleccion&foco=<id_manzana>`: no se declara un `?panel=hoja` propio
 * mientras la página clásica sea la de por defecto (el QA recorre los paneles
 * declarados sobre ella; ADR 0114 §3, enmienda de U17). Generarla tarda unos segundos.
 */
export function HojaVista({ idManzana }: { idManzana: string }) {
  const [abierta, setAbierta] = useState(false);
  const [png, setPng] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [pdf, setPdf] = useState<string | null>(null);
  // Cambiar de UMP descarta la vista anterior.
  useEffect(() => {
    setAbierta(false);
    setPng(null);
    setPdf(null);
    setError("");
  }, [idManzana]);
  const ver = () => {
    setAbierta(true);
    setCargando(true);
    setError("");
    apiHojasRutaFichaUmp(idManzana, "png")
      .then((r) => (r.formato === "png" ? setPng(downloadUrl(r.file_id)) : setPdf(downloadUrl(r.file_id))))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "No se pudo generar la hoja"))
      .finally(() => setCargando(false));
  };
  // B46: el PDF se abre en una pestaña propia, donde se lee a tamaño real y se imprime con el
  // visor del navegador. (El modal del artefacto espera decisión: ADR 0114 §3, enmienda U17.)
  const abrirPdf = () => {
    if (pdf) {
      window.open(pdf, "_blank", "noopener,noreferrer");
      return;
    }
    apiHojasRutaFichaUmp(idManzana, "pdf")
      .then((r) => {
        setPdf(downloadUrl(r.file_id));
        window.open(downloadUrl(r.file_id), "_blank", "noopener,noreferrer");
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "No se pudo generar el PDF"));
  };
  if (!abierta) {
    return (
      <PulsoButton variant="secondary" size="sm" onClick={ver}>
        Ver la hoja de ruta
      </PulsoButton>
    );
  }
  return (
    <section className="hr-muestra-grupo hr-hoja-vista" aria-label="Hoja de ruta">
      <h3>Hoja de ruta</h3>
      {cargando ? <p className="hr-mapa-nota">Generando la hoja… tarda unos segundos por el mapa.</p> : null}
      {error ? <p className="hr-mapa-aviso">{error}</p> : null}
      {png ? (
        <a href={png} target="_blank" rel="noopener noreferrer" className="hr-hoja-img" title="Ver la hoja en grande">
          <img src={png} alt="Vista previa de la hoja de ruta de esta UMP" />
        </a>
      ) : null}
      {png ? <p className="hr-mapa-nota">Toca la hoja para verla en grande.</p> : null}
      <div className="hr-mapa-acciones">
        <PulsoButton variant="primary" size="sm" disabled={cargando} onClick={abrirPdf}>
          <Printer size={13} aria-hidden /> Imprimir o descargar
        </PulsoButton>
        <PulsoButton variant="secondary" size="sm" onClick={() => setAbierta(false)}>
          Cerrar
        </PulsoButton>
      </div>
    </section>
  );
}
