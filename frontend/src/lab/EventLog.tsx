/**
 * lab/EventLog.tsx — the Lab event log (R7.4).
 *
 * A table of events: trigger, decision, delta J, and reason. Trigger/decision
 * are i18n keys; the reason is a backend descriptor. Delta J is formatted via
 * Intl. Rendered newest-last so it reads as a timeline.
 */
import { useLocale } from "@/i18n/useLocale";
import { useStore } from "@/store";
import { formatNumber } from "@/i18n/formatters";

export function EventLog() {
  const { t, d } = useLocale();
  const locale = useStore((s) => s.locale);
  const eventLog = useStore((s) => s.eventLog);

  return (
    <section className="event-log" aria-label={t("lab.eventLog")}>
      <h3>{t("lab.eventLog")}</h3>
      <table>
        <thead>
          <tr>
            <th>{t("lab.eventLog.trigger")}</th>
            <th>{t("lab.eventLog.decision")}</th>
            <th>{t("lab.eventLog.deltaJ")}</th>
            <th>{t("lab.eventLog.reason")}</th>
          </tr>
        </thead>
        <tbody>
          {eventLog.map((e) => (
            <tr key={e.id}>
              <td>{t(e.triggerKey)}</td>
              <td>{t(e.decisionKey)}</td>
              <td className="mono">
                {e.deltaJ === null
                  ? "\u2014"
                  : formatNumber(e.deltaJ, locale, { maximumFractionDigits: 2 })}
              </td>
              <td>{e.reason ? d(e.reason) : "\u2014"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
