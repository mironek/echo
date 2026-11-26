// Tłumaczenia interfejsu: wybór języka, t() i tPlural(), nazwy języków przez Intl.DisplayNames.

import { de } from './locales/de'
import { en } from './locales/en'
import type { MessageKey, Messages, PluralForms } from './locales/en'
import { es } from './locales/es'
import { fr } from './locales/fr'
import { it } from './locales/it'
import { ja } from './locales/ja'
import { pl } from './locales/pl'
import { pt } from './locales/pt'
import { ru } from './locales/ru'
import { uk } from './locales/uk'
import { zh } from './locales/zh'

export const DEFAULT_UI_LANGUAGE = 'en'

/** Języki interfejsu z nazwą we własnym języku (do listy w ustawieniach). */
export const UI_LANGUAGES: { code: string; name: string }[] = [
  { code: 'en', name: 'English' },
  { code: 'pl', name: 'Polski' },
  { code: 'de', name: 'Deutsch' },
  { code: 'fr', name: 'Français' },
  { code: 'it', name: 'Italiano' },
  { code: 'es', name: 'Español' },
  { code: 'pt', name: 'Português' },
  { code: 'ru', name: 'Русский' },
  { code: 'uk', name: 'Українська' },
  { code: 'ja', name: '日本語' },
  { code: 'zh', name: '中文' },
]

const LOCALES: Record<string, Messages> = { en, pl, de, fr, it, es, pt, ru, uk, ja, zh }

let currentCode = DEFAULT_UI_LANGUAGE
let current: Messages = en

/** Ustawia język interfejsu (nieznany kod = angielski). Wywoływane przed rysowaniem z wartości w $.state. */
export function useUiLanguage(code: string): void {
  currentCode = LOCALES[code] ? code : DEFAULT_UI_LANGUAGE
  current = LOCALES[currentCode] ?? en
}

/** Kod bieżącego języka interfejsu. */
export function uiLanguage(): string {
  return currentCode
}

/** Wstawia parametry {nazwa} do tekstu. */
function fill(text: string, params: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole))
}

/**
 * Zapasowy tekst dla klucza bez tłumaczenia (także w angielskim): ostatnia część klucza, np. `teal`
 * z `color.teal` — zamiast błędu, który zatrzymałby rysowanie paska lub panelu.
 */
function missingText(key: string): string {
  return key.split('.').pop() ?? key
}

/** Zwraca przetłumaczony tekst z wstawionymi parametrami (brak tłumaczenia = nazwa z klucza). */
export function t(key: MessageKey, params: Record<string, string | number> = {}): string {
  const value = current[key] ?? en[key]
  if (value === undefined) return missingText(key)
  return fill(typeof value === 'string' ? value : value.other, params)
}

/** Kategoria liczby mnogiej dla bieżącego języka; bez Intl: 1 = one, reszta = other. */
function pluralCategory(count: number): keyof PluralForms {
  try {
    return new Intl.PluralRules(currentCode).select(count) as keyof PluralForms
  } catch {
    return count === 1 ? 'one' : 'other'
  }
}

/** Zwraca tekst w formie liczby mnogiej pasującej do count ({count} jest wstawiane). */
export function tPlural(key: MessageKey, count: number, params: Record<string, string | number> = {}): string {
  const value = current[key] ?? en[key]
  if (value === undefined) return `${count} ${missingText(key)}`
  const forms: PluralForms = typeof value === 'string' ? { other: value } : value
  const text = forms[pluralCategory(count)] ?? forms.other
  return fill(text, { ...params, count })
}

/** Nazwa języka (kod ISO) w języku interfejsu, z wielkiej litery; bez Intl zwraca fallback albo kod. */
export function languageName(code: string, fallback?: string): string {
  try {
    const name = new Intl.DisplayNames([currentCode], { type: 'language' }).of(code)
    if (name && name !== code) return name.charAt(0).toUpperCase() + name.slice(1)
  } catch {
    // Brak Intl.DisplayNames w środowisku moda: zostaje nazwa z serwera.
  }
  return fallback ?? code
}
