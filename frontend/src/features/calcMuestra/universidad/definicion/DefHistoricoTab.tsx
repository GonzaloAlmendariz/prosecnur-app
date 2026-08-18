/**
 * Pestaña «Histórico» (sección Datos): qué dejó el estudio que ya se aplicó.
 *
 * G42 · Gonzalo: «falta la pestaña para agregar la base de monitoreo del año
 * pasado para tenerlo como histórico».
 *
 * G44 · Segunda pasada. La primera versión ponía aquí la carga del archivo, y
 * eso estaba mal por partida doble: la base histórica ya se sube en Fuentes
 * —donde se suben todas—, y repetir el uploader hacía que esta pestaña se
 * leyera como un trámite. Gonzalo: «lo que tenemos que ver en histórico es toda
 * la información rica que hemos recolectado, de forma elegante, gráfica,
 * visual, que es como se caracteriza todo este módulo».
 *
 * Entonces esta pestaña no carga nada: **lee**. Muestra el estudio previo como
 * lo que es —un diseño que se decidió y un campo que ocurrió— para que quien
 * dimensiona el estudio nuevo sepa de dónde sale cada tasa que va a heredar.
 *
 * No entra al marco vigente ni cambia el número de cursos-horario a
 * seleccionar; sólo transfiere tasas agregadas de un estudio anterior.
 */
import type {
  CalcMuestraAulasState,
  CalcMuestraReferenciaAsistencia,
} from "../../../../api/client";
import { AvisoModulo } from "../shared/AvisoModulo";
import { HistoricoEstudioPanel } from "./HistoricoEstudioPanel";
import { RankingDesempenoCard } from "./RankingDesempenoCard";

export function DefHistoricoTab({
  aulasState,
  referencia,
}: {
  aulasState: CalcMuestraAulasState | null;
  referencia: CalcMuestraReferenciaAsistencia | null;
}) {
  const marcoConstruido = Boolean(aulasState?.frame);

  return (
    <section
      className="cmv2-definition-stack"
      data-audit-ready={referencia ? "true" : "false"}
      data-qa-geometry-group="calc-muestra/definicion-historico"
      data-qa-geometry-contract="intrinsic"
      aria-label="Base histórica de referencia"
    >
      {referencia ? <HistoricoEstudioPanel referencia={referencia} /> : null}
      {/* I15 · El ranking va como HERMANO del panel, no dentro: ese archivo
          tiene 1.663 líneas y no crece. El join de tipo/ciclo lee el marco
          vigente, que esta pestaña ya recibe. */}
      {referencia ? (
        <RankingDesempenoCard
          referencia={referencia}
          aulaFrame={aulasState?.frame?.aula_frame ?? null}
        />
      ) : null}
      {!referencia ? (
        // C3: sin base cargada la pestaña dice dónde se carga, en vez de
        // ofrecer un segundo uploader que compita con Fuentes.
        <AvisoModulo tone="info" role="status" compact>
          {marcoConstruido
            ? "Sube la base del estudio anterior en Fuentes y su lectura aparecerá aquí."
            : "Puedes declararla ahora o más tarde: se sube en Fuentes, el marco se construye sin ella y al cargarla se calibra sobre el marco vigente."}
        </AvisoModulo>
      ) : null}
    </section>
  );
}
