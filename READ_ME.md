# FinanceTracker - Personal Finance Management Application

## Overview

FinanceTracker is a full-stack personal finance management application built with React, Express.js, Node.js and MangoDB. The application provides users with the ability to track their financial transactions, manage multiple accounts, categorize expenses, and view financial analytics. The system uses a modern tech stack with TypeScript throughout, Drizzle ORM for database management, and shadcn/ui for the frontend components.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **UI Framework**: shadcn/ui components with Radix UI primitives
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **State Management**: TanStack React Query for server state management
- **Routing**: Wouter for client-side routing
- **Form Handling**: React Hook Form with Zod validation
- **Build Tool**: Vite with hot module replacement

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Design**: RESTful API with JSON responses
- **Database**: MongoDB with Mongoose ODM
- **Validation**: Zod schemas shared between client and server
- **Session Management**: Express sessions

### Database Design
- **ODM**: Mongoose with MongoDB
- **Collections**: accounts, categories, transactions
- **Relationships**: ObjectId references between transactions and accounts/categories
- **Schema Validation**: Mongoose schemas with Zod validation integration
- **Development**: In-memory MongoDB server for local development

## Key Components

### Data Models
1. **Accounts**: Represents financial accounts (checking, savings, credit)
   - Fields: id, name, type, balance, createdAt
   - Supports multiple account types with balance tracking

2. **Categories**: Expense/income categorization system
   - Fields: id, name, color, icon, createdAt
   - Visual customization with colors and FontAwesome icons

3. **Transactions**: Core financial transaction records
   - Fields: id, amount, description, type, date, accountId, categoryId, createdAt
   - Links to accounts and categories with referential integrity

### API Endpoints
- **Accounts**: Full CRUD operations (`/api/accounts`)
- **Categories**: Full CRUD operations (`/api/categories`)
- **Transactions**: Full CRUD operations with filtering (`/api/transactions`)
- **Analytics**: Summary statistics and category spending analysis

### Frontend Pages
1. **Dashboard**: Overview with key metrics and recent transactions
2. **Transactions**: Comprehensive transaction management with filtering
3. **Accounts**: Account management and balance tracking
4. **Categories**: Category creation and customization

### UI Components
- Modular component architecture using shadcn/ui
- Form components with validation and error handling
- Data tables with sorting and filtering capabilities
- Mobile-responsive design with collapsible sidebar

## Data Flow

1. **User Actions**: User interactions trigger React components
2. **Form Validation**: Client-side validation using React Hook Form + Zod
3. **API Requests**: TanStack React Query manages HTTP requests to Express API
4. **Server Validation**: Server validates requests using shared Zod schemas
5. **Database Operations**: Drizzle ORM handles PostgreSQL interactions
6. **Response Handling**: JSON responses update client state via React Query
7. **UI Updates**: Components re-render based on updated server state

## External Dependencies

### Database
- **PostgreSQL**: Primary database (configured via DATABASE_URL)
- **Neon Database**: Serverless PostgreSQL provider integration

### UI Libraries
- **Radix UI**: Accessible component primitives
- **Lucide React**: Icon library
- **FontAwesome**: Additional icons for categories
- **Tailwind CSS**: Utility-first CSS framework

### Development Tools
- **TypeScript**: Type safety across the stack
- **Vite**: Fast development server and build tool
- **ESBuild**: Fast bundling for production server
- **PostCSS**: CSS processing with Tailwind

### Validation & Forms
- **Zod**: Schema validation library
- **React Hook Form**: Form state management
- **@hookform/resolvers**: Zod integration for forms

## Deployment Strategy

### Development
- **Client**: Vite dev server with HMR on port 5173
- **Server**: Node.js with tsx for TypeScript execution
- **Database**: PostgreSQL connection via DATABASE_URL environment variable

### Production Build
1. **Frontend**: Vite builds static assets to `dist/public`
2. **Backend**: ESBuild bundles server code to `dist/index.js`
3. **Static Serving**: Express serves built frontend assets
4. **Database**: Drizzle migrations applied via `drizzle-kit push`

### Environment Configuration
- Development uses `NODE_ENV=development`
- Production requires `DATABASE_URL` environment variable
- Build process optimized for Node.js deployment

## Changelog
- July 03, 2025. Initial setup
- July 03, 2025. Added FontAwesome icons and improved stat card alignment
- July 06, 2025. Migrated from PostgreSQL to MongoDB to implement MERN stack architecture
- July 06, 2025. Added complete user authentication system with registration, login, JWT tokens, and protected routes
- July 07, 2025. Added data export functionality (CSV, PDF) with date range filtering
- July 07, 2025. Implemented advanced transaction search and filtering with date range, amount range, and multi-field sorting
- July 07, 2025. Added account-to-account transfer functionality with dual transaction recording and balance updates

## User Preferences

Preferred communication style: Simple, everyday language.