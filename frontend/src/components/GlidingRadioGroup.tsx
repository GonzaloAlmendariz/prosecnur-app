import type {
  ButtonHTMLAttributes,
  ReactNode,
} from "react";
import {
  GlidingTabList,
  type GlidingTabListProps,
} from "./GlidingTabList";

export type GlidingRadioValue = string | number | boolean;

type GlidingRadioButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "type" | "role" | "aria-checked" | "onClick" | "onKeyDown" | "children"
>;

export type GlidingRadioGroupProps<T, V extends GlidingRadioValue> = Omit<
  GlidingTabListProps,
  "activeKey" | "mode" | "role" | "onRovingKeyChange" | "children"
> & {
  value: V;
  options: readonly T[];
  getOptionValue: (option: T) => V;
  getOptionKey?: (option: T) => string;
  onValueChange: (value: V) => void;
  getOptionProps?: (
    option: T,
    state: { checked: boolean; index: number },
  ) => GlidingRadioButtonProps;
  children: (
    option: T,
    state: { checked: boolean; index: number },
  ) => ReactNode;
};

export function resolveGlidingRadioValue<T, V extends GlidingRadioValue>(
  options: readonly T[],
  getOptionValue: (option: T) => V,
  serializedKey: string,
  getOptionKey: (option: T) => string = (option) => String(getOptionValue(option)),
): V | null {
  const option = options.find((candidate) => getOptionKey(candidate) === serializedKey);
  return option === undefined ? null : getOptionValue(option);
}

export function commitGlidingRadioValue<V extends GlidingRadioValue>(
  currentValue: V,
  nextValue: V,
  onValueChange: (value: V) => void,
) {
  if (!Object.is(currentValue, nextValue)) onValueChange(nextValue);
}

export function GlidingRadioGroup<T, V extends GlidingRadioValue>({
  value,
  options,
  getOptionValue,
  getOptionKey = (option) => String(getOptionValue(option)),
  onValueChange,
  getOptionProps,
  children,
  ...rootProps
}: GlidingRadioGroupProps<T, V>) {
  const activeOption = options.find((option) => Object.is(getOptionValue(option), value));
  const selectValue = (nextValue: V) => {
    commitGlidingRadioValue(value, nextValue, onValueChange);
  };

  return (
    <GlidingTabList
      {...rootProps}
      activeKey={activeOption === undefined ? null : getOptionKey(activeOption)}
      mode="tabs"
      role="radiogroup"
      onRovingKeyChange={(serializedKey) => {
        const nextValue = resolveGlidingRadioValue(options, getOptionValue, serializedKey, getOptionKey);
        if (nextValue !== null) selectValue(nextValue);
      }}
    >
      {options.map((option, index) => {
        const optionValue = getOptionValue(option);
        const optionKey = getOptionKey(option);
        const checked = Object.is(optionValue, value);
        const { className, ...buttonProps } = getOptionProps?.(option, { checked, index }) ?? {};
        return (
          <button
            {...buttonProps}
            key={optionKey}
            type="button"
            role="radio"
            data-gliding-key={optionKey}
            aria-checked={checked}
            className={[className, checked ? "is-active" : ""].filter(Boolean).join(" ")}
            onClick={() => selectValue(optionValue)}
          >
            {children(option, { checked, index })}
          </button>
        );
      })}
    </GlidingTabList>
  );
}
