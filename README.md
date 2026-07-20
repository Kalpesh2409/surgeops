# SurgeOps

[![CI](https://github.com/Kalpesh2409/surgeops/actions/workflows/ci.yml/badge.svg)](https://github.com/Kalpesh2409/surgeops/actions/workflows/ci.yml)

## Problem Statement

Dark stores in Indian quick-commerce operate on thin margins against highly volatile, hyperlocal demand — a heatwave spikes cold-drink orders, a downpour spikes staples, and static pricing/inventory rules can't keep up. Manual price reviews lag the spike; fixed markups leave margin on the table during stockout-risk windows; and inventory imbalances between stores go unaddressed.

**SurgeOps** simulates a real-time pricing and inventory system across four dark stores (Bandra West, Kothrud, Koramangala, Noida), pairing a rules engine with an ML demand model so the two can cross-check each other — with live state pushed to a dashboard via SSE.

## Tech Stack

| Layer | Technology |
|---|---|
| API | Node.js, Express, TypeScript |
| ML Service | Python, FastAPI, scikit-learn |
| Database | PostgreSQL, Prisma ORM |
| Cache / Real-time state | Redis (ioredis) |
| Frontend | React, TypeScript, Tailwind CSS v4, shadcn/ui |
| Real-time updates | Server-Sent Events (SSE) |
| AI explanations | Gemini API (free tier) |
| Infra | Docker Compose |
| CI/CD | GitHub Actions |

**Why these choices:**

- **Node.js + Express + TypeScript for the API** — type safety across a system with many moving pieces (pricing, inventory, simulator), and a mature ecosystem for building REST + SSE endpoints quickly.
- **Python + FastAPI + scikit-learn for ML, as a real server (not Jupyter)** — scikit-learn is the standard choice for a tabular regression problem like demand prediction, and FastAPI serves it as an actual microservice the Node API can call over HTTP — closer to how ML is deployed in production than a notebook would be.
- **PostgreSQL + Prisma** — relational data (stores, products, orders, price history) fits a relational model well, and Prisma gives type-safe queries and migrations without hand-written SQL.
- **Redis** — sub-second reads for live pricing/inventory state without hitting Postgres on every request; also used for caching Gemini explanations to stay within free-tier rate limits.
- **SSE over WebSockets** — the data flow is one-directional (server → dashboard), so SSE gives real-time push with a simpler protocol and no need for bidirectional messaging.
- **No message queue for MVP** — order volume in this simulation doesn't warrant the operational overhead of a queue; direct service calls keep the system simpler to reason about and to run at ₹0 cost.
- **Gemini API (free tier)** — the only free LLM option viable for generating human-readable pricing explanations, with rate limiting designed around its 5 RPM cap.
- **Docker Compose** — spins up Postgres, Redis, API, ML service, and frontend together with one command; no need for Kubernetes-level orchestration at this scale.
- **GitHub Actions** — free CI for a private repo, with real Postgres/Redis service containers so tests run against real infra, not mocks.

## Architecture

```mermaid
flowchart TB
    Sim(["🚦 Traffic Simulator<br/>injects demand events"])

    subgraph Stores [" 4 Dark Stores (managed by the API) "]
        direction LR
        S1["🏬 Bandra West"]
        S2["🏬 Kothrud"]
        S3["🏬 Koramangala"]
        S4["🏬 Noida"]
    end

    API["⚙️ Node.js + Express API<br/>Port 4000"]
    DB[("🗄️ PostgreSQL<br/>via Prisma")]
    Cache[("⚡ Redis<br/>via ioredis")]
    ML["🧠 FastAPI ML Service<br/>scikit-learn RandomForest"]
    Gemini["✨ Gemini API<br/>rate-limited + cached"]
    Web["📊 React Dashboard<br/>Tailwind + shadcn/ui"]

    Sim -->|demand events| API
    API <-->|reads/writes| DB
    API <-->|cache & pub| Cache
    API -->|predict| ML
    API -->|explain| Gemini
    API ==>|SSE stream| Web

    Stores ~~~ API

    classDef store fill:#fce7f3,stroke:#db2777,color:#831843,stroke-width:1px
    classDef core fill:#dbeafe,stroke:#2563eb,color:#1e3a8a,stroke-width:2px
    classDef data fill:#dcfce7,stroke:#16a34a,color:#14532d,stroke-width:1px
    classDef ext fill:#fef3c7,stroke:#d97706,color:#78350f,stroke-width:1px
    classDef ui fill:#ede9fe,stroke:#7c3aed,color:#4c1d95,stroke-width:1px

    class S1,S2,S3,S4 store
    class API core
    class DB,Cache data
    class ML,Gemini ext
    class Web ui
```