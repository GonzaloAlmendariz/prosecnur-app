// Territorial › Catálogo › Fichas (revamp v5): el escenario muestra la ficha a tamaño
// legible y el panel lateral las acciones. Mientras no se genera la vista real (PNG del
// motor, tarda por el mapa), el escenario dibuja la estructura de la ficha de la UMP
// elegida (`MaquetaFicha`), rotulada como tal. El PDF de prueba de una manzana al azar es
// un bloque secundario al pie del panel. Los dos PDF se entregan por el kit de entregables
// (ADR 0133): el botón sólo se deshabilita y el contenedor queda bajo él.
//
// Contrato de Superficie: C1 `material-campo/territorial/ficha` (intrinsic); el escenario
// es dueño de su alto y de su scroll (C3/C4).

import { useState } from "react";

import { urlDelArchivo } from "../../../api/core";
import { apiHojasRutaFichaUmp, apiHojasRutaRandomPdf, type HojasRutaRandomPreference, type HojasRutaState } from "../../../api/hojasRuta";
import type { UnidadesTerritoriales } from "../../../api/materialTerritorial";
import { ContenedorEntregable } from "../../../components/entregables/ContenedorEntregable";
import { useGeneracion } from "../../../components/entregables/useGeneracion";
import { GlidingRadioGroup } from "../../../components/GlidingRadioGroup";
import { PulsoButton } from "../../../components/PulsoButton";
import { PulsoSelect } from "../../../components/PulsoSelect";
import { Loader2, Printer } from "../../../vendor/lucide-react";
import { MODULO_MATERIAL } from "../entregas/modeloEntrega";
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
  // La vista real (PNG) se ve en el escenario: no es un entregable.
  const [cargandoVista, setCargandoVista] = useState(false);
  const [error, setError] = useState("");
  const [preferencia, setPreferencia] = useState<HojasRutaRandomPreference>("balanced");
  const [azar, setAzar] = useState<string | null>(null);
  const unidad = unidades.units.find((u) => u.unit_id === elegida) ?? unidades.units[0] ?? null;
  const pdf = useGeneracion({ titulo: "Ficha de la UMP", modulo: MODULO_MATERIAL, formato: "pdf", articulo: "la" });
  const prueba = useGeneracion({ titulo: "PDF de prueba", modulo: MODULO_MATERIAL, formato: "pdf", articulo: "el" });
  const generandoPdf = pdf.estado.fase === "en_curso";
  const generandoPrueba = prueba.estado.fase === "en_curso";
  const tituloFicha = `Ficha de ${unidad?.label ?? "la UMP"}`;

  const verPng = () => {
    setCargandoVista(true);
    setError("");
    apiHojasRutaFichaUmp(elegida, "png")
      .then((r) => {
        if (r.formato === "png") setPng(urlDelArchivo(r.file_id));
        // Sin imagen, la vista llega en PDF: se entrega como la ficha.
        else void pdf.ejecutar(async () => r, { titulo: tituloFicha });
      })
      .catch((e: unknown) => setError(mensaje(e, "No se pudo generar la ficha.")))
      .finally(() => setCargandoVista(false));
  };
  const generarPdf = () => { void pdf.ejecutar(() => apiHojasRutaFichaUmp(elegida, "pdf"), { titulo: tituloFicha }); };
  const generarPrueba = () => {
    if (!hojas) return;
    void prueba.ejecutar(async () => {
      const r = await apiHojasRutaRandomPdf(hojas.integrated_config, preferencia);
      setAzar(`${r.distrito}, zona ${r.zona}, manzana ${r.manzana}`);
      return r;
    });
  };

  return (
    <div className="rec-terr-ficha" data-qa-geometry-member data-qa-geometry-group="material-campo/territorial/ficha" data-qa-geometry-contract="intrinsic">
      <figure className="rec-terr-ficha-escenario" data-qa-geometry-capacity="owned" aria-busy={cargandoVista}>
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
          <PulsoButton variant="primary" disabled={!elegida || generandoPdf || cargandoVista || unidades.stale} onClick={generarPdf}>
            <Printer size={14} aria-hidden /> Generar el PDF
          </PulsoButton>
          <PulsoButton variant="secondary" disabled={!elegida || generandoPdf || cargandoVista || unidades.stale || Boolean(png)} onClick={verPng}>
            {cargandoVista ? <Loader2 size={14} className="pulso-spin" aria-hidden /> : null} {cargandoVista ? "Generando la vista…" : "Ver la ficha real"}
          </PulsoButton>
        </div>
        <ContenedorEntregable estado={pdf.estado} forma="bloque" onCerrar={pdf.cerrar} />
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
            getOptionProps={(o) => ({ disabled: generandoPrueba, title: o[2] })}
          >
            {(o) => <span>{o[1]}</span>}
          </GlidingRadioGroup>
          <PulsoButton variant="secondary" size="sm" disabled={!hojas || generandoPrueba || unidades.stale} onClick={generarPrueba}>
            Generar un PDF de prueba
          </PulsoButton>
          <ContenedorEntregable estado={prueba.estado} forma="bloque" onCerrar={prueba.cerrar} />
          {azar ? <span className="rec-terr-nota">Última: {azar}</span> : null}
        </section>
      </aside>
    </div>
  );
}
