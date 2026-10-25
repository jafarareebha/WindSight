import type {
  ForecastResponse,
  AnalysisResponse,
  MetadataResponse,
  HealthResponse,
  ShortfallRequest,
  ShortfallResponse,
  ForecastPublicationsResponse,
} from '../types';

const BASE_URL =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL !== undefined
    ? import.meta.env.VITE_API_BASE_URL
    : '/api';

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const cleanBase = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${cleanBase}${cleanEndpoint}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      ...options,
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData && (errorData.message || errorData.detail || errorData.error)) {
          errorMessage = errorData.message || errorData.detail || errorData.error;
        }
      } catch {
        // Fallback to text if not json
        const text = await response.text().catch(() => null);
        if (text) errorMessage = text;
      }
      throw new ApiError(errorMessage, response.status);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new Error(
      error instanceof Error ? error.message : 'Network request failed'
    );
  }
}

export const api = {
  getHealth: () => request<HealthResponse>('/health'),

  getMetadata: () => request<MetadataResponse>('/metadata'),

  getForecasts: (date: string, cutoffHour: number = 9, cutoffMinute: number = 30) =>
    request<ForecastResponse>(
      `/forecasts?date=${encodeURIComponent(date)}&cutoff_hour=${cutoffHour}&cutoff_minute=${cutoffMinute}`
    ),

  getActuals: (date: string) =>
    request<{ date: string; actuals: Array<{ startTime: string; actualGeneration: number }> }>(
      `/actuals?date=${encodeURIComponent(date)}`
    ),

  getAnalysis: (
    startDate: string = '2026-01-01',
    endDate: string = '2026-01-31',
    cutoffHour: number = 9,
    cutoffMinute: number = 30
  ) =>
    request<AnalysisResponse>(
      `/analysis?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(
        endDate
      )}&cutoff_hour=${cutoffHour}&cutoff_minute=${cutoffMinute}`
    ),

  getForecastPublications: (
    date: string,
    startTime: string,
    cutoffHour: number = 9,
    cutoffMinute: number = 30
  ) =>
    request<ForecastPublicationsResponse>(
      `/forecast-publications?date=${encodeURIComponent(date)}&start_time=${encodeURIComponent(
        startTime
      )}&cutoff_hour=${cutoffHour}&cutoff_minute=${cutoffMinute}`
    ),

  calculateShortfall: (payload: ShortfallRequest) =>
    request<ShortfallResponse>('/shortfall', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
