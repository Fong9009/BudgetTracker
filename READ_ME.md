# Budget Tracker

A comprehensive personal finance management application built with the MERN stack (MongoDB, Express.js, React, Node.js) and TypeScript. This application helps users track their income, expenses, and manage their financial accounts with a modern, responsive interface.

## Features

- **Account Management**: Create and manage multiple financial accounts (checking, savings, credit cards)
- **Transaction Tracking**: Record income and expenses with detailed categorization
- **Category Organization**: Create custom categories with colors and icons
- **Transfer Management**: Move money between accounts with automatic transaction creation
- **Dashboard Analytics**: Visual charts and statistics for spending patterns
- **Data Export**: Export transaction data in CSV format
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **User Authentication**: Secure login and registration system
- **Password Reset**: Email-based password recovery system

## Tech Stack

### Frontend
- **React** with TypeScript
- **Vite** for fast development and building
- **React Router** for navigation
- **React Hook Form** with Zod validation
- **TanStack Query** for data fetching and caching
- **Tailwind CSS** for styling
- **shadcn/ui** for beautiful UI components
- **Recharts** for data visualization
- **Lucide React** for icons

### Backend
- **Node.js** with Express.js
- **TypeScript** for type safety
- **MongoDB** with Mongoose ODM
- **JWT** for authentication
- **bcryptjs** for password hashing
- **Nodemailer** for email functionality
- **Zod** for runtime validation

### Development Tools
- **ESBuild** for fast bundling
- **PostCSS** with Autoprefixer
- **TypeScript** compiler

## Architecture

The application follows a modern full-stack architecture:

1. **Frontend**: React SPA with TypeScript, using Vite for development
2. **Backend**: Express.js REST API with TypeScript
3. **Database**: MongoDB with Mongoose for data modeling
4. **Authentication**: JWT-based authentication with secure password hashing
5. **API Layer**: RESTful endpoints with proper error handling and validation

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- MongoDB (local installation or cloud instance)

### Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables (see Environment Variables section)
4. Start the development server: `npm run dev`

### Environment Variables

Create a `.env` file in the root directory with the following variables:

- **MONGODB_URI**: MongoDB connection string
- **JWT_SECRET**: Secret key for JWT token generation
- **MAIL_HOST**: SMTP server hostname
- **MAIL_PORT**: SMTP server port
- **MAIL_USER**: Email username for sending emails
- **MAIL_PASS**: Email password or app password
- **FRONTEND_URL**: Frontend application URL (for email links)

### Development

1. **Frontend**: React development server with hot reloading
2. **Backend**: Express server with TypeScript compilation
3. **Database**: MongoDB connection with Mongoose schemas

## Project Structure

```
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom React hooks
│   │   └── lib/            # Utility functions
├── server/                 # Express backend
│   ├── auth.ts            # Authentication middleware
│   ├── routes.ts          # API routes
│   ├── storage.ts         # Database operations
│   └── index.ts           # Server entry point
├── shared/                 # Shared TypeScript types
│   └── schema.ts          # Zod schemas and MongoDB models
└── package.json           # Dependencies and scripts
```

## Recent Changes

- July 06, 2025: Migrated from PostgreSQL to MongoDB to implement MERN stack architecture
- Enhanced user authentication with JWT tokens
- Added password reset functionality via email
- Improved error handling and user feedback
- Refactored database operations to use Mongoose ODM