# Goldfish

A clean ASP.NET Core 8.0 Razor Pages + Vanilla TypeScript web application.

## Project Structure

```
goldfish/
├── Pages/                 # ASP.NET Razor Pages
│   ├── Shared/           # Shared layout and components
│   ├── Index.cshtml      # Home page
│   ├── Privacy.cshtml    # Privacy policy page
│   └── Error.cshtml      # Error page
├── src/                  # TypeScript source files
│   └── main.ts          # Entry point
├── wwwroot/             # Static files (served to browser)
│   ├── css/            # Compiled and custom CSS
│   └── js/             # Compiled JavaScript from TypeScript
├── goldfish.csproj      # Project file
├── Program.cs           # Application startup configuration
├── package.json         # NPM dependencies and scripts
├── tsconfig.json        # TypeScript configuration
├── appsettings.json     # App configuration
└── appsettings.Development.json
```

## Getting Started

### Prerequisites
- .NET 8.0 SDK
- Node.js (for TypeScript compilation)

### Setup

1. Restore .NET dependencies:
```bash
dotnet restore
```

2. Install Node.js dependencies:
```bash
npm install
```

3. Build TypeScript:
```bash
npm run build
```

### Development

Run the application with TypeScript watch mode:
```bash
npm run dev
```

This will:
- Watch TypeScript files and compile on changes
- Run the ASP.NET Core application with dotnet watch

Or run them separately:
```bash
npm run watch    # In one terminal
dotnet run       # In another terminal
```

### Production Build

```bash
npm run build
dotnet publish -c Release
```

## Features

- ASP.NET Core 8.0 Razor Pages
- Vanilla TypeScript (no frameworks)
- Static file serving from `wwwroot/`
- Development configuration

## Adding Bootstrap

To add Bootstrap, run:
```bash
npm install bootstrap@5
```

Then update `Pages/Shared/_Layout.cshtml` to reference Bootstrap CSS and JS.