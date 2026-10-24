/**
 * routes/campuses.ts — curated main-campus anchors for Greater Boston colleges.
 *
 * Why curated: people search by abbreviation ("BU", "BC", "MIT", "NEU"), which
 * an address geocoder cannot resolve, and OSM's single point for a large campus
 * can sit far from where a walker means (OSM's "Harvard University" node is by
 * the Business School, ~1 km from Harvard Yard). Each anchor is the main
 * campus entrance / quad, cross-checked against OSM (within ~300 m of the OSM
 * amenity=university|college feature, except where noted).
 *
 * `aliases` are matched after normalise() (lowercase, no punctuation).
 * All points lie inside the snapshot bbox so they are routable.
 */

export interface Campus {
  id: string;
  name: string;
  detail: string;
  lat: number;
  lng: number;
  aliases: string[];
}

export const campuses: Campus[] = [
  {
    id: "northeastern",
    name: "Northeastern University",
    detail: "360 Huntington Avenue, Boston",
    lat: 42.3398,
    lng: -71.0892,
    aliases: ["northeastern", "neu", "nu", "northeastern university"],
  },
  {
    id: "bu",
    name: "Boston University",
    detail: "Commonwealth Avenue, Boston",
    lat: 42.3505,
    lng: -71.1054,
    aliases: ["bu", "boston u", "boston university"],
  },
  {
    id: "bu-medical",
    name: "Boston University Medical Campus",
    detail: "Albany Street, South End",
    lat: 42.3355,
    lng: -71.0726,
    aliases: ["bu medical", "bumc", "bu medical campus", "boston university medical campus"],
  },
  {
    id: "bc",
    name: "Boston College",
    detail: "Chestnut Hill",
    lat: 42.3355,
    lng: -71.1685,
    aliases: ["bc", "boston college"],
  },
  {
    id: "mit",
    name: "MIT (Massachusetts Institute of Technology)",
    detail: "77 Massachusetts Avenue, Cambridge",
    lat: 42.3592,
    lng: -71.0935,
    aliases: ["mit", "massachusetts institute of technology"],
  },
  {
    // Harvard Yard, not OSM's campus node (which sits by Harvard Business School).
    id: "harvard",
    name: "Harvard University (Harvard Yard)",
    detail: "Massachusetts Avenue, Cambridge",
    lat: 42.3744,
    lng: -71.1169,
    aliases: ["harvard", "harvard university", "harvard yard"],
  },
  {
    id: "harvard-business",
    name: "Harvard Business School",
    detail: "Soldiers Field, Allston",
    lat: 42.3657,
    lng: -71.1222,
    aliases: ["hbs", "harvard business school"],
  },
  {
    id: "harvard-medical",
    name: "Harvard Medical School",
    detail: "25 Shattuck Street, Longwood",
    lat: 42.3369,
    lng: -71.1039,
    aliases: ["hms", "harvard medical school", "harvard med"],
  },
  {
    id: "tufts",
    name: "Tufts University",
    detail: "Medford/Somerville campus",
    lat: 42.4064,
    lng: -71.1189,
    aliases: ["tufts", "tufts university"],
  },
  {
    id: "tufts-boston",
    name: "Tufts University Health Sciences Campus",
    detail: "136 Harrison Avenue, Chinatown",
    lat: 42.3497,
    lng: -71.0623,
    aliases: ["tufts boston", "tufts medical school", "tufts health sciences"],
  },
  {
    id: "berklee",
    name: "Berklee College of Music",
    detail: "Massachusetts Avenue, Back Bay",
    lat: 42.3466,
    lng: -71.0871,
    aliases: ["berklee", "berklee college of music"],
  },
  {
    id: "emerson",
    name: "Emerson College",
    detail: "Boylston Street, Boston",
    lat: 42.3522,
    lng: -71.0657,
    aliases: ["emerson", "emerson college"],
  },
  {
    id: "suffolk",
    name: "Suffolk University",
    detail: "73 Tremont Street, Boston",
    lat: 42.3577,
    lng: -71.061,
    aliases: ["suffolk", "suffolk university"],
  },
  {
    id: "umass-boston",
    name: "University of Massachusetts Boston",
    detail: "Columbia Point, Dorchester",
    lat: 42.3138,
    lng: -71.0387,
    aliases: ["umass boston", "umb", "university of massachusetts boston"],
  },
  {
    id: "simmons",
    name: "Simmons University",
    detail: "The Fenway, Boston",
    lat: 42.3389,
    lng: -71.1004,
    aliases: ["simmons", "simmons university"],
  },
  {
    id: "wentworth",
    name: "Wentworth Institute of Technology",
    detail: "Huntington Avenue, Boston",
    lat: 42.3366,
    lng: -71.0954,
    aliases: ["wentworth", "wit", "wentworth institute of technology"],
  },
  {
    id: "massart",
    name: "Massachusetts College of Art and Design (MassArt)",
    detail: "621 Huntington Avenue, Boston",
    lat: 42.3368,
    lng: -71.0993,
    aliases: ["massart", "mass art", "massachusetts college of art and design"],
  },
];
