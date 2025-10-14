import gql from 'graphql-tag'

export const typeDefs = gql`
  # Public types - easily discoverable
  type User {
    id: ID!
    username: String!
    email: String!
    bio: String
    posts: [Post!]!
    
    # Hidden field - not in introspection disabled mode
    apiKey: String
  }

  type Post {
    id: ID!
    title: String!
    content: String!
    author: User!
    published: Boolean!
    views: Int!
    
    # Hidden field - sensitive data
    internalNotes: String
  }

  # Admin types - harder to discover
  type AdminUser {
    id: ID!
    username: String!
    email: String!
    role: String!
    permissions: [String!]!
    secretToken: String!
    lastLogin: String
  }

  type SystemConfig {
    version: String!
    environment: String!
    databaseUrl: String!
    apiKeys: [String!]!
    debugMode: Boolean!
  }

  # Secret type - very hidden
  type Flag {
    id: ID!
    name: String!
    value: String!
    description: String!
  }

  type Query {
    # Public queries
    users: [User!]!
    user(id: ID!): User
    posts: [Post!]!
    post(id: ID!): Post
    
    # Semi-hidden queries (not obvious from naming)
    getUserByUsername(username: String!): User
    searchPosts(keyword: String!): [Post!]!
    
    # Hidden admin queries
    adminUsers: [AdminUser!]!
    adminUser(id: ID!): AdminUser
    
    # Very hidden queries
    systemConfig: SystemConfig
    internalFlags: [Flag!]!
    debugInfo: String!
    
    # IDOR vulnerability
    userPrivateData(userId: ID!): User
  }

  type Mutation {
    # Public mutations
    createPost(title: String!, content: String!, authorId: ID!): Post!
    updatePost(id: ID!, title: String, content: String): Post
    
    # Hidden mutations
    promoteToAdmin(userId: ID!): AdminUser
    deleteUser(userId: ID!): Boolean!
    resetAllData: Boolean!
  }
`
