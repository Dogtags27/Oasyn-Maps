/**
 * router.tsx — routes for the app shell (R1.1).
 *   / landing, /app Navigator, /lab Lab, /watch Watch, /privacy, /about.
 */
import { createBrowserRouter } from "react-router-dom";
import { Landing } from "@/pages/Landing";
import { Navigator } from "@/pages/Navigator";
import { Lab } from "@/pages/Lab";
import { Watch } from "@/pages/Watch";
import { Privacy } from "@/pages/Privacy";
import { About } from "@/pages/About";

export const router = createBrowserRouter([
  { path: "/", element: <Landing /> },
  { path: "/app", element: <Navigator /> },
  { path: "/lab", element: <Lab /> },
  { path: "/watch", element: <Watch /> },
  { path: "/privacy", element: <Privacy /> },
  { path: "/about", element: <About /> },
]);
