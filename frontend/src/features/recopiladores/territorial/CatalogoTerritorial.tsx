// Territorial › Catálogo (ADR 0118 §1): las dos piezas que se imprimen, con los
// mismos motores de Hojas de ruta (layout legacy de E2).
//
// - Ficha por UMP: qué dice cada cara y una prueba sobre una UMP elegida o
//   sobre una manzana al azar (`ficha-ump`, `random-pdf`).
// - Hoja de zona: qué trae y cuántas salen; no tiene vista previa propia en el
//   backend, se genera dentro del ZIP de Paquetes.
//
// Contrato de Superficie: cada pieza es una tarjeta con título y su propio
// vacío (C1/C3); el scroll es del panel de la sección (C4).

import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { downloadUrl } from "../../../api/core";
import { apiHojasRutaFichaUmp, apiHojasRutaRandomPdf, type HojasRutaRandomPreference, type HojasRutaState } from "../../../api/hojasRuta";
import type { UnidadesTerritoriales } from "../../../api/materialTerritorial";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { GlidingRadioGroup } from "../../../components/GlidingRadioGroup";
import { PulsoButton } from "../../../components/PulsoButton";
import { PulsoSelect } from "../../../components/PulsoSelect";
import { conNivel } from "../../../lib/navegacion/direccion";
import { FileText, Loader2, MapPinned, Printer } from "../../../vendor/lucide-react";
import { AvisoDesactualizada, VacioSinFuente } from "./UnidadesTerritoriales";

const PREFERENCIAS = [["balanced", "Balanceado"], ["population", "Alta población"], ["urban", "Urbana compacta"]] as const;

function mensaje(e: unknown, porDefecto: string): string {
  return e instanceof Error ? e.message.replace(/ · E_[A-Z_]+$/, "") : porDefecto;
}

type Props = {
  pestana: "fichas" | "zonas";
  unidades: UnidadesTerritoriales | null;
  hojas: HojasRutaState | null;
};

function FichaPorUmp({ unidades, hojas }: { unidades: UnidadesTerritoriales; hojas: HojasRutaState | null }) {
  const [elegida, setElegida] = useState(unidades.units[0]?.unit_id ?? "");
  const [png, setPng] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<"" | "png" | "pdf" | "azar">("");
  const [error, setError] = useState("");
  const [preferencia, setPreferencia] = useState<HojasRutaRandomPreference>("balanced");
  const [azar, setAzar] = useState<string | null>(null);

  const correr = (tipo: "png" | "pdf" | "azar", f: () => Promise<void>) => {
    setOcupado(tipo);
    setError("");
    f().catch((e: unknown) => setError(mensaje(e, "No se pudo generar la prueba."))).finally(() => setOcupado(""));
  };
  const verPng = () => correr("png", async () => {
    const r = await apiHojasRutaFichaUmp(elegida, "png");
    setPng(r.formato === "png" ? downloadUrl(r.file_id) : null);
    if (r.formato === "pdf") window.open(downloadUrl(r.file_id), "_blank", "noopener,noreferrer");
  });
  const abrirPdf = () => correr("pdf", async () => {
    const r = await apiHojasRutaFichaUmp(elegida, "pdf");
    window.open(downloadUrl(r.file_id), "_blank", "noopener,noreferrer");
  });
  const alAzar = () => correr("azar", async () => {
    if (!hojas) return;
    const r = await apiHojasRutaRandomPdf(hojas.integrated_config, preferencia);
    setAzar(`${r.distrito} · zona ${r.zona} · manzana ${r.manzana}`);
    window.open(downloadUrl(r.file_id), "_blank", "noopener,noreferrer");
  });

  return (
    <>
      <article className="rec-terr-tarjeta" data-qa-geometry-member>
        <h3><FileText size={15} aria-hidden /> Ficha por UMP</h3>
        <p className="rec-terr-nota">
          Una ficha por titular y por reemplazo, en blanco y negro. La cara 1 lleva los datos de la UMP, la cuota de la hoja
          (sexo por edad, con los totales a cumplir) y cómo se eligen las casas: esquina de entrada, sentido y salto. La cara 2,
          el mapa de la manzana con sus calles y sus aledañas por si se agota.
        </p>
        <div className="rec-terr-fila">
          <div className="rec-terr-campo">
            <span aria-hidden>UMP</span>
            <PulsoSelect
              size="sm"
              ariaLabel="UMP para la prueba"
              value={elegida || undefined}
              onValueChange={(v) => { setElegida(v); setPng(null); }}
              options={unidades.units.map((u) => ({
                value: u.unit_id,
                label: `${u.label} · ${u.distrito}${u.zona ? ` · zona ${u.zona}` : ""}`,
              }))}
            />
          </div>
          <PulsoButton variant="secondary" size="sm" disabled={!elegida || ocupado !== "" || unidades.stale} onClick={verPng}>
            {ocupado === "png" ? <Loader2 size={14} className="pulso-spin" aria-hidden /> : null} Ver la ficha
          </PulsoButton>
          <PulsoButton variant="primary" size="sm" disabled={!elegida || ocupado !== "" || unidades.stale} onClick={abrirPdf}>
            <Printer size={14} aria-hidden /> {ocupado === "pdf" ? "Generando…" : "Abrir el PDF"}
          </PulsoButton>
        </div>
        {ocupado === "png" ? <p className="rec-terr-nota">Generando la ficha… tarda unos segundos por el mapa.</p> : null}
        {png ? <img className="rec-terr-hoja-img" src={png} alt="Vista previa de la ficha de la UMP elegida" /> : null}
      </article>

      <article className="rec-terr-tarjeta" data-qa-geometry-member>
        <h3><Printer size={15} aria-hidden /> PDF de prueba</h3>
        <p className="rec-terr-nota">Una ficha de una manzana al azar del marco, para revisar el formato antes de imprimir el paquete.</p>
        <GlidingRadioGroup
          value={preferencia}
          options={PREFERENCIAS}
          getOptionValue={(o) => o[0]}
          onValueChange={setPreferencia}
          className="rec-terr-opciones"
          aria-label="Qué manzana sortear para la prueba"
          getOptionProps={() => ({ disabled: ocupado !== "" })}
        >
          {(o) => <span>{o[1]}</span>}
        </GlidingRadioGroup>
        <div className="rec-terr-fila">
          <PulsoButton variant="secondary" size="sm" disabled={!hojas || ocupado !== "" || unidades.stale} onClick={alAzar}>
            {ocupado === "azar" ? "Generando…" : "Abrir un PDF de prueba"}
          </PulsoButton>
          {azar ? <span className="rec-terr-nota">Última: {azar}</span> : null}
        </div>
      </article>
      {error ? <p className="rec-terr-error" role="alert">{error}</p> : null}
    </>
  );
}

function HojaDeZona({ unidades }: { unidades: UnidadesTerritoriales }) {
  const location = useLocation();
  const zonas = useMemo(() => new Set(unidades.units.map((u) => `${u.ubigeo}|${u.zona}`)).size, [unidades]);
  const aPaquetes = `${location.pathname}${conNivel(conNivel(location.search, "seccion", "paquetes"), "pestana", "armado")}`;
  return (
    <article className="rec-terr-tarjeta" data-qa-geometry-member>
      <h3><MapPinned size={15} aria-hidden /> Hoja de zona</h3>
      <p className="rec-terr-nota">
        Una página apaisada por zona con todas sus rutas sobre el mismo mapa de la cara 2: titulares rellenas y numeradas,
        reemplazos con borde discontinuo e insignia «R», y al lado el resumen y la tabla de rutas.
      </p>
      <dl className="rec-terr-cifras">
        <div><dt>Hojas de zona</dt><dd>{zonas.toLocaleString("es-PE")}</dd></div>
        <div><dt>UMP en ellas</dt><dd>{unidades.units.length.toLocaleString("es-PE")}</dd></div>
      </dl>
      <p className="rec-terr-nota">
        No tiene vista previa suelta: sale dentro del ZIP del paquete. <Link to={aPaquetes}>Ir a Paquetes</Link>
      </p>
    </article>
  );
}

export function CatalogoTerritorial({ pestana, unidades, hojas }: Props) {
  if (!unidades) {
    return (
      <div className="rec-terr-seccion" data-qa-geometry-capacity="owned">
        <VacioSinFuente mensaje={null} />
      </div>
    );
  }
  return (
    <div className="rec-terr-seccion">
      {unidades.stale ? <AvisoDesactualizada enviadoAt={unidades.enviado_at} /> : null}
      <div className="rec-terr-tarjetas" data-qa-geometry-group={`material-campo/territorial/catalogo-${pestana}`} data-qa-geometry-contract="intrinsic">
        {pestana === "fichas" ? (
          unidades.units.length ? <FichaPorUmp unidades={unidades} hojas={hojas} /> : (
            <EstadoVacio icono={<FileText size={18} />} titulo="La muestra enviada no trae UMP" descripcion="Vuelve a enviarla desde Hojas de ruta." />
          )
        ) : <HojaDeZona unidades={unidades} />}
      </div>
    </div>
  );
}
