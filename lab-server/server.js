import { ApolloServer } from '@apollo/server'
import { startStandaloneServer } from '@apollo/server/standalone'
import { typeDefs } from './schema.js'
import { users, posts, adminUsers, systemConfig, flags } from './data.js'

// Resolvers with intentional vulnerabilities
const resolvers = {
  Query: {
    // Public queries
    users: () => users,
    user: (_, { id }) => users.find((u) => u.id === id),
    posts: () => posts.filter((p) => p.published),
    post: (_, { id }) => posts.find((p) => p.id === id),

    // Semi-hidden queries
    getUserByUsername: (_, { username }) => {
      const user = users.find((u) => u.username === username)
      if (!user) {
        // Intentional info disclosure via error message
        throw new Error(
          `User '${username}' not found. Available usernames: ${users.map((u) => u.username).join(', ')}`
        )
      }
      return user
    },

    searchPosts: (_, { keyword }) => {
      // Intentionally returns unpublished posts too (info disclosure)
      return posts.filter(
        (p) =>
          p.title.toLowerCase().includes(keyword.toLowerCase()) ||
          p.content.toLowerCase().includes(keyword.toLowerCase())
      )
    },

    // Hidden admin queries - no authentication required (vulnerability)
    adminUsers: () => {
      console.log('⚠️  WARNING: adminUsers query accessed without authentication!')
      return adminUsers
    },

    adminUser: (_, { id }) => {
      console.log(`⚠️  WARNING: adminUser query accessed for ID ${id} without authentication!`)
      return adminUsers.find((u) => u.id === id)
    },

    // Very hidden queries
    systemConfig: () => {
      console.log('🚨 CRITICAL: systemConfig accessed - leaking credentials!')
      return systemConfig
    },

    internalFlags: () => {
      console.log('🎯 FLAGS accessed!')
      return flags
    },

    debugInfo: () => {
      // Information disclosure
      return JSON.stringify(
        {
          nodeVersion: process.version,
          platform: process.platform,
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          env: {
            NODE_ENV: process.env.NODE_ENV || 'development',
            DATABASE_URL: systemConfig.databaseUrl,
          },
          internalEndpoints: [
            'adminUsers',
            'systemConfig',
            'internalFlags',
            'userPrivateData',
          ],
        },
        null,
        2
      )
    },

    // IDOR vulnerability - no access control
    userPrivateData: (_, { userId }) => {
      console.log(`⚠️  IDOR: Accessing private data for user ${userId} without authorization`)
      return users.find((u) => u.id === userId)
    },
  },

  Mutation: {
    // Public mutations
    createPost: (_, { title, content, authorId }) => {
      const newPost = {
        id: String(posts.length + 1),
        title,
        content,
        authorId,
        published: false,
        views: 0,
        internalNotes: 'Created via API',
      }
      posts.push(newPost)
      return newPost
    },

    updatePost: (_, { id, title, content }) => {
      const post = posts.find((p) => p.id === id)
      if (!post) {
        throw new Error(`Post ${id} not found`)
      }
      if (title) post.title = title
      if (content) post.content = content
      return post
    },

    // Hidden mutations - no authentication (vulnerability)
    promoteToAdmin: (_, { userId }) => {
      console.log(`🚨 CRITICAL: User ${userId} promoted to admin without authorization!`)
      const user = users.find((u) => u.id === userId)
      if (!user) {
        throw new Error(`User ${userId} not found`)
      }

      const newAdmin = {
        id: userId,
        username: user.username,
        email: user.email,
        role: 'admin',
        permissions: ['read', 'write', 'admin'],
        secretToken: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${userId}.promoted`,
        lastLogin: new Date().toISOString(),
      }
      adminUsers.push(newAdmin)
      return newAdmin
    },

    deleteUser: (_, { userId }) => {
      console.log(`⚠️  WARNING: Delete user ${userId} called without authorization!`)
      const index = users.findIndex((u) => u.id === userId)
      if (index === -1) {
        throw new Error(`User ${userId} not found`)
      }
      users.splice(index, 1)
      return true
    },

    resetAllData: () => {
      console.log('🚨 CRITICAL: resetAllData called - this would wipe the database!')
      return true
    },
  },

  // Field resolvers
  User: {
    posts: (user) => posts.filter((p) => p.authorId === user.id),
  },

  Post: {
    author: (post) => users.find((u) => u.id === post.authorId),
  },
}

// Create Apollo Server
const server = new ApolloServer({
  typeDefs,
  resolvers,
  // Intentionally verbose error messages (vulnerability)
  formatError: (formattedError, error) => {
    console.error('GraphQL Error:', formattedError)
    // Expose full error details including stack traces
    return {
      ...formattedError,
      extensions: {
        ...formattedError.extensions,
        stacktrace: error.stack,
        timestamp: new Date().toISOString(),
      },
    }
  },
  // Enable introspection (normally disabled in production)
  introspection: true,
  // Enable playground
  playground: true,
})

// Start the server
const { url } = await startStandaloneServer(server, {
  listen: { port: 4000 },
})

console.log(`🚀 GraphQL Sniper Lab Server ready at ${url}`)
console.log(``)
console.log(`📚 Available queries to discover:`)
console.log(`   - users, user(id)`)
console.log(`   - posts, post(id)`)
console.log(`   - getUserByUsername(username)`)
console.log(`   - searchPosts(keyword)`)
console.log(`   - ... and more hidden endpoints!`)
console.log(``)
console.log(`🎯 Try fuzzing to find:`)
console.log(`   - Hidden admin endpoints`)
console.log(`   - Secret configuration data`)
console.log(`   - CTF flags`)
console.log(`   - Sensitive user information`)
console.log(``)
console.log(`⚠️  This is an intentionally vulnerable server for testing purposes!`)
