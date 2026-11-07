// Territorial › Unidades en un estudio por cuotas (ADR 0125 §2): Hojas de ruta envió ZONAS con su N y su
// cuota por sexo y edad, no UMP. La lista es una tabla de zonas con la cuota resumida por sexo, y cada zona
// abre su hoja de conteo (o todas a la vez).
//
// Contrato de Superficie:
// - C1: `material-campo/territorial/zonas`, una tabla del kit con las zonas del envío.
// - C3: un envío sin zonas tiene su propio vacío (el de la tabla).
// - C4: el scroll es del panel de la sección; la tabla no fija alto propio.

import { useState } from "react";

import { downloadUrl } from "../../../api/core";
import { descargarArchivo } from "../../../lib/descargas";
import { apiMaterialTerritorialPapel, type UnidadesTerritoriales, type ZonaDeCuotas } from "../../../api/materialTerritorial";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { PulsoButton } from "../../../components/PulsoButton";
import { PulsoTable, type PulsoTableColumna } from "../../../components/PulsoTable";
import { ROTULO_DE_FASE } from "../campanas/modeloRegistro";
import { MapPinned, Printer } from "../../../vendor/lucide-react";
import { AvisoDesactualizada } from "./UnidadesTerritoriales";
import { fechaDelEnvio } from "./modeloUnidades";

/** «Hombre 34, Mujer 38»: la cuota de la zona sumada por sexo, en el orden en que llega. */
export function cuotaPorSexo(zona: Pick<ZonaDeCuotas, "cuotas">): string {
  const suma = new Map<string, number>();
  for (const c of zona.cuotas) suma.set(c.sexo, (suma.get(c.sexo) ?? 0) + c.n);
  return [...suma].map(([sexo, n]) => `${sexo} ${n.toLocaleString("es-PE")}`).join(", ");
}

type Props = { campaignId: string; unidades: UnidadesTerritoriales };

export function ZonasDeCuotas({ campaignId, unidades }: Props) {
  const [ocupado, setOcupado] = useState<string>("");
  const [error, setError] = useState("");
  const imprimir = (unidad?: string) => {
    setOcupado(unidad ?? "__todas");
    setError("");
    apiMaterialTerritorialPapel(campaignId, "conteo", unidad ? { unidad } : { alcance: "todas" })
      .then((r) => descargarArchivo(downloadUrl(r.file_id)))
      .catch((e: unknown) => setError(e instanceof Error ? e.message.replace(/ · E_[A-Z_]+$/, "") : "No se pudo generar la hoja."))
      .finally(() => setOcupado(""));
  };
  const columnas: PulsoTableColumna<ZonaDeCuotas>[] = [
    { id: "zona", encabezado: "Zona", ancho: 220, celda: (z) => <strong>{z.nombre}</strong>, valor: (z) => z.nombre },
    { id: "codigo", encabezado: "Código", ancho: 100, celda: (z) => z.id_zona, valor: (z) => z.id_zona },
    { id: "n", encabezado: "Entrevistas", ancho: 110, tipo: "cifra", celda: (z) => z.n.toLocaleString("es-PE"), valor: (z) => z.n },
    { id: "cuota", encabezado: "Cuota por sexo", ancho: 200, celda: (z) => cuotaPorSexo(z) || "—" },
    { id: "celdas", encabezado: "Celdas", ancho: 80, tipo: "cifra", celda: (z) => z.cuotas.length },
    { id: "hoja", encabezado: "Hoja de conteo", ancho: 140, celda: (z) => (
      <PulsoButton variant="ghost" size="sm" disabled={ocupado !== "" || unidades.stale} onClick={() => imprimir(z.id_zona)} aria-label={`Hoja de conteo de ${z.nombre}`}>
        <Printer size={13} aria-hidden /> {ocupado === z.id_zona ? "Generando…" : "Abrir"}
      </PulsoButton>
    ) },
  ];

  const cuando = fechaDelEnvio(unidades.enviado_at);
  return (
    <div className="rec-terr-seccion">
      {unidades.stale ? <AvisoDesactualizada enviadoAt={unidades.enviado_at} /> : null}
      <header className="rec-terr-cabeza">
        <span>
          <h2>Zonas de la muestra por cuotas</h2>
          <p>
            {unidades.n_zonas.toLocaleString("es-PE")} {unidades.n_zonas === 1 ? "zona" : "zonas"} y {unidades.n_entrevistas.toLocaleString("es-PE")} entrevistas
            {`, ${ROTULO_DE_FASE[unidades.fase].toLocaleLowerCase("es-PE")}`}
            {cuando ? `, enviada el ${cuando}` : ""}
          </p>
        </span>
        <PulsoButton variant="secondary" size="sm" disabled={!unidades.zonas.length || ocupado !== "" || unidades.stale} onClick={() => imprimir()}>
          <Printer size={14} aria-hidden /> {ocupado === "__todas" ? "Generando…" : "Hojas de conteo de todas"}
        </PulsoButton>
      </header>
      <div data-qa-geometry-group="material-campo/territorial/zonas" data-qa-geometry-contract="intrinsic" data-qa-geometry-capacity="owned">
        <PulsoTable
          columnas={columnas}
          filas={unidades.zonas}
          idDeFila={(z) => z.id_zona}
          ariaLabel="Zonas de la muestra"
          densidad="compacta"
          altoMaximo={100000}
          vacio={<EstadoVacio icono={<MapPinned size={18} />} titulo="El envío no trae zonas" descripcion="Vuelve a enviarlo desde Hojas de ruta con los distritos y el N fijados." />}
        />
      </div>
      {error ? <p className="rec-terr-error" role="alert">{error}</p> : null}
    </div>
  );
}
