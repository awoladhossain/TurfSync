# 🏟️ TurfBook: Advanced Turf Booking & Management System

**TurfBook** is a high-performance backend application for managing sports turf bookings (Football, Cricket, etc.). Built with **NestJS** and **TypeScript**, this project implements enterprise-level architecture patterns with a focus on reliability, scalability, and clean code practices.

---

## 📋 Table of Contents
- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Running the Application](#running-the-application)
- [Testing](#testing)
- [API Documentation](#api-documentation)
- [Development Guidelines](#development-guidelines)
- [Contributing](#contributing)
- [License](#license)

---

## 🎯 Overview

TurfBook is a backend REST API designed to facilitate turf (sports ground) booking management. The system supports multiple user roles (Players, Turf Owners, Admins) with distinct workflows, real-time slot availability management, and transaction-safe booking operations.

### Key Objectives
- Prevent double booking through atomic transactions
- Provide a seamless booking experience for players
- Enable turf owners to manage availability and pricing
- Maintain high availability and performance under load

---

## 🛠️ Tech Stack

| Category | Technology |
|----------|-----------|
| **Runtime** | Node.js |
| **Framework** | NestJS 11 |
| **Language** | TypeScript |
| **Database** | PostgreSQL |
| **ORM** | Prisma |
| **Validation** | class-validator, class-transformer |
| **Testing** | Jest |
| **Code Quality** | ESLint, Prettier |
| **Containerization** | Docker, Docker Compose |
| **Configuration** | @nestjs/config |

---

## ✨ Features

### Core Features
- **Role-Based Access Control (RBAC)** - Distinct workflows for Players, Turf Owners, and Admins
- **Atomic Booking Logic** - Prevents double booking using PostgreSQL transactions
- **Real-time Slot Management** - Dynamic availability tracking with instant status updates
- **User Authentication** - Secure session management with configuration-based settings
- **Request Validation** - Type-safe DTO validation with class-validator

### Technical Highlights
- **Modular Architecture** - Clean separation of concerns with independent modules
- **Error Handling** - Comprehensive exception handling with custom error responses
- **Testing Coverage** - Unit tests and E2E tests with Jest
- **Development Experience** - Hot reload, debug mode, and watch mode support
- **Code Quality** - Automated linting and formatting with ESLint and Prettier

---

## 📁 Project Structure

```
turfbook/
├── src/
│   ├── app.module.ts           # Root application module
│   ├── app.controller.ts       # Main HTTP controller
│   ├── app.controller.spec.ts  # Unit tests for controller
│   ├── app.service.ts          # Business logic service
│   ├── main.ts                 # Application bootstrap
│   └── [modules]/              # Feature modules (to be expanded)
├── test/
│   ├── app.e2e-spec.ts         # End-to-end tests
│   └── jest-e2e.json           # Jest E2E configuration
├── docker-compose.yml          # Docker Compose configuration
├── package.json                # Dependencies and scripts
├── tsconfig.json               # TypeScript configuration
├── tsconfig.build.json         # TypeScript build configuration
├── eslint.config.mjs           # ESLint configuration
├── nest-cli.json               # NestJS CLI configuration
└── README.md                   # This file
```

---

## 🔧 Installation

### Prerequisites
- **Node.js** >= 18 (v22 recommended)
- **npm** >= 9 or **yarn** >= 1.22
- **Docker** and **Docker Compose** (optional, for containerized setup)

### Steps

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/turfbook.git
   cd turfbook
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   Create a `.env` file in the root directory (optional, for advanced configuration):
   ```bash
   cp .env.example .env  # if available
   ```

4. **Set up the database (if using PostgreSQL):**
   ```bash
   # Using Docker Compose
   docker-compose up -d

   # Or run your PostgreSQL service locally
   ```

5. **Run database migrations (if using Prisma):**
   ```bash
   npx prisma migrate dev
   ```

---

## 🚀 Running the Application

### Development Mode
Start the application in watch mode with auto-reload:
```bash
npm run start:dev
```
The API will be available at `http://localhost:3000`

### Production Mode
Build and run the optimized production version:
```bash
npm run build
npm run start:prod
```

### Debug Mode
Start the application with Node debugger enabled:
```bash
npm run start:debug
```
Attach your IDE debugger to port 9229

### Using Docker
```bash
# Build and run with Docker Compose
docker-compose up --build

# Run in detached mode
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

---

## 🧪 Testing

### Run All Tests
```bash
npm run test
```

### Run Tests in Watch Mode
Monitor and re-run tests on file changes:
```bash
npm run test:watch
```

### Run Tests with Coverage
Generate coverage report:
```bash
npm run test:cov
```

### Run E2E Tests
```bash
npm run test:e2e
```

### Debug Tests
Launch Jest with Node debugger:
```bash
npm run test:debug
```

---

## 📚 Code Quality

### Format Code
Auto-format with Prettier:
```bash
npm run format
```

### Lint Code
Run ESLint with auto-fix:
```bash
npm run lint
```

---

## 🔌 API Documentation

### Base URL
```
http://localhost:3000/api
```

### Health Check
```http
GET /health
```

### Available Endpoints
- **Authentication** - User login, logout, token refresh
- **Users** - User profile management
- **Turfs** - Turf listing, details, search
- **Slots** - Availability management
- **Bookings** - Create, retrieve, cancel bookings

> Full API documentation will be available via Swagger/OpenAPI (implementation pending)

---

## 🏗️ Development Guidelines

### Code Structure
- **Modules** - Feature-based modules in `src/`
- **Controllers** - HTTP request handlers
- **Services** - Business logic and data operations
- **DTOs** - Data Transfer Objects for request/response validation
- **Entities** - Database models
- **Guards** - Authorization and authentication logic
- **Middleware** - Request/response interceptors

### Best Practices
1. **Type Safety** - Always use TypeScript; avoid `any` type
2. **Validation** - Use class-validator DTOs for request validation
3. **Error Handling** - Use NestJS exception filters
4. **Testing** - Write tests alongside features; aim for >80% coverage
5. **Code Style** - Follow ESLint rules; run formatter before commit
6. **Documentation** - Add JSDoc comments for complex logic
7. **Transactions** - Use database transactions for critical operations

### Creating a New Module
```bash
nest generate module features/users
nest generate controller features/users
nest generate service features/users
```

---

## 📦 Dependencies

### Core Dependencies
- `@nestjs/common` - NestJS core module
- `@nestjs/core` - NestJS runtime
- `@nestjs/platform-express` - Express.js integration
- `@nestjs/config` - Configuration management
- `class-validator` - DTO validation
- `class-transformer` - DTO transformation
- `reflect-metadata` - Metadata reflection
- `rxjs` - Reactive programming library

### Dev Dependencies
- `jest` - Testing framework
- `elasticsearch` - ESLint configuration
- `prettier` - Code formatter
- `@nestjs/testing` - NestJS testing utilities
- `@nestjs/cli` - Command line tools
- `ts-jest` - TypeScript support for Jest
- `supertest` - HTTP assertion library
- `typescript` - TypeScript compiler

---

## 🐛 Troubleshooting

### Port Already in Use
If port 3000 is occupied:
```bash
# Change the default port
PORT=3001 npm run start:dev

# Or kill the process
lsof -i :3000
kill -9 <PID>
```

### Database Connection Error
- Verify PostgreSQL is running
- Check `.env` database credentials
- Ensure database exists
- Run migrations: `npx prisma migrate dev`

### Dependencies Issues
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### TypeScript Errors
```bash
# Recompile TypeScript
npm run build

# Or check for type errors
npx tsc --noEmit
```

---

## 📋 Checklist for New Developers

- [ ] Node.js and npm installed
- [ ] Repository cloned
- [ ] Dependencies installed (`npm install`)
- [ ] Environment variables configured (`.env`)
- [ ] Database set up and migrations run
- [ ] Application starts successfully (`npm run start:dev`)
- [ ] Tests pass (`npm run test`)
- [ ] ESLint passes (`npm run lint`)

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit changes** (`git commit -m 'Add amazing feature'`)
4. **Push to branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

### Code Review Criteria
- All tests pass
- Code follows ESLint rules
- No console.log statements in production code
- TypeScript has strict mode enabled
- Test coverage maintained or improved
- Commit messages are clear and descriptive

---

## 📄 License

This project is licensed under the **UNLICENSED** license. See [LICENSE](./LICENSE) file for details.

---

## 📞 Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Check existing documentation
- Review test files for usage examples

---

## 🔗 Useful Resources

- [NestJS Documentation](https://docs.nestjs.com)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [Jest Documentation](https://jestjs.io)
- [Prisma Documentation](https://www.prisma.io/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs)

---

**Happy Coding! 🚀**

Last Updated: April 2026
