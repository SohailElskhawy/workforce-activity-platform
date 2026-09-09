export type TranslationValues = Record<string, string | number>;

export type PluralTranslation = {
  one: string;
  other: string;
};

export function formatTemplate(
  template: string,
  values: TranslationValues,
): string {
  return template.replace(/\{(\w+)\}/g, (placeholder, key: string) => {
    const value = values[key];
    return value === undefined ? placeholder : String(value);
  });
}

export function formatPlural(
  translation: PluralTranslation,
  count: number,
  values: TranslationValues = {},
): string {
  return formatTemplate(count === 1 ? translation.one : translation.other, {
    ...values,
    count,
  });
}
