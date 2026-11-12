/**
 * Campo de una meta en la tabla de propuestas: se lee como cifra de la tabla (con separador de miles, sin borde) y
 * se edita al enfocarlo. `type="number"` no admite separador, por eso es texto con teclado numérico.
 */
import { useState } from "react";

const cifra = new Intl.NumberFormat("en-US");

export function CampoMeta({ valor, etiqueta, excede, titulo, onChange, onFocus }: {
  valor: number;
  etiqueta: string;
  /** La meta exige más respuesta que la esperada del actor. */
  excede: boolean;
  titulo?: string;
  onChange: (valor: number) => void;
  onFocus?: () => void;
}) {
  const [borrador, setBorrador] = useState<string | null>(null);
  return (
    <input
      className="cmg-campo-meta"
      type="text"
      inputMode="numeric"
      aria-label={etiqueta}
      aria-invalid={excede || undefined}
      title={titulo}
      data-excede={excede ? "true" : undefined}
      value={borrador ?? cifra.format(valor)}
      onFocus={(e) => {
        setBorrador(String(valor));
        onFocus?.();
        // Se selecciona después de que el campo muestre la cifra sin separador.
        const campo = e.currentTarget;
        requestAnimationFrame(() => campo.select());
      }}
      onBlur={() => setBorrador(null)}
      onChange={(e) => {
        const limpio = e.currentTarget.value.replace(/[^\d]/g, "");
        setBorrador(limpio);
        onChange(limpio ? Number(limpio) : 0);
      }}
    />
  );
}

/**
 * Campo del margen de una meta: muestra el margen que da la meta y, si se escribe uno, propone la meta que lo da
 * (`onMargen` recibe el margen como proporción, 0.05 para "5"). Al salir vuelve a mostrar el margen de la meta,
 * que puede quedar algo por debajo del escrito por el redondeo.
 */
export function CampoMargen({ margen, etiqueta, onMargen, onFocus }: {
  margen: number | null;
  etiqueta: string;
  onMargen: (margen: number) => void;
  onFocus?: () => void;
}) {
  const [borrador, setBorrador] = useState<string | null>(null);
  const visible = margen == null ? "" : (margen * 100).toFixed(1);
  return (
    <label className="cmg-campo-margen">
      <span aria-hidden="true">±</span>
      <input
        type="text"
        inputMode="decimal"
        aria-label={etiqueta}
        value={borrador ?? visible}
        onFocus={(e) => {
          setBorrador(visible);
          onFocus?.();
          const campo = e.currentTarget;
          requestAnimationFrame(() => campo.select());
        }}
        onBlur={() => setBorrador(null)}
        onChange={(e) => {
          const texto = e.currentTarget.value.replace(",", ".").replace(/[^\d.]/g, "");
          setBorrador(texto);
          const valor = Number(texto);
          if (texto && Number.isFinite(valor) && valor > 0 && valor < 100) onMargen(valor / 100);
        }}
      />
      <span aria-hidden="true">%</span>
    </label>
  );
}
