export interface ForecastInterval {
  startTime: string;
  forecastGeneration: number | null;
  actualGeneration: number | null;
  publishTime: string | null;
  signedError: number | null;
  absoluteError: number | null;
  forecastEligible: boolean;
}

export interface AccuracyMetrics {
  mae: number | null;
  rmse: number | null;
  bias: number | null;
  mape: number | null;
  count: number;
  coverage: number;
  overpredictionPct: number | null;
  underpredictionPct: number | null;
}

export interface CutoffConfig {
  hour: number;
  minute: number;
  timezone: string;
  date?: string | null;
}

export interface ForecastResponse {
  date: string;
  cutoff: CutoffConfig;
  intervals: ForecastInterval[];
  summary: AccuracyMetrics;
}

export interface AnalysisResponse {
  metrics: AccuracyMetrics;
  intervals: ForecastInterval[];
  period: { startDate: string; endDate: string };
  cutoff: CutoffConfig;
  dataFreshness: string;
}

export interface ShortfallRequest {
  demand_mw: number;
  forecast_mw: number;
}

export interface ShortfallResponse {
  demand_mw: number;
  forecast_mw: number;
  shortfall_mw: number;
  disclaimer: string;
}

export interface MetadataResponse {
  analysisStart: string;
  analysisEnd: string;
  defaultCutoffHour: number;
  defaultCutoffMinute: number;
  timezone: string;
  dataSources: { fuelhh: string; windfor: string };
}

export interface HealthResponse {
  status: string;
  timestamp: string;
}

export interface ForecastPublicationItem {
  publishTime: string;
  generation: number | null;
  forecastGeneration?: number | null;
  startTime: string;
  dataset?: string;
  eligibleBeforeCutoff?: boolean | null;
}

export interface ForecastPublicationsResponse {
  date: string;
  startTime: string;
  publications: ForecastPublicationItem[];
}

export interface AppOutletContext {
  selectedDate: string;
  onDateChange: (date: string) => void;
  cutoffHour: number;
  cutoffMinute: number;
  onCutoffChange: (hour: number, minute: number) => void;
}
