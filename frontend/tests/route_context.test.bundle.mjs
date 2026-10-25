var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/utils/forecastPresentation.ts
function formatCutoff(cutoff, fallback) {
  const value = validCutoff(cutoff) ? cutoff : validCutoff(fallback) ? fallback : null;
  if (!value) return "Cutoff unavailable";
  const time = `${String(value.hour).padStart(2, "0")}:${String(value.minute).padStart(2, "0")} ${typeof value.timezone === "string" && value.timezone ? value.timezone : "UTC"}`;
  return isIsoDate(cutoff?.date) ? `D-1 \u2022 ${cutoff.date} ${time}` : `D-1 \u2022 ${time}`;
}
function calculateIntervalCoverage(intervals, startDate, endDate) {
  const start = isIsoDate(startDate) ? /* @__PURE__ */ new Date(`${startDate}T00:00:00Z`) : null;
  const end = isIsoDate(endDate) ? /* @__PURE__ */ new Date(`${endDate}T00:00:00Z`) : null;
  const expectedCount = start && end && start <= end ? ((end.getTime() - start.getTime()) / 864e5 + 1) * 48 : 0;
  const validIntervals = /* @__PURE__ */ new Set();
  for (const interval of intervals) {
    const timestamp = new Date(interval.startTime);
    if (!Number.isNaN(timestamp.getTime()) && isFiniteNumber(interval.forecastGeneration) && isFiniteNumber(interval.actualGeneration)) {
      validIntervals.add(timestamp.toISOString());
    }
  }
  const validCount = validIntervals.size;
  return {
    validCount,
    expectedCount,
    percentage: expectedCount > 0 && validCount > 0 ? validCount / expectedCount * 100 : null
  };
}
var isFiniteNumber, isIsoDate, validCutoff;
var init_forecastPresentation = __esm({
  "src/utils/forecastPresentation.ts"() {
    isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);
    isIsoDate = (value) => {
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      const parsed = /* @__PURE__ */ new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
    };
    validCutoff = (value) => {
      if (!value || typeof value.hour !== "number" || typeof value.minute !== "number") return false;
      return Number.isInteger(value.hour) && value.hour >= 0 && value.hour <= 23 && Number.isInteger(value.minute) && value.minute >= 0 && value.minute <= 59;
    };
  }
});

// src/hooks/useApi.ts
import { useState as useState2, useEffect, useCallback, useRef } from "react";
function useApi(fetcher, deps = [], options = { immediate: true }) {
  const [state, setState] = useState2({
    data: null,
    loading: options.immediate ?? true,
    error: null
  });
  const isMounted = useRef(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const execute = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const result = await fetcherRef.current();
      if (isMounted.current) {
        setState({ data: result, loading: false, error: null });
      }
      return result;
    } catch (err) {
      if (isMounted.current) {
        const message = err instanceof Error ? err.message : "An unexpected error occurred";
        setState({ data: null, loading: false, error: message });
      }
      throw err;
    }
  }, []);
  useEffect(() => {
    isMounted.current = true;
    if (options.immediate) {
      execute().catch(() => {
      });
    }
    return () => {
      isMounted.current = false;
    };
  }, deps);
  return {
    ...state,
    refetch: execute
  };
}
var init_useApi = __esm({
  "src/hooks/useApi.ts"() {
  }
});

// src/services/api.ts
async function request(endpoint, options) {
  const cleanBase = BASE_URL.endsWith("/") ? BASE_URL.slice(0, -1) : BASE_URL;
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = `${cleanBase}${cleanEndpoint}`;
  try {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      ...options
    });
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData && (errorData.message || errorData.detail || errorData.error)) {
          errorMessage = errorData.message || errorData.detail || errorData.error;
        }
      } catch {
        const text = await response.text().catch(() => null);
        if (text) errorMessage = text;
      }
      throw new ApiError(errorMessage, response.status);
    }
    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new Error(
      error instanceof Error ? error.message : "Network request failed"
    );
  }
}
var BASE_URL, ApiError, api;
var init_api = __esm({
  "src/services/api.ts"() {
    BASE_URL = typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL !== void 0 ? import.meta.env.VITE_API_BASE_URL : "/api";
    ApiError = class extends Error {
      status;
      constructor(message, status) {
        super(message);
        this.name = "ApiError";
        this.status = status;
      }
    };
    api = {
      getHealth: () => request("/health"),
      getMetadata: () => request("/metadata"),
      getForecasts: (date, cutoffHour = 9, cutoffMinute = 30) => request(
        `/forecasts?date=${encodeURIComponent(date)}&cutoff_hour=${cutoffHour}&cutoff_minute=${cutoffMinute}`
      ),
      getActuals: (date) => request(
        `/actuals?date=${encodeURIComponent(date)}`
      ),
      getAnalysis: (startDate = "2026-01-01", endDate = "2026-01-31", cutoffHour = 9, cutoffMinute = 30) => request(
        `/analysis?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(
          endDate
        )}&cutoff_hour=${cutoffHour}&cutoff_minute=${cutoffMinute}`
      ),
      getForecastPublications: (date, startTime, cutoffHour = 9, cutoffMinute = 30) => request(
        `/forecast-publications?date=${encodeURIComponent(date)}&start_time=${encodeURIComponent(
          startTime
        )}&cutoff_hour=${cutoffHour}&cutoff_minute=${cutoffMinute}`
      ),
      calculateShortfall: (payload) => request("/shortfall", {
        method: "POST",
        body: JSON.stringify(payload)
      })
    };
  }
});

// src/components/common/MetricCard.tsx
import React7 from "react";
var MetricCard;
var init_MetricCard = __esm({
  "src/components/common/MetricCard.tsx"() {
    MetricCard = ({
      label,
      value,
      unit,
      description,
      subtext,
      trend = "neutral",
      badge
    }) => {
      const getTrendColor = () => {
        switch (trend) {
          case "positive":
            return "text-[#22c55e]";
          case "negative":
            return "text-[#ef4444]";
          case "warning":
            return "text-[#f59e0b]";
          default:
            return "text-[#94a3b8]";
        }
      };
      const formattedValue = value !== null && value !== void 0 ? typeof value === "number" ? Number.isInteger(value) ? value.toLocaleString() : value.toFixed(1) : value : "\u2014";
      return /* @__PURE__ */ React7.createElement("div", { className: "bg-[#1a2332] border border-[#2a3a4e] rounded-md p-4 flex flex-col justify-between hover:border-[#3b506b] transition-colors" }, /* @__PURE__ */ React7.createElement("div", { className: "flex items-center justify-between mb-2" }, /* @__PURE__ */ React7.createElement("span", { className: "text-xs font-medium text-[#94a3b8] uppercase tracking-wider" }, label), badge && /* @__PURE__ */ React7.createElement("span", { className: "text-[11px] font-mono px-1.5 py-0.5 rounded bg-[#0f1729] border border-[#2a3a4e] text-[#14b8a6]" }, badge)), /* @__PURE__ */ React7.createElement("div", { className: "flex items-baseline space-x-1.5 my-1" }, /* @__PURE__ */ React7.createElement("span", { className: "text-2xl font-semibold text-[#e2e8f0] font-mono tabular-nums tracking-tight" }, formattedValue), unit && /* @__PURE__ */ React7.createElement("span", { className: "text-xs font-mono text-[#94a3b8]" }, unit)), (description || subtext) && /* @__PURE__ */ React7.createElement("div", { className: "mt-2 pt-2 border-t border-[#2a3a4e]/50 flex items-center justify-between text-xs" }, description && /* @__PURE__ */ React7.createElement("span", { className: "text-[#64748b] truncate", title: description }, description), subtext && /* @__PURE__ */ React7.createElement("span", { className: `font-mono text-xs ${getTrendColor()}` }, subtext)));
    };
  }
});

// src/components/common/LoadingState.tsx
import React8 from "react";
import { Loader2 } from "lucide-react";
var LoadingState;
var init_LoadingState = __esm({
  "src/components/common/LoadingState.tsx"() {
    LoadingState = ({
      message = "Loading forecast telemetry...",
      heightClass = "h-64"
    }) => {
      return /* @__PURE__ */ React8.createElement(
        "div",
        {
          className: `w-full ${heightClass} flex flex-col items-center justify-center bg-[#1a2332]/50 border border-[#2a3a4e] rounded-md p-6`
        },
        /* @__PURE__ */ React8.createElement(Loader2, { className: "w-6 h-6 text-[#14b8a6] animate-spin mb-3" }),
        /* @__PURE__ */ React8.createElement("p", { className: "text-xs font-mono text-[#94a3b8] tracking-wide" }, message)
      );
    };
  }
});

// src/components/common/ErrorState.tsx
import React9 from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
var ErrorState;
var init_ErrorState = __esm({
  "src/components/common/ErrorState.tsx"() {
    ErrorState = ({
      title = "Data Pipeline Error",
      message = "Failed to retrieve telemetry data from the BMRS feed.",
      onRetry,
      heightClass = "h-64"
    }) => {
      return /* @__PURE__ */ React9.createElement(
        "div",
        {
          className: `w-full ${heightClass} flex flex-col items-center justify-center bg-[#1a2332]/50 border border-[#ef4444]/30 rounded-md p-6 text-center`
        },
        /* @__PURE__ */ React9.createElement("div", { className: "w-10 h-10 rounded-full bg-[#ef4444]/10 border border-[#ef4444]/20 flex items-center justify-center mb-3 text-[#ef4444]" }, /* @__PURE__ */ React9.createElement(AlertCircle, { className: "w-5 h-5" })),
        /* @__PURE__ */ React9.createElement("h4", { className: "text-sm font-semibold text-[#e2e8f0] mb-1" }, title),
        /* @__PURE__ */ React9.createElement("p", { className: "text-xs text-[#94a3b8] max-w-md mb-4 font-mono" }, message),
        onRetry && /* @__PURE__ */ React9.createElement(
          "button",
          {
            onClick: onRetry,
            type: "button",
            className: "inline-flex items-center gap-2 px-3 py-1.5 text-xs font-mono font-medium rounded bg-[#1e2a3a] hover:bg-[#2a3a4e] text-[#e2e8f0] border border-[#2a3a4e] transition-colors cursor-pointer"
          },
          /* @__PURE__ */ React9.createElement(RefreshCw, { className: "w-3.5 h-3.5 text-[#14b8a6]" }),
          "Retry Request"
        )
      );
    };
  }
});

// src/components/common/EmptyState.tsx
import React10 from "react";
import { Database } from "lucide-react";
var EmptyState;
var init_EmptyState = __esm({
  "src/components/common/EmptyState.tsx"() {
    EmptyState = ({
      title = "No Telemetry Recorded",
      description = "No published wind forecast intervals or settlement actuals found for the selected parameters.",
      heightClass = "h-64"
    }) => {
      return /* @__PURE__ */ React10.createElement(
        "div",
        {
          className: `w-full ${heightClass} flex flex-col items-center justify-center bg-[#1a2332]/50 border border-[#2a3a4e] rounded-md p-6 text-center`
        },
        /* @__PURE__ */ React10.createElement("div", { className: "w-10 h-10 rounded-full bg-[#0f1729] border border-[#2a3a4e] flex items-center justify-center mb-3 text-[#64748b]" }, /* @__PURE__ */ React10.createElement(Database, { className: "w-5 h-5" })),
        /* @__PURE__ */ React10.createElement("h4", { className: "text-sm font-semibold text-[#e2e8f0] mb-1" }, title),
        /* @__PURE__ */ React10.createElement("p", { className: "text-xs text-[#94a3b8] max-w-sm font-mono" }, description)
      );
    };
  }
});

// src/components/charts/ForecastActualChart.tsx
import React11, { useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from "recharts";
var ForecastActualChart;
var init_ForecastActualChart = __esm({
  "src/components/charts/ForecastActualChart.tsx"() {
    ForecastActualChart = ({
      intervals,
      title = "Day-Ahead Wind Forecast vs. Settlement Actual Generation",
      subtitle = "30-minute settlement period resolution (MW)",
      height = 360
    }) => {
      const chartData = useMemo(() => {
        return intervals.map((item) => {
          const dateObj = new Date(item.startTime);
          const timeStr = dateObj.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
            timeZone: "UTC"
          });
          return {
            time: timeStr,
            fullTime: item.startTime,
            forecast: item.forecastGeneration,
            actual: item.actualGeneration,
            error: item.signedError,
            publishTime: item.publishTime
          };
        });
      }, [intervals]);
      if (!intervals || intervals.length === 0) {
        return /* @__PURE__ */ React11.createElement("div", { className: "bg-[#1a2332] border border-[#2a3a4e] rounded-md p-6 text-center text-[#94a3b8] font-mono text-xs" }, "No interval data available for chart rendering.");
      }
      return /* @__PURE__ */ React11.createElement("div", { className: "bg-[#1a2332] border border-[#2a3a4e] rounded-md p-4" }, /* @__PURE__ */ React11.createElement("div", { className: "flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#2a3a4e] mb-4 gap-2" }, /* @__PURE__ */ React11.createElement("div", null, /* @__PURE__ */ React11.createElement("h3", { className: "text-sm font-semibold text-[#e2e8f0]" }, title), /* @__PURE__ */ React11.createElement("p", { className: "text-xs text-[#94a3b8] font-mono" }, subtitle)), /* @__PURE__ */ React11.createElement("div", { className: "flex items-center gap-4 text-xs font-mono" }, /* @__PURE__ */ React11.createElement("div", { className: "flex items-center gap-1.5" }, /* @__PURE__ */ React11.createElement("span", { className: "w-3 h-0.5 bg-[#3b82f6] rounded" }), /* @__PURE__ */ React11.createElement("span", { className: "text-[#94a3b8]" }, "Forecast (MW)")), /* @__PURE__ */ React11.createElement("div", { className: "flex items-center gap-1.5" }, /* @__PURE__ */ React11.createElement("span", { className: "w-3 h-0.5 bg-[#22c55e] rounded" }), /* @__PURE__ */ React11.createElement("span", { className: "text-[#94a3b8]" }, "Actual (MW)")))), /* @__PURE__ */ React11.createElement("div", { style: { width: "100%", height } }, /* @__PURE__ */ React11.createElement(ResponsiveContainer, { width: "100%", height: "100%" }, /* @__PURE__ */ React11.createElement(
        ComposedChart,
        {
          data: chartData,
          margin: { top: 10, right: 10, left: -10, bottom: 0 }
        },
        /* @__PURE__ */ React11.createElement(CartesianGrid, { strokeDasharray: "3 3", stroke: "#2a3a4e", vertical: false }),
        /* @__PURE__ */ React11.createElement(
          XAxis,
          {
            dataKey: "time",
            stroke: "#64748b",
            fontSize: 11,
            fontFamily: "monospace",
            tickLine: false,
            axisLine: { stroke: "#2a3a4e" },
            interval: "preserveStartEnd",
            minTickGap: 24
          }
        ),
        /* @__PURE__ */ React11.createElement(
          YAxis,
          {
            stroke: "#64748b",
            fontSize: 11,
            fontFamily: "monospace",
            tickLine: false,
            axisLine: { stroke: "#2a3a4e" },
            tickFormatter: (v) => `${(v / 1e3).toFixed(1)}k`,
            unit: " MW"
          }
        ),
        /* @__PURE__ */ React11.createElement(
          Tooltip,
          {
            content: ({ active, payload }) => {
              if (!active || !payload || !payload.length) return null;
              const data = payload[0].payload;
              return /* @__PURE__ */ React11.createElement("div", { className: "bg-[#0f1729] border border-[#2a3a4e] rounded p-3 text-xs shadow-xl font-mono" }, /* @__PURE__ */ React11.createElement("div", { className: "text-[#94a3b8] border-b border-[#2a3a4e] pb-1.5 mb-2 font-medium" }, "Interval: ", /* @__PURE__ */ React11.createElement("span", { className: "text-[#e2e8f0]" }, data.time, " UTC")), /* @__PURE__ */ React11.createElement("div", { className: "space-y-1.5" }, /* @__PURE__ */ React11.createElement("div", { className: "flex items-center justify-between gap-4" }, /* @__PURE__ */ React11.createElement("span", { className: "text-[#3b82f6] flex items-center gap-1.5" }, /* @__PURE__ */ React11.createElement("span", { className: "w-2 h-2 rounded-full bg-[#3b82f6]" }), "Forecast:"), /* @__PURE__ */ React11.createElement("span", { className: "text-[#e2e8f0] font-semibold tabular-nums" }, data.forecast !== null ? `${data.forecast.toLocaleString()} MW` : "N/A")), /* @__PURE__ */ React11.createElement("div", { className: "flex items-center justify-between gap-4" }, /* @__PURE__ */ React11.createElement("span", { className: "text-[#22c55e] flex items-center gap-1.5" }, /* @__PURE__ */ React11.createElement("span", { className: "w-2 h-2 rounded-full bg-[#22c55e]" }), "Actual:"), /* @__PURE__ */ React11.createElement("span", { className: "text-[#e2e8f0] font-semibold tabular-nums" }, data.actual !== null ? `${data.actual.toLocaleString()} MW` : "N/A")), data.error !== null && /* @__PURE__ */ React11.createElement("div", { className: "flex items-center justify-between gap-4 pt-1.5 border-t border-[#2a3a4e]/70" }, /* @__PURE__ */ React11.createElement("span", { className: "text-[#94a3b8]" }, "Signed Error:"), /* @__PURE__ */ React11.createElement(
                "span",
                {
                  className: `font-semibold tabular-nums ${data.error > 0 ? "text-[#f59e0b]" : data.error < 0 ? "text-[#3b82f6]" : "text-[#e2e8f0]"}`
                },
                data.error > 0 ? `+${data.error.toLocaleString()}` : data.error.toLocaleString(),
                " MW"
              )), data.publishTime && /* @__PURE__ */ React11.createElement("div", { className: "text-[10px] text-[#64748b] pt-1 border-t border-[#2a3a4e]/40" }, "Published: ", new Date(data.publishTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }), " UTC")));
            }
          }
        ),
        /* @__PURE__ */ React11.createElement(Legend, { content: () => null }),
        /* @__PURE__ */ React11.createElement(
          Line,
          {
            type: "monotone",
            dataKey: "forecast",
            name: "Forecast",
            stroke: "#3b82f6",
            strokeWidth: 2,
            dot: false,
            activeDot: { r: 4, stroke: "#3b82f6", strokeWidth: 2, fill: "#0f1729" },
            isAnimationActive: false
          }
        ),
        /* @__PURE__ */ React11.createElement(
          Line,
          {
            type: "monotone",
            dataKey: "actual",
            name: "Actual",
            stroke: "#22c55e",
            strokeWidth: 2,
            dot: false,
            activeDot: { r: 4, stroke: "#22c55e", strokeWidth: 2, fill: "#0f1729" },
            isAnimationActive: false
          }
        )
      ))));
    };
  }
});

// src/components/charts/ForecastErrorChart.tsx
import React12, { useMemo as useMemo2 } from "react";
import {
  ResponsiveContainer as ResponsiveContainer2,
  BarChart,
  Bar,
  XAxis as XAxis2,
  YAxis as YAxis2,
  Tooltip as Tooltip2,
  CartesianGrid as CartesianGrid2,
  ReferenceLine,
  Cell
} from "recharts";
var ForecastErrorChart;
var init_ForecastErrorChart = __esm({
  "src/components/charts/ForecastErrorChart.tsx"() {
    ForecastErrorChart = ({
      intervals,
      title = "Forecast Delta & Bias Distribution (Signed Error)",
      subtitle = "Signed Error = Forecast \u2212 Actual (Positive = Overprediction, Negative = Underprediction)",
      height = 280
    }) => {
      const chartData = useMemo2(() => {
        return intervals.map((item) => {
          const dateObj = new Date(item.startTime);
          const timeStr = dateObj.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
            timeZone: "UTC"
          });
          return {
            time: timeStr,
            signedError: item.signedError,
            absoluteError: item.absoluteError,
            forecast: item.forecastGeneration,
            actual: item.actualGeneration
          };
        });
      }, [intervals]);
      if (!intervals || intervals.length === 0) {
        return /* @__PURE__ */ React12.createElement("div", { className: "bg-[#1a2332] border border-[#2a3a4e] rounded-md p-6 text-center text-[#94a3b8] font-mono text-xs" }, "No error telemetry available.");
      }
      return /* @__PURE__ */ React12.createElement("div", { className: "bg-[#1a2332] border border-[#2a3a4e] rounded-md p-4" }, /* @__PURE__ */ React12.createElement("div", { className: "flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#2a3a4e] mb-4 gap-2" }, /* @__PURE__ */ React12.createElement("div", null, /* @__PURE__ */ React12.createElement("h3", { className: "text-sm font-semibold text-[#e2e8f0]" }, title), /* @__PURE__ */ React12.createElement("p", { className: "text-xs text-[#94a3b8] font-mono" }, subtitle)), /* @__PURE__ */ React12.createElement("div", { className: "flex items-center gap-4 text-xs font-mono" }, /* @__PURE__ */ React12.createElement("div", { className: "flex items-center gap-1.5" }, /* @__PURE__ */ React12.createElement("span", { className: "w-2.5 h-2.5 bg-[#f59e0b] rounded-sm" }), /* @__PURE__ */ React12.createElement("span", { className: "text-[#94a3b8]" }, "Overprediction (+MW)")), /* @__PURE__ */ React12.createElement("div", { className: "flex items-center gap-1.5" }, /* @__PURE__ */ React12.createElement("span", { className: "w-2.5 h-2.5 bg-[#3b82f6] rounded-sm" }), /* @__PURE__ */ React12.createElement("span", { className: "text-[#94a3b8]" }, "Underprediction (-MW)")))), /* @__PURE__ */ React12.createElement("div", { style: { width: "100%", height } }, /* @__PURE__ */ React12.createElement(ResponsiveContainer2, { width: "100%", height: "100%" }, /* @__PURE__ */ React12.createElement(
        BarChart,
        {
          data: chartData,
          margin: { top: 10, right: 10, left: -10, bottom: 0 }
        },
        /* @__PURE__ */ React12.createElement(CartesianGrid2, { strokeDasharray: "3 3", stroke: "#2a3a4e", vertical: false }),
        /* @__PURE__ */ React12.createElement(
          XAxis2,
          {
            dataKey: "time",
            stroke: "#64748b",
            fontSize: 11,
            fontFamily: "monospace",
            tickLine: false,
            axisLine: { stroke: "#2a3a4e" },
            interval: "preserveStartEnd",
            minTickGap: 24
          }
        ),
        /* @__PURE__ */ React12.createElement(
          YAxis2,
          {
            stroke: "#64748b",
            fontSize: 11,
            fontFamily: "monospace",
            tickLine: false,
            axisLine: { stroke: "#2a3a4e" },
            tickFormatter: (v) => `${v > 0 ? "+" : ""}${v} MW`
          }
        ),
        /* @__PURE__ */ React12.createElement(ReferenceLine, { y: 0, stroke: "#64748b", strokeWidth: 1 }),
        /* @__PURE__ */ React12.createElement(
          Tooltip2,
          {
            content: ({ active, payload }) => {
              if (!active || !payload || !payload.length) return null;
              const data = payload[0].payload;
              const isOver = (data.signedError ?? 0) > 0;
              return /* @__PURE__ */ React12.createElement("div", { className: "bg-[#0f1729] border border-[#2a3a4e] rounded p-3 text-xs shadow-xl font-mono" }, /* @__PURE__ */ React12.createElement("div", { className: "text-[#94a3b8] border-b border-[#2a3a4e] pb-1.5 mb-2 font-medium" }, "Interval: ", /* @__PURE__ */ React12.createElement("span", { className: "text-[#e2e8f0]" }, data.time, " UTC")), /* @__PURE__ */ React12.createElement("div", { className: "space-y-1.5" }, /* @__PURE__ */ React12.createElement("div", { className: "flex items-center justify-between gap-4" }, /* @__PURE__ */ React12.createElement("span", { className: "text-[#94a3b8]" }, "Signed Delta:"), /* @__PURE__ */ React12.createElement(
                "span",
                {
                  className: `font-semibold tabular-nums ${isOver ? "text-[#f59e0b]" : "text-[#3b82f6]"}`
                },
                data.signedError !== null ? `${data.signedError > 0 ? "+" : ""}${data.signedError.toLocaleString()} MW` : "N/A"
              )), /* @__PURE__ */ React12.createElement("div", { className: "flex items-center justify-between gap-4" }, /* @__PURE__ */ React12.createElement("span", { className: "text-[#94a3b8]" }, "Abs Error (|e|):"), /* @__PURE__ */ React12.createElement("span", { className: "text-[#e2e8f0] font-semibold tabular-nums" }, data.absoluteError !== null ? `${data.absoluteError.toLocaleString()} MW` : "N/A")), /* @__PURE__ */ React12.createElement("div", { className: "flex items-center justify-between gap-4 pt-1.5 border-t border-[#2a3a4e]/60 text-[#64748b]" }, /* @__PURE__ */ React12.createElement("span", null, "Direction:"), /* @__PURE__ */ React12.createElement("span", { className: "font-medium text-[#e2e8f0]" }, data.signedError === null ? "N/A" : data.signedError > 0 ? "Overpredicted generation" : data.signedError < 0 ? "Underpredicted generation" : "Exact match"))));
            }
          }
        ),
        /* @__PURE__ */ React12.createElement(Bar, { dataKey: "signedError", isAnimationActive: false }, chartData.map((entry, index) => /* @__PURE__ */ React12.createElement(
          Cell,
          {
            key: `cell-${index}`,
            fill: (entry.signedError ?? 0) >= 0 ? "#f59e0b" : "#3b82f6",
            fillOpacity: 0.85
          }
        )))
      ))));
    };
  }
});

// src/components/features/ShortfallCalculator.tsx
import React13, { useState as useState3, useEffect as useEffect2 } from "react";
import { Calculator, ArrowRight, ShieldAlert as ShieldAlert2, Clock as Clock2 } from "lucide-react";
var ShortfallCalculator;
var init_ShortfallCalculator = __esm({
  "src/components/features/ShortfallCalculator.tsx"() {
    init_api();
    ShortfallCalculator = ({
      initialForecastMw = 14500,
      intervals = [],
      selectedDate
    }) => {
      const [demandMw, setDemandMw] = useState3(36e3);
      const [selectedIntervalIndex, setSelectedIntervalIndex] = useState3("custom");
      const [forecastMw, setForecastMw] = useState3(initialForecastMw);
      const [loading, setLoading] = useState3(false);
      const [result, setResult] = useState3(null);
      const [error, setError] = useState3(null);
      useEffect2(() => {
        if (intervals && intervals.length > 0) {
          const peakEveningIndex = intervals.findIndex((inv) => {
            const d = new Date(inv.startTime);
            return d.getUTCHours() === 17 && d.getUTCMinutes() === 30 && inv.forecastGeneration !== null;
          });
          const chosenIdx = peakEveningIndex >= 0 ? peakEveningIndex : intervals.findIndex((inv) => inv.forecastGeneration !== null);
          if (chosenIdx >= 0) {
            setSelectedIntervalIndex(chosenIdx);
            setForecastMw(intervals[chosenIdx].forecastGeneration ?? initialForecastMw);
            return;
          }
        }
        setForecastMw(initialForecastMw);
      }, [intervals, initialForecastMw]);
      const handleIntervalSelect = (value) => {
        if (value === "custom") {
          setSelectedIntervalIndex("custom");
        } else {
          const idx = Number(value);
          setSelectedIntervalIndex(idx);
          const chosen = intervals[idx];
          if (chosen && chosen.forecastGeneration !== null) {
            setForecastMw(chosen.forecastGeneration);
          }
        }
      };
      const handleCalculate = async (e) => {
        if (e) e.preventDefault();
        setLoading(true);
        setError(null);
        try {
          const response = await api.calculateShortfall({
            demand_mw: Number(demandMw),
            forecast_mw: Number(forecastMw)
          });
          setResult(response);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Calculation failed");
        } finally {
          setLoading(false);
        }
      };
      const calculatedShortfall = Math.max(0, demandMw - forecastMw);
      const selectedInterval = typeof selectedIntervalIndex === "number" && intervals[selectedIntervalIndex] ? intervals[selectedIntervalIndex] : null;
      return /* @__PURE__ */ React13.createElement("div", { className: "bg-[#1a2332] border border-[#2a3a4e] rounded-md p-5" }, /* @__PURE__ */ React13.createElement("div", { className: "flex items-center gap-2 pb-3 mb-4 border-b border-[#2a3a4e]" }, /* @__PURE__ */ React13.createElement(Calculator, { className: "w-4 h-4 text-[#14b8a6]" }), /* @__PURE__ */ React13.createElement("div", null, /* @__PURE__ */ React13.createElement("h3", { className: "text-sm font-semibold text-[#e2e8f0]" }, "Residual Demand & Shortfall Stress Calculator"), /* @__PURE__ */ React13.createElement("p", { className: "text-xs text-[#94a3b8]" }, "Simulate thermal/storage dispatch requirements given wind forecast generation"))), /* @__PURE__ */ React13.createElement("form", { onSubmit: handleCalculate, className: "space-y-4" }, intervals && intervals.length > 0 && /* @__PURE__ */ React13.createElement("div", { className: "bg-[#0f1729] border border-[#2a3a4e] rounded p-3" }, /* @__PURE__ */ React13.createElement("label", { className: "block text-xs font-mono text-[#94a3b8] mb-1.5 flex items-center gap-1.5" }, /* @__PURE__ */ React13.createElement(Clock2, { className: "w-3.5 h-3.5 text-[#14b8a6]" }), /* @__PURE__ */ React13.createElement("span", null, "Target Settlement Interval (30-Minute Period)")), /* @__PURE__ */ React13.createElement(
        "select",
        {
          value: selectedIntervalIndex,
          onChange: (e) => handleIntervalSelect(e.target.value),
          className: "w-full bg-[#1a2332] border border-[#2a3a4e] rounded px-3 py-2 text-xs font-mono text-[#e2e8f0] focus:outline-none focus:border-[#14b8a6] cursor-pointer"
        },
        /* @__PURE__ */ React13.createElement("option", { value: "custom" }, "Manual / Custom Forecast Value"),
        intervals.map((inv, idx) => {
          const dateObj = new Date(inv.startTime);
          const timeStr = dateObj.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
            timeZone: "UTC"
          });
          const periodNum = idx + 1;
          const fcText = inv.forecastGeneration !== null ? `${inv.forecastGeneration.toLocaleString()} MW` : "No forecast";
          return /* @__PURE__ */ React13.createElement("option", { key: inv.startTime, value: idx }, "Period ", periodNum, " (", timeStr, " UTC) \u2014 Forecast: ", fcText);
        })
      ), selectedInterval && /* @__PURE__ */ React13.createElement("p", { className: "text-[11px] text-[#14b8a6] mt-1.5 font-mono" }, "Using Period ", Number(selectedIntervalIndex) + 1, " (", new Date(selectedInterval.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" }), " UTC) day-ahead forecast of ", selectedInterval.forecastGeneration?.toLocaleString() ?? "\u2014", " MW")), /* @__PURE__ */ React13.createElement("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4" }, /* @__PURE__ */ React13.createElement("div", null, /* @__PURE__ */ React13.createElement("label", { className: "block text-xs font-mono text-[#94a3b8] mb-1.5" }, "System Demand (MW)"), /* @__PURE__ */ React13.createElement("div", { className: "relative" }, /* @__PURE__ */ React13.createElement(
        "input",
        {
          type: "number",
          min: "0",
          step: "100",
          value: demandMw,
          onChange: (e) => setDemandMw(Number(e.target.value)),
          className: "w-full bg-[#0f1729] border border-[#2a3a4e] rounded px-3 py-2 text-sm font-mono text-[#e2e8f0] focus:outline-none focus:border-[#14b8a6]",
          placeholder: "e.g. 36000"
        }
      ), /* @__PURE__ */ React13.createElement("span", { className: "absolute right-3 top-2.5 text-xs text-[#64748b] font-mono" }, "MW")), /* @__PURE__ */ React13.createElement("p", { className: "text-[11px] text-[#64748b] mt-1 font-mono" }, "Typical UK winter peak: 38,000\u201344,000 MW")), /* @__PURE__ */ React13.createElement("div", null, /* @__PURE__ */ React13.createElement("label", { className: "block text-xs font-mono text-[#94a3b8] mb-1.5" }, "Wind Generation Forecast (MW)"), /* @__PURE__ */ React13.createElement("div", { className: "relative" }, /* @__PURE__ */ React13.createElement(
        "input",
        {
          type: "number",
          min: "0",
          step: "100",
          value: forecastMw,
          onChange: (e) => {
            setSelectedIntervalIndex("custom");
            setForecastMw(Number(e.target.value));
          },
          className: "w-full bg-[#0f1729] border border-[#2a3a4e] rounded px-3 py-2 text-sm font-mono text-[#e2e8f0] focus:outline-none focus:border-[#14b8a6]",
          placeholder: "e.g. 14500"
        }
      ), /* @__PURE__ */ React13.createElement("span", { className: "absolute right-3 top-2.5 text-xs text-[#64748b] font-mono" }, "MW")), /* @__PURE__ */ React13.createElement("p", { className: "text-[11px] text-[#64748b] mt-1 font-mono" }, "GB Wind Nameplate Capacity: ~30,000 MW"))), /* @__PURE__ */ React13.createElement("div", { className: "flex items-center justify-between pt-2" }, /* @__PURE__ */ React13.createElement("div", { className: "flex gap-2" }, [
        { label: "Low Wind / High Peak", d: 42e3, f: 3200 },
        { label: "Average Winter", d: 36e3, f: 14500 },
        { label: "High Wind Storm", d: 33e3, f: 22e3 }
      ].map((preset) => /* @__PURE__ */ React13.createElement(
        "button",
        {
          key: preset.label,
          type: "button",
          onClick: () => {
            setSelectedIntervalIndex("custom");
            setDemandMw(preset.d);
            setForecastMw(preset.f);
          },
          className: "px-2 py-1 text-[11px] font-mono bg-[#0f1729] hover:bg-[#1e2a3a] text-[#94a3b8] rounded border border-[#2a3a4e] transition-colors"
        },
        preset.label
      ))), /* @__PURE__ */ React13.createElement(
        "button",
        {
          type: "submit",
          disabled: loading,
          className: "inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded bg-[#14b8a6] hover:bg-[#0d9488] text-[#0f1729] transition-colors cursor-pointer disabled:opacity-50"
        },
        /* @__PURE__ */ React13.createElement("span", null, loading ? "Evaluating..." : "Compute Residual Shortfall"),
        /* @__PURE__ */ React13.createElement(ArrowRight, { className: "w-3.5 h-3.5" })
      ))), error && /* @__PURE__ */ React13.createElement("div", { className: "mt-4 p-3 rounded bg-[#ef4444]/10 border border-[#ef4444]/20 text-xs font-mono text-[#ef4444]" }, error), (result || !error && demandMw > 0) && /* @__PURE__ */ React13.createElement("div", { className: "mt-5 pt-4 border-t border-[#2a3a4e]" }, /* @__PURE__ */ React13.createElement("div", { className: "grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4" }, /* @__PURE__ */ React13.createElement("div", { className: "bg-[#0f1729] border border-[#2a3a4e] p-3 rounded" }, /* @__PURE__ */ React13.createElement("span", { className: "text-[11px] font-mono text-[#94a3b8] uppercase" }, "Target Demand"), /* @__PURE__ */ React13.createElement("div", { className: "text-lg font-mono font-semibold text-[#e2e8f0] tabular-nums mt-0.5" }, (result?.demand_mw ?? demandMw).toLocaleString(), " MW")), /* @__PURE__ */ React13.createElement("div", { className: "bg-[#0f1729] border border-[#2a3a4e] p-3 rounded" }, /* @__PURE__ */ React13.createElement("span", { className: "text-[11px] font-mono text-[#94a3b8] uppercase" }, "Wind Share"), /* @__PURE__ */ React13.createElement("div", { className: "text-lg font-mono font-semibold text-[#14b8a6] tabular-nums mt-0.5" }, ((result?.forecast_mw ?? forecastMw) / (result?.demand_mw ?? demandMw) * 100).toFixed(1), "%"), /* @__PURE__ */ React13.createElement("span", { className: "text-[10px] text-[#64748b] font-mono" }, (result?.forecast_mw ?? forecastMw).toLocaleString(), " MW forecast")), /* @__PURE__ */ React13.createElement("div", { className: "bg-[#0f1729] border border-[#2a3a4e] p-3 rounded" }, /* @__PURE__ */ React13.createElement("span", { className: "text-[11px] font-mono text-[#94a3b8] uppercase" }, "Thermal/Interconnector Residual"), /* @__PURE__ */ React13.createElement("div", { className: "text-lg font-mono font-semibold text-[#f59e0b] tabular-nums mt-0.5" }, (result?.shortfall_mw ?? calculatedShortfall).toLocaleString(), " MW"), /* @__PURE__ */ React13.createElement("span", { className: "text-[10px] text-[#64748b] font-mono" }, "Capacity required"))), /* @__PURE__ */ React13.createElement("div", { className: "flex items-start gap-2 p-3 bg-[#0f1729]/70 border border-[#2a3a4e] rounded text-[11px] text-[#94a3b8] font-mono leading-relaxed" }, /* @__PURE__ */ React13.createElement(ShieldAlert2, { className: "w-4 h-4 text-[#f59e0b] shrink-0 mt-0.5" }), /* @__PURE__ */ React13.createElement("div", null, /* @__PURE__ */ React13.createElement("span", { className: "font-semibold text-[#e2e8f0]" }, "System Operational Notice: "), result?.disclaimer || "Simulated shortfall calculation based on raw day-ahead forecast deltas. This metric is informational and does not account for interconnectors, pumped storage, rapid CCGT spinning reserves, or demand-side balancing mechanisms."))));
    };
  }
});

// src/pages/Overview.tsx
var Overview_exports = {};
__export(Overview_exports, {
  Overview: () => Overview
});
import React14 from "react";
import { useOutletContext } from "react-router-dom";
var Overview;
var init_Overview = __esm({
  "src/pages/Overview.tsx"() {
    init_useApi();
    init_api();
    init_MetricCard();
    init_LoadingState();
    init_ErrorState();
    init_EmptyState();
    init_ForecastActualChart();
    init_ForecastErrorChart();
    init_ShortfallCalculator();
    init_forecastPresentation();
    Overview = () => {
      const { selectedDate, cutoffHour, cutoffMinute } = useOutletContext();
      const {
        data: forecastData,
        loading,
        error,
        refetch
      } = useApi(
        () => api.getForecasts(selectedDate, cutoffHour, cutoffMinute),
        [selectedDate, cutoffHour, cutoffMinute]
      );
      if (loading) {
        return /* @__PURE__ */ React14.createElement(LoadingState, { message: `Fetching BMRS WINDFOR and FUELHH data for ${selectedDate}...` });
      }
      if (error) {
        return /* @__PURE__ */ React14.createElement(
          ErrorState,
          {
            title: "Failed to Load Overview Data",
            message: error,
            onRetry: refetch
          }
        );
      }
      if (!forecastData || !forecastData.intervals || forecastData.intervals.length === 0) {
        return /* @__PURE__ */ React14.createElement(
          EmptyState,
          {
            title: "No Forecast Records",
            description: `No day-ahead forecast publications found for ${selectedDate} prior to ${String(
              cutoffHour
            ).padStart(2, "0")}:${String(cutoffMinute).padStart(2, "0")} UTC cutoff.`
          }
        );
      }
      const { intervals, summary, cutoff } = forecastData;
      const intervalCoverage = calculateIntervalCoverage(intervals, selectedDate, selectedDate);
      const cutoffDisplay = formatCutoff(cutoff, {
        hour: cutoffHour,
        minute: cutoffMinute,
        timezone: "UTC"
      });
      let peakActual = 0;
      let peakForecast = 0;
      intervals.forEach((i) => {
        if (i.actualGeneration && i.actualGeneration > peakActual) peakActual = i.actualGeneration;
        if (i.forecastGeneration && i.forecastGeneration > peakForecast) peakForecast = i.forecastGeneration;
      });
      const biasTrend = summary.bias === null || summary.bias === 0 ? "neutral" : summary.bias > 0 ? "warning" : "positive";
      return /* @__PURE__ */ React14.createElement("div", { className: "space-y-6" }, /* @__PURE__ */ React14.createElement("div", { className: "flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#2a3a4e] gap-2" }, /* @__PURE__ */ React14.createElement("div", null, /* @__PURE__ */ React14.createElement("h1", { className: "text-base font-semibold text-[#e2e8f0]" }, "GB Wind Generation Day-Ahead Intelligence"), /* @__PURE__ */ React14.createElement("p", { className: "text-xs text-[#94a3b8] font-mono" }, "Settlement Date: ", /* @__PURE__ */ React14.createElement("span", { className: "text-[#14b8a6]" }, selectedDate), " \u2022 Decision Cutoff:", " ", /* @__PURE__ */ React14.createElement("span", { className: "text-[#14b8a6]" }, cutoffDisplay))), /* @__PURE__ */ React14.createElement("div", { className: "flex items-center gap-2 text-xs font-mono" }, intervalCoverage.percentage === null ? /* @__PURE__ */ React14.createElement("span", { className: "px-2 py-1 rounded bg-[#1a2332] border border-[#2a3a4e] text-[#94a3b8]" }, "No valid matched intervals") : /* @__PURE__ */ React14.createElement(React14.Fragment, null, /* @__PURE__ */ React14.createElement("span", { className: "px-2 py-1 rounded bg-[#1a2332] border border-[#2a3a4e] text-[#94a3b8]" }, "Valid Intervals: ", /* @__PURE__ */ React14.createElement("strong", { className: "text-[#e2e8f0]" }, intervalCoverage.validCount, " / ", intervalCoverage.expectedCount)), /* @__PURE__ */ React14.createElement("span", { className: "px-2 py-1 rounded bg-[#1a2332] border border-[#2a3a4e] text-[#14b8a6]" }, "Coverage: ", /* @__PURE__ */ React14.createElement("strong", { className: "text-[#14b8a6]" }, intervalCoverage.percentage.toFixed(1).replace(/\.0$/, ""), "%"))))), /* @__PURE__ */ React14.createElement("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" }, /* @__PURE__ */ React14.createElement(
        MetricCard,
        {
          label: "Mean Absolute Error (MAE)",
          value: summary.mae,
          unit: "MW",
          description: "Average magnitude of forecast error",
          subtext: summary.mape ? `${summary.mape.toFixed(1)}% MAPE` : void 0,
          badge: "Dispersion"
        }
      ), /* @__PURE__ */ React14.createElement(
        MetricCard,
        {
          label: "Root Mean Square Error (RMSE)",
          value: summary.rmse,
          unit: "MW",
          description: "Penalizes large tail dispatch errors",
          badge: "Risk"
        }
      ), /* @__PURE__ */ React14.createElement(
        MetricCard,
        {
          label: "Systemic Mean Bias",
          value: summary.bias !== null && summary.bias > 0 ? `+${summary.bias.toFixed(1)}` : summary.bias,
          unit: "MW",
          description: "Signed delta (Forecast - Actual)",
          subtext: summary.bias !== null ? summary.bias > 0 ? "Overpredicted volume" : "Underpredicted volume" : void 0,
          trend: biasTrend,
          badge: "Direction"
        }
      ), /* @__PURE__ */ React14.createElement(
        MetricCard,
        {
          label: "Peak Generation",
          value: peakActual,
          unit: "MW",
          description: `Forecast Peak: ${peakForecast.toLocaleString()} MW`,
          subtext: `Delta: ${peakForecast - peakActual > 0 ? "+" : ""}${(peakForecast - peakActual).toLocaleString()} MW`,
          trend: "neutral",
          badge: "Capacity"
        }
      )), /* @__PURE__ */ React14.createElement("div", { className: "w-full" }, /* @__PURE__ */ React14.createElement(
        ForecastActualChart,
        {
          intervals,
          title: `Day-Ahead Forecast vs Settlement Actuals \u2014 ${selectedDate}`,
          subtitle: `Evaluated against latest WINDFOR published before ${cutoffDisplay.replace(/^D-1 • /, "")}`,
          height: 380
        }
      )), /* @__PURE__ */ React14.createElement("div", { className: "w-full" }, /* @__PURE__ */ React14.createElement(
        ForecastErrorChart,
        {
          intervals,
          title: `Settlement Period Forecast Errors (MW) \u2014 ${selectedDate}`,
          height: 260
        }
      )), /* @__PURE__ */ React14.createElement("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-6" }, /* @__PURE__ */ React14.createElement("div", { className: "lg:col-span-1 space-y-4" }, /* @__PURE__ */ React14.createElement("div", { className: "bg-[#1a2332] border border-[#2a3a4e] rounded-md p-4" }, /* @__PURE__ */ React14.createElement("h3", { className: "text-xs font-semibold text-[#e2e8f0] uppercase tracking-wider mb-3" }, "Distribution Diagnostics"), /* @__PURE__ */ React14.createElement("div", { className: "space-y-3 font-mono text-xs" }, /* @__PURE__ */ React14.createElement("div", null, /* @__PURE__ */ React14.createElement("div", { className: "flex justify-between text-[#94a3b8] mb-1" }, /* @__PURE__ */ React14.createElement("span", null, "Overprediction Periods:"), /* @__PURE__ */ React14.createElement("span", { className: "text-[#f59e0b] font-semibold" }, summary.overpredictionPct !== null ? `${summary.overpredictionPct}%` : "\u2014")), /* @__PURE__ */ React14.createElement("div", { className: "w-full bg-[#0f1729] h-1.5 rounded-full overflow-hidden" }, /* @__PURE__ */ React14.createElement(
        "div",
        {
          className: "bg-[#f59e0b] h-full rounded-full",
          style: { width: `${summary.overpredictionPct ?? 0}%` }
        }
      ))), /* @__PURE__ */ React14.createElement("div", null, /* @__PURE__ */ React14.createElement("div", { className: "flex justify-between text-[#94a3b8] mb-1" }, /* @__PURE__ */ React14.createElement("span", null, "Underprediction Periods:"), /* @__PURE__ */ React14.createElement("span", { className: "text-[#3b82f6] font-semibold" }, summary.underpredictionPct !== null ? `${summary.underpredictionPct}%` : "\u2014")), /* @__PURE__ */ React14.createElement("div", { className: "w-full bg-[#0f1729] h-1.5 rounded-full overflow-hidden" }, /* @__PURE__ */ React14.createElement(
        "div",
        {
          className: "bg-[#3b82f6] h-full rounded-full",
          style: { width: `${summary.underpredictionPct ?? 0}%` }
        }
      ))), /* @__PURE__ */ React14.createElement("div", { className: "pt-2 border-t border-[#2a3a4e] text-[#64748b] text-[11px] leading-relaxed" }, "Overpredicted intervals require the Balancing Mechanism to dispatch rapid response gas turbines or constrain demand, elevating system balancing costs.")))), /* @__PURE__ */ React14.createElement("div", { className: "lg:col-span-2" }, /* @__PURE__ */ React14.createElement(
        ShortfallCalculator,
        {
          initialForecastMw: Math.round(peakForecast * 0.75),
          intervals,
          selectedDate
        }
      ))));
    };
  }
});

// src/components/tables/ForecastTable.tsx
import React15, { useState as useState4, useMemo as useMemo3 } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, ExternalLink } from "lucide-react";
var isFiniteNumber2, formatNumber, ForecastTable;
var init_ForecastTable = __esm({
  "src/components/tables/ForecastTable.tsx"() {
    isFiniteNumber2 = (value) => typeof value === "number" && Number.isFinite(value);
    formatNumber = (value, signed = false) => {
      if (!isFiniteNumber2(value)) return "\u2014";
      return `${signed && value > 0 ? "+" : ""}${value.toLocaleString()}`;
    };
    ForecastTable = ({
      intervals,
      onSelectInterval
    }) => {
      const [sortField, setSortField] = useState4("startTime");
      const [sortOrder, setSortOrder] = useState4("asc");
      const [filterType, setFilterType] = useState4("all");
      const handleSort = (field) => {
        if (sortField === field) {
          setSortOrder(sortOrder === "asc" ? "desc" : "asc");
        } else {
          setSortField(field);
          setSortOrder("asc");
        }
      };
      const filteredAndSortedIntervals = useMemo3(() => {
        let result = [...intervals];
        if (filterType === "over") {
          result = result.filter((i) => isFiniteNumber2(i.signedError) && i.signedError > 0);
        } else if (filterType === "under") {
          result = result.filter((i) => isFiniteNumber2(i.signedError) && i.signedError < 0);
        }
        result.sort((a, b) => {
          let valA = null;
          let valB = null;
          if (sortField === "startTime") {
            valA = a.startTime;
            valB = b.startTime;
          } else {
            valA = a[sortField];
            valB = b[sortField];
          }
          if (valA === null || valA === void 0) return 1;
          if (valB === null || valB === void 0) return -1;
          if (typeof valA === "string" && typeof valB === "string") {
            return sortOrder === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
          }
          if (!isFiniteNumber2(valA)) return 1;
          if (!isFiniteNumber2(valB)) return -1;
          return sortOrder === "asc" ? valA - valB : valB - valA;
        });
        return result;
      }, [intervals, sortField, sortOrder, filterType]);
      const renderSortIcon = (field) => {
        if (sortField !== field) {
          return /* @__PURE__ */ React15.createElement(ArrowUpDown, { className: "w-3 h-3 text-[#64748b] ml-1 inline" });
        }
        return sortOrder === "asc" ? /* @__PURE__ */ React15.createElement(ArrowUp, { className: "w-3 h-3 text-[#14b8a6] ml-1 inline" }) : /* @__PURE__ */ React15.createElement(ArrowDown, { className: "w-3 h-3 text-[#14b8a6] ml-1 inline" });
      };
      if (!intervals || intervals.length === 0) {
        return /* @__PURE__ */ React15.createElement("div", { className: "bg-[#1a2332] border border-[#2a3a4e] rounded-md p-6 text-center text-[#94a3b8] font-mono text-xs" }, "No settlement interval data available.");
      }
      return /* @__PURE__ */ React15.createElement("div", { className: "bg-[#1a2332] border border-[#2a3a4e] rounded-md overflow-hidden" }, /* @__PURE__ */ React15.createElement("div", { className: "p-3 border-b border-[#2a3a4e] flex flex-wrap items-center justify-between gap-2" }, /* @__PURE__ */ React15.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ React15.createElement("span", { className: "text-xs font-semibold text-[#e2e8f0]" }, "Interval Records"), /* @__PURE__ */ React15.createElement("span", { className: "text-xs font-mono text-[#64748b]" }, "(", filteredAndSortedIntervals.length, " periods)")), /* @__PURE__ */ React15.createElement("div", { className: "flex items-center gap-1.5 text-xs font-mono" }, /* @__PURE__ */ React15.createElement("span", { className: "text-[#64748b]" }, "Filter:"), /* @__PURE__ */ React15.createElement(
        "button",
        {
          type: "button",
          onClick: () => setFilterType("all"),
          className: `px-2 py-0.5 rounded text-[11px] transition-colors ${filterType === "all" ? "bg-[#14b8a6]/20 text-[#14b8a6] border border-[#14b8a6]/40" : "text-[#94a3b8] hover:bg-[#1e2a3a]"}`
        },
        "All"
      ), /* @__PURE__ */ React15.createElement(
        "button",
        {
          type: "button",
          onClick: () => setFilterType("over"),
          className: `px-2 py-0.5 rounded text-[11px] transition-colors ${filterType === "over" ? "bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/40" : "text-[#94a3b8] hover:bg-[#1e2a3a]"}`
        },
        "Overprediction (+MW)"
      ), /* @__PURE__ */ React15.createElement(
        "button",
        {
          type: "button",
          onClick: () => setFilterType("under"),
          className: `px-2 py-0.5 rounded text-[11px] transition-colors ${filterType === "under" ? "bg-[#3b82f6]/20 text-[#3b82f6] border border-[#3b82f6]/40" : "text-[#94a3b8] hover:bg-[#1e2a3a]"}`
        },
        "Underprediction (-MW)"
      ))), /* @__PURE__ */ React15.createElement("div", { className: "overflow-x-auto" }, /* @__PURE__ */ React15.createElement("table", { className: "w-full text-left border-collapse text-xs" }, /* @__PURE__ */ React15.createElement("thead", null, /* @__PURE__ */ React15.createElement("tr", { className: "border-b border-[#2a3a4e] bg-[#0f1729]/60 text-[#94a3b8] font-mono" }, /* @__PURE__ */ React15.createElement(
        "th",
        {
          onClick: () => handleSort("startTime"),
          className: "py-2.5 px-3 font-medium cursor-pointer hover:text-[#e2e8f0] select-none"
        },
        "Time (UTC) ",
        renderSortIcon("startTime")
      ), /* @__PURE__ */ React15.createElement(
        "th",
        {
          onClick: () => handleSort("forecastGeneration"),
          className: "py-2.5 px-3 font-medium text-right cursor-pointer hover:text-[#e2e8f0] select-none"
        },
        "Forecast (MW) ",
        renderSortIcon("forecastGeneration")
      ), /* @__PURE__ */ React15.createElement(
        "th",
        {
          onClick: () => handleSort("actualGeneration"),
          className: "py-2.5 px-3 font-medium text-right cursor-pointer hover:text-[#e2e8f0] select-none"
        },
        "Actual (MW) ",
        renderSortIcon("actualGeneration")
      ), /* @__PURE__ */ React15.createElement(
        "th",
        {
          onClick: () => handleSort("signedError"),
          className: "py-2.5 px-3 font-medium text-right cursor-pointer hover:text-[#e2e8f0] select-none"
        },
        "Signed Error ",
        renderSortIcon("signedError")
      ), /* @__PURE__ */ React15.createElement(
        "th",
        {
          onClick: () => handleSort("absoluteError"),
          className: "py-2.5 px-3 font-medium text-right cursor-pointer hover:text-[#e2e8f0] select-none"
        },
        "|Error| ",
        renderSortIcon("absoluteError")
      ), /* @__PURE__ */ React15.createElement("th", { className: "py-2.5 px-3 font-medium text-right" }, "Published At"), /* @__PURE__ */ React15.createElement("th", { className: "py-2.5 px-3 font-medium text-center" }, "Action"))), /* @__PURE__ */ React15.createElement("tbody", { className: "divide-y divide-[#2a3a4e]/40 font-mono" }, filteredAndSortedIntervals.map((interval, idx) => {
        const dateObj = new Date(interval.startTime);
        const timeDisplay = dateObj.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: "UTC"
        });
        const dateDisplay = dateObj.toLocaleDateString([], {
          month: "short",
          day: "numeric",
          timeZone: "UTC"
        });
        const publishDisplay = interval.publishTime ? new Date(interval.publishTime).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: "UTC"
        }) : "\u2014";
        const signedError = interval.signedError;
        const isOver = isFiniteNumber2(signedError) && signedError > 0;
        const isUnder = isFiniteNumber2(signedError) && signedError < 0;
        return /* @__PURE__ */ React15.createElement(
          "tr",
          {
            key: `${interval.startTime}-${idx}`,
            className: "hover:bg-[#1e2a3a]/60 transition-colors"
          },
          /* @__PURE__ */ React15.createElement("td", { className: "py-2.5 px-3 text-[#e2e8f0] whitespace-nowrap" }, /* @__PURE__ */ React15.createElement("span", { className: "font-semibold" }, timeDisplay), /* @__PURE__ */ React15.createElement("span", { className: "text-[#64748b] ml-1.5 text-[11px]" }, dateDisplay)),
          /* @__PURE__ */ React15.createElement("td", { className: "py-2.5 px-3 text-right text-[#3b82f6] tabular-nums font-semibold whitespace-nowrap" }, formatNumber(interval.forecastGeneration)),
          /* @__PURE__ */ React15.createElement("td", { className: "py-2.5 px-3 text-right text-[#22c55e] tabular-nums font-semibold whitespace-nowrap" }, formatNumber(interval.actualGeneration)),
          /* @__PURE__ */ React15.createElement(
            "td",
            {
              className: `py-2.5 px-3 text-right tabular-nums font-semibold whitespace-nowrap ${isOver ? "text-[#f59e0b]" : isUnder ? "text-[#3b82f6]" : "text-[#94a3b8]"}`
            },
            formatNumber(signedError, true)
          ),
          /* @__PURE__ */ React15.createElement("td", { className: "py-2.5 px-3 text-right text-[#e2e8f0] tabular-nums whitespace-nowrap" }, formatNumber(interval.absoluteError)),
          /* @__PURE__ */ React15.createElement("td", { className: "py-2.5 px-3 text-right text-[#94a3b8] whitespace-nowrap text-[11px]" }, publishDisplay),
          /* @__PURE__ */ React15.createElement("td", { className: "py-2.5 px-3 text-center whitespace-nowrap" }, onSelectInterval && /* @__PURE__ */ React15.createElement(
            "button",
            {
              type: "button",
              onClick: () => onSelectInterval(interval),
              title: "View forecast revision history",
              className: "inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded bg-[#0f1729] hover:bg-[#14b8a6]/10 text-[#14b8a6] border border-[#2a3a4e] hover:border-[#14b8a6]/40 transition-colors"
            },
            /* @__PURE__ */ React15.createElement("span", null, "Revisions"),
            /* @__PURE__ */ React15.createElement(ExternalLink, { className: "w-2.5 h-2.5" })
          ))
        );
      })))));
    };
  }
});

// src/pages/ForecastExplorer.tsx
var ForecastExplorer_exports = {};
__export(ForecastExplorer_exports, {
  ForecastExplorer: () => ForecastExplorer
});
import React16, { useState as useState5 } from "react";
import { useOutletContext as useOutletContext2 } from "react-router-dom";
import { X as X2, History, Clock as Clock3, Activity as Activity2, CheckCircle2 } from "lucide-react";
var isFiniteNumber3, formatMw, ForecastExplorer;
var init_ForecastExplorer = __esm({
  "src/pages/ForecastExplorer.tsx"() {
    init_useApi();
    init_api();
    init_ForecastTable();
    init_LoadingState();
    init_ErrorState();
    init_EmptyState();
    isFiniteNumber3 = (value) => typeof value === "number" && Number.isFinite(value);
    formatMw = (value, signed = false) => {
      if (!isFiniteNumber3(value)) return "\u2014";
      return `${signed && value > 0 ? "+" : ""}${value.toLocaleString()} MW`;
    };
    ForecastExplorer = () => {
      const { selectedDate, cutoffHour, cutoffMinute } = useOutletContext2();
      const [selectedInterval, setSelectedInterval] = useState5(null);
      const [revisionsLoading, setRevisionsLoading] = useState5(false);
      const [revisionsData, setRevisionsData] = useState5(null);
      const [revisionsError, setRevisionsError] = useState5(null);
      const {
        data: forecastData,
        loading,
        error,
        refetch
      } = useApi(
        () => api.getForecasts(selectedDate, cutoffHour, cutoffMinute),
        [selectedDate, cutoffHour, cutoffMinute]
      );
      const handleSelectInterval = async (interval) => {
        setSelectedInterval(interval);
        setRevisionsLoading(true);
        setRevisionsError(null);
        try {
          const response = await api.getForecastPublications(
            selectedDate,
            interval.startTime,
            cutoffHour,
            cutoffMinute
          );
          setRevisionsData(response);
        } catch (err) {
          setRevisionsError(
            err instanceof Error ? err.message : "Failed to load publication revisions"
          );
        } finally {
          setRevisionsLoading(false);
        }
      };
      const handleCloseModal = () => {
        setSelectedInterval(null);
        setRevisionsData(null);
        setRevisionsError(null);
      };
      if (loading) {
        return /* @__PURE__ */ React16.createElement(LoadingState, { message: `Loading interval settlement telemetry for ${selectedDate}...` });
      }
      if (error) {
        return /* @__PURE__ */ React16.createElement(
          ErrorState,
          {
            title: "Failed to Load Interval Telemetry",
            message: error,
            onRetry: refetch
          }
        );
      }
      if (!forecastData || !forecastData.intervals || forecastData.intervals.length === 0) {
        return /* @__PURE__ */ React16.createElement(
          EmptyState,
          {
            title: "No Interval Data",
            description: `No settlement period intervals recorded for ${selectedDate}.`
          }
        );
      }
      return /* @__PURE__ */ React16.createElement("div", { className: "space-y-6" }, /* @__PURE__ */ React16.createElement("div", { className: "flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#2a3a4e] gap-2" }, /* @__PURE__ */ React16.createElement("div", null, /* @__PURE__ */ React16.createElement("h1", { className: "text-base font-semibold text-[#e2e8f0]" }, "Settlement Period Forecast Explorer"), /* @__PURE__ */ React16.createElement("p", { className: "text-xs text-[#94a3b8] font-mono" }, "Granular 30-minute breakdown \u2022 Date: ", /* @__PURE__ */ React16.createElement("span", { className: "text-[#14b8a6]" }, selectedDate), ' \u2022 Click "Revisions" on any row to audit forecast updates over time')), /* @__PURE__ */ React16.createElement("div", { className: "flex items-center gap-2 text-xs font-mono" }, /* @__PURE__ */ React16.createElement("span", { className: "px-2 py-1 rounded bg-[#1a2332] border border-[#2a3a4e] text-[#94a3b8]" }, "Records: ", /* @__PURE__ */ React16.createElement("strong", { className: "text-[#e2e8f0]" }, forecastData.intervals.length)))), /* @__PURE__ */ React16.createElement(
        ForecastTable,
        {
          intervals: forecastData.intervals,
          onSelectInterval: handleSelectInterval
        }
      ), selectedInterval && /* @__PURE__ */ React16.createElement("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs" }, /* @__PURE__ */ React16.createElement("div", { className: "bg-[#1a2332] border border-[#2a3a4e] rounded-md w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden" }, /* @__PURE__ */ React16.createElement("div", { className: "p-4 border-b border-[#2a3a4e] flex items-center justify-between bg-[#0f1729]/80" }, /* @__PURE__ */ React16.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ React16.createElement(History, { className: "w-4 h-4 text-[#14b8a6]" }), /* @__PURE__ */ React16.createElement("h3", { className: "text-sm font-semibold text-[#e2e8f0]" }, "Forecast Publication History")), /* @__PURE__ */ React16.createElement(
        "button",
        {
          type: "button",
          onClick: handleCloseModal,
          className: "p-1 rounded text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#1e2a3a] transition-colors",
          "aria-label": "Close"
        },
        /* @__PURE__ */ React16.createElement(X2, { className: "w-4 h-4" })
      )), /* @__PURE__ */ React16.createElement("div", { className: "p-4 border-b border-[#2a3a4e] bg-[#1a2332] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono" }, /* @__PURE__ */ React16.createElement("div", null, /* @__PURE__ */ React16.createElement("span", { className: "text-[#64748b] block text-[11px]" }, "Target Period"), /* @__PURE__ */ React16.createElement("span", { className: "text-[#e2e8f0] font-semibold" }, new Date(selectedInterval.startTime).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "UTC"
      }), " ", "UTC")), /* @__PURE__ */ React16.createElement("div", null, /* @__PURE__ */ React16.createElement("span", { className: "text-[#64748b] block text-[11px]" }, "Actual Outturn"), /* @__PURE__ */ React16.createElement("span", { className: "text-[#22c55e] font-semibold" }, formatMw(selectedInterval.actualGeneration))), /* @__PURE__ */ React16.createElement("div", null, /* @__PURE__ */ React16.createElement("span", { className: "text-[#64748b] block text-[11px]" }, "Cutoff Forecast"), /* @__PURE__ */ React16.createElement("span", { className: "text-[#3b82f6] font-semibold" }, formatMw(selectedInterval.forecastGeneration))), /* @__PURE__ */ React16.createElement("div", null, /* @__PURE__ */ React16.createElement("span", { className: "text-[#64748b] block text-[11px]" }, "Signed Error"), /* @__PURE__ */ React16.createElement(
        "span",
        {
          className: `font-semibold ${isFiniteNumber3(selectedInterval.signedError) && selectedInterval.signedError > 0 ? "text-[#f59e0b]" : "text-[#3b82f6]"}`
        },
        formatMw(selectedInterval.signedError, true)
      ))), /* @__PURE__ */ React16.createElement("div", { className: "p-4 overflow-y-auto flex-1 font-mono text-xs" }, revisionsLoading ? /* @__PURE__ */ React16.createElement("div", { className: "py-8 flex flex-col items-center justify-center text-[#94a3b8]" }, /* @__PURE__ */ React16.createElement(Activity2, { className: "w-5 h-5 text-[#14b8a6] animate-pulse mb-2" }), /* @__PURE__ */ React16.createElement("span", null, "Retrieving publication chronology from B1620 feed...")) : revisionsError ? /* @__PURE__ */ React16.createElement("div", { className: "p-3 rounded bg-[#ef4444]/10 border border-[#ef4444]/20 text-[#ef4444]" }, revisionsError) : revisionsData && revisionsData.publications && revisionsData.publications.length > 0 ? /* @__PURE__ */ React16.createElement("div", null, /* @__PURE__ */ React16.createElement("div", { className: "text-[11px] text-[#64748b] mb-3" }, "Chronological WINDFOR releases received for this target settlement period. The entry active at the decision cutoff is highlighted."), /* @__PURE__ */ React16.createElement("div", { className: "space-y-2" }, revisionsData.publications.map((pub, idx) => {
        const pubDate = pub.publishTime ? new Date(pub.publishTime) : null;
        const hasValidDate = pubDate && !Number.isNaN(pubDate.getTime());
        const isChosen = Boolean(selectedInterval.publishTime && pub.publishTime && new Date(pub.publishTime).getTime() === new Date(selectedInterval.publishTime).getTime());
        const genValue = pub.generation ?? pub.forecastGeneration;
        return /* @__PURE__ */ React16.createElement(
          "div",
          {
            key: idx,
            className: `p-3 rounded border transition-colors flex items-center justify-between ${isChosen ? "bg-[#14b8a6]/10 border-[#14b8a6]/50 text-[#e2e8f0]" : "bg-[#0f1729] border-[#2a3a4e] text-[#94a3b8]"}`
          },
          /* @__PURE__ */ React16.createElement("div", { className: "flex items-center gap-3" }, /* @__PURE__ */ React16.createElement(Clock3, { className: "w-3.5 h-3.5 text-[#64748b]" }), /* @__PURE__ */ React16.createElement("div", null, /* @__PURE__ */ React16.createElement("div", { className: "font-semibold text-[#e2e8f0]" }, hasValidDate ? `${pubDate.toLocaleString([], {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "UTC"
          })} UTC` : "\u2014"), /* @__PURE__ */ React16.createElement("div", { className: "text-[10px] text-[#64748b]" }, "Publication Timestamp"))),
          /* @__PURE__ */ React16.createElement("div", { className: "text-right" }, /* @__PURE__ */ React16.createElement("div", { className: "font-semibold text-[#3b82f6] text-sm tabular-nums" }, formatMw(genValue)), isChosen && /* @__PURE__ */ React16.createElement("span", { className: "inline-flex items-center gap-1 text-[10px] text-[#14b8a6] font-semibold" }, /* @__PURE__ */ React16.createElement(CheckCircle2, { className: "w-3 h-3" }), "Active at Cutoff"))
        );
      }))) : /* @__PURE__ */ React16.createElement("div", { className: "text-center py-8 text-[#64748b]" }, "Single publication record available for this settlement period.")), /* @__PURE__ */ React16.createElement("div", { className: "p-3 border-t border-[#2a3a4e] bg-[#0f1729]/80 flex justify-end" }, /* @__PURE__ */ React16.createElement(
        "button",
        {
          type: "button",
          onClick: handleCloseModal,
          className: "px-3 py-1.5 rounded text-xs font-mono font-medium bg-[#1e2a3a] hover:bg-[#2a3a4e] text-[#e2e8f0] border border-[#2a3a4e] transition-colors"
        },
        "Close Audit View"
      )))));
    };
  }
});

// tests/route_context.test.tsx
import { describe, it } from "node:test";
import assert from "node:assert";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter, Routes, Route, useOutletContext as useOutletContext3 } from "react-router-dom";

// src/components/layout/AppShell.tsx
import React6, { useState } from "react";
import { Outlet } from "react-router-dom";

// src/components/layout/Header.tsx
import React4 from "react";
import { Wind, Menu, X } from "lucide-react";

// src/components/common/DateSelector.tsx
import React from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
var DateSelector = ({
  selectedDate,
  onDateChange,
  minDate = "2026-01-01",
  maxDate = "2026-01-31"
}) => {
  const handlePrevDay = () => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() - 1);
    const prevStr = current.toISOString().split("T")[0];
    if (prevStr >= minDate) {
      onDateChange(prevStr);
    }
  };
  const handleNextDay = () => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + 1);
    const nextStr = current.toISOString().split("T")[0];
    if (nextStr <= maxDate) {
      onDateChange(nextStr);
    }
  };
  const isMin = selectedDate <= minDate;
  const isMax = selectedDate >= maxDate;
  return /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1.5 bg-[#1a2332] border border-[#2a3a4e] rounded-md p-1" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      onClick: handlePrevDay,
      disabled: isMin,
      "aria-label": "Previous Day",
      className: "p-1 rounded text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#1e2a3a] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
    },
    /* @__PURE__ */ React.createElement(ChevronLeft, { className: "w-4 h-4" })
  ), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-1.5 px-2" }, /* @__PURE__ */ React.createElement(Calendar, { className: "w-3.5 h-3.5 text-[#14b8a6]" }), /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "date",
      value: selectedDate,
      min: minDate,
      max: maxDate,
      onChange: (e) => {
        const val = e.target.value;
        if (val >= minDate && val <= maxDate) {
          onDateChange(val);
        }
      },
      className: "bg-transparent text-xs font-mono font-medium text-[#e2e8f0] focus:outline-none cursor-pointer [color-scheme:dark]"
    }
  )), /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      onClick: handleNextDay,
      disabled: isMax,
      "aria-label": "Next Day",
      className: "p-1 rounded text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#1e2a3a] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
    },
    /* @__PURE__ */ React.createElement(ChevronRight, { className: "w-4 h-4" })
  ), /* @__PURE__ */ React.createElement("div", { className: "h-4 w-px bg-[#2a3a4e] mx-1 hidden sm:block" }), /* @__PURE__ */ React.createElement("div", { className: "hidden sm:flex items-center gap-1 text-[11px] font-mono" }, ["2026-01-05", "2026-01-15", "2026-01-25"].map((d) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: d,
      onClick: () => onDateChange(d),
      type: "button",
      className: `px-1.5 py-0.5 rounded transition-colors ${selectedDate === d ? "bg-[#14b8a6]/20 text-[#14b8a6] border border-[#14b8a6]/40" : "text-[#64748b] hover:text-[#94a3b8] hover:bg-[#1e2a3a]"}`
    },
    d.slice(5)
  ))));
};

// src/components/common/DecisionCutoffControl.tsx
import React2 from "react";
import { Clock } from "lucide-react";
var DecisionCutoffControl = ({
  cutoffHour,
  cutoffMinute,
  onCutoffChange,
  timezone = "UTC"
}) => {
  const presets = [
    { label: "09:30 D-1", hour: 9, minute: 30, title: "UK Day-Ahead Bidding Gate" },
    { label: "11:00 D-1", hour: 11, minute: 0, title: "Nord Pool / EPEX SPOT Auction Close" },
    { label: "16:00 D-1", hour: 16, minute: 0, title: "Late Afternoon Dispatch Update" }
  ];
  return /* @__PURE__ */ React2.createElement("div", { className: "flex flex-wrap items-center gap-2 bg-[#1a2332] border border-[#2a3a4e] rounded-md p-1 px-2.5" }, /* @__PURE__ */ React2.createElement("div", { className: "flex items-center gap-1.5 text-xs text-[#94a3b8]" }, /* @__PURE__ */ React2.createElement(Clock, { className: "w-3.5 h-3.5 text-[#14b8a6]" }), /* @__PURE__ */ React2.createElement("span", { className: "font-medium text-[#94a3b8]" }, "Cutoff:")), /* @__PURE__ */ React2.createElement("div", { className: "flex items-center gap-1" }, /* @__PURE__ */ React2.createElement(
    "select",
    {
      value: cutoffHour,
      onChange: (e) => onCutoffChange(Number(e.target.value), cutoffMinute),
      "aria-label": "Cutoff hour",
      className: "bg-[#0f1729] border border-[#2a3a4e] rounded text-xs font-mono text-[#e2e8f0] px-1.5 py-1 focus:outline-none focus:border-[#14b8a6] cursor-pointer"
    },
    Array.from({ length: 24 }).map((_, i) => /* @__PURE__ */ React2.createElement("option", { key: i, value: i }, String(i).padStart(2, "0")))
  ), /* @__PURE__ */ React2.createElement("span", { className: "text-[#64748b] font-mono" }, ":"), /* @__PURE__ */ React2.createElement(
    "select",
    {
      value: cutoffMinute,
      onChange: (e) => onCutoffChange(cutoffHour, Number(e.target.value)),
      "aria-label": "Cutoff minute",
      className: "bg-[#0f1729] border border-[#2a3a4e] rounded text-xs font-mono text-[#e2e8f0] px-1.5 py-1 focus:outline-none focus:border-[#14b8a6] cursor-pointer"
    },
    [0, 15, 30, 45].map((m) => /* @__PURE__ */ React2.createElement("option", { key: m, value: m }, String(m).padStart(2, "0")))
  ), /* @__PURE__ */ React2.createElement("span", { className: "text-[11px] font-mono text-[#64748b] ml-0.5" }, timezone)), /* @__PURE__ */ React2.createElement("div", { className: "h-4 w-px bg-[#2a3a4e] mx-1 hidden md:block" }), /* @__PURE__ */ React2.createElement("div", { className: "hidden md:flex items-center gap-1 text-[11px] font-mono" }, presets.map((p) => {
    const isSelected = cutoffHour === p.hour && cutoffMinute === p.minute;
    return /* @__PURE__ */ React2.createElement(
      "button",
      {
        key: p.label,
        type: "button",
        title: p.title,
        onClick: () => onCutoffChange(p.hour, p.minute),
        className: `px-1.5 py-0.5 rounded transition-colors ${isSelected ? "bg-[#14b8a6]/20 text-[#14b8a6] border border-[#14b8a6]/40" : "text-[#64748b] hover:text-[#94a3b8] hover:bg-[#1e2a3a]"}`
      },
      p.label
    );
  })));
};

// src/components/common/DataFreshnessIndicator.tsx
import React3 from "react";
import { Activity } from "lucide-react";
var DataFreshnessIndicator = ({
  freshnessTimestamp,
  sourceText = "Elexon BMRS (B1620 / FUELHH)",
  isOnline = true
}) => {
  return /* @__PURE__ */ React3.createElement("div", { className: "flex items-center gap-2 text-xs font-mono" }, /* @__PURE__ */ React3.createElement("div", { className: "flex items-center gap-1.5 px-2 py-1 rounded bg-[#0f1729] border border-[#2a3a4e]" }, /* @__PURE__ */ React3.createElement("span", { className: "relative flex h-2 w-2" }, isOnline && /* @__PURE__ */ React3.createElement("span", { className: "animate-ping absolute inline-flex h-full w-full rounded-full bg-[#14b8a6] opacity-75" }), /* @__PURE__ */ React3.createElement(
    "span",
    {
      className: `relative inline-flex rounded-full h-2 w-2 ${isOnline ? "bg-[#14b8a6]" : "bg-[#ef4444]"}`
    }
  )), /* @__PURE__ */ React3.createElement("span", { className: "text-[#94a3b8] text-[11px] uppercase tracking-wider" }, isOnline ? "Verified Feed" : "Offline")), /* @__PURE__ */ React3.createElement("div", { className: "hidden lg:flex items-center gap-1 text-[#64748b] text-[11px]" }, /* @__PURE__ */ React3.createElement(Activity, { className: "w-3 h-3 text-[#14b8a6]" }), /* @__PURE__ */ React3.createElement("span", null, sourceText), freshnessTimestamp && /* @__PURE__ */ React3.createElement(React3.Fragment, null, /* @__PURE__ */ React3.createElement("span", { className: "text-[#2a3a4e]" }, "\u2022"), /* @__PURE__ */ React3.createElement("span", null, new Date(freshnessTimestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), " UTC"))));
};

// src/components/layout/Header.tsx
var Header = ({
  selectedDate,
  onDateChange,
  cutoffHour,
  cutoffMinute,
  onCutoffChange,
  mobileMenuOpen,
  onToggleMobileMenu
}) => {
  return /* @__PURE__ */ React4.createElement("header", { className: "sticky top-0 z-30 bg-[#0f1729]/95 backdrop-blur-sm border-b border-[#2a3a4e] px-4 py-2.5" }, /* @__PURE__ */ React4.createElement("div", { className: "flex items-center justify-between gap-3" }, /* @__PURE__ */ React4.createElement("div", { className: "flex items-center gap-3" }, /* @__PURE__ */ React4.createElement(
    "button",
    {
      type: "button",
      onClick: onToggleMobileMenu,
      className: "md:hidden p-1.5 rounded text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#1e2a3a] transition-colors",
      "aria-label": "Toggle menu"
    },
    mobileMenuOpen ? /* @__PURE__ */ React4.createElement(X, { className: "w-5 h-5" }) : /* @__PURE__ */ React4.createElement(Menu, { className: "w-5 h-5" })
  ), /* @__PURE__ */ React4.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ React4.createElement("div", { className: "w-7 h-7 rounded bg-[#14b8a6]/15 border border-[#14b8a6]/30 flex items-center justify-center text-[#14b8a6]" }, /* @__PURE__ */ React4.createElement(Wind, { className: "w-4 h-4" })), /* @__PURE__ */ React4.createElement("div", null, /* @__PURE__ */ React4.createElement("span", { className: "font-semibold text-sm tracking-tight text-[#e2e8f0]" }, "Wind", /* @__PURE__ */ React4.createElement("span", { className: "text-[#14b8a6]" }, "Sight")), /* @__PURE__ */ React4.createElement("span", { className: "hidden sm:inline-block ml-2 text-[10px] font-mono text-[#64748b] border border-[#2a3a4e] px-1 rounded" }, "Jan 2026")))), /* @__PURE__ */ React4.createElement("div", { className: "flex items-center gap-2 sm:gap-3" }, /* @__PURE__ */ React4.createElement(DateSelector, { selectedDate, onDateChange }), /* @__PURE__ */ React4.createElement("div", { className: "hidden lg:block" }, /* @__PURE__ */ React4.createElement(
    DecisionCutoffControl,
    {
      cutoffHour,
      cutoffMinute,
      onCutoffChange
    }
  )), /* @__PURE__ */ React4.createElement("div", { className: "hidden xl:block" }, /* @__PURE__ */ React4.createElement(DataFreshnessIndicator, null)))));
};

// src/components/layout/Sidebar.tsx
import React5 from "react";
import { NavLink } from "react-router-dom";
import { LayoutDashboard, Table, BarChart3, BookOpen, ShieldAlert } from "lucide-react";
var Sidebar = ({ onCloseMobile }) => {
  const navItems = [
    {
      to: "/",
      label: "Overview",
      icon: LayoutDashboard,
      description: "Daily forecast & actuals"
    },
    {
      to: "/explorer",
      label: "Forecast Explorer",
      icon: Table,
      description: "Settlement table & revisions"
    },
    {
      to: "/analysis",
      label: "Accuracy Analysis",
      icon: BarChart3,
      description: "Month-long error metrics"
    },
    {
      to: "/methodology",
      label: "Methodology",
      icon: BookOpen,
      description: "Cutoff logic & formulation"
    }
  ];
  return /* @__PURE__ */ React5.createElement("aside", { className: "h-full flex flex-col justify-between bg-[#1a2332] border-r border-[#2a3a4e] w-64 p-3 select-none" }, /* @__PURE__ */ React5.createElement("div", null, /* @__PURE__ */ React5.createElement("div", { className: "px-3 py-3 mb-2" }, /* @__PURE__ */ React5.createElement("span", { className: "text-[11px] font-mono font-semibold tracking-wider text-[#64748b] uppercase" }, "Intelligence Suite")), /* @__PURE__ */ React5.createElement("nav", { className: "space-y-1" }, navItems.map((item) => {
    const Icon = item.icon;
    return /* @__PURE__ */ React5.createElement(
      NavLink,
      {
        key: item.to,
        to: item.to,
        end: item.to === "/",
        onClick: onCloseMobile,
        className: ({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded text-xs transition-colors ${isActive ? "bg-[#0f1729] text-[#14b8a6] border border-[#2a3a4e] font-semibold" : "text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#1e2a3a]"}`
      },
      ({ isActive }) => /* @__PURE__ */ React5.createElement(React5.Fragment, null, /* @__PURE__ */ React5.createElement(Icon, { className: `w-4 h-4 shrink-0 ${isActive ? "text-[#14b8a6]" : "text-[#64748b]"}` }), /* @__PURE__ */ React5.createElement("div", { className: "flex flex-col text-left" }, /* @__PURE__ */ React5.createElement("span", null, item.label), /* @__PURE__ */ React5.createElement("span", { className: "text-[10px] text-[#64748b] font-normal font-sans" }, item.description)))
    );
  }))), /* @__PURE__ */ React5.createElement("div", { className: "p-3 border-t border-[#2a3a4e] text-xs font-mono space-y-2" }, /* @__PURE__ */ React5.createElement("div", { className: "bg-[#0f1729] p-2.5 rounded border border-[#2a3a4e] text-[11px] text-[#94a3b8]" }, /* @__PURE__ */ React5.createElement("div", { className: "flex items-center gap-1.5 text-[#14b8a6] font-semibold mb-1" }, /* @__PURE__ */ React5.createElement("span", { className: "w-1.5 h-1.5 rounded-full bg-[#14b8a6]" }), "GB Power System"), /* @__PURE__ */ React5.createElement("div", null, "BMRS WINDFOR (B1620)"), /* @__PURE__ */ React5.createElement("div", null, "FUELHH Settlement Outturn"), /* @__PURE__ */ React5.createElement("div", { className: "text-[#64748b] mt-1 text-[10px]" }, "Dataset: Jan 1\u201331, 2026")), /* @__PURE__ */ React5.createElement("div", { className: "text-[10px] text-[#64748b] flex items-center gap-1" }, /* @__PURE__ */ React5.createElement(ShieldAlert, { className: "w-3 h-3 text-[#f59e0b] shrink-0" }), /* @__PURE__ */ React5.createElement("span", null, "Point-in-time audited data"))));
};

// src/components/layout/AppShell.tsx
var AppShell = ({
  selectedDate,
  onDateChange,
  cutoffHour,
  cutoffMinute,
  onCutoffChange
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  return /* @__PURE__ */ React6.createElement("div", { className: "min-h-screen flex flex-col bg-[#0f1729] text-[#e2e8f0]" }, /* @__PURE__ */ React6.createElement(
    Header,
    {
      selectedDate,
      onDateChange,
      cutoffHour,
      cutoffMinute,
      onCutoffChange,
      mobileMenuOpen,
      onToggleMobileMenu: () => setMobileMenuOpen(!mobileMenuOpen)
    }
  ), /* @__PURE__ */ React6.createElement("div", { className: "lg:hidden bg-[#0f1729] border-b border-[#2a3a4e] p-2 flex justify-center" }, /* @__PURE__ */ React6.createElement(
    DecisionCutoffControl,
    {
      cutoffHour,
      cutoffMinute,
      onCutoffChange
    }
  )), /* @__PURE__ */ React6.createElement("div", { className: "flex-1 flex overflow-hidden" }, /* @__PURE__ */ React6.createElement("div", { className: "hidden md:block shrink-0" }, /* @__PURE__ */ React6.createElement(Sidebar, null)), mobileMenuOpen && /* @__PURE__ */ React6.createElement("div", { className: "fixed inset-0 z-40 md:hidden flex" }, /* @__PURE__ */ React6.createElement(
    "div",
    {
      className: "fixed inset-0 bg-black/60 backdrop-blur-xs",
      onClick: () => setMobileMenuOpen(false)
    }
  ), /* @__PURE__ */ React6.createElement("div", { className: "relative z-50 w-64 max-w-[80%] h-full bg-[#1a2332]" }, /* @__PURE__ */ React6.createElement(Sidebar, { onCloseMobile: () => setMobileMenuOpen(false) }))), /* @__PURE__ */ React6.createElement("main", { className: "flex-1 overflow-y-auto p-4 md:p-6 bg-[#0f1729]" }, /* @__PURE__ */ React6.createElement("div", { className: "max-w-7xl mx-auto space-y-6" }, /* @__PURE__ */ React6.createElement(
    Outlet,
    {
      context: {
        selectedDate,
        onDateChange,
        cutoffHour,
        cutoffMinute,
        onCutoffChange
      }
    }
  )))), /* @__PURE__ */ React6.createElement("footer", { className: "bg-[#0f1729] border-t border-[#2a3a4e] px-4 py-3 text-xs text-[#64748b] font-mono flex flex-col sm:flex-row items-center justify-between gap-2" }, /* @__PURE__ */ React6.createElement("div", null, "WindSight Telemetry \xA9 2026. GB Power System Wind Forecasting Evaluation Platform."), /* @__PURE__ */ React6.createElement("div", { className: "flex items-center gap-4 text-[11px]" }, /* @__PURE__ */ React6.createElement("span", null, "Data: Elexon BMRS B1620 & FUELHH"), /* @__PURE__ */ React6.createElement("span", null, "Settlement Period: 30-min"), /* @__PURE__ */ React6.createElement("span", null, "Point-in-Time Causality Guard: Active"))));
};

// tests/route_context.test.tsx
init_forecastPresentation();
describe("WindSight Route Context & Data Flow Tests", () => {
  it("formats a valid cutoff without exposing undefined values", () => {
    assert.strictEqual(
      formatCutoff(
        { hour: 9, minute: 30, timezone: "UTC", date: "2026-01-14" },
        { hour: 9, minute: 30, timezone: "UTC" }
      ),
      "D-1 \u2022 2026-01-14 09:30 UTC"
    );
    assert.strictEqual(
      formatCutoff({ hour: Number.NaN, minute: null }, { hour: 9, minute: 30, timezone: "UTC" }),
      "D-1 \u2022 09:30 UTC"
    );
  });
  it("counts only distinct finite forecast-actual pairs and calculates settlement coverage", () => {
    const intervals = [
      { startTime: "2026-01-01T00:00:00Z", forecastGeneration: 100, actualGeneration: 90 },
      { startTime: "2026-01-01T00:00:00Z", forecastGeneration: 100, actualGeneration: 90 },
      { startTime: "2026-01-01T00:30:00Z", forecastGeneration: null, actualGeneration: 90 },
      { startTime: "2026-01-01T01:00:00Z", forecastGeneration: Number.NaN, actualGeneration: 90 },
      { startTime: "2026-01-01T01:30:00Z", forecastGeneration: 100, actualGeneration: 90 }
    ];
    const dayCoverage = calculateIntervalCoverage(intervals, "2026-01-01", "2026-01-01");
    assert.deepStrictEqual(dayCoverage, { validCount: 2, expectedCount: 48, percentage: 2 / 48 * 100 });
    const monthCoverage = calculateIntervalCoverage(intervals, "2026-01-01", "2026-01-31");
    assert.strictEqual(monthCoverage.expectedCount, 1488);
    assert.strictEqual(monthCoverage.validCount, 2);
    assert.strictEqual(monthCoverage.percentage, 2 / 1488 * 100);
  });
  it("AppShell passes selectedDate, cutoffHour, cutoffMinute, onDateChange, and onCutoffChange to child route", () => {
    let capturedContext = null;
    const ChildComponent = () => {
      const context = useOutletContext3();
      capturedContext = context;
      return h(
        "div",
        { id: "child" },
        `Date: ${context.selectedDate}, Cutoff: ${context.cutoffHour}:${context.cutoffMinute}`
      );
    };
    let updatedDate = null;
    let updatedCutoff = null;
    const handleDateChange = (d) => {
      updatedDate = d;
    };
    const handleCutoffChange = (hour, minute) => {
      updatedCutoff = { hour, minute };
    };
    const tree = h(
      MemoryRouter,
      { initialEntries: ["/"] },
      h(
        Routes,
        null,
        h(
          Route,
          {
            element: h(AppShell, {
              selectedDate: "2026-01-15",
              onDateChange: handleDateChange,
              cutoffHour: 9,
              cutoffMinute: 30,
              onCutoffChange: handleCutoffChange
            })
          },
          h(Route, { index: true, element: h(ChildComponent) })
        )
      )
    );
    const html = renderToString(tree);
    assert.ok(
      html.includes("Date: 2026-01-15, Cutoff: 9:30"),
      "Rendered HTML should include child content with context values"
    );
    assert.ok(capturedContext !== null, "useOutletContext() must not be undefined");
    const ctx = capturedContext;
    assert.strictEqual(ctx.selectedDate, "2026-01-15");
    assert.strictEqual(ctx.cutoffHour, 9);
    assert.strictEqual(ctx.cutoffMinute, 30);
    assert.strictEqual(typeof ctx.onDateChange, "function");
    assert.strictEqual(typeof ctx.onCutoffChange, "function");
    ctx.onDateChange("2026-01-20");
    assert.strictEqual(updatedDate, "2026-01-20");
    ctx.onCutoffChange(11, 0);
    assert.deepStrictEqual(updatedCutoff, { hour: 11, minute: 0 });
  });
  it("DateSelector renders and properly limits date ranges for Jan 2026", () => {
    let dateSelected = null;
    const selectorTree = h(DateSelector, {
      selectedDate: "2026-01-15",
      onDateChange: (d) => {
        dateSelected = d;
      },
      minDate: "2026-01-01",
      maxDate: "2026-01-31"
    });
    const selectorHtml = renderToString(selectorTree);
    assert.ok(selectorHtml.includes("2026-01-15"), "DateSelector should contain the selected date");
    assert.ok(selectorHtml.includes("01-05"), "DateSelector should contain quick shortcut 01-05");
    assert.ok(selectorHtml.includes("01-15"), "DateSelector should contain quick shortcut 01-15");
    assert.ok(selectorHtml.includes("01-25"), "DateSelector should contain quick shortcut 01-25");
  });
  it("Overview component renders inside AppShell without throwing undefined destructure error", async () => {
    const { Overview: Overview2 } = await Promise.resolve().then(() => (init_Overview(), Overview_exports));
    const tree = h(
      MemoryRouter,
      { initialEntries: ["/"] },
      h(
        Routes,
        null,
        h(
          Route,
          {
            element: h(AppShell, {
              selectedDate: "2026-01-15",
              onDateChange: () => {
              },
              cutoffHour: 9,
              cutoffMinute: 30,
              onCutoffChange: () => {
              }
            })
          },
          h(Route, { index: true, element: h(Overview2) })
        )
      )
    );
    const html = renderToString(tree);
    assert.ok(
      html.includes("Fetching BMRS WINDFOR and FUELHH data for 2026-01-15"),
      "Overview should render initial loading state using context selectedDate"
    );
  });
  it("ForecastExplorer renders safely inside AppShell without throwing errors", async () => {
    const { ForecastExplorer: ForecastExplorer2 } = await Promise.resolve().then(() => (init_ForecastExplorer(), ForecastExplorer_exports));
    const tree = h(
      MemoryRouter,
      { initialEntries: ["/"] },
      h(
        Routes,
        null,
        h(
          Route,
          {
            element: h(AppShell, {
              selectedDate: "2026-01-15",
              onDateChange: () => {
              },
              cutoffHour: 9,
              cutoffMinute: 30,
              onCutoffChange: () => {
              }
            })
          },
          h(Route, { index: true, element: h(ForecastExplorer2) })
        )
      )
    );
    const html = renderToString(tree);
    assert.ok(
      html.includes("Loading interval settlement telemetry for 2026-01-15"),
      "ForecastExplorer should render initial loading state using context selectedDate"
    );
  });
});
