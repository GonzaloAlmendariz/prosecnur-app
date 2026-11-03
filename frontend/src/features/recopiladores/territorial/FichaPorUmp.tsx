// Territorial › Catálogo › Fichas (revamp v5): el escenario muestra la ficha a tamaño
// legible y el panel lateral las acciones. Mientras no se genera la vista real (PNG del
// motor, tarda por el mapa), el escenario dibuja la estructura de la ficha de la UMP
// elegida (`MaquetaFicha`), rotulada como tal. El PDF de prueba de una manzana al azar es
// un bloque secundario al pie del panel.
//
// Contrato de Superficie: C1 `material-campo/territorial/ficha` (intrinsic); el escenario
// es dueño de su alto y de su scroll (C3/C4).

import { useState } from "react";

import { downloadUrl } from "../../../api/core";
import { apiHojasRutaFichaUmp, apiHojasRutaRandomPdf, type HojasRutaRandomPreference, type HojasRutaState } from "../../../api/hojasRuta";
import type { UnidadesTerritoriales } from "../../../api/materialTerritorial";
import { GlidingRadioGroup } from "../../../components/GlidingRadioGroup";
import { PulsoButton } from "../../../components/PulsoButton";
import { PulsoSelect } from "../../../components/PulsoSelect";
import { Loader2, Printer } from "../../../vendor/lucide-react";
import { MaquetaFicha } from "./MaquetaFicha";
import "./ficha.css";

// Rótulo corto para que el segmentado quepa en el panel; el nombre completo va en el `title`.
const PREFERENCIAS = [["balanced", "Balanceada", "Manzana balanceada"], ["population", "Poblada", "Manzana de alta población"], ["urban", "Compacta", "Manzana urbana compacta"]] as const;

function mensaje(e: unknown, porDefecto: string): string {
  return e instanceof Error ? e.message.replace(/ · E_[A-Z_]+$/, "") : porDefecto;
}

export function FichaPorUmp({ unidades, hojas }: { unidades: UnidadesTerritoriales; hojas: HojasRutaState | null }) {
  const [elegida, setElegida] = useState(unidades.units[0]?.unit_id ?? "");
  const [png, setPng] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<"" | "png" | "pdf" | "azar">("");
  const [error, setError] = useState("");
  const [preferencia, setPreferencia] = useState<HojasRutaRandomPreference>("balanced");
  const [azar, setAzar] = useState<string | null>(null);
  const unidad = unidades.units.find((u) => u.unit_id === elegida) ?? unidades.units[0] ?? null;

  const correr = (tipo: "png" | "pdf" | "azar", f: () => Promise<void>) => {
    setOcupado(tipo);
    setError("");
    f().catch((e: unknown) => setError(mensaje(e, "No se pudo generar la ficha."))).finally(() => setOcupado(""));
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
    setAzar(`${r.distrito}, zona ${r.zona}, manzana ${r.manzana}`);
    window.open(downloadUrl(r.file_id), "_blank", "noopener,noreferrer");
  });

  return (
    <div className="rec-terr-ficha" data-qa-geometry-member data-qa-geometry-group="material-campo/territorial/ficha" data-qa-geometry-contract="intrinsic">
      <figure className="rec-terr-ficha-escenario" data-qa-geometry-capacity="owned" aria-busy={ocupado === "png"}>
        {png ? (
          <img src={png} alt={`Ficha de ${unidad?.label ?? "la UMP"}`} />
        ) : unidad ? (
          <MaquetaFicha unidad={unidad} />
        ) : null}
        <figcaption>{unidad ? `${unidad.label}, ${png ? "ficha generada" : "estructura de la ficha"}` : ""}</figcaption>
      </figure>

      <aside className="rec-terr-ficha-panel" aria-labelledby="rec-terr-ficha-titulo">
        <div>
          <h2 id="rec-terr-ficha-titulo">Ficha por UMP</h2>
          <p className="rec-terr-nota">A4 en blanco y negro, dos caras, una por titular y por reemplazo</p>
        </div>
        <div className="rec-terr-campo">
          <span aria-hidden>UMP</span>
          <PulsoSelect
            size="sm"
            ariaLabel="UMP de la ficha"
            value={elegida || undefined}
            onValueChange={(v) => { setElegida(v); setPng(null); }}
            options={unidades.units.map((u) => ({
              value: u.unit_id,
              label: `${u.label}, ${u.distrito}${u.zona ? `, zona ${u.zona}` : ""}`,
            }))}
          />
        </div>
        <div className="rec-terr-ficha-acciones">
          <PulsoButton variant="primary" disabled={!elegida || ocupado !== "" || unidades.stale} onClick={abrirPdf}>
            <Printer size={14} aria-hidden /> {ocupado === "pdf" ? "Generando…" : "Abrir el PDF"}
          </PulsoButton>
          <PulsoButton variant="secondary" disabled={!elegida || ocupado !== "" || unidades.stale || Boolean(png)} onClick={verPng}>
            {ocupado === "png" ? <Loader2 size={14} className="pulso-spin" aria-hidden /> : null} {ocupado === "png" ? "Generando la vista…" : "Ver la ficha real"}
          </PulsoButton>
        </div>
        {error ? <p className="rec-terr-error" role="alert">{error}</p> : null}

        <section className="rec-terr-ficha-prueba" aria-labelledby="rec-terr-prueba-titulo">
          <h3 id="rec-terr-prueba-titulo">PDF de prueba</h3>
          <p className="rec-terr-nota">Una manzana al azar del marco, para revisar el formato antes de imprimir</p>
          <GlidingRadioGroup
            value={preferencia}
            options={PREFERENCIAS}
            getOptionValue={(o) => o[0]}
            onValueChange={setPreferencia}
            className="rec-terr-opciones"
            aria-label="Qué manzana sortear para la prueba"
            getOptionProps={(o) => ({ disabled: ocupado !== "", title: o[2] })}
          >
            {(o) => <span>{o[1]}</span>}
          </GlidingRadioGroup>
          <PulsoButton variant="secondary" size="sm" disabled={!hojas || ocupado !== "" || unidades.stale} onClick={alAzar}>
            {ocupado === "azar" ? "Generando…" : "Abrir un PDF de prueba"}
          </PulsoButton>
          {azar ? <span className="rec-terr-nota">Última: {azar}</span> : null}
        </section>
      </aside>
    </div>
  );
}
