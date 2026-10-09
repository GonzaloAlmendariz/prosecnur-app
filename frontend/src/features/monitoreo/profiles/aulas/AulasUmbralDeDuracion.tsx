import { Clock } from "../../../../vendor/lucide-react";

/**
 * A partir de cuántos minutos una respuesta es sospechosa.
 *
 * **Se declara al principio, no a mitad de campo.** Gonzalo: «el umbral es menos
 * de 5 minutos, configurable a 8 u otros números, pero **lo ideal es definirlos
 * al principio**». Por eso este control vive en DOS sitios y es el mismo:
 *
 * - en **Fuentes**, junto a «Qué cuenta como encuesta efectiva», que es donde se
 *   declara de qué vale cada respuesta antes de que llegue la primera;
 * - en **Validación**, junto a la distribución de duraciones, porque un umbral
 *   se afina viendo la forma que tiene el dato.
 *
 * El **5 es el defecto declarado**, no un número neutro: es el que Gonzalo fija.
 * Y sigue siendo configurable porque el motor mismo dice que no hay dónde
 * cortar por análisis —medido en `acnur_acg`, <5 min marca el 4,3 % de las
 * respuestas y <7 min el 13,6 %, la cifra se triplica entre cinco y siete—, así
 * que el número lo pone quien conoce el cuestionario.
 */

export const UMBRAL_DE_DURACION_POR_DEFECTO = 5;

export function AulasUmbralDeDuracion({ declarado, minutos, onDeclarar, leyenda }: {
  declarado: boolean;
  minutos: number | null;
  onDeclarar: (minutos: number) => void | Promise<void>;
  /** Se enseña sólo donde no hay otra frase que ya lo diga (Fuentes). */
  leyenda?: string;
}) {
  return (
    <form
      className="aulas-tiempos-umbral"
      onSubmit={(e) => {
        e.preventDefault();
        const dato = new FormData(e.currentTarget).get("minutos");
        const n = Number.parseFloat(String(dato ?? "").replace(",", "."));
        // Cero o negativo no marcaría nada y el motor lo descartaría igual:
        // rechazarlo aquí evita el botón que parece no hacer nada.
        if (Number.isFinite(n) && n > 0) void onDeclarar(n);
      }}
    >
      {leyenda ? (
        <span className="aulas-tiempos-umbral-leyenda">
          <Clock size={13} aria-hidden="true" /> {leyenda}
        </span>
      ) : null}
      <label htmlFor="aulas-umbral-duracion">
        {declarado ? "Cambiar el umbral" : "Marcar como sospechosas las de menos de"}
      </label>
      <input
        id="aulas-umbral-duracion" name="minutos" type="number"
        min={1} step={1} inputMode="numeric"
        // Sin declarar entra ya con el 5: el defecto no se esconde detrás de un
        // campo vacío que obliga a inventar un número.
        defaultValue={declarado && minutos ? String(minutos) : String(UMBRAL_DE_DURACION_POR_DEFECTO)}
      />
      <span className="aulas-tiempos-umbral-unidad">min</span>
      <button type="submit">Declarar</button>
    </form>
  );
}
