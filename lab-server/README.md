# GraphQL Sniper Lab Server

An intentionally vulnerable GraphQL server designed for testing the GraphQL Sniper fuzzer and practicing GraphQL security testing.

## ⚠️ WARNING

This server contains intentional security vulnerabilities and should **NEVER** be exposed to the internet or used in production. It is strictly for educational and testing purposes in a controlled environment.

## 🚀 Quick Start

### Using Docker Compose (Recommended)

```bash
# Start the lab server
docker compose up -d
# Or if using older docker-compose:
# docker-compose up -d

# View logs
docker compose logs -f

# Stop the server
docker compose down
```

The server will be available at: **http://localhost:4000**

### Using Node.js Directly

```bash
# Install dependencies
npm install

# Start the server
npm start
```

## 📚 Server Overview

### Public Endpoints (Easy to Discover)

- `users` - List all users
- `user(id: ID!)` - Get user by ID
- `posts` - List all published posts
- `post(id: ID!)` - Get post by ID
- `getUserByUsername(username: String!)` - Find user by username
- `searchPosts(keyword: String!)` - Search posts by keyword

### Hidden Endpoints (Requires Fuzzing)

- `adminUsers` - List admin users (no auth required! 🚨)
- `adminUser(id: ID!)` - Get admin user details
- `systemConfig` - System configuration with credentials
- `internalFlags` - CTF-style flags for successful exploitation
- `debugInfo` - Detailed system information
- `userPrivateData(userId: ID!)` - IDOR vulnerability

### Hidden Mutations

- `promoteToAdmin(userId: ID!)` - Promote user to admin
- `deleteUser(userId: ID!)` - Delete any user
- `resetAllData` - Reset all data

## 🎯 Vulnerabilities to Test

### 1. **Information Disclosure**

The server leaks sensitive information through:
- Verbose error messages with stack traces
- `debugInfo` query exposing system details
- Error messages revealing valid usernames

**Test with:**
```graphql
query {
  getUserByUsername(username: "nonexistent")
}
```

### 2. **Missing Authentication**

Admin endpoints are accessible without authentication:

**Test with:**
```graphql
query {
  adminUsers {
    id
    username
    role
    secretToken
  }
}
```

### 3. **Hidden Fields**

Types contain hidden sensitive fields:
- `User.apiKey` - API keys for each user
- `Post.internalNotes` - Internal comments

**Test with:**
```graphql
query {
  users {
    id
    username
    apiKey
  }
}
```

### 4. **IDOR (Insecure Direct Object Reference)**

Access any user's private data:

**Test with:**
```graphql
query {
  userPrivateData(userId: "99") {
    id
    username
    apiKey
  }
}
```

### 5. **Information Leakage via Search**

The `searchPosts` query returns unpublished posts:

**Test with:**
```graphql
query {
  searchPosts(keyword: "draft") {
    id
    title
    published
    internalNotes
  }
}
```

## 🎓 Fuzzing Practice

### Wordlist for Field Fuzzing

Use these keywords to fuzz for hidden fields:
```
admin
secret
internal
hidden
private
debug
config
flag
system
token
key
password
credential
```

### Example Fuzzing Queries

**Finding hidden queries:**
```graphql
query {
  FUZZ {
    id
  }
}
```

Replace `FUZZ` with words like: `adminUsers`, `systemConfig`, `internalFlags`, `debugInfo`

**Finding hidden fields:**
```graphql
query {
  users {
    id
    username
    FUZZ
  }
}
```

Replace `FUZZ` with: `apiKey`, `secretToken`, `privateData`, etc.

## 🏆 CTF Flags

The server contains 4 CTF flags that can be discovered through fuzzing:

1. **FLAG_HIDDEN_ENDPOINT** - Find and query the `internalFlags` endpoint
2. **FLAG_IDOR** - Exploit the IDOR vulnerability via `userPrivateData`
3. **FLAG_INFO_DISCLOSURE** - Trigger information disclosure in error messages
4. **FLAG_ADMIN_ACCESS** - Access admin endpoints without authentication

Query to get all flags:
```graphql
query {
  internalFlags {
    name
    value
    description
  }
}
```

## 📊 Sample Data

### Users
- ID 1: `alice` (developer)
- ID 2: `bob` (security researcher)
- ID 3: `charlie` (devops engineer)
- ID 99: `admin` (system admin)

### Interesting User IDs for Testing
- Use ID `99` to access admin account
- Try different IDs with `userPrivateData` query

## 🔍 Using with GraphQL Sniper

### Step 1: Start the Lab Server
```bash
docker-compose up -d
```

### Step 2: Configure GraphQL Sniper
- URL: `http://localhost:4000/graphql`
- Enable proxy if needed
- Disable proxy if testing directly

### Step 3: Create a Wordlist
Save common GraphQL field/query names to a file or paste into the fuzzer:
```
admin
adminUsers
systemConfig
internalFlags
debugInfo
apiKey
secretToken
privateData
internalNotes
```

### Step 4: Mark Text for Replacement
In your GraphQL query, select the text you want to fuzz (e.g., a field name) and mark it for replacement.

### Step 5: Start Fuzzing
- Set threads (1-10 recommended for localhost)
- Set delay if needed (0ms is fine for localhost)
- Click "Start Fuzzing"

## 🛠️ Development

### Project Structure
```
lab-server/
├── server.js          # Apollo Server setup and resolvers
├── schema.js          # GraphQL type definitions
├── data.js            # Mock database with test data
├── package.json       # Dependencies
├── Dockerfile         # Docker image configuration
└── docker-compose.yml # Docker Compose setup
```

### Modifying the Server

Edit `data.js` to add more test data or `schema.js` to add new types/queries.

The server will automatically reload if you're using:
```bash
npm run dev
```

## 📝 Example Queries

### Basic Query
```graphql
query {
  users {
    id
    username
    email
  }
}
```

### Admin Query (Hidden)
```graphql
query {
  adminUsers {
    id
    username
    role
    secretToken
  }
}
```

### System Config (Very Hidden)
```graphql
query {
  systemConfig {
    version
    environment
    databaseUrl
    apiKeys
  }
}
```

### Get All Flags
```graphql
query {
  internalFlags {
    name
    value
    description
  }
}
```

## 🐛 Troubleshooting

### Port Already in Use
If port 4000 is already in use, modify `docker-compose.yml`:
```yaml
ports:
  - "4001:4000"  # Change 4001 to any available port
```

### Container Won't Start
Check logs:
```bash
docker-compose logs
```

### Reset Everything
```bash
docker-compose down -v
docker-compose up -d --build
```

## 📚 Learning Resources

- [GraphQL Security Best Practices](https://cheatsheetseries.owasp.org/cheatsheets/GraphQL_Cheat_Sheet.html)
- [OWASP GraphQL](https://owasp.org/www-project-graphql/)
- [GraphQL Vulnerabilities](https://github.com/dolevf/Damn-Vulnerable-GraphQL-Application)

## 🤝 Contributing

This is a lab environment for GraphQL Sniper. Feel free to add more vulnerabilities, test data, or scenarios!

## 📄 License

MIT - For educational purposes only
