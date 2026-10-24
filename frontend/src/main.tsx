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
