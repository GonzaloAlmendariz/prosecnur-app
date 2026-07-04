import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { humanizeIdentifier } from "./graficadorDisplay";
import { resolveGraphLucideIcon } from "./lucideRegistry";

export type PresetTypeOption = {
  name: string;
  titulo_humano?: string;
  icono_ui?: string | null;
};

type PresetTypePickerProps = {
  value: string;
  options: PresetTypeOption[];
  onChange: (value: string) => void;
  caption?: string;
  showCaption?: boolean;
  disabled?: boolean;
  style?: CSSProperties;
};

export default function PresetTypePicker({
  value,
  options,
  onChange,
  caption = "Tipo de gráfico",
  showCaption = true,
  disabled = false,
  style,
}: PresetTypePickerProps) {
  const selected = options.find((option) => option.name === value);
  const selectedLabel = labelFor(selected, value);
  const SelectedIcon = resolveGraphLucideIcon(selected?.icono_ui ?? undefined, "Sliders");
  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function toggleOpen() {
    if (disabled || options.length === 0) return;
    if (open) {
      setOpen(false);
      return;
    }
    const rect = rootRef.current?.getBoundingClientRect();
    if (rect) {
      const width = Math.min(360, window.innerWidth - 28);
      const left = Math.max(14, Math.min(rect.left, window.innerWidth - width - 14));
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const openUp = spaceBelow < 280 && spaceAbove > spaceBelow;
      setPopoverStyle({
        position: "fixed",
        left,
        width,
        maxHeight: Math.max(220, Math.min(380, (openUp ? spaceAbove : spaceBelow) - 14)),
        ...(openUp ? { bottom: window.innerHeight - rect.top + 8 } : { top: rect.bottom + 8 }),
      });
    }
    setOpen(true);
  }

  function commit(nextValue: string) {
    if (nextValue !== value) onChange(nextValue);
    setOpen(false);
  }

  return (
    <div ref={rootRef} style={{ ...rootStyle, ...style }}>
      <button
        type="button"
        onClick={toggleOpen}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled || options.length === 0}
        style={{
          ...triggerStyle,
          ...(open ? triggerOpenStyle : {}),
          ...(disabled ? disabledStyle : {}),
        }}
      >
        <span style={iconShellStyle} aria-hidden="true">
          <SelectedIcon size={14} />
        </span>
        <span style={triggerCopyStyle}>
          {showCaption && <span style={captionStyle}>{caption}</span>}
          <strong style={selectedLabelStyle}>{selectedLabel}</strong>
        </span>
        <ChevronDown size={14} style={{ color: "var(--pulso-text-soft)", flex: "0 0 auto" }} />
      </button>

      {open && typeof document !== "undefined" && createPortal((
        <div
          ref={popoverRef}
          role="listbox"
          aria-label={caption}
          style={popoverShellStyle(popoverStyle)}
        >
          <div style={popoverHeadStyle}>
            <span>{caption}</span>
            <strong>{options.length} opciones</strong>
          </div>
          <div style={optionListStyle}>
            {options.map((option) => {
              const Icon = resolveGraphLucideIcon(option.icono_ui ?? undefined, "Sliders");
              const active = option.name === value;
              return (
                <button
                  key={option.name}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => commit(option.name)}
                  title={labelFor(option)}
                  style={{
                    ...optionStyle,
                    ...(active ? optionActiveStyle : {}),
                  }}
                >
                  <span style={optionIconStyle} aria-hidden="true">
                    <Icon size={13} />
                  </span>
                  <span style={optionLabelStyle}>{labelFor(option)}</span>
                  {active && <Check size={13} style={checkStyle} />}
                </button>
              );
            })}
          </div>
        </div>
      ), document.body)}
    </div>
  );
}

function labelFor(option: PresetTypeOption | undefined, fallback = "gráfico") {
  return option?.titulo_humano || humanizeIdentifier(option?.name ?? fallback, "Tipo de gráfico");
}

const rootStyle: CSSProperties = {
  minWidth: 0,
  width: "min(100%, 280px)",
};

const triggerStyle: CSSProperties = {
  width: "100%",
  minHeight: 31,
  display: "grid",
  gridTemplateColumns: "24px minmax(0, 1fr) auto",
  alignItems: "center",
  gap: 7,
  padding: "4px 8px 4px 5px",
  border: "1px solid color-mix(in srgb, var(--gv2-accent-border, var(--pulso-primary-border)) 72%, var(--pulso-border))",
  borderRadius: 8,
  background: "linear-gradient(180deg, rgba(255,255,255,0.98), color-mix(in srgb, var(--gv2-accent-soft, var(--pulso-primary-soft)) 20%, #ffffff))",
  color: "var(--pulso-text)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.86), 0 4px 12px rgba(0, 36, 87, 0.045)",
  cursor: "pointer",
  textAlign: "left",
};

const triggerOpenStyle: CSSProperties = {
  borderColor: "color-mix(in srgb, var(--gv2-accent, var(--pulso-primary)) 58%, var(--pulso-border))",
  boxShadow: "0 0 0 3px color-mix(in srgb, var(--gv2-accent, var(--pulso-primary)) 12%, transparent)",
};

const disabledStyle: CSSProperties = {
  opacity: 0.62,
  cursor: "not-allowed",
};

const iconShellStyle: CSSProperties = {
  width: 24,
  height: 24,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 7,
  background: "color-mix(in srgb, var(--gv2-accent-soft, var(--pulso-primary-soft)) 56%, #ffffff)",
  color: "var(--gv2-accent, var(--pulso-primary))",
  boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--gv2-accent-border, var(--pulso-primary-border)) 62%, transparent)",
};

const triggerCopyStyle: CSSProperties = {
  minWidth: 0,
  display: "grid",
  gap: 1,
};

const captionStyle: CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: "var(--pulso-text-soft)",
  fontSize: 9,
  fontWeight: 820,
  lineHeight: 1,
  textTransform: "uppercase",
  letterSpacing: 0,
};

const selectedLabelStyle: CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: "var(--pulso-text)",
  fontSize: 11.5,
  fontWeight: 820,
  lineHeight: 1.12,
  letterSpacing: 0,
};

function popoverShellStyle(positionStyle: CSSProperties): CSSProperties {
  return {
    ...positionStyle,
    zIndex: 10030,
    display: "grid",
    gap: 8,
    padding: 8,
    border: "1px solid color-mix(in srgb, var(--gv2-accent-border, var(--pulso-primary-border)) 74%, var(--pulso-border))",
    borderRadius: 10,
    background: "color-mix(in srgb, var(--pulso-surface) 94%, transparent)",
    boxShadow: "var(--pulso-shadow-popover)",
    backdropFilter: "blur(14px)",
    overflow: "hidden",
  };
}

const popoverHeadStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  padding: "2px 2px 7px",
  borderBottom: "1px solid var(--pulso-border)",
  color: "var(--pulso-text-soft)",
  fontSize: 10,
  fontWeight: 820,
  textTransform: "uppercase",
};

const optionListStyle: CSSProperties = {
  display: "grid",
  gap: 5,
  overflow: "auto",
  paddingRight: 2,
};

const optionStyle: CSSProperties = {
  minWidth: 0,
  minHeight: 32,
  display: "grid",
  gridTemplateColumns: "24px minmax(0, 1fr) 18px",
  alignItems: "center",
  gap: 7,
  padding: "4px 6px",
  border: "1px solid transparent",
  borderRadius: 8,
  background: "transparent",
  color: "var(--pulso-text)",
  cursor: "pointer",
  textAlign: "left",
};

const optionActiveStyle: CSSProperties = {
  borderColor: "color-mix(in srgb, var(--gv2-accent, var(--pulso-primary)) 42%, var(--pulso-border))",
  background: "color-mix(in srgb, var(--gv2-accent-soft, var(--pulso-primary-soft)) 54%, #ffffff)",
};

const optionIconStyle: CSSProperties = {
  width: 24,
  height: 24,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 7,
  color: "var(--gv2-accent, var(--pulso-primary))",
};

const optionLabelStyle: CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: 11.5,
  fontWeight: 760,
  letterSpacing: 0,
};

const checkStyle: CSSProperties = {
  color: "var(--gv2-accent, var(--pulso-primary))",
  justifySelf: "center",
};
