/**
 * ui/PlaceSearch.tsx — searchable destinations + presets (R13.3, R5.5).
 *
 * A keyboard-operable search over the places layer plus preset trips, so the
 * user can set start/destination without the map. Selecting a place calls the
 * provided handler with its coordinates. Place names come from OSM data and are
 * kept as mapped (not translated) per R12.5.
 */
import { useMemo, useState } from "react";
import { useT } from "@/i18n/useLocale";
import { useLayer, pointLatLng } from "@/map/useLayer";
import type { LatLngT } from "@/api/types";

export interface PlaceSearchProps {
  label: string;
  onPick: (at: LatLngT, name: string) => void;
}

interface PlaceOption {
  id: string;
  name: string;
  at: LatLngT;
}

export function PlaceSearch({ label, onPick }: PlaceSearchProps) {
  const t = useT();
  const places = useLayer("places");
  const [query, setQuery] = useState("");

  const options = useMemo<PlaceOption[]>(() => {
    if (!places) return [];
    const out: PlaceOption[] = [];
    for (const f of places.features) {
      const ll = pointLatLng(f);
      if (!ll) continue;
      const props = f.properties as { id?: string; name?: string } | undefined;
      out.push({
        id: props?.id ?? `${ll[0]},${ll[1]}`,
        name: props?.name ?? "",
        at: { lat: ll[0], lng: ll[1] },
      });
    }
    return out;
  }, [places]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, query]);

  const listId = `place-search-${label.replace(/\s+/g, "-")}`;

  return (
    <div className="place-search">
      <label>
        <span>{label}</span>
        <input
          type="search"
          value={query}
          placeholder={t("trip.searchPlaces")}
          onChange={(e) => setQuery(e.target.value)}
          aria-expanded={filtered.length > 0}
          aria-controls={listId}
          autoComplete="off"
        />
      </label>
      <ul id={listId} className="place-search__results">
        {filtered.length === 0 && <li className="place-search__empty">{t("trip.noResults")}</li>}
        {filtered.map((o) => (
          <li key={o.id}>
            <button type="button" onClick={() => onPick(o.at, o.name)}>
              {o.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
