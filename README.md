# Stone Henge MVP

Quote generation system for stone countertop fabrication.

<!-- Force redeploy to pick up R2 environment variables -->

## Prerequisites

- Node.js 18+ (https://nodejs.org)
- Docker Desktop (https://docker.com/products/docker-desktop)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Database

```bash
docker compose up -d
```

### 3. Set Up Environment

```bash
cp .env.example .env
```

### 4. Run Database Migrations

```bash
npx prisma migrate dev
```

### 5. Seed Demo Data

```bash
npx prisma db seed
```

### 6. Start Development Server

```bash
npm run dev
```

### 7. Open Application

Visit http://localhost:3000

**Demo Login:**
- Email: admin@northcoaststone.com.au
- Password: demo1234

## Project Structure

```
stonehenge/
├── src/
│   ├── app/                # Next.js pages
│   ├── components/         # React components
│   └── lib/                # Utilities, database
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── seed.ts             # Demo data
├── uploads/                # Uploaded files (local)
├── docker-compose.yml      # PostgreSQL container
└── package.json
```

## Key Features

- Create and manage quotes
- Material catalog with pricing
- Pricing rules (edge profiles, cutouts, features)
- PDF quote generation
- Customer management (basic)
- File uploads for drawings

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npx prisma studio` | Open database GUI |
| `npx prisma migrate dev` | Run migrations |
| `npx prisma db seed` | Seed demo data |

## Tech Stack

- **Framework:** Next.js 14
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Styling:** TailwindCSS
- **PDF Generation:** @react-pdf/renderer

## Deployment to Railway

See DEPLOY.md for full deployment instructions.
