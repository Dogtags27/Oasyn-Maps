/**
 * main.tsx — entry point. Composes providers: client (boots config) + locale,
 * then the app shell and the router.
 */
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { App } from "./App";
import { ClientProvider } from "./api/useClient";
import { LocaleProvider } from "./i18n/useLocale";

import "./tokens/theme.css";
import "./tokens/type.css";
import "./ui/FocusRing.css";
import "./app.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ClientProvider>
      <LocaleProvider>
        <App>
          <RouterProvider router={router} />
        </App>
      </LocaleProvider>
    </ClientProvider>
  </React.StrictMode>,
);

// Register the app-shell service worker so the app opens offline (R17.3).
// Routing still needs a connection; API calls are never cached.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // PWA is a stretch feature; failure to register is non-fatal.
    });
  });
}
