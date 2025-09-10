<div align="center">

# 🚀 Node.js Tutorial HTTP Server

![Node.js Version](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-green?style=flat-square&logo=node.js) 
![Zero Dependencies](https://img.shields.io/badge/Dependencies-Zero-blue?style=flat-square&logo=npm) 
![Educational Purpose](https://img.shields.io/badge/Purpose-Educational-orange?style=flat-square&logo=bookstack) 
![MIT License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square&logo=opensourceinitiative) 
![Built-in Test Runner](https://img.shields.io/badge/Testing-Built--in%20Test%20Runner-success?style=flat-square&logo=jest) 
![Docker Ready](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker)

**🎓 Learn Node.js HTTP server development through hands-on implementation**

*A comprehensive educational project that teaches fundamental Node.js web server concepts using only built-in modules. Perfect for developers learning backend development, HTTP protocol implementation, and production deployment practices.*

</div>

---

## ✨ Key Features

- ✅ **Zero External Dependencies** - Pure Node.js implementation using only built-in modules
- 🌐 **Simple HTTP API** - `/hello` endpoint demonstrating request-response cycle
- 🧪 **Comprehensive Testing** - Built-in Node.js test runner with 90%+ coverage
- 🔐 **Security Best Practices** - HTTP security headers and secure error handling
- 📊 **Production Ready** - Health monitoring, logging, and deployment automation
- 🐳 **Container Support** - Docker and Docker Compose for easy deployment
- 📚 **Educational Excellence** - Detailed documentation and learning resources

---

## 🎓 What You'll Learn

### 🏗️ **HTTP Server Fundamentals**
Master Node.js built-in `http` module and server lifecycle management

### 🔄 **Request-Response Processing**
Understand URL routing, method validation, and response generation

### 🛡️ **Security & Error Handling**
Implement secure error responses and HTTP security headers

### 🧪 **Testing with Node.js**
Use built-in test runner for unit, integration, and E2E testing

### 📊 **Production Deployment**
Learn containerization, monitoring, and operational best practices

### 🎯 **Clean Architecture**
Apply component separation and maintainable code patterns

**Target Audience:** This tutorial is designed for JavaScript developers transitioning to backend development, Node.js beginners learning server-side programming, and developers interested in understanding HTTP server fundamentals without framework abstractions.

**Learning Approach:** The project follows a progressive learning approach, starting with basic HTTP server concepts and advancing to production deployment strategies. Each component is thoroughly documented with educational explanations and practical examples.

---

## 🚀 Quick Start

### 📋 Prerequisites

- **Node.js 18+**: Download from [nodejs.org](https://nodejs.org/) (Recommended: Node.js 22.x LTS)
- **Git**: For repository cloning and version control
- **Terminal/Command Line**: Basic command line familiarity
- **Text Editor**: VS Code, WebStorm, or your preferred editor
- **Optional: Docker**: For containerized deployment (Docker 24.x+)

### 📥 Installation

```bash
# Clone Repository
git clone <repository-url>
cd nodejs-tutorial-http-server

# Start the Server
cd src/backend
node server.js

# Verify Installation
# Test the hello endpoint
curl http://localhost:3000/hello
# Expected output: Hello world

# Check server health
curl http://localhost:3000/health
# Expected: JSON health status
```

### 🎯 First Steps

1. **🌐 Open Browser**: Navigate to `http://localhost:3000/hello`
2. **📖 Explore Code**: Read through `src/backend/server.js` to understand the implementation
3. **🧪 Run Tests**: Execute `cd src/backend && npm test` to see comprehensive test suite
4. **📚 Read Documentation**: Check out [Backend Guide](./src/backend/README.md) for detailed explanations

### 🛠️ Troubleshooting

- **Port Already in Use**: If port 3000 is busy, use `PORT=8080 node server.js`
- **Node.js Version**: Ensure Node.js 18+ with `node --version`
- **Permission Issues**: On Unix systems, avoid using ports below 1024 without sudo

---

## 📁 Project Structure

The project is organized into distinct directories for educational clarity and separation of concerns. Each component serves a specific learning objective and can be studied independently.

```
nodejs-tutorial-http-server/
├── 📁 src/backend/              # 🎯 Main Node.js Application
│   ├── server.js                #    Application entry point
│   ├── package.json             #    Project configuration
│   ├── lib/                     #    Core components & modules
│   ├── config/                  #    Configuration management
│   ├── test/                    #    Comprehensive test suite
│   ├── docs/                    #    Detailed documentation
│   ├── examples/                #    Usage examples & demos
│   └── README.md                #    Backend documentation
├── 📁 infrastructure/           # 🚀 Deployment & Operations
│   ├── docker/                  #    Container configurations
│   ├── config/                  #    Infrastructure configs
│   ├── scripts/                 #    Deployment automation
│   ├── monitoring/              #    Health & monitoring setup
│   └── README.md                #    Infrastructure guide
├── 📁 .github/                  # ⚙️ CI/CD & Community
│   ├── workflows/               #    GitHub Actions CI/CD
│   └── ISSUE_TEMPLATE/          #    Issue & PR templates
├── 📄 README.md                 # 📋 This main project guide
├── 📄 LICENSE                   # ⚖️ MIT License terms
└── 📄 .gitignore                # 🚫 Git ignore rules
```

### 🎯 **Backend Application** ([src/backend/](./src/backend/))
The core Node.js HTTP server implementation with comprehensive documentation, testing, and examples.

**Key Files:**
- **[server.js](./src/backend/server.js)** - Main application entry point
- **[README.md](./src/backend/README.md)** - Comprehensive backend guide
- **[API.md](./src/backend/API.md)** - API reference documentation
- **[lib/](./src/backend/lib/)** - Core HTTP server components
- **[test/](./src/backend/test/)** - Complete test suite

### 🚀 **Infrastructure** ([infrastructure/](./infrastructure/))
Production deployment configurations, monitoring setup, and operational procedures.

**Key Components:**
- **[Docker Configs](./infrastructure/docker/)** - Container and orchestration
- **[Deployment Scripts](./infrastructure/scripts/)** - Automation tools
- **[Monitoring](./infrastructure/monitoring/)** - Health checks and metrics
- **[README.md](./infrastructure/README.md)** - Infrastructure guide

### ⚙️ **Development & CI/CD** ([.github/](./.github/))
Continuous integration, security scanning, and community contribution templates.

---

## 🎓 Learning Objectives & Skill Progression

### 📈 **Learning Path**

#### 🥇 **Beginner Level (2-4 hours)**
1. **Environment Setup** - Install Node.js and start the server
2. **Code Exploration** - Understand the basic HTTP server implementation
3. **API Testing** - Test endpoints using browser and command line tools
4. **Basic Modifications** - Make simple changes and observe behavior

#### 🥈 **Intermediate Level (1-2 weeks)**
1. **Architecture Study** - Deep dive into component architecture
2. **Testing Practice** - Run and understand the comprehensive test suite
3. **Feature Extension** - Add new endpoints and functionality
4. **Performance Analysis** - Monitor and optimize server performance

#### 🥉 **Advanced Level (2-4 weeks)**
1. **Production Deployment** - Deploy using Docker and infrastructure
2. **Monitoring Integration** - Set up comprehensive monitoring stack
3. **Security Hardening** - Implement advanced security measures
4. **Operational Excellence** - Practice CI/CD and automation

### 🎯 **Core Learning Objectives**

#### **🏗️ HTTP Server Fundamentals**
- Master Node.js built-in `http` module for server creation and management
- Understand TCP/IP networking and HTTP protocol implementation
- Learn server lifecycle management including startup and graceful shutdown
- Implement request parsing, routing, and response generation

#### **💻 Backend Development Concepts**
- Apply component-based architecture with clear separation of concerns
- Implement error handling strategies and secure error responses
- Practice logging, monitoring, and operational visibility patterns
- Understand asynchronous programming and event-driven architecture

#### **🧪 Testing and Quality Assurance**
- Use Node.js built-in test runner for comprehensive testing
- Write unit tests, integration tests, and end-to-end tests
- Implement code coverage analysis and quality metrics
- Practice test-driven development and debugging techniques

#### **🚀 Production Deployment**
- Learn containerization with Docker and Docker Compose
- Implement health monitoring and metrics collection
- Apply security best practices and hardening techniques
- Practice deployment automation and operational procedures

---

## 🌐 HTTP API Overview

The server provides a minimal but complete HTTP API demonstrating fundamental web server concepts:

| Endpoint | Method | Purpose | Response |
|----------|---------|---------|----------|
| `/hello` | GET | Demo endpoint | `Hello world` (text/plain) |
| `/health` | GET | Server health status | Health metrics (JSON) |

**📖 Complete API Documentation**: [Backend API Reference](./src/backend/API.md)

### 💡 **Quick Usage Examples**

**Command Line Testing:**
```bash
# Hello endpoint
curl http://localhost:3000/hello
# Output: Hello world

# Health check
curl http://localhost:3000/health | jq
# Output: JSON health status

# Error handling
curl http://localhost:3000/invalid
# Output: 404 Not Found
```

**JavaScript Client:**
```javascript
// Using fetch API
const response = await fetch('http://localhost:3000/hello');
const message = await response.text();
console.log(message); // 'Hello world'

// Health check
const health = await fetch('http://localhost:3000/health');
const status = await health.json();
console.log(status); // Health metrics object
```

---

## 🚀 Deployment Options

The tutorial supports multiple deployment strategies for different learning objectives:

### 📦 **Local Development**
Perfect for learning and development:
```bash
cd src/backend
node server.js
# Server available at http://localhost:3000
```

### 🐳 **Docker Deployment**
Containerized deployment for consistency:
```bash
cd src/backend
docker build -t nodejs-tutorial .
docker run -p 3000:3000 nodejs-tutorial
```

### 🏗️ **Production Infrastructure**
Complete production stack with monitoring:
```bash
cd infrastructure
docker-compose up -d
# Access application: http://localhost
# Monitoring: http://localhost:9090 (Prometheus)
# Dashboards: http://localhost:3001 (Grafana)
```

**📚 Detailed Deployment Guide**: [Infrastructure Documentation](./infrastructure/README.md)

### 🌍 **Environment Support**

| Environment | Status | Use Case | Documentation |
|-------------|---------|----------|---------------|
| **Local Development** | ✅ Ready | Learning & coding | [Backend Guide](./src/backend/README.md) |
| **Docker Container** | ✅ Ready | Consistent deployment | [Dockerfile](./src/backend/Dockerfile) |
| **Docker Compose** | ✅ Ready | Multi-service setup | [Infrastructure Guide](./infrastructure/README.md) |
| **Cloud Platforms** | ✅ Compatible | Production deployment | Platform-specific guides |

---

## 🛠️ Development Environment

### 🚀 **Development Scripts**
```bash
cd src/backend

# Development server with auto-restart
npm run dev

# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Health check
npm run health-check
```

**File Watching & Hot Reload:** The development server automatically restarts when you modify files, providing immediate feedback for learning and development.

### 🔍 **Code Exploration Guide**

**Start Here - Core Files:**
1. **[server.js](./src/backend/server.js)** - Application entry point and server bootstrap
2. **[lib/http-server.js](./src/backend/lib/http-server.js)** - HTTP server implementation
3. **[lib/request-router.js](./src/backend/lib/request-router.js)** - URL routing logic
4. **[lib/hello-handler.js](./src/backend/lib/hello-handler.js)** - Hello endpoint handler

**Architecture Deep Dive:**
5. **[lib/response-generator.js](./src/backend/lib/response-generator.js)** - Response formatting
6. **[lib/error-handler.js](./src/backend/lib/error-handler.js)** - Error processing
7. **[config/environment.js](./src/backend/config/environment.js)** - Configuration management

**Testing Examples:**
8. **[test/unit/](./src/backend/test/unit/)** - Unit testing examples
9. **[test/integration/](./src/backend/test/integration/)** - API testing patterns
10. **[test/e2e/](./src/backend/test/e2e/)** - End-to-end testing

---

## ⚙️ Technical Requirements

| Requirement | Minimum | Recommended | Purpose |
|-------------|---------|-------------|---------|
| **Node.js** | 18.0.0 | 22.x LTS | JavaScript runtime |
| **NPM** | 9.0.0 | 11.x | Package management |
| **Memory** | 512 MB | 2 GB | Application + monitoring |
| **Disk** | 100 MB | 1 GB | Source + containers + logs |
| **CPU** | 1 core | 2+ cores | Optimal performance |

### 🌍 **Platform Compatibility**

**Operating Systems:**
- ✅ Linux (Ubuntu 20.04+, CentOS 8+, Alpine Linux)
- ✅ macOS (macOS 10.15+, Apple Silicon supported)
- ✅ Windows (Windows 10+, WSL2 recommended)

**Container Platforms:**
- ✅ Docker Engine 24.x+
- ✅ Podman 4.x+
- ✅ Kubernetes 1.25+
- ✅ Docker Compose 2.20+

**Cloud Platforms:**
- ✅ AWS (EC2, ECS, Lambda)
- ✅ Google Cloud (GCE, Cloud Run, GKE)
- ✅ Azure (VM, Container Instances, AKS)
- ✅ DigitalOcean, Heroku, Railway

---

## ⚡ Performance Characteristics

**Response Performance:**
- **Hello Endpoint**: < 100ms response time
- **Health Endpoint**: < 200ms response time
- **Concurrent Users**: 100+ simultaneous connections
- **Throughput**: 1,000+ requests per second

**Resource Usage:**
- **Memory**: < 50MB typical usage
- **CPU**: < 5% on modern hardware
- **Startup Time**: < 2 seconds cold start
- **Container Size**: < 100MB Alpine-based image

---

## 🤝 Contributing

We welcome contributions from developers of all skill levels! This project serves as a learning resource, so contributions should maintain educational value and clarity.

**How to Contribute:**
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes with tests and documentation
4. Run the test suite: `npm test`
5. Submit a pull request with clear description

**Contribution Areas:**
- 🐛 Bug fixes and reliability improvements
- 📚 Documentation enhancements and examples
- 🧪 Test coverage and quality improvements
- ⚡ Performance optimizations
- 🔒 Security enhancements
- 🎓 Educational content and tutorials

---

## 💬 Support & Community

**Getting Help:**
- 📖 **Documentation**: Comprehensive guides in [src/backend/README.md](./src/backend/README.md)
- 🐛 **Issues**: [GitHub Issues](../../issues) for bug reports and questions
- 💡 **Discussions**: [GitHub Discussions](../../discussions) for ideas and help
- 📧 **Contact**: Reach out to maintainers for educational partnerships

**Educational Resources:**
- 🎓 **Learning Materials**: Step-by-step guides and explanations
- 💻 **Code Examples**: Working examples for every concept
- 🎥 **Video Tutorials**: [Coming Soon] Visual learning content
- 🏫 **Classroom Use**: Free for educational institutions

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](./LICENSE) file for details.

**Key Points:**
- ✅ **Free to use** for personal, educational, and commercial projects
- ✅ **Modify and distribute** with attribution
- ✅ **No warranty** - use at your own risk
- ✅ **Educational friendly** - perfect for classroom and tutorial use

**Copyright (c) 2024 Node.js Tutorial Contributors**

---

<div align="center">

### 🎓 **Happy Learning Node.js!** 🎓

*Educational HTTP Server built with ❤️ for the developer community*

**Technologies:** Node.js 22.x LTS • **Testing:** Built-in Test Runner • **Dependencies:** Zero 🎯

[⭐ Star this repo](../../stargazers) • [🐛 Report issues](../../issues) • [💡 Request features](../../issues/new) • [🤝 Contribute](#-contributing)

**Quick Links:**
[📖 Backend Docs](./src/backend/README.md) • [🚀 Infrastructure](./infrastructure/README.md) • [🌐 API Reference](./src/backend/API.md)

</div>