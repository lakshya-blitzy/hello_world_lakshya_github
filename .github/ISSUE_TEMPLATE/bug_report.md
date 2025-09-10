---
name: Bug Report
about: Create a report to help improve the Node.js tutorial HTTP server
title: '[BUG] Brief description of the issue'
labels: ['bug', 'needs-investigation', 'triage-required']
assignees: []
---

## 🐛 Bug Category

Please select the category that best describes this bug:

- [ ] 🚀 **Server Startup** - Issues starting the HTTP server or port binding problems
- [ ] 🌐 **Endpoint Response** - Problems with /hello endpoint or HTTP request handling
- [ ] ❌ **Error Handling** - Unexpected errors, error messages, or exception handling
- [ ] 💻 **Cross-Platform** - Compatibility issues across Windows, macOS, or Linux
- [ ] ⚡ **Performance** - Slow response times, memory usage, or resource issues
- [ ] 📚 **Documentation** - Inaccurate or unclear documentation content
- [ ] 🎓 **Educational Content** - Issues with tutorial clarity or learning experience

## 📋 Bug Summary

**Clear and concise description of the bug or issue:**

<!-- 
Provide a brief summary of the bug. For example:
• 'Server fails to start on Windows with EADDRINUSE error'
• '/hello endpoint returns 500 error instead of Hello world'
• 'Application crashes when handling concurrent requests'
• 'Tutorial instructions don't work on Node.js 22.x'

Focus on what is happening versus what should happen.
-->

## ✅ Expected Behavior

**Describe what you expected to happen:**

<!-- 
Explain the expected behavior based on the tutorial documentation or typical Node.js HTTP server behavior. Include:
• What response or behavior you anticipated
• Reference to tutorial instructions or documentation
• Expected HTTP status codes or response content
• Expected server behavior patterns

For example:
• 'Server should start successfully and bind to port 3000'
• 'GET request to /hello should return "Hello world" with status 200'
• 'Application should handle graceful shutdown with SIGTERM'
-->

## ❌ Actual Behavior

**Describe what actually happened instead:**

<!-- 
Describe the actual behavior you experienced. Include:
• Error messages or unexpected responses
• HTTP status codes received
• Console output or log messages
• Any visible symptoms or failures

Be specific about what differs from expected behavior.
-->

## 🔄 Steps to Reproduce

**Detailed steps to reproduce the bug:**

<!-- 
Provide step-by-step instructions to reproduce the issue:

1. Download or clone the tutorial application
2. Navigate to the project directory: `cd src/backend`
3. Run the specific command: `node server.js`
4. Perform specific actions (e.g., `curl http://localhost:3000/hello`)
5. Observe the unexpected behavior

Include exact commands, file paths, and configuration used.
Be as specific as possible - include any parameters or environment setup.
-->

## 💻 Environment Details

**Your development environment information:**

**Operating System:**
<!-- Windows 11 / macOS 14.0 / Ubuntu 22.04 / etc. -->

**Node.js Version:**
<!-- Run `node --version` and paste result -->

**npm Version:**
<!-- Run `npm --version` and paste result -->

**Terminal/Shell:**
<!-- Command Prompt / PowerShell / Terminal / WSL / Bash / etc. -->

**Container Environment:**
<!-- Docker Desktop version (if applicable) / Native execution -->

**Additional Development Tools:**
<!-- Any IDEs, development tools, or system configurations that might be relevant -->

## 🚨 Error Messages and Logs

**Complete error messages, stack traces, and console output:**

<!-- 
Paste complete error messages and console output:

```
[Paste server startup output here]
```

```
[Paste error messages here]
```

```
[Paste curl or HTTP client output here]
```

Include timestamps if available and any relevant system logs.
Make sure to include the complete stack trace for JavaScript errors.
-->

## 🎓 Educational Context

**Your learning context and experience level:**

**Node.js Experience Level:**
- [ ] **Beginner** - New to Node.js and HTTP server concepts
- [ ] **Intermediate** - Familiar with Node.js basics, learning advanced concepts  
- [ ] **Advanced** - Experienced with Node.js, working on specific patterns

**Tutorial Progress:**
<!-- Which specific step or section of the tutorial were you following? -->

**Learning Environment:**
- [ ] **Self-study** - Working through tutorial independently
- [ ] **Classroom** - Part of structured course or class
- [ ] **Workshop** - Hands-on learning session
- [ ] **Online course** - Following along with online curriculum

**Previous Experience:**
<!-- Any relevant programming or web development background -->

**Learning Goals:**
<!-- What you're trying to learn or accomplish with this tutorial -->

## ⚠️ Severity Assessment

**How severely does this bug impact your learning or usage?**

- [ ] **Low** - Minor inconvenience, workaround available, doesn't block learning
- [ ] **Medium** - Impedes learning progress, affects tutorial completion, some functionality lost
- [ ] **High** - Blocks tutorial completion or core functionality, significant learning barrier
- [ ] **Critical** - Application completely unusable or causes system issues

## 🔧 Troubleshooting Attempted

**What troubleshooting steps have you already tried?**

<!-- 
Describe what you've already attempted to fix the issue:

• Restarted Node.js server
• Checked port availability with `netstat -tuln | grep 3000` or `lsof -i :3000`
• Verified Node.js and npm versions meet requirements (18.x, 20.x, or 22.x)
• Reviewed tutorial documentation and README
• Searched online for similar issues
• Tried different terminal or command prompt
• Tested on different port numbers (e.g., PORT=8080 node server.js)
• Cleared npm cache with `npm cache clean --force`
• Checked file permissions with `ls -la server.js`
• Tested with different Node.js versions

Include results of these attempts and any partial solutions discovered.
-->

## 🔍 System Diagnostics

**System diagnostic information:**

<!-- 
Run these diagnostic commands and paste results:

**Node.js Installation Verification:**
```bash
node --version
npm --version
which node  # (or 'where node' on Windows)
node -e "console.log('HTTP module available:', !!require('http'))"
node -e "console.log('Built-in test runner:', !!require('node:test'))"
```

**Network and Port Diagnostics:**
```bash
# Check if port 3000 is in use
netstat -tuln | grep 3000  # Linux/macOS
netstat -an | findstr :3000  # Windows

# Test HTTP endpoint availability
curl -v http://localhost:3000/hello
```

**Zero-Dependency Verification:**
```bash
# Verify no node_modules directory exists
ls -la | grep node_modules

# Check package.json dependencies
node -e "console.log('Dependencies:', Object.keys(require('./package.json').dependencies || {}))"
```

**File and Permission Check:**
```bash
ls -la server.js  # Check file permissions (Unix/Linux/macOS)
node -c server.js  # Syntax validation
```
-->

## 🌐 Browser Testing Results

**Browser testing results (if applicable to web interface issues):**

<!-- 
If the issue involves browser access, test multiple browsers and include results:

**Chrome:** Version X.X.X
- Status: [Working/Not Working/Partial]
- Response: [Response received or error details]

**Firefox:** Version X.X.X
- Status: [Working/Not Working/Partial]
- Response: [Response received or error details]

**Safari:** Version X.X.X (macOS only)
- Status: [Working/Not Working/Partial]
- Response: [Response received or error details]

**Edge:** Version X.X.X (Windows)
- Status: [Working/Not Working/Partial]
- Response: [Response received or error details]

**Developer Console Errors:** Any JavaScript errors in browser developer console
**Network Tab Results:** HTTP status codes and response details from browser network inspector
**Incognito/Private Mode:** Does the issue persist in private browsing?
-->

## 🔄 Node.js Version Matrix Testing

**Testing across supported Node.js versions:**

<!-- 
Test the issue across supported Node.js versions if possible:

**Node.js 18.x:**
- Version tested: [e.g., v18.20.4]
- Status: [Working/Broken/Not Tested]
- Notes: [Any version-specific observations]

**Node.js 20.x:**
- Version tested: [e.g., v20.15.1]
- Status: [Working/Broken/Not Tested]
- Notes: [Any version-specific observations]

**Node.js 22.x:**
- Version tested: [e.g., v22.11.0]
- Status: [Working/Broken/Not Tested]
- Notes: [Any version-specific observations]

**Version-Specific Behavior:** Any differences in behavior between Node.js versions
-->

## 🛠️ Zero Dependencies Architecture Validation

**Confirm zero external dependencies compliance:**

<!-- 
Verify the issue isn't related to external dependencies:

- [ ] ✅ Confirmed no node_modules directory exists in project
- [ ] ✅ Verified package.json has zero runtime dependencies  
- [ ] ✅ Application uses only Node.js built-in modules (http, fs, path, etc.)
- [ ] ✅ No external npm packages installed or required
- [ ] ✅ Issue persists with clean Node.js installation

**Built-in Modules Used:** List any Node.js built-in modules the application should be using
**External Package Check:** Confirmation that no third-party packages are involved
-->

## 📊 Performance and Resource Monitoring

**Performance and resource usage information:**

<!-- 
If performance-related, include resource monitoring data:

**Memory Usage:**
```bash
# Check memory usage during server operation
ps aux | grep node  # Unix/Linux/macOS
tasklist | findstr node  # Windows
```

**CPU Usage:**
<!-- Monitor CPU usage during issue reproduction -->

**Response Time Analysis:**
```bash
# Measure response times
time curl http://localhost:3000/hello
```

**Connection Analysis:**
```bash
# Check active connections
netstat -an | grep :3000
```

**Process Monitoring:**
<!-- Any observations about process behavior, memory leaks, or resource consumption -->
-->

## 📝 Additional Context

**Any other relevant information, screenshots, or context:**

<!-- 
Add any additional context that might help diagnose the issue:

• Screenshots or screen recordings of the problem
• Network configuration details (firewall, proxy, VPN, corporate network)
• Similar issues experienced in other Node.js projects or tutorials
• Specific educational institution requirements or network constraints
• Time when the issue started occurring (did it work before?)
• Related configuration files or environment variables
• Links to similar reported issues or discussions
• Any modifications made to the original tutorial code
• Container deployment details if using Docker
• CI/CD environment details if applicable

Include any files, logs, or configuration that might be relevant to diagnosing the issue.
-->

---

## 🔧 For Maintainers - Bug Triage Framework

<!-- This section is auto-populated for maintainer reference -->

### 🎯 Educational Impact Assessment
- **Learning Barrier Severity:** Does this bug prevent educational objective completion?
- **Skill Level Impact:** Which experience levels are affected (Beginner/Intermediate/Advanced)?
- **Tutorial Section Impact:** Which tutorial components are affected by this bug?

### 🔍 Technical Analysis Priority  
- **Node.js Version Specificity:** Does this affect specific Node.js versions (18.x/20.x/22.x)?
- **Platform Specificity:** Is this Windows/macOS/Linux specific or cross-platform?
- **Zero Dependencies Compliance:** Does resolution maintain zero external dependencies?

### 📋 Reproduction Verification Checklist
- **Environment Setup:** Can the issue be reproduced in a clean environment?
- **Step Validation:** Are reproduction steps complete and accurate?
- **Cross-Platform Testing:** Has the issue been validated across target platforms?

### ⚡ Resolution Strategy Framework
- **Code Fix Required:** Direct application code modification needed
- **Documentation Update:** Tutorial or documentation clarification required  
- **Educational Enhancement:** Additional learning support or examples needed
- **Environment Configuration:** Platform-specific setup guidance required

### 🎓 Quality Gates Integration
- **CI/CD Validation:** Will fix be validated by existing CI pipeline (Node.js 18.x/20.x/22.x)?
- **Test Coverage Impact:** Does resolution require additional test cases?
- **Security Assessment:** Are there security implications for the proposed fix?
- **Performance Validation:** Will resolution maintain performance requirements (<100ms response time)?

### 📊 Success Metrics Definition
- **Resolution Confirmation:** How will bug fix success be measured and validated?
- **Educational Effectiveness:** How will improved learning outcomes be verified?
- **Community Impact:** What level of community benefit will this resolution provide?

---

## 🚨 Bug Report Quality Checklist

Before submitting, please verify your bug report includes:

- [ ] **Clear Bug Category** - Selected appropriate category for triage
- [ ] **Detailed Description** - Clear summary of issue and expected vs actual behavior  
- [ ] **Complete Environment** - Node.js version, OS, terminal, and system details
- [ ] **Reproduction Steps** - Step-by-step instructions to reproduce the issue
- [ ] **Error Messages** - Complete error output, stack traces, and console logs
- [ ] **Educational Context** - Learning level, tutorial progress, and goals
- [ ] **Troubleshooting Attempted** - List of debugging steps already tried
- [ ] **System Diagnostics** - Relevant system and network diagnostic information

---

**🎓 Thank you for helping improve the Node.js learning experience! 🎓**

*This bug report will be triaged based on educational impact, technical severity, and community benefit. All fixes maintain the tutorial's focus on Node.js built-in capabilities and zero external dependencies.*

*For immediate help while waiting for issue resolution, consider:*
- *Checking the [GitHub Discussions](../../discussions) for community support*
- *Reviewing the complete [API Documentation](../../blob/main/src/backend/API.md)*
- *Consulting the [Development Guide](../../blob/main/src/backend/docs/development-guide.md)*