# Quick Start Guide: GraphQL Sniper Lab

This guide will walk you through setting up and using the GraphQL Sniper fuzzer with the lab server.

## Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ (for running GraphQL Sniper)
- A modern web browser

## Step 1: Start the Lab Server

```bash
cd lab-server
docker compose up -d
```

Verify it's running:
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"query":"{ users { id username } }"}' \
  http://localhost:4000/graphql
```

You should see a JSON response with user data.

## Step 2: Start GraphQL Sniper

In a new terminal:

```bash
# Start the dev server
npm run dev

# In another terminal, start the proxy (optional but recommended)
npm run proxy
```

Open your browser to: **http://localhost:5173**

## Step 3: Configure GraphQL Sniper

1. Navigate to the GraphQL page
2. Set **Target URL** to: `http://localhost:4000/graphql`
3. Enable "Use local proxy" if you started the proxy server
4. Paste this sample query in the **Raw GraphQL JSON request body**:

```json
{
  "query": "{ users { id username email } }"
}
```

5. Click **Beautify** to parse it into the editable fields

## Step 4: Test Basic Functionality

Click **Send** to verify the connection works. You should see:
- Status: `200 OK`
- Response with user data
- Words added to the Session Wordlist

## Step 5: Start Fuzzing

### Navigate to Fuzzer

Click **"Send to Fuzzer →"** button at the bottom of the left pane.

### Set Up Your Fuzz Test

1. In the **GraphQL Query** editor, select a word you want to fuzz. For example, select `users`:
   ```graphql
   query {
     users {
       id
       username
     }
   }
   ```

2. Click **"Mark Selection for Replacement"**

3. In the **Wordlist** box, paste the contents of `sample-wordlist.txt` or use this minimal list:
   ```
   users
   adminUsers
   systemConfig
   internalFlags
   debugInfo
   posts
   ```

4. Set **Performance Settings**:
   - Concurrent Threads: `5` (good for localhost)
   - Delay: `0` ms (no delay needed for localhost)

5. Click **"Start Fuzzing"**

### Watch the Results

Switch to the **Results** tab to see:
- Status codes for each word
- Response sizes
- Timing information
- Click "Expand" to see full request/response details

## Step 6: Discover Hidden Endpoints

Look for responses with:
- Status code `200` (successful)
- Different response sizes (indicates different data)
- Error messages that reveal information

### Hidden Endpoints to Find

Try fuzzing to discover:
- `adminUsers` - Returns admin user data with secret tokens
- `systemConfig` - Exposes database credentials
- `internalFlags` - Contains CTF flags
- `debugInfo` - System information disclosure

### Example Successful Fuzz

When you fuzz the query and replace `users` with `adminUsers`, you'll find:
```json
{
  "adminUsers": [
    {
      "id": "99",
      "username": "admin",
      "role": "super_admin",
      "secretToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.admin.secret"
    }
  ]
}
```

## Step 7: Fuzz Fields

You can also fuzz individual fields. Try this query:

```graphql
query {
  users {
    id
    username
    email
  }
}
```

Select `email` and replace it with field names like:
- `apiKey`
- `secretToken`
- `privateData`
- `internalNotes`

## Tips for Effective Fuzzing

### 1. Start Broad
Use generic words first:
```
admin
secret
internal
config
debug
```

### 2. Get More Specific
Based on what you find, try variations:
```
adminUsers
adminUser
adminConfig
adminPanel
```

### 3. Try Different Patterns
GraphQL conventions:
```
getUsers
listUsers
fetchUsers
allUsers
```

### 4. Check Error Messages
Failed queries often leak information:
- Available field names
- Type information
- Valid parameter formats

### 5. Use Concurrent Requests
For large wordlists:
- Set threads to 10-20 for faster results
- Add small delay (50-100ms) if needed

## Troubleshooting

### Lab Server Not Responding

Check if it's running:
```bash
docker compose ps
docker compose logs
```

Restart if needed:
```bash
docker compose restart
```

### Proxy Connection Failed

Make sure the proxy is running:
```bash
# In the graphql-sniper directory
npm run proxy
```

Or disable proxy in GraphQL Sniper settings.

### No Results in Fuzzer

- Verify the query syntax is valid
- Make sure you marked text for replacement
- Check the wordlist has words (one per line)
- Look at browser console for errors

## Next Steps

- Try fuzzing mutations
- Experiment with different query structures
- Add your own words to the wordlist
- Modify the lab server to add more vulnerabilities

## CTF Challenges

Can you find all 4 flags? 🚩

1. Find the hidden `internalFlags` endpoint
2. Discover the IDOR vulnerability
3. Trigger information disclosure
4. Access admin endpoints

Happy fuzzing! 🎯
