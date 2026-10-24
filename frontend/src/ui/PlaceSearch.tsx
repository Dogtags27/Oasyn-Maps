/**
 * ui/PlaceSearch.tsx — start / destination search (R13.3, R5.5).
 *
 * Search-as-you-type against GET /api/search, which merges the snapshot's own
 * named places, parks and cooling centres with a bbox-limited OSM geocoder for
 * addresses and points of interest. Mock mode searches the sample layers.
 *
 * Accessibility: a WAI-ARIA combobox. Arrow keys move through the options,
 * Enter picks, Escape closes the list (a second Escape bubbles up and
 * collapses the search bar). Status changes are announced via role="status".
 * Place names come from map data and are kept as mapped (R12.5).
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useLocale } from "@/i18n/useLocale";
import { useClient } from "@/api/useClient";
import { StaleResponseError } from "@/api/client";
import { useStore } from "@/store";
import { viewConfig } from "@/config";
import type { LatLngT, SearchResultT } from "@/api/types";

export interface PlaceSearchProps {
  label: string;
  onPick: (at: LatLngT, name: string) => void;
  /** Label of the currently chosen place (shown when the field is idle). */
  value?: string | null;
}

/** Fewer characters than this never hit the API (matches the contract). */
const MIN_CHARS = 2;
const MAX_RESULTS = 8;

type Status = "idle" | "loading" | "done" | "error";

export function PlaceSearch({ label, onPick, value }: PlaceSearchProps) {
  const { t, locale } = useLocale();
  const client = useClient();
  const config = useStore((s) => s.config);
  const debounceMs = useMemo(() => viewConfig(config).debounceMs, [config]);

  const uid = useId();
  const listId = `place-search-list-${uid}`;
  const optionId = (i: number) => `place-search-opt-${uid}-${i}`;

  const [query, setQuery] = useState(value ?? "");
  const [results, setResults] = useState<SearchResultT[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [degraded, setDegraded] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const lastPicked = useRef<string | null>(value ?? null);

  // Reflect an external change (e.g. swap, or a map tap) when not typing.
  useEffect(() => {
    if (!open) {
      setQuery(value ?? "");
      lastPicked.current = value ?? null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Debounced search. Each field has its own channel so stale answers drop.
  useEffect(() => {
    const q = query.trim();
    if (!open || q.length < MIN_CHARS || q === lastPicked.current) {
      setStatus("idle");
      setResults([]);
      setActive(-1);
      return;
    }
    setStatus("loading");
    let cancelled = false;
    const timer = setTimeout(() => {
      client
        .search(q, { limit: MAX_RESULTS, lang: locale, channel: uid })
        .then((res) => {
          if (cancelled) return;
          setResults(res.results);
          setDegraded(res.degraded);
          setStatus("done");
          setActive(res.results.length > 0 ? 0 : -1);
        })
        .catch((err) => {
          if (cancelled || err instanceof StaleResponseError) return;
          setResults([]);
          setStatus("error");
          setActive(-1);
        });
    }, debounceMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, open, client, locale, uid, debounceMs]);

  function pick(r: SearchResultT) {
    lastPicked.current = r.name;
    setQuery(r.name);
    setOpen(false);
    setResults([]);
    setActive(-1);
    onPick(r.at, r.name);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && results.length > 0) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp" && results.length > 0) {
      e.preventDefault();
      setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter" && open && active >= 0 && results[active]) {
      e.preventDefault();
      pick(results[active]);
    } else if (e.key === "Escape" && open && (results.length > 0 || status !== "idle")) {
      // First Escape closes the list; let the next one collapse the bar.
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();
      setOpen(false);
    }
  }

  const q = query.trim();
  const showList = open && q.length >= MIN_CHARS && q !== lastPicked.current;
  let message: string | null = null;
  if (open && q.length > 0 && q.length < MIN_CHARS) message = t("trip.searchHint");
  else if (showList && status === "loading" && results.length === 0) message = t("trip.searching");
  else if (showList && status === "error") message = t("trip.searchError");
  else if (showList && status === "done" && results.length === 0) message = t("trip.noResults");

  return (
    <div className="place-search">
      <label>
        <span>{label}</span>
        <input
          type="search"
          role="combobox"
          value={query}
          placeholder={t("trip.searchPlaces")}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          aria-expanded={showList && results.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? optionId(active) : undefined}
          autoComplete="off"
          enterKeyHint="search"
          spellCheck={false}
        />
      </label>
      <ul id={listId} className="place-search__results" role="listbox" aria-label={label}>
        {showList &&
          results.map((r, i) => (
            <li
              key={r.id}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              className={i === active ? "is-active" : undefined}
              // mousedown (not click) so the input's blur doesn't close the list first.
              onMouseDown={(e) => {
                e.preventDefault();
                pick(r);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span className={`place-search__kind place-search__kind--${r.kind}`} aria-hidden="true" />
              <span className="place-search__text">
                <span className="place-search__name">{r.name}</span>
                {r.detail && <span className="place-search__detail">{r.detail}</span>}
              </span>
            </li>
          ))}
      </ul>
      <p className="place-search__status" role="status" aria-live="polite">
        {message}
        {!message && showList && status === "done" && degraded && results.length > 0
          ? t("trip.searchLimited")
          : null}
      </p>
    </div>
  );
}
