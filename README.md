# Maven Package README MCP Server

[![npm version](https://img.shields.io/npm/v/maven-package-readme-mcp-server)](https://www.npmjs.com/package/maven-package-readme-mcp-server)
[![npm downloads](https://img.shields.io/npm/dm/maven-package-readme-mcp-server)](https://www.npmjs.com/package/maven-package-readme-mcp-server)
[![GitHub stars](https://img.shields.io/github/stars/naoto24kawa/maven-package-readme-mcp-server)](https://github.com/naoto24kawa/maven-package-readme-mcp-server)
[![GitHub issues](https://img.shields.io/github/issues/naoto24kawa/maven-package-readme-mcp-server)](https://github.com/naoto24kawa/maven-package-readme-mcp-server/issues)
[![license](https://img.shields.io/npm/l/maven-package-readme-mcp-server)](https://github.com/naoto24kawa/maven-package-readme-mcp-server/blob/main/LICENSE)

An MCP (Model Context Protocol) server that provides tools for fetching Maven package information, README content, and usage examples from Maven Central and GitHub repositories.

## Features

- **Package README Retrieval**: Get comprehensive README content and usage examples for Maven packages
- **Package Information**: Fetch detailed package metadata, dependencies, and statistics
- **Package Search**: Search Maven Central repository with filtering options
- **Smart Caching**: Efficient caching system to minimize API calls
- **GitHub Integration**: Fallback to GitHub repositories for README content when available

## Installation

### NPM

```bash
npm install -g maven-package-readme-mcp-server
```

### From Source

```bash
git clone <repository-url>
cd maven-package-readme-mcp-server
npm install
npm run build
```

## Usage

### As MCP Server

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "maven-package-readme": {
      "command": "maven-package-readme-mcp-server",
      "env": {
        "GITHUB_TOKEN": "your-github-token-here"
      }
    }
  }
}
```

### Available Tools

#### 1. get_package_readme

Get package README and usage examples from Maven Central.

**Parameters:**
- `package_name` (string, required): Maven package in `groupId:artifactId` format
- `version` (string, optional): Package version or version range (default: "latest")
- `include_examples` (boolean, optional): Include usage examples (default: true)

**Version Format:**
- Specific version: `"6.0.0"`
- Latest version: `"latest"` (default)
- Version ranges: `"[1.0,2.0)"` (Maven version range syntax)

**Example:**
```json
{
  "package_name": "org.springframework:spring-core",
  "version": "6.0.0",
  "include_examples": true
}
```

#### 2. get_package_info

Get package basic information and dependencies.

**Parameters:**
- `package_name` (string, required): Maven package in `groupId:artifactId` format
- `include_dependencies` (boolean, optional): Include dependencies (default: true)
- `include_dev_dependencies` (boolean, optional): Include test dependencies (default: false)

**Example:**
```json
{
  "package_name": "com.google.guava:guava",
  "include_dependencies": true,
  "include_dev_dependencies": false
}
```

#### 3. search_packages

Search for packages in Maven Central.

**Parameters:**
- `query` (string, required): Search query
- `limit` (number, optional): Maximum results (default: 20, max: 250)
- `quality` (number, optional): Minimum quality score (0-1)
- `popularity` (number, optional): Minimum popularity score (0-1)

**Example:**
```json
{
  "query": "spring boot",
  "limit": 10,
  "quality": 0.7
}
```

## Maven Package Format

This server uses Maven's standard coordinate format:

```
groupId:artifactId
```

Examples:
- `org.springframework:spring-core`
- `com.google.guava:guava`
- `org.apache.commons:commons-lang3`
- `junit:junit`

## Response Format

### Package README Response

```json
{
  "package_name": "org.springframework:spring-core",
  "version": "6.0.0",
  "description": "Spring Core",
  "readme_content": "# Spring Framework...",
  "usage_examples": [
    {
      "title": "Basic Usage",
      "description": "How to use Spring Core",
      "code": "ApplicationContext context = ...",
      "language": "java"
    }
  ],
  "installation": {
    "maven": "<dependency>...</dependency>",
    "gradle": "implementation 'org.springframework:spring-core:6.0.0'",
    "sbt": "libraryDependencies += \"org.springframework\" % \"spring-core\" % \"6.0.0\""
  },
  "basic_info": {
    "groupId": "org.springframework",
    "artifactId": "spring-core",
    "version": "6.0.0",
    "description": "Spring Core",
    "license": "Apache License 2.0",
    "organization": "Spring Framework",
    "keywords": []
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/spring-projects/spring-framework"
  }
}
```

### Package Info Response

```json
{
  "package_name": "org.springframework:spring-core",
  "latest_version": "6.0.0",
  "description": "Spring Core",
  "organization": "Spring Framework",
  "license": "Apache License 2.0",
  "keywords": [],
  "dependencies": {
    "org.springframework:spring-jcl": "6.0.0"
  },
  "test_dependencies": {
    "org.junit.jupiter:junit-jupiter": "5.8.2"
  },
  "download_stats": {
    "last_day": 1000,
    "last_week": 7000,
    "last_month": 30000
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/spring-projects/spring-framework"
  }
}
```

### Search Response

```json
{
  "query": "spring boot",
  "total": 150,
  "packages": [
    {
      "groupId": "org.springframework.boot",
      "artifactId": "spring-boot",
      "version": "3.0.0",
      "description": "Spring Boot",
      "keywords": ["spring", "boot"],
      "organization": "org.springframework",
      "repositoryId": "central",
      "score": {
        "final": 0.95,
        "detail": {
          "quality": 0.9,
          "popularity": 0.95,
          "maintenance": 1.0
        }
      },
      "searchScore": 0.95
    }
  ]
}
```

## Configuration

Environment variables:

- `GITHUB_TOKEN`: GitHub personal access token for enhanced API limits (optional)

## Development

### Setup

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Run built version
npm start

# Lint code
npm run lint
```

### Project Structure

```
src/
├── index.ts                 # Entry point
├── server.ts               # MCP server implementation
├── tools/                  # Tool implementations
│   ├── get-package-readme.ts
│   ├── get-package-info.ts
│   └── search-packages.ts
├── services/               # Core services
│   ├── maven-central-api.ts # Maven Central API client
│   ├── github-api.ts       # GitHub API client
│   ├── cache.ts           # Caching service
│   ├── readme-parser.ts   # README parsing utilities
│   └── version-resolver.ts # Version resolution logic
├── utils/                 # Utility functions
│   ├── logger.ts         # Logging utilities
│   ├── error-handler.ts  # Error handling
│   └── validators.ts     # Input validation
└── types/                # TypeScript type definitions
    └── index.ts
```

## API Endpoints Used

### Maven Central API

- **Search**: `https://search.maven.org/solrsearch/select`
- **Repository**: `https://repo1.maven.org/maven2/`

### GitHub API (Fallback)

- **README**: `https://api.github.com/repos/{owner}/{repo}/readme`

## Error Handling

The server includes comprehensive error handling for:

- Package not found (404)
- Version not found (404)
- Network errors and timeouts
- Rate limiting (429)
- Invalid package name format
- API server errors (5xx)

All errors are properly typed and include context information.

## Caching Strategy

- **Memory-based cache** for API responses
- **Cache keys** based on package coordinates and operation type
- **Automatic cleanup** of expired entries

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Run linting and type checking
6. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Related Projects

- [npm-package-readme-mcp-server](../npm-package-readme-mcp-server/) - Similar server for npm packages
- [composer-package-readme-mcp-server](../composer-package-readme-mcp-server/) - Similar server for Composer packages

## Support

For issues and questions:

1. Check the [Issues](../../issues) page
2. Create a new issue with detailed information
3. Include package names and error messages if applicable