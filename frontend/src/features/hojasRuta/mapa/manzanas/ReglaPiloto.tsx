import type { HojasRutaPilotExclusionMode } from "../../../../api/hojasRuta";
import { GlidingRadioGroup } from "../../../../components/GlidingRadioGroup";
import { reglaPilotoDesfasada } from "./desfasePiloto";

type Props = {
  modo: HojasRutaPilotExclusionMode;
  /** Titulares que sorteó el piloto. */
  titularesPiloto: number;
  /** Exclusiones con que se sorteó la muestra vigente; null sin muestra. */
  excluidasEnLaMuestra: number | null;
  deshabilitado: boolean;
  onCambiar: (modo: HojasRutaPilotExclusionMode) => void;
};

const OPCIONES: { id: HojasRutaPilotExclusionMode; titulo: string; cuerpo: string }[] = [
  { id: "exclude_titulars", titulo: "Evita las del piloto", cuerpo: "Campo real no vuelve a sortear las manzanas titulares del piloto." },
  { id: "ignore", titulo: "No las evita", cuerpo: "Las titulares del piloto pueden volver a salir en campo." },
];

/**
 * P2 de la paridad con la página clásica: en Campo real, si el sorteo evita las manzanas
 * titulares que ya usó el piloto. La regla vive en la corrida de campo y se aplica en el
 * servidor al sortear; cambiarla no borra la muestra vigente, pero avisa si se sorteó con la otra.
 */
export function ReglaPiloto({ modo, titularesPiloto, excluidasEnLaMuestra, deshabilitado, onCambiar }: Props) {
  const desfasada = reglaPilotoDesfasada(modo, titularesPiloto, excluidasEnLaMuestra);
  return (
    <section className="hr-muestra-grupo" aria-label="Regla del piloto">
      <h3>Piloto</h3>
      <GlidingRadioGroup
        value={modo}
        options={OPCIONES}
        getOptionValue={(o) => o.id}
        onValueChange={onCambiar}
        aria-label="Regla para usar la corrida piloto en Campo real"
        getOptionProps={() => ({ disabled: deshabilitado })}
      >
        {(o) => (
          <>
            <strong>{o.titulo}</strong>
            <small>{o.cuerpo}</small>
          </>
        )}
      </GlidingRadioGroup>
      <p className="hr-mapa-nota">
        El piloto sorteó {titularesPiloto.toLocaleString("es-PE")} {titularesPiloto === 1 ? "titular" : "titulares"}.
        {modo === "exclude_titulars" ? " En el mapa se ven en gris, con trazo cortado." : ""}
      </p>
      {desfasada ? (
        <p className="hr-mapa-aviso" role="status">
          La muestra vigente se sorteó con la otra regla: sortea de nuevo para aplicar esta.
        </p>
      ) : null}
    </section>
  );
}
