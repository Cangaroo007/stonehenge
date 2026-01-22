# Stone Henge - Complete Project Documentation

> **Purpose:** This document provides a comprehensive overview of the Stone Henge Quote Management System for use by AI assistants (Claude) to understand the codebase and implement upgrades.

---

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure](#3-project-structure)
4. [Database Schema](#4-database-schema)
5. [API Endpoints](#5-api-endpoints)
6. [UI Components](#6-ui-components)
7. [Pages & Routes](#7-pages--routes)
8. [Authentication System](#8-authentication-system)
9. [Key Patterns & Conventions](#9-key-patterns--conventions)
10. [Development Setup](#10-development-setup)
11. [Planned Upgrades & Improvements](#11-planned-upgrades--improvements)
12. [Implementation Roadmap](#12-implementation-roadmap)

---

## 1. Project Overview

**Stone Henge MVP** is a Quote Management System for stone countertop fabrication, built for Northcoast Stone Pty Ltd (Australian company). It enables creating, managing, and generating professional PDF quotes for stone benchtops.

### Core Features
- **Quote Management:** Create, edit, view quotes with multi-room support
- **Customer Database:** Track customer information and quote history
- **Material Catalog:** Manage stone materials with pricing
- **Pricing Rules:** Configurable pricing for edges, cutouts, thickness, features
- **PDF Generation:** Professional quote PDFs with company branding
- **AI Drawing Analysis:** Upload architectural drawings for automatic piece extraction
- **User Authentication:** Secure JWT-based login system

### Key Metrics
- 39 TypeScript/TSX files
- ~316KB source code
- 14 pages + 15 API endpoints
- 9 database models

---

## 2. Technology Stack

### Core Framework
| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 14.1.0 | React framework with App Router |
| React | 18.2.0 | UI library |
| TypeScript | 5.3.3 | Type safety |
| Node.js | 18+ | Runtime |

### Database
| Technology | Version | Purpose |
|------------|---------|---------|
| PostgreSQL | 16 | Primary database |
| Prisma | 5.9.0 | Type-safe ORM |

### Styling
| Technology | Version | Purpose |
|------------|---------|---------|
| TailwindCSS | 3.4.1 | Utility-first CSS |
| tailwind-merge | 2.2.1 | Class merging |
| clsx | 2.1.0 | Conditional classes |

### Authentication & Security
| Technology | Version | Purpose |
|------------|---------|---------|
| jose | 5.2.2 | JWT handling |
| bcryptjs | 2.4.3 | Password hashing |

### PDF & File Handling
| Technology | Version | Purpose |
|------------|---------|---------|
| pdf-lib | 1.17.1 | PDF generation (serverless compatible) |
| @react-pdf/renderer | 3.4.0 | PDF components (legacy) |

### AI Integration
| Technology | Version | Purpose |
|------------|---------|---------|
| @anthropic-ai/sdk | 0.39.0 | Claude API for drawing analysis |

### Utilities
| Technology | Version | Purpose |
|------------|---------|---------|
| date-fns | 3.3.1 | Date formatting |
| zod | 3.22.4 | Schema validation |
| react-hot-toast | 2.4.1 | Toast notifications |

---

## 3. Project Structure

```
stonehenge/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (dashboard)/              # Protected dashboard routes
│   │   │   ├── layout.tsx            # Dashboard layout with auth check
│   │   │   ├── dashboard/page.tsx    # Home stats dashboard
│   │   │   ├── quotes/               # Quote management pages
│   │   │   │   ├── page.tsx          # List all quotes
│   │   │   │   ├── new/page.tsx      # Create quote
│   │   │   │   └── [id]/             # Dynamic quote routes
│   │   │   │       ├── page.tsx      # View quote
│   │   │   │       └── edit/page.tsx # Edit quote
│   │   │   ├── customers/            # Customer management pages
│   │   │   ├── materials/            # Material catalog pages
│   │   │   ├── pricing/page.tsx      # Pricing rules management
│   │   │   └── settings/page.tsx     # App settings
│   │   ├── login/page.tsx            # Public login page
│   │   ├── api/                      # API routes
│   │   │   ├── auth/                 # Authentication endpoints
│   │   │   ├── quotes/               # Quote CRUD + PDF
│   │   │   ├── customers/            # Customer CRUD
│   │   │   ├── materials/            # Material CRUD
│   │   │   ├── pricing-rules/        # Pricing rules CRUD
│   │   │   ├── analyze-drawing/      # AI drawing analysis
│   │   │   └── health/               # Health check endpoint
│   │   ├── page.tsx                  # Root redirect
│   │   ├── layout.tsx                # Root layout
│   │   └── globals.css               # Global styles
│   ├── components/                   # Reusable React components
│   │   ├── Sidebar.tsx               # Navigation sidebar
│   │   ├── Header.tsx                # Top header bar
│   │   ├── QuoteForm.tsx             # Quote creation/editing (811 LOC)
│   │   ├── QuotePDF.tsx              # PDF preview component
│   │   ├── DrawingUploadModal.tsx    # AI drawing upload (515 LOC)
│   │   ├── PricingRuleForm.tsx       # Pricing rule form
│   │   └── DeleteQuoteButton.tsx     # Quote delete action
│   └── lib/                          # Utilities
│       ├── auth.ts                   # JWT/password functions
│       ├── db.ts                     # Prisma client singleton
│       └── utils.ts                  # Formatting helpers
├── prisma/
│   ├── schema.prisma                 # Database schema (9 models)
│   └── seed.ts                       # Demo data seeder
├── uploads/                          # Local file storage
├── package.json                      # Dependencies & scripts
├── tsconfig.json                     # TypeScript config (strict mode)
├── tailwind.config.js                # Tailwind theme
├── next.config.js                    # Next.js config
├── docker-compose.yml                # Local PostgreSQL
├── railway.toml                      # Deployment config
├── .env.example                      # Environment template
├── README.md                         # Quick start guide
└── DEPLOY.md                         # Deployment guide
```

---

## 4. Database Schema

### Entity Relationship Diagram (Text)

```
User (1) ──────────< Quote (many)
                       │
Customer (1) ─────────<┤
                       │
                       ├──< QuoteRoom (many)
                       │         │
                       │         └──< QuotePiece (many)
                       │                   │
                       │                   ├──> Material (optional)
                       │                   │
                       │                   └──< PieceFeature (many)
                       │                              │
                       │                              └──> PricingRule (optional)
                       │
                       └──< QuoteFile (many)

Setting (standalone key-value config)
```

### Model Definitions

#### User
```prisma
model User {
  id           Int      @id @default(autoincrement())
  email        String   @unique
  passwordHash String
  name         String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  quotes       Quote[]
}
```

#### Customer
```prisma
model Customer {
  id        Int      @id @default(autoincrement())
  name      String
  company   String?
  email     String?
  phone     String?
  address   String?
  notes     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  quotes    Quote[]
}
```

#### Material
```prisma
model Material {
  id          Int          @id @default(autoincrement())
  name        String
  collection  String?      // Classic, Premium, Designer, Industrial
  description String?
  pricePerSqm Decimal      @db.Decimal(10, 2)
  isActive    Boolean      @default(true)
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
  pieces      QuotePiece[]
}
```

#### PricingRule
```prisma
model PricingRule {
  id            Int            @id @default(autoincrement())
  category      String         // thickness, edge, cutout, feature
  name          String
  description   String?
  price         Decimal        @db.Decimal(10, 2)
  priceType     String         // fixed, per_meter, per_sqm, multiplier
  isActive      Boolean        @default(true)
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  pieceFeatures PieceFeature[]
}
```

#### Quote
```prisma
model Quote {
  id             Int        @id @default(autoincrement())
  quoteNumber    String     @unique
  revision       Int        @default(1)
  customerId     Int?
  customer       Customer?  @relation(fields: [customerId], references: [id])
  projectName    String?
  projectAddress String?
  status         String     @default("draft")  // draft, sent, accepted, declined
  subtotal       Decimal    @db.Decimal(10, 2)
  taxRate        Decimal    @db.Decimal(5, 2)
  taxAmount      Decimal    @db.Decimal(10, 2)
  total          Decimal    @db.Decimal(10, 2)
  validUntil     DateTime?
  notes          String?
  internalNotes  String?
  createdBy      Int?
  createdByUser  User?      @relation(fields: [createdBy], references: [id])
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt
  rooms          QuoteRoom[]
  files          QuoteFile[]
}
```

#### QuoteRoom
```prisma
model QuoteRoom {
  id        Int          @id @default(autoincrement())
  quoteId   Int
  quote     Quote        @relation(fields: [quoteId], references: [id], onDelete: Cascade)
  name      String       // Kitchen, Bathroom, Ensuite, Laundry, etc.
  sortOrder Int          @default(0)
  pieces    QuotePiece[]
}
```

#### QuotePiece
```prisma
model QuotePiece {
  id           Int            @id @default(autoincrement())
  roomId       Int
  room         QuoteRoom      @relation(fields: [roomId], references: [id], onDelete: Cascade)
  materialId   Int?
  material     Material?      @relation(fields: [materialId], references: [id])
  materialName String?        // Denormalized for display
  description  String?
  lengthMm     Int
  widthMm      Int
  thicknessMm  Int            @default(20)
  areaSqm      Decimal        @db.Decimal(10, 4)
  materialCost Decimal        @db.Decimal(10, 2)
  featuresCost Decimal        @db.Decimal(10, 2)
  totalCost    Decimal        @db.Decimal(10, 2)
  sortOrder    Int            @default(0)
  features     PieceFeature[]
}
```

#### PieceFeature
```prisma
model PieceFeature {
  id            Int          @id @default(autoincrement())
  pieceId       Int
  piece         QuotePiece   @relation(fields: [pieceId], references: [id], onDelete: Cascade)
  pricingRuleId Int?
  pricingRule   PricingRule? @relation(fields: [pricingRuleId], references: [id])
  name          String
  quantity      Int          @default(1)
  unitPrice     Decimal      @db.Decimal(10, 2)
  totalPrice    Decimal      @db.Decimal(10, 2)
}
```

#### QuoteFile
```prisma
model QuoteFile {
  id           Int      @id @default(autoincrement())
  quoteId      Int
  quote        Quote    @relation(fields: [quoteId], references: [id], onDelete: Cascade)
  filename     String
  originalName String
  filePath     String
  fileType     String?
  fileSize     Int?
  uploadedAt   DateTime @default(now())
}
```

#### Setting
```prisma
model Setting {
  id        Int      @id @default(autoincrement())
  key       String   @unique  // quote_prefix, quote_validity_days, etc.
  value     String
  updatedAt DateTime @updatedAt
}
```

---

## 5. API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login with email/password, returns JWT cookie |
| POST | `/api/auth/logout` | Clear auth cookie |
| GET | `/api/health` | Database health check |

### Quotes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/quotes` | List all quotes with customer data |
| POST | `/api/quotes` | Create quote with nested rooms/pieces |
| GET | `/api/quotes/[id]` | Get single quote with full hierarchy |
| PUT | `/api/quotes/[id]` | Update quote, replaces rooms/pieces |
| DELETE | `/api/quotes/[id]` | Delete quote (cascades) |
| GET | `/api/quotes/[id]/pdf` | Generate and download PDF |

### Customers

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/customers` | List all customers |
| POST | `/api/customers` | Create customer |
| GET | `/api/customers/[id]` | Get single customer |
| PUT | `/api/customers/[id]` | Update customer |
| DELETE | `/api/customers/[id]` | Delete customer |

### Materials

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/materials` | List all materials |
| POST | `/api/materials` | Create material |
| GET | `/api/materials/[id]` | Get single material |
| PUT | `/api/materials/[id]` | Update material |
| DELETE | `/api/materials/[id]` | Delete material |

### Pricing Rules

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/pricing-rules` | List all pricing rules |
| POST | `/api/pricing-rules` | Create pricing rule |

### AI Integration

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/analyze-drawing` | Upload drawing for AI analysis |

---

## 6. UI Components

### Core Components

| Component | File | LOC | Description |
|-----------|------|-----|-------------|
| Sidebar | `src/components/Sidebar.tsx` | 108 | Navigation menu with icons |
| Header | `src/components/Header.tsx` | 47 | Top bar with user info & logout |
| QuoteForm | `src/components/QuoteForm.tsx` | 811 | Complex quote editor with rooms/pieces |
| DrawingUploadModal | `src/components/DrawingUploadModal.tsx` | 515 | AI drawing upload & review |
| QuotePDF | `src/components/QuotePDF.tsx` | 498 | PDF preview (react-pdf) |
| PricingRuleForm | `src/components/PricingRuleForm.tsx` | 137 | Pricing rule editor |
| DeleteQuoteButton | `src/components/DeleteQuoteButton.tsx` | 49 | Delete with confirmation |

### QuoteForm State Structure
```typescript
interface FormState {
  customerId: number | null;
  customerName: string;
  projectName: string;
  projectAddress: string;
  notes: string;
  internalNotes: string;
  rooms: {
    name: string;
    pieces: {
      description: string;
      lengthMm: number;
      widthMm: number;
      thicknessMm: number;
      materialId: number | null;
      materialName: string;
      pricePerSqm: number;
      features: {
        name: string;
        quantity: number;
        unitPrice: number;
        pricingRuleId: number | null;
      }[];
    }[];
  }[];
}
```

---

## 7. Pages & Routes

### Public Routes
| Route | File | Description |
|-------|------|-------------|
| `/` | `src/app/page.tsx` | Redirect to dashboard or login |
| `/login` | `src/app/login/page.tsx` | Login form |

### Protected Routes (Dashboard)
| Route | File | Description |
|-------|------|-------------|
| `/dashboard` | `src/app/(dashboard)/dashboard/page.tsx` | Stats overview |
| `/quotes` | `src/app/(dashboard)/quotes/page.tsx` | Quote list |
| `/quotes/new` | `src/app/(dashboard)/quotes/new/page.tsx` | Create quote |
| `/quotes/[id]` | `src/app/(dashboard)/quotes/[id]/page.tsx` | View quote |
| `/quotes/[id]/edit` | `src/app/(dashboard)/quotes/[id]/edit/page.tsx` | Edit quote |
| `/customers` | `src/app/(dashboard)/customers/page.tsx` | Customer list |
| `/customers/new` | `src/app/(dashboard)/customers/new/page.tsx` | Create customer |
| `/customers/[id]/edit` | `src/app/(dashboard)/customers/[id]/edit/page.tsx` | Edit customer |
| `/materials` | `src/app/(dashboard)/materials/page.tsx` | Material catalog |
| `/materials/new` | `src/app/(dashboard)/materials/new/page.tsx` | Create material |
| `/materials/[id]/edit` | `src/app/(dashboard)/materials/[id]/edit/page.tsx` | Edit material |
| `/pricing` | `src/app/(dashboard)/pricing/page.tsx` | Pricing rules |
| `/settings` | `src/app/(dashboard)/settings/page.tsx` | App settings |

---

## 8. Authentication System

### Flow
1. User submits email/password to `/api/auth/login`
2. Server verifies password with bcrypt
3. JWT token created with 7-day expiration using jose
4. Token stored in httpOnly cookie
5. Dashboard layout checks for valid token on each request
6. Invalid/missing token redirects to `/login`

### Key Files
- `src/lib/auth.ts` - JWT creation, verification, password hashing
- `src/app/api/auth/login/route.ts` - Login endpoint
- `src/app/api/auth/logout/route.ts` - Logout endpoint
- `src/app/(dashboard)/layout.tsx` - Auth check middleware

### Demo Credentials
- Email: `admin@northcoaststone.com.au`
- Password: `demo1234`

---

## 9. Key Patterns & Conventions

### TypeScript
- **Strict mode enabled** in tsconfig.json
- Arrow functions preferred over function declarations
- Proper type exports for API responses
- Decimal types for financial calculations

### API Design
- RESTful conventions with proper HTTP status codes
- Consistent error format: `{ error: "message" }`
- Nested data creation in POST/PUT requests

### Database
- Prisma ORM with Decimal(10,2) for money
- Cascade deletes for referential integrity
- Denormalized fields where needed (materialName)

### Styling
- TailwindCSS utility classes
- Component classes in globals.css
- Responsive with lg: breakpoints

### Financial Calculations
```typescript
// Always convert Prisma Decimal to number for calculations
const amount = parseFloat(decimal.toString());
```

---

## 10. Development Setup

### Prerequisites
- Node.js 18+
- Docker Desktop

### Quick Start
```bash
# Clone and install
git clone <repo-url>
cd stonehenge
npm install

# Start database
docker compose up -d

# Configure environment
cp .env.example .env

# Run migrations
npx prisma migrate dev

# Seed demo data
npx prisma db seed

# Start dev server
npm run dev

# Open http://localhost:3000
```

### Available Scripts
```bash
npm run dev          # Development server
npm run build        # Production build
npm start            # Production server
npm run lint         # Linting
npx prisma studio    # Database GUI
npx prisma db seed   # Seed demo data
```

### Environment Variables
```env
DATABASE_URL="postgresql://user:pass@localhost:5432/stonehenge"
JWT_SECRET="your-secret-key"
NEXT_PUBLIC_APP_NAME="Stone Henge"
NEXT_PUBLIC_CURRENCY="AUD"
NEXT_PUBLIC_TAX_RATE="10"
NEXT_PUBLIC_TAX_NAME="GST"
COMPANY_NAME="Your Company"
COMPANY_ADDRESS="123 Main St"
COMPANY_PHONE="1234567890"
COMPANY_EMAIL="info@company.com"
COMPANY_ABN="12345678901"
ANTHROPIC_API_KEY="sk-ant-..." # Optional, for AI features
```

---

## 11. Planned Upgrades & Improvements

> **Instructions for Claude:** When implementing these features, reference this document for understanding the existing codebase structure, patterns, and conventions. Follow the established patterns for API routes, components, and database schema.

### Priority 1 - Core Business Features
<!-- Add your high-priority features here -->

1. **Feature Name**
   - Description:
   - Affected files:
   - Database changes:
   - New API endpoints:
   - New components:

### Priority 2 - User Experience
<!-- Add UX improvements here -->

### Priority 3 - Technical Improvements
<!-- Add technical debt / infrastructure improvements here -->

### Priority 4 - Nice to Have
<!-- Add lower priority features here -->

---

## 12. Implementation Roadmap

> **Instructions for Claude:** Use these prompts sequentially to implement the planned features. Each prompt should be self-contained and reference this documentation.

### Phase 1: [Feature Name]
```
Prompt 1.1:
[Detailed implementation prompt]

Prompt 1.2:
[Follow-up prompt if needed]
```

### Phase 2: [Feature Name]
```
Prompt 2.1:
[Detailed implementation prompt]
```

---

## Appendix A: File Reference Quick Links

### Most Important Files for Understanding the Codebase
1. `prisma/schema.prisma` - Database structure
2. `src/components/QuoteForm.tsx` - Complex state management example
3. `src/app/api/quotes/[id]/pdf/route.ts` - PDF generation
4. `src/lib/auth.ts` - Authentication logic
5. `src/app/(dashboard)/layout.tsx` - Protected route pattern

### Files to Modify for Common Tasks

| Task | Files to Modify |
|------|-----------------|
| Add new database field | `prisma/schema.prisma`, API routes, components |
| Add new page | `src/app/(dashboard)/[new-page]/page.tsx` |
| Add new API endpoint | `src/app/api/[endpoint]/route.ts` |
| Add new component | `src/components/[Component].tsx` |
| Modify quote form | `src/components/QuoteForm.tsx` |
| Modify PDF layout | `src/app/api/quotes/[id]/pdf/route.ts` |
| Change styling | `src/app/globals.css` or component |

---

## Appendix B: Common Patterns

### Creating a New API Route
```typescript
// src/app/api/example/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const GET = async () => {
  try {
    const items = await prisma.example.findMany();
    return NextResponse.json(items);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
};

export const POST = async (request: NextRequest) => {
  try {
    const data = await request.json();
    const item = await prisma.example.create({ data });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
  }
};
```

### Creating a New Page
```typescript
// src/app/(dashboard)/example/page.tsx
import prisma from '@/lib/db';
import Link from 'next/link';

const ExamplePage = async () => {
  const items = await prisma.example.findMany();

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Example</h1>
        <Link href="/example/new" className="btn-primary">
          Add New
        </Link>
      </div>
      {/* Content */}
    </div>
  );
};

export default ExamplePage;
```

### Client Component Pattern
```typescript
'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';

interface Props {
  initialData?: SomeType;
}

const ExampleForm = ({ initialData }: Props) => {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/example', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Saved!');
    } catch {
      toast.error('Error saving');
    } finally {
      setLoading(false);
    }
  };

  return <form onSubmit={handleSubmit}>{/* ... */}</form>;
};

export default ExampleForm;
```

---

*Last Updated: January 2026*
*Document Version: 1.0*
