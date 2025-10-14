// Mock database - intentionally contains sensitive information
export const users = [
  {
    id: '1',
    username: 'alice',
    email: 'alice@example.com',
    bio: 'Software developer and blogger',
    apiKey: 'sk_live_abc123xyz789',
  },
  {
    id: '2',
    username: 'bob',
    email: 'bob@example.com',
    bio: 'Security researcher',
    apiKey: 'sk_live_def456uvw012',
  },
  {
    id: '3',
    username: 'charlie',
    email: 'charlie@example.com',
    bio: 'DevOps engineer',
    apiKey: 'sk_live_ghi789rst345',
  },
  {
    id: '99',
    username: 'admin',
    email: 'admin@internal.local',
    bio: 'System administrator',
    apiKey: 'sk_live_admin_master_key_999',
  },
]

export const posts = [
  {
    id: '1',
    title: 'Getting Started with GraphQL',
    content: 'GraphQL is a query language for APIs...',
    authorId: '1',
    published: true,
    views: 1523,
    internalNotes: 'Approved by editorial team on 2024-01-15',
  },
  {
    id: '2',
    title: 'Security Best Practices',
    content: 'When building APIs, security should be a top priority...',
    authorId: '2',
    published: true,
    views: 892,
    internalNotes: 'Contains sensitive security info - monitor closely',
  },
  {
    id: '3',
    title: 'Docker Tips and Tricks',
    content: 'Docker makes deployment easier...',
    authorId: '3',
    published: true,
    views: 2341,
    internalNotes: 'Popular post - consider expanding',
  },
  {
    id: '4',
    title: 'Draft: Unreleased Feature',
    content: 'This post is not ready yet...',
    authorId: '1',
    published: false,
    views: 0,
    internalNotes: 'DO NOT PUBLISH - contains leaked roadmap info',
  },
]

export const adminUsers = [
  {
    id: '99',
    username: 'admin',
    email: 'admin@internal.local',
    role: 'super_admin',
    permissions: ['read', 'write', 'delete', 'admin'],
    secretToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.admin.secret',
    lastLogin: '2024-01-20T10:30:00Z',
  },
  {
    id: '100',
    username: 'moderator',
    email: 'mod@internal.local',
    role: 'moderator',
    permissions: ['read', 'write', 'moderate'],
    secretToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mod.secret',
    lastLogin: '2024-01-19T14:22:00Z',
  },
]

export const systemConfig = {
  version: '1.0.0',
  environment: 'production',
  databaseUrl: 'postgresql://admin:P@ssw0rd123@db.internal.local:5432/maindb',
  apiKeys: [
    'sk_live_abc123xyz789',
    'sk_test_dev456test789',
    'sk_prod_master_key_xyz',
  ],
  debugMode: true,
}

export const flags = [
  {
    id: '1',
    name: 'FLAG_HIDDEN_ENDPOINT',
    value: 'CTF{you_found_the_hidden_graphql_endpoint}',
    description: 'Congratulations on discovering this hidden query!',
  },
  {
    id: '2',
    name: 'FLAG_IDOR',
    value: 'CTF{insecure_direct_object_reference}',
    description: 'Found via userPrivateData query',
  },
  {
    id: '3',
    name: 'FLAG_INFO_DISCLOSURE',
    value: 'CTF{information_disclosure_via_errors}',
    description: 'Leaked through verbose error messages',
  },
  {
    id: '4',
    name: 'FLAG_ADMIN_ACCESS',
    value: 'CTF{unauthorized_admin_access}',
    description: 'Accessed admin endpoints without authentication',
  },
]
