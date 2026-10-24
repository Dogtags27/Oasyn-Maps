/**
 * i18n/t.ts — in-house translator (R12.3).
 *
 * - `{var}` interpolation.
 * - Plurals via Intl.PluralRules selecting `key_one` / `key_other`
 *   (ja and zh resolve to `other` only).
 * - All user-facing text in the app goes through t(); components never contain
 *   string literals (R12.2). Backend text arrives as Descriptor { key, vars }
 *   and is rendered with the same t().
 */

export type Vars = Record<string, string | number | boolean>;
export type Messages = Record<string, string>;

/** A missing key renders visibly so it is caught in review rather than shipped. */
function missing(key: string): string {
  return `⟦${key}⟧`;
}

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const v = vars[name];
    return v === undefined ? whole : String(v);
  });
}

/**
 * Build a translator bound to a locale's messages and plural rules.
 * `locale` drives Intl.PluralRules so count-sensitive keys pick the right form.
 */
export function makeT(messages: Messages, locale: string) {
  const plural = new Intl.PluralRules(locale);

  return function t(key: string, vars?: Vars): string {
    // Pluralise when a numeric `count` is supplied and a plural variant exists.
    if (vars && typeof vars.count === "number") {
      const category = plural.select(vars.count); // "one" | "other" | ...
      const pluralKey = `${key}_${category}`;
      if (pluralKey in messages) return interpolate(messages[pluralKey], vars);
      const otherKey = `${key}_other`;
      if (otherKey in messages) return interpolate(messages[otherKey], vars);
    }
    if (key in messages) return interpolate(messages[key], vars);
    return missing(key);
  };
}

export type TFn = ReturnType<typeof makeT>;
