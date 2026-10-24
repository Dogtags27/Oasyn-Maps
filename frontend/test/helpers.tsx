/**
 * test/helpers.tsx — render helpers that wrap components in the locale provider.
 *
 * The client provider boots config via fetch, which we avoid in unit tests by
 * only wrapping with LocaleProvider (en is bundled synchronously). Components
 * needing the client are tested with a mock-mode ApiClient directly.
 */
import type { ReactElement, ReactNode } from "react";
import { render } from "@testing-library/react";
import { LocaleProvider } from "@/i18n/useLocale";
import { ApiClient } from "@/api/client";
import { ClientContext } from "@/api/useClient";

export function renderWithLocale(ui: ReactElement) {
  return render(<LocaleProvider>{ui}</LocaleProvider>);
}

export function renderWithProviders(ui: ReactElement) {
  const client = new ApiClient({ mode: "mock" });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <ClientContext.Provider value={client}>
      <LocaleProvider>{children}</LocaleProvider>
    </ClientContext.Provider>
  );
  return render(<Wrapper>{ui}</Wrapper>);
}
