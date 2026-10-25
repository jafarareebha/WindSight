import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { Overview } from './pages/Overview';
import { ForecastExplorer } from './pages/ForecastExplorer';
import { AccuracyAnalysis } from './pages/AccuracyAnalysis';
import { Methodology } from './pages/Methodology';
import { api } from './services/api';

export const App: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>('2026-01-15');
  const [cutoffHour, setCutoffHour] = useState<number>(9);
  const [cutoffMinute, setCutoffMinute] = useState<number>(30);

  // Sync with backend metadata if available
  useEffect(() => {
    api.getMetadata()
      .then((meta) => {
        if (meta) {
          if (meta.defaultCutoffHour !== undefined) setCutoffHour(meta.defaultCutoffHour);
          if (meta.defaultCutoffMinute !== undefined) setCutoffMinute(meta.defaultCutoffMinute);
        }
      })
      .catch(() => {
        // Fall back gracefully to defaults
      });
  }, []);

  const handleCutoffChange = (hour: number, minute: number) => {
    setCutoffHour(hour);
    setCutoffMinute(minute);
  };

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route
          element={
            <AppShell
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              cutoffHour={cutoffHour}
              cutoffMinute={cutoffMinute}
              onCutoffChange={handleCutoffChange}
            />
          }
        >
          <Route index element={<Overview />} />
          <Route path="explorer" element={<ForecastExplorer />} />
          <Route path="analysis" element={<AccuracyAnalysis />} />
          <Route path="methodology" element={<Methodology />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
