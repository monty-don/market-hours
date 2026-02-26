import React, { useEffect, useMemo, useState } from "react";
import { DateTime, Duration, Interval } from "luxon";

// --- CONFIG ---
// Regular trading sessions only (no holidays). Times are LOCAL to each market's city.
// For markets with a lunch break, list two sessions.
const MARKETS = [
  {
    code: "NYSE",
    name: "New York Stock Exchange (NYSE)",
    city: "New York",
    timeZone: "America/New_York",
    sessions: [
      { start: "09:30", end: "16:00" },
    ],
    days: [1, 2, 3, 4, 5],
  },
  {
    code: "NASDAQ",
    name: "Nasdaq",
    city: "New York",
    timeZone: "America/New_York",
    sessions: [
      { start: "09:30", end: "16:00" },
    ],
    days: [1, 2, 3, 4, 5],
  },
  {
    code: "LSE",
    name: "London Stock Exchange (LSE)",
    city: "London",
    timeZone: "Europe/London",
    sessions: [
      { start: "08:00", end: "16:30" },
    ],
    days: [1, 2, 3, 4, 5],
  },
  {
    code: "XETRA",
    name: "Deutsche Börse Xetra",
    city: "Frankfurt",
    timeZone: "Europe/Berlin",
    sessions: [
      { start: "09:00", end: "17:30" },
    ],
    days: [1, 2, 3, 4, 5],
  },
  {
    code: "PAR",
    name: "Euronext Paris",
    city: "Paris",
    timeZone: "Europe/Paris",
    sessions: [
      { start: "09:00", end: "17:30" },
    ],
    days: [1, 2, 3, 4, 5],
  },
  {
    code: "TSE",
    name: "Tokyo Stock Exchange (TSE)",
    city: "Tokyo",
    timeZone: "Asia/Tokyo",
    sessions: [
      { start: "09:00", end: "11:30" },
      { start: "12:30", end: "15:00" },
    ],
    days: [1, 2, 3, 4, 5],
  },
  {
    code: "HKEX",
    name: "Hong Kong Stock Exchange (HKEX)",
    city: "Hong Kong",
    timeZone: "Asia/Hong_Kong",
    sessions: [
      { start: "09:30", end: "12:00" },
      { start: "13:00", end: "16:00" },
    ],
    days: [1, 2, 3, 4, 5],
  },
  {
    code: "SSE",
    name: "Shanghai Stock Exchange (SSE)",
    city: "Shanghai",
    timeZone: "Asia/Shanghai",
    sessions: [
      { start: "09:30", end: "11:30" },
      { start: "13:00", end: "15:00" },
    ],
    days: [1, 2, 3, 4, 5],
  },
  {
    code: "SGX",
    name: "Singapore Exchange (SGX)",
    city: "Singapore",
    timeZone: "Asia/Singapore",
    sessions: [
      { start: "09:00", end: "17:00" },
    ],
    days: [1, 2, 3, 4, 5],
  },
  {
    code: "ASX",
    name: "Australian Securities Exchange (ASX)",
    city: "Sydney",
    timeZone: "Australia/Sydney",
    sessions: [
      { start: "10:00", end: "16:00" },
    ],
    days: [1, 2, 3, 4, 5],
  },
  {
    code: "NSE",
    name: "NSE India (NIFTY)",
    city: "Mumbai",
    timeZone: "Asia/Kolkata",
    sessions: [
      { start: "09:15", end: "15:30" },
    ],
    days: [1, 2, 3, 4, 5],
  },
  {
    code: "TSX",
    name: "Toronto Stock Exchange (TSX)",
    city: "Toronto",
    timeZone: "America/Toronto",
    sessions: [
      { start: "09:30", end: "16:00" },
    ],
    days: [1, 2, 3, 4, 5],
  },
  // --- Added per request ---
  {
    code: "IDX",
    name: "Indonesia Stock Exchange (IDX)",
    city: "Jakarta",
    timeZone: "Asia/Jakarta",
    sessions: [
      { start: "09:00", end: "12:00" },
      { start: "13:30", end: "15:00" },
    ],
    days: [1, 2, 3, 4, 5],
  },
  {
    code: "TWSE",
    name: "Taiwan Stock Exchange (TWSE)",
    city: "Taipei",
    timeZone: "Asia/Taipei",
    sessions: [
      { start: "09:00", end: "13:30" },
    ],
    days: [1, 2, 3, 4, 5],
  },
  {
    code: "KRX",
    name: "Korea Exchange (KRX)",
    city: "Seoul",
    timeZone: "Asia/Seoul",
    sessions: [
      { start: "09:00", end: "15:30" },
    ],
    days: [1, 2, 3, 4, 5],
  },
];

// Map markets to ISO 3166-1 alpha-2 country codes for holiday lookups
const MARKET_COUNTRIES = {
  NYSE: "US",
  NASDAQ: "US",
  LSE: "GB",
  XETRA: "DE",
  PAR: "FR",
  TSE: "JP",
  HKEX: "HK",
  SSE: "CN",
  SGX: "SG",
  ASX: "AU",
  NSE: "IN",
  TSX: "CA",
  IDX: "ID",
  TWSE: "TW",
  KRX: "KR",
};

function parseHM(hm) {
  const [h, m] = hm.split(":").map(Number);
  return { h, m };
}

function makeDT(date, { h, m }, zone) {
  return date.set({ hour: h, minute: m, second: 0, millisecond: 0 }).setZone(zone, { keepLocalTime: true });
}

function nextWeekday(date, days) {
  // days: array of luxon weekday numbers 1=Mon ... 7=Sun
  let d = date;
  for (let i = 0; i < 14; i++) {
    if (days.includes(d.weekday)) return d;
    d = d.plus({ days: 1 });
  }
  return date; // fallback
}

function formatDurationHuman(dur) {
  const d = dur.shiftTo("days", "hours", "minutes", "seconds").normalize();
  const parts = [];
  if (d.days) parts.push(`${d.days}d`);
  if (d.hours) parts.push(`${d.hours}h`);
  if (d.minutes) parts.push(`${d.minutes}m`);
  if (!d.days && !d.hours) parts.push(`${Math.max(0, Math.floor(d.seconds))}s`);
  return parts.join(" ");
}

function formatDurationClock(dur) {
  const total = Math.max(0, Math.floor(dur.as("seconds")));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const hh = h.toString().padStart(2, "0");
  const mm = m.toString().padStart(2, "0");
  const ss = s.toString().padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function computeStatus(market, nowUtc) {
  const now = nowUtc.setZone(market.timeZone);
  const today = now.startOf("day");

  // Find the nearest relevant day that is a trading day
  let checkDay = nextWeekday(today, market.days);

  // Build today's sessions
  const sessionsToday = market.sessions.map(({ start, end }) => {
    const s = makeDT(checkDay, parseHM(start), market.timeZone);
    const e = makeDT(checkDay, parseHM(end), market.timeZone);
    return Interval.fromDateTimes(s, e);
  });

  // If today isn't a trading day, jump to the next one
  if (!market.days.includes(now.weekday)) {
    checkDay = nextWeekday(now.plus({ days: 1 }).startOf("day"), market.days);
  }

  // Recompute sessions for the (possibly) adjusted day
  const sessions = market.sessions.map(({ start, end }) => {
    const s = makeDT(checkDay, parseHM(start), market.timeZone);
    const e = makeDT(checkDay, parseHM(end), market.timeZone);
    return Interval.fromDateTimes(s, e);
  });

  // Determine if open now (check all sessions for current day only)
  const todaysSessions = market.sessions.map(({ start, end }) => {
    const s = makeDT(now.startOf("day"), parseHM(start), market.timeZone);
    const e = makeDT(now.startOf("day"), parseHM(end), market.timeZone);
    return Interval.fromDateTimes(s, e);
  });

  let isOpen = false;
  let currentClose = null;
  for (const interval of todaysSessions) {
    if (interval.contains(now)) {
      isOpen = true;
      currentClose = interval.end;
      break;
    }
  }

  if (isOpen) {
    return {
      status: "Open",
      untilLabel: "closes in",
      until: currentClose.diff(now),
      nextEventAt: currentClose,
      localTime: now,
    };
  }

  // Not open now: find the next session start (later today or on a future trading day)
  let nextStart = null;
  let nextEnd = null;

  // Later today first
  for (const interval of todaysSessions) {
    if (now < interval.start) {
      nextStart = interval.start;
      nextEnd = interval.end;
      break;
    }
  }

  // Otherwise look forward up to 14 days for the next trading day
  if (!nextStart) {
    let d = now.plus({ days: 1 }).startOf("day");
    for (let i = 0; i < 14; i++) {
      if (market.days.includes(d.weekday)) {
        const first = market.sessions[0];
        nextStart = makeDT(d, parseHM(first.start), market.timeZone);
        nextEnd = makeDT(d, parseHM(first.end), market.timeZone);
        break;
      }
      d = d.plus({ days: 1 });
    }
  }

  const untilOpen = nextStart ? nextStart.diff(now) : Duration.fromObject({ seconds: 0 });

  return {
    status: "Closed",
    untilLabel: "opens in",
    until: untilOpen,
    nextEventAt: nextStart,
    localTime: now,
  };
}

function Badge({ children, intent = "neutral" }) {
  const colors = {
    positive: "bg-green-100 text-green-700 border-green-200",
    negative: "bg-red-100 text-red-700 border-red-200",
    neutral: "bg-gray-100 text-gray-700 border-gray-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium ${colors[intent]}`}>
      {children}
    </span>
  );
}

function Card({ children, status }) {
  const ring = status === "Open" ? "ring-1 ring-green-200" : "ring-1 ring-red-200";
  return (
    <div className={`rounded-2xl shadow-sm border border-gray-100 bg-white p-5 hover:shadow-md transition-shadow ${ring}`}>
      {children}
    </div>
  );
}

function useNowTick() {
  const [now, setNow] = useState(DateTime.utc());
  useEffect(() => {
    const id = setInterval(() => setNow(DateTime.utc()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

// --- Holiday utilities ---
// Fetch public holidays from Nager.Date API and cache per country/year.
// Note: Exchange-specific calendars can differ from national holidays.
// This provides a pragmatic approximation with graceful fallback if the API is unavailable.
function useHolidayCache(enabled) {
  const [cache, setCache] = useState({}); // { `${cc}-${year}`: Map<ISODate, name> }
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    async function ensureCountryYear(cc, year) {
      const key = `${cc}-${year}`;
      if (cache[key]) return;
      try {
        const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${cc}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const map = new Map();
        for (const h of data) {
          // h.date comes as YYYY-MM-DD
          map.set(h.date, h.localName || h.name || "Holiday");
        }
        if (!cancelled) setCache((prev) => ({ ...prev, [key]: map }));
      } catch (e) {
        if (!cancelled) setError(e.message || String(e));
      }
    }

    // Preload for all countries present in the dashboard for current & next year
    const now = DateTime.now();
    const years = [now.year, now.year + 1];
    const countries = Array.from(new Set(Object.values(MARKET_COUNTRIES)));
    countries.forEach((cc) => years.forEach((y) => ensureCountryYear(cc, y)));

    return () => { cancelled = true; };
  }, [enabled]);

  function isHoliday(cc, date) {
    if (!enabled) return { isHoliday: false, name: null };
    const years = [date.year];
    for (const y of years) {
      const key = `${cc}-${y}`;
      const map = cache[key];
      if (!map) continue;
      const iso = date.toISODate();
      if (map.has(iso)) return { isHoliday: true, name: map.get(iso) };
    }
    return { isHoliday: false, name: null };
  }

  return { isHoliday, error };
}

function nextTradableDay(startDate, days, holidayCheck) {
  // days: array of luxon weekday numbers 1=Mon ... 7=Sun
  let d = startDate;
  for (let i = 0; i < 31; i++) {
    const weekdayOk = days.includes(d.weekday);
    const holiday = holidayCheck?.(d) || { isHoliday: false };
    if (weekdayOk && !holiday.isHoliday) return d;
    d = d.plus({ days: 1 });
  }
  return startDate;
}

export default function MarketHoursDashboard() {
  const nowUtc = useNowTick();
  const [query, setQuery] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [useHolidays, setUseHolidays] = useState(true);

  const { isHoliday, error: holidayError } = useHolidayCache(useHolidays);

  function computeWithHolidays(market) {
    const cc = MARKET_COUNTRIES[market.code];
    const now = nowUtc.setZone(market.timeZone);
    const today = now.startOf("day");

    const holidayToday = isHoliday(cc, today);
    const todaysSessions = market.sessions.map(({ start, end }) => {
      const s = makeDT(today, parseHM(start), market.timeZone);
      const e = makeDT(today, parseHM(end), market.timeZone);
      return Interval.fromDateTimes(s, e);
    });

    // If holiday today => treat as closed full day
    if (useHolidays && holidayToday.isHoliday) {
      // Find the next tradable day after today
      const nextDay = nextTradableDay(today.plus({ days: 1 }), market.days, (d) => isHoliday(cc, d));
      const first = market.sessions[0];
      const nextStart = makeDT(nextDay, parseHM(first.start), market.timeZone);
      return {
        status: "Closed",
        untilLabel: "opens in",
        until: nextStart.diff(now),
        nextEventAt: nextStart,
        localTime: now,
        holiday: holidayToday.name,
      };
    }

    // Otherwise, fall back to regular computation but skipping future holidays when picking next day
    // Determine if open now
    let isOpen = false;
    let currentClose = null;
    for (const interval of todaysSessions) {
      if (interval.contains(now)) { isOpen = true; currentClose = interval.end; break; }
    }
    if (isOpen) {
      return { status: "Open", untilLabel: "closes in", until: currentClose.diff(now), nextEventAt: currentClose, localTime: now, holiday: null };
    }

    // Not open now: check if there is a later session today (assuming not a holiday)
    for (const interval of todaysSessions) {
      if (now < interval.start) {
        return { status: "Closed", untilLabel: "opens in", until: interval.start.diff(now), nextEventAt: interval.start, localTime: now, holiday: null };
      }
    }

    // Else find next tradable day (skip holidays)
    const nextDay = nextTradableDay(today.plus({ days: 1 }), market.days, (d) => isHoliday(cc, d));
    const first = market.sessions[0];
    const nextStart = makeDT(nextDay, parseHM(first.start), market.timeZone);
    return { status: "Closed", untilLabel: "opens in", until: nextStart.diff(now), nextEventAt: nextStart, localTime: now, holiday: null };
  }

  const rows = useMemo(() => {
    const enriched = MARKETS.map((m) => {
      const s = computeWithHolidays(m);
      return { ...m, ...s };
    })
      .filter((m) => (onlyOpen ? m.status === "Open" : true))
      .filter((m) => m.name.toLowerCase().includes(query.toLowerCase()) || m.code.toLowerCase().includes(query.toLowerCase()) || m.city.toLowerCase().includes(query.toLowerCase()));

    return enriched.sort((a, b) => {
      if (a.status !== b.status) return a.status === "Open" ? -1 : 1;
      return a.until.as("seconds") - b.until.as("seconds");
    });
  }, [nowUtc, query, onlyOpen, useHolidays, isHoliday]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="sticky top-0 z-10 bg-white/70 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Global Market Hours</h1>
            <p className="text-sm text-gray-600">Live status of major stock exchanges — holidays and lunch breaks handled (national-holiday approximation).</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />
              Show only open
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={useHolidays} onChange={(e) => setUseHolidays(e.target.checked)} />
              Holiday closures
            </label>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((m) => (
            <Card key={m.code} status={m.status}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    {m.name}
                    <span className="text-xs text-gray-500 font-normal">{m.code}</span>
                  </h2>
                  <div className="text-xs text-gray-500">{m.city} • {m.timeZone}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge intent={m.status === "Open" ? "positive" : "negative"}>{m.status}</Badge>
                  {m.holiday && <Badge intent="neutral">Holiday: {m.holiday}</Badge>}
                </div>
              </div>

              {/* Prominent countdown */}
              <div className="mt-4">
                <div className="text-xs uppercase tracking-wide text-gray-500">{m.untilLabel}</div>
                <div className="mt-1 text-3xl md:text-4xl font-extrabold tabular-nums">
                  {formatDurationClock(m.until)}
                </div>
                {m.nextEventAt && (
                  <div className="text-xs text-gray-500 mt-1">at {m.nextEventAt.toFormat("HH:mm")} local • {formatDurationHuman(m.until)}</div>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                  <div className="text-xs text-gray-500">Local time</div>
                  <div className="font-medium text-gray-900 tabular-nums">{m.localTime.toFormat("cccc, dd LLL yyyy • HH:mm:ss")}</div>
                </div>
                <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                  <div className="text-xs text-gray-500">Session hours</div>
                  <ul className="mt-1 space-y-0.5">
                    {m.sessions.map((s, i) => (
                      <li key={i} className="font-mono text-[13px]">{s.start} – {s.end}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {rows.length === 0 && (
          <div className="text-center text-sm text-gray-600 py-12">No markets match your filters.</div>
        )}

        <div className="mt-8 text-[11px] text-gray-500 leading-relaxed">
          Disclaimer: This tool approximates exchange holidays using national public-holiday calendars. Exchange-specific calendars can differ (e.g., additional closures/half-days). Always confirm with the exchange.
          {holidayError && (
            <div className="text-red-500 mt-1">Holiday data unavailable: {String(holidayError)}</div>
          )}
        </div>
      </main>

      <footer className="max-w-6xl mx-auto px-4 pb-8 text-xs text-gray-400">
        Built with <a className="underline hover:text-gray-600" href="https://moment.github.io/luxon/" target="_blank" rel="noreferrer">Luxon</a> and holiday data from <a className="underline hover:text-gray-600" href="https://date.nager.at" target="_blank" rel="noreferrer">Nager.Date</a>.
      </footer>
    </div>
  );
}
