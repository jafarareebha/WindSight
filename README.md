# WindSight — UK Wind Power Forecast Intelligence Dashboard

A professional decision-support tool for UK electricity utility day-ahead purchasing teams. WindSight helps analysts understand wind generation forecasts, evaluate forecast accuracy, and assess forecast uncertainty for the UK electricity market.

> **⚠️ Disclaimer:** This application is an analytical decision-support tool. It does not execute trades or provide authoritative procurement recommendations.

---

## Business Problem

UK electricity utilities must procure electricity from the wholesale market to meet consumer demand. Wind power generation depends on weather conditions, making accurate wind generation forecasts critical for day-ahead electricity purchasing decisions.

WindSight addresses this by providing:
1. **Forecast Visibility** — What wind generation forecasts were available at the time purchasing decisions were made
2. **Publication Tracking** — When each forecast was published relative to the decision deadline
3. **Historical Comparison** — How eligible forecasts compared against actual wind generation
4. **Statistical Accuracy** — Quantified forecast errors using MAE, RMSE, and bias metrics
5. **Uncertainty Assessment** — Understanding the reliability and uncertainty of wind forecasts
6. **Optional Shortfall Estimation** — Indicative calculation of demand not covered by wind (user-supplied demand)

---

## Key Features

### Core Feature A: Forecast Overview
- Interactive time-series chart comparing forecast vs actual wind generation
- Summary metrics for selected delivery dates
- Forecast publication timestamps and eligibility status
- Half-hourly interval detail with tooltips

### Core Feature B: Forecast Explorer
- Sortable, paginated data table of all delivery intervals
- Forecast publication history for each interval
- Decision cutoff configuration
- Error breakdown by interval

### Core Feature C: Forecast Accuracy Analysis
- MAE, RMSE, and Mean Bias Error calculations
- Error-over-time visualization
- Largest-error identification
- Data completeness tracking
- Overprediction/underprediction statistics

### Optional: Wind Shortfall Estimator
- User-entered assumed demand input
- Indicative shortfall calculation
- Prominent disclaimer about limitations

---

## Technology Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 18 | UI framework |
| Vite 6 | Build tool and dev server |
| TypeScript | Type safety |
| Tailwind CSS 4 | Utility-first styling |
| Recharts | Interactive data visualizations |
| Lucide React | Professional icon library |
| React Router | Client-side routing |

### Backend
| Technology | Purpose |
|---|---|
| Python 3.12 | Runtime |
| FastAPI | REST API framework |
| Pydantic v2 | Request/response validation |
| Pandas | Data processing and time-series alignment |
| HTTPX | Async HTTP client for Elexon API |
| Uvicorn | ASGI server |
| Pytest | Testing framework |

### Infrastructure
| Technology | Purpose |
|---|---|
| Docker | Containerization |
| Docker Compose | Local development orchestration |
| Vercel | Production deployment (frontend + Python serverless functions) |

---

## Architecture and Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                    User's Browser                        │
│  React Dashboard (Vite build, served by Vercel CDN)     │
└─────────────────────┬───────────────────────────────────┘
                      │ HTTP /api/*
                      ▼
┌─────────────────────────────────────────────────────────┐
│              Python Backend (FastAPI)                     │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ API      │  │ Data         │  │ Accuracy         │  │
│  │ Routes   │→ │ Processor    │→ │ Calculator       │  │
│  └──────────┘  └──────┬───────┘  └──────────────────┘  │
│                       │                                  │
│  ┌────────────────────▼─────────────────────────────┐   │
│  │           Elexon API Client (HTTPX)               │   │
│  └────────────────────┬─────────────────────────────┘   │
└───────────────────────┼─────────────────────────────────┘
                        │ HTTPS
                        ▼
┌─────────────────────────────────────────────────────────┐
│              Elexon BMRS API (data.elexon.co.uk)        │
│  ┌──────────────┐  ┌──────────────────────────────┐    │
│  │ FUELHH       │  │ WINDFOR                       │    │
│  │ (Actuals)    │  │ (Forecasts)                   │    │
│  └──────────────┘  └──────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

## Data Sources

### FUELHH — Half-Hourly Fuel Generation (Actuals)
- **Endpoint:** `GET /datasets/FUELHH/stream`
- **Purpose:** Actual national wind generation (outturn data)
- **Granularity:** Half-hourly (48 settlement periods per day)
- **Filtering:** `fuelType == "WIND"` to isolate wind generation
- **Fields used:**
  - `startTime` — Start of the half-hourly delivery interval (ISO 8601 UTC)
  - `publishTime` — When the actual was published (ISO 8601 UTC)
  - `settlementDate` — GB settlement date
  - `settlementPeriod` — Settlement period (1–48)
  - `fuelType` — Fuel type identifier (filtered to `"WIND"`)
  - `generation` — Average power output in MW for the interval

### WINDFOR — Wind Generation Forecast
- **Endpoint:** `GET /datasets/WINDFOR/stream`
- **Purpose:** National wind generation forecasts published at various times
- **Granularity:** Hourly delivery intervals
- **Key characteristic:** Multiple forecast publications exist for each delivery interval, published at different times
- **Fields used:**
  - `startTime` — Start of the forecast delivery interval (ISO 8601 UTC)
  - `publishTime` — When this forecast was published (ISO 8601 UTC)
  - `generation` — Forecast average power in MW for the interval
- **Note:** WINDFOR does not include `fuelType`, `settlementDate`, or `settlementPeriod` fields

### 30-Minute Settlement Period Alignment
FUELHH actuals have native **half-hourly (30-minute)** settlement resolution (48 settlement periods per day, 1,488 expected periods in January 2026), while WINDFOR forecasts are issued at **hourly** intervals:
- Each FUELHH settlement period outturn is preserved at its native 30-minute resolution without averaging two half-hours into an hourly figure.
- Each 30-minute settlement period (both `:00` and `:30` within hour $H$) is evaluated directly against the prevailing hourly forecast rate issued for hour $H$ `[H:00 to H+1:00)`.
- This maintains complete fidelity to the UK electricity settlement structure while accurately evaluating forecast error across every half-hour delivery interval.

### API Query Parameters
Both endpoints use `publishDateTimeFrom` and `publishDateTimeTo` (ISO 8601) to filter by publication time. The stream endpoints return JSON arrays directly without pagination.

---

## Forecast Selection and Decision-Cutoff Methodology

### Day-Ahead Market Context
The UK day-ahead electricity market (operated through EPEX SPOT) requires purchasing decisions before gate closure. The default decision cutoff in WindSight is **09:30 UTC** (09:30 GMT in January), based on the EPEX SPOT UK day-ahead auction timing.

> **Note:** This cutoff is a configurable assumption. The application does not verify the exact market gate closure time. Users can adjust the cutoff to match their specific procurement process.

### Forecast Selection Algorithm
For each delivery interval `t` and a configured decision cutoff `T`:

1. Retrieve all WINDFOR forecast records with `startTime == t`
2. Parse each forecast's `publishTime`
3. Retain only forecasts where `publishTime ≤ T`
4. Select the forecast with the **maximum** (latest) `publishTime` among eligible forecasts
5. If no forecast was published by the cutoff, the interval is marked as **no eligible forecast**

### Date Relationships
- **Decision date:** The date on which purchasing decisions are made (typically D-1)
- **Decision cutoff:** The time by which forecasts must be published to be considered (default: 09:30 UTC)
- **Delivery date:** The date for which electricity is being purchased (typically D)
- **Delivery interval:** A specific hourly period within the delivery date

For January 2026 analysis:
- Forecasts for January 1 delivery could be published on December 31
- The application fetches WINDFOR data starting from the day before the analysis period
- All timestamps are handled as timezone-aware UTC

### Timezone Handling
- All internal processing uses UTC
- January in the UK is GMT (UTC+0), so no offset applies
- The UI clearly displays the timezone context
- Timezone handling is implemented robustly for potential extension to BST periods

---

## Statistical Metrics

### Signed Error
```
signed_error = forecast_generation − actual_generation
```
- **Positive:** Forecast overestimated generation
- **Negative:** Forecast underestimated generation

### Mean Absolute Error (MAE)
```
MAE = mean(|forecast − actual|)
```
Average magnitude of forecast errors. Lower is better. Units: MW.

### Root Mean Squared Error (RMSE)
```
RMSE = √(mean((forecast − actual)²))
```
Penalizes larger errors more heavily than MAE. Units: MW.

### Mean Bias Error (Bias)
```
Bias = mean(forecast − actual)
```
- **Positive bias:** Forecasts tend to overestimate wind generation
- **Negative bias:** Forecasts tend to underestimate wind generation
- **Near zero:** No systematic directional error (individual errors may still be large)

### MAPE (Optional)
```
MAPE = mean(|forecast − actual| / actual) × 100
```
Only calculated when all actual values are non-zero. Documented as potentially misleading when generation is low.

### Data Requirements
- Metrics are calculated only from valid, matched forecast–actual pairs
- Intervals missing either a forecast or an actual observation are excluded
- The sample count and data coverage percentage are always displayed alongside metrics
- If too few valid observations exist, an explanatory message is shown instead of misleading metrics

---

## Assumptions and Limitations

1. **Decision cutoff is assumed, not verified.** The default 09:30 UTC cutoff is based on the EPEX SPOT UK day-ahead auction schedule. Users should verify this against their actual procurement timeline.

2. **Hourly forecast rate mapped to 30-minute settlement periods.** Each hourly forecast rate is evaluated against the native half-hourly outturn for both settlement periods within that hour, preserving actual settlement granularity without synthesizing artificial sub-hourly forecast profiles.

3. **National-level data only.** Both FUELHH and WINDFOR provide GB-national aggregated wind generation. Regional breakdowns are not available from these datasets.

4. **No other generation sources.** The shortfall estimator considers only wind generation and a user-entered demand value. It excludes solar, gas, nuclear, interconnectors, storage, existing contracts, and all other factors relevant to actual procurement.

5. **January 2026 scope.** The analysis period is restricted to January 2026 as specified in the project requirements.

6. **No real-time guarantees.** Data is fetched from Elexon's API on request. The application does not maintain a persistent data feed.

7. **Serverless execution limits.** When deployed to Vercel, Python functions have execution time limits (up to 60 seconds). Large date range queries may need to be split.

---

## Project Structure

```
WindSight/
├── api/
│   └── index.py              # Vercel serverless function entry point
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py            # FastAPI application
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   └── routes.py      # API endpoint handlers
│   │   ├── core/
│   │   │   ├── __init__.py
│   │   │   └── config.py      # Application settings
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   └── models.py      # Pydantic request/response models
│   │   └── services/
│   │       ├── __init__.py
│   │       ├── elexon_client.py      # Elexon API integration
│   │       ├── data_processor.py     # Data cleaning and alignment
│   │       └── accuracy_calculator.py # Statistical calculations
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── conftest.py
│   │   ├── test_data_processor.py
│   │   ├── test_accuracy_calculator.py
│   │   └── test_api.py
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── charts/
│   │   │   ├── common/
│   │   │   ├── features/
│   │   │   ├── layout/
│   │   │   └── tables/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── hooks/
│   │   ├── types/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── public/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── nginx.conf
│   └── Dockerfile
├── docker-compose.yml
├── .dockerignore
├── .gitignore
├── .env.example
├── vercel.json
└── README.md
```

---

## Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.12+
- **Docker** and Docker Compose (for containerized development)
- **Git**

---

## Local Development Setup

### Backend

```bash
# Create and activate virtual environment
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the backend server
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`. API documentation at `http://localhost:8000/docs`.

### Frontend

```bash
# Install dependencies
cd frontend
npm install

# Start development server (proxies /api to backend on port 8000)
npm run dev
```

The frontend will be available at `http://localhost:5173`.

### Both Together

Run backend and frontend in separate terminals, or use Docker Compose (see below).

---

## Docker Setup

Docker is used for **local development and testing**. Production deployment uses Vercel.

```bash
# Build and start both services
docker compose up --build

# Access the application
# Frontend: http://localhost:8080
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs

# Stop services
docker compose down
```

---

## Testing

### Backend Tests

```bash
cd backend
source venv/bin/activate
python -m pytest tests/ -v
```

Tests cover:
- Wind actuals filtering (FUELHH → WIND only)
- Timestamp parsing and timezone handling
- Forecast selection by decision cutoff
- Forecast–actual matching by delivery interval
- MAE, RMSE, and bias calculations (including sign convention)
- Missing and duplicate data handling
- API endpoint responses
- Shortfall calculation and input validation

### Frontend Build Verification

```bash
cd frontend
npm run build
```

---

## Environment Variables

### Backend
| Variable | Default | Description |
|---|---|---|
| `CORS_ORIGINS` | `http://localhost:3000,http://localhost:5173` | Comma-separated allowed origins |
| `ELEXON_BASE_URL` | `https://data.elexon.co.uk/bmrs/api/v1` | Elexon API base URL |
| `DEFAULT_CUTOFF_HOUR` | `9` | Default decision cutoff hour (UTC) |
| `DEFAULT_CUTOFF_MINUTE` | `30` | Default decision cutoff minute |
| `REQUEST_TIMEOUT` | `30` | HTTP request timeout in seconds |
| `MAX_RETRIES` | `3` | Maximum retry attempts for API requests |

### Frontend (Vite build-time)
| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | (empty) | API base URL. Empty string for same-origin (Vercel). |

### Vercel Environment Variables
Set in the Vercel dashboard:
- `CORS_ORIGINS` — Your Vercel deployment URL (e.g., `https://windsight.vercel.app`)
- `ELEXON_BASE_URL` — `https://data.elexon.co.uk/bmrs/api/v1`

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Application health check |
| `GET` | `/api/metadata` | Supported analysis period, defaults, data source info |
| `GET` | `/api/forecasts` | Forecast data for a delivery date with cutoff applied |
| `GET` | `/api/actuals` | Actual wind generation for a date |
| `GET` | `/api/analysis` | Matched forecast–actual pairs with accuracy metrics |
| `GET` | `/api/forecast-publications` | Available publications for a delivery interval |
| `POST` | `/api/shortfall` | Indicative wind shortfall calculation |

Query parameters and request bodies are documented in the auto-generated OpenAPI spec at `/docs`.

---

## Deployment

### Vercel Deployment

WindSight is designed for deployment on **Vercel only**.

1. **Push to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial WindSight MVP"
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```

2. **Import to Vercel:**
   - Go to [vercel.com](https://vercel.com) and import the GitHub repository
   - Vercel will detect the `vercel.json` configuration
   - Set the **Root Directory** to the repository root

3. **Configure Environment Variables** in the Vercel dashboard:
   - `CORS_ORIGINS` = your deployment URL
   - `ELEXON_BASE_URL` = `https://data.elexon.co.uk/bmrs/api/v1`

4. **Deploy** — Vercel will:
   - Install Python dependencies from `backend/requirements.txt`
   - Build the React frontend from `frontend/`
   - Deploy the Python API as a serverless function
   - Serve the frontend from the CDN

5. **Verify** — Open the deployment URL and confirm:
   - Frontend loads
   - API calls succeed (`/api/health`)
   - Real Elexon data appears in charts

### Known Deployment Considerations
- Vercel Python functions have a **60-second execution limit** (configured in `vercel.json`)
- Functions start fresh on each invocation (no persistent filesystem)
- Cold starts may add 1–3 seconds to the first request
- Large date range analysis queries may approach the time limit

---

## AI Assistance Disclosure

This project was developed with assistance from:
- **Google Antigravity** — AI coding assistant used for code generation, architecture decisions, and documentation
- Development involved human review and verification of all generated code, API integration, and test results

The AI assistance was used for:
- Initial project scaffolding and boilerplate
- Component implementation
- Test writing
- Documentation drafting

All Elexon API integration, data processing logic, statistical calculations, and business rules were verified against the actual API responses and requirements.

---

## Known Limitations and Future Improvements

### Current Limitations
1. **January 2026 only** — The analysis period is hardcoded to January 2026
2. **No persistent caching** — Each API request fetches data from Elexon (caching is in-memory only per function invocation)
3. **Forecast resolution vs. settlement periods** — WINDFOR forecasts are issued hourly, while settlement actuals operate at 30-minute intervals. Each 30-minute period is compared against the prevailing hourly forecast rate.
4. **Single cutoff per query** — Cannot compare multiple cutoff scenarios simultaneously
5. **No authentication** — The application is publicly accessible

### Future Improvements
- Extend to arbitrary date ranges
- Add persistent caching (Redis or database) for historical data
- Support multiple concurrent cutoff scenario comparisons
- Add regional wind generation breakdown if data becomes available
- Implement user authentication for enterprise deployment
- Add data export (CSV, Excel) functionality
- Support BST/GMT timezone switching for non-January months
- Add comparative analysis across different forecast horizons
