// Territorial › Unidades en un estudio por cuotas (ADR 0125 §2): Hojas de ruta envió ZONAS con su N y su
// cuota por sexo y edad, no UMP. La lista es una tabla de zonas con la cuota resumida por sexo, y cada zona
// genera su hoja de conteo (o todas a la vez). La espera y el archivo van en el contenedor del kit de
// entregables (ADR 0133): en la fila para una zona, bajo la cabecera para todas.
//
// Contrato de Superficie:
// - C1: `material-campo/territorial/zonas`, una tabla del kit con las zonas del envío.
// - C3: un envío sin zonas tiene su propio vacío (el de la tabla).
// - C4: el scroll es del panel de la sección; la tabla no fija alto propio.

import { apiMaterialTerritorialPapel, type UnidadesTerritoriales, type ZonaDeCuotas } from "../../../api/materialTerritorial";
import { ContenedorEntregable } from "../../../components/entregables/ContenedorEntregable";
import { useGeneracion } from "../../../components/entregables/useGeneracion";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { PulsoButton } from "../../../components/PulsoButton";
import { PulsoTable, type PulsoTableColumna } from "../../../components/PulsoTable";
import { ROTULO_DE_FASE } from "../campanas/modeloRegistro";
import { MapPinned, Printer } from "../../../vendor/lucide-react";
import { AvisoDesactualizada } from "./UnidadesTerritoriales";
import { fechaDelEnvio } from "./modeloUnidades";
import { GenerarEnFila } from "../entregas/GenerarEnFila";
import { MODULO_MATERIAL } from "../entregas/modeloEntrega";

/** «Hombre 34, Mujer 38»: la cuota de la zona sumada por sexo, en el orden en que llega. */
export function cuotaPorSexo(zona: Pick<ZonaDeCuotas, "cuotas">): string {
  const suma = new Map<string, number>();
  for (const c of zona.cuotas) suma.set(c.sexo, (suma.get(c.sexo) ?? 0) + c.n);
  return [...suma].map(([sexo, n]) => `${sexo} ${n.toLocaleString("es-PE")}`).join(", ");
}

type Props = { campaignId: string; unidades: UnidadesTerritoriales };

export function ZonasDeCuotas({ campaignId, unidades }: Props) {
  const todas = useGeneracion({ titulo: "Hojas de conteo de todas las zonas", modulo: MODULO_MATERIAL, formato: "pdf", articulo: "las" });
  const generandoTodas = todas.estado.fase === "en_curso";
  const columnas: PulsoTableColumna<ZonaDeCuotas>[] = [
    { id: "zona", encabezado: "Zona", ancho: 220, celda: (z) => <strong>{z.nombre}</strong>, valor: (z) => z.nombre },
    { id: "codigo", encabezado: "Código", ancho: 100, celda: (z) => z.id_zona, valor: (z) => z.id_zona },
    { id: "n", encabezado: "Entrevistas", ancho: 110, tipo: "cifra", celda: (z) => z.n.toLocaleString("es-PE"), valor: (z) => z.n },
    { id: "cuota", encabezado: "Cuota por sexo", ancho: 200, celda: (z) => cuotaPorSexo(z) || "—" },
    { id: "celdas", encabezado: "Celdas", ancho: 80, tipo: "cifra", celda: (z) => z.cuotas.length },
    { id: "hoja", encabezado: "Hoja de conteo", ancho: 200, celda: (z) => (
      <GenerarEnFila
        titulo={`Hoja de conteo de ${z.nombre}`}
        formato="pdf"
        articulo="la"
        ariaLabel={`Hoja de conteo de ${z.nombre}`}
        disabled={unidades.stale}
        generar={() => apiMaterialTerritorialPapel(campaignId, "conteo", { unidad: z.id_zona })}
      >
        <Printer size={13} aria-hidden /> Generar
      </GenerarEnFila>
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
        <PulsoButton
          variant="secondary"
          size="sm"
          disabled={!unidades.zonas.length || generandoTodas || unidades.stale}
          onClick={() => { void todas.ejecutar(() => apiMaterialTerritorialPapel(campaignId, "conteo", { alcance: "todas" })); }}
        >
          <Printer size={14} aria-hidden /> Hojas de conteo de todas
        </PulsoButton>
      </header>
      <ContenedorEntregable estado={todas.estado} forma="bloque" onCerrar={todas.cerrar} />
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
    </div>
  );
}
