Now I have enough research to compile a comprehensive guide. Let me assemble everything into a thorough response.

---

# Full-Stack Next.js 15 Best Practices Guide (2025-2026)

## Prisma + Supabase + Cloudflare R2 + Vercel

---

## Recommended Version Matrix

| Package | Version | Notes |
|---|---|---|
| `next` | `^15.1.4+` | App Router, React 19 support |
| `react` / `react-dom` | `^19.0.0` | Required for App Router in Next.js 15 |
| `prisma` / `@prisma/client` | `^6.2.1+` | ESM-first client, Next.js integration |
| `@supabase/supabase-js` | `^2.x` | Core Supabase client |
| `@supabase/ssr` | `^0.5.x+` | Replaces deprecated `@supabase/auth-helpers` |
| `@aws-sdk/client-s3` | `^3.x` | R2 S3-compatible API |
| `@aws-sdk/s3-request-presigner` | `^3.x` | Presigned URL generation |

**Important**: The `@supabase/auth-helpers` package is **deprecated**. All new projects must use `@supabase/ssr` instead. ([Supabase SSR Migration Guide](https://supabase.com/docs/guides/auth/server-side/migrating-to-ssr-from-auth-helpers))

---

## 1. Next.js 15 App Router Patterns

### Server Components vs Client Components

All components in the App Router are **server components by default**. Only add `"use client"` when you need interactivity, browser APIs, or React hooks like `useState`/`useEffect`. ([Official Next.js Docs](https://nextjs.org/docs/app/getting-started/server-and-client-components))

**Decision framework:**

| Use Server Component (default) | Use Client Component (`"use client"`) |
|---|---|
| Data fetching from DB/APIs | onClick, onChange, form local state |
| Access to secrets/env vars | Browser APIs (window, localStorage) |
| Heavy library usage (markdown, etc.) | Animations, transitions |
| Rendering large lists | Real-time subscriptions (Supabase) |
| Admin dashboard read views | File upload with progress tracking |

**Critical anti-pattern**: Do NOT place `"use client"` high in the component tree. This disables RSC benefits for the entire subtree. Keep client components as **leaf-level islands**.

```
app/
  dashboard/
    page.tsx              # Server Component - fetches data
    _components/
      StatsGrid.tsx       # Server Component - renders stats
      LiveChart.tsx       # "use client" - needs interactivity
      UploadButton.tsx    # "use client" - file picker + progress
```

### Composing Server and Client Components

```tsx
// app/dashboard/page.tsx (Server Component - NO "use client")
import { prisma } from '@/lib/prisma'
import { StatsGrid } from './_components/StatsGrid'
import { LiveChart } from './_components/LiveChart'

export default async function DashboardPage() {
  // This runs on the server - direct DB access, no API needed
  const stats = await prisma.episode.findMany({
    select: { id: true, title: true, status: true, viewCount: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  return (
    <div>
      {/* Server Component child - zero JS shipped */}
      <StatsGrid stats={stats} />
      {/* Client Component island - only this ships JS */}
      <LiveChart initialData={stats} />
    </div>
  )
}
```

### Route Segment Configuration

Next.js 15 changed caching defaults: **fetch requests are NOT cached by default**. You must opt in explicitly. ([Next.js Caching Guide](https://nextjs.org/docs/app/guides/caching))

```tsx
// Static page with ISR (revalidate every 60 seconds)
export const revalidate = 60

// Force dynamic rendering (equivalent to old getServerSideProps)
export const dynamic = 'force-dynamic'

// Force static (build-time only)
export const dynamic = 'force-static'

// Per-fetch caching (opt-in since Next.js 15)
const data = await fetch(url, { next: { revalidate: 3600 } })
```

### Server Actions for Mutations

```tsx
// app/admin/episodes/actions.ts
'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const EpisodeSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  seasonId: z.string().uuid(),
})

export async function createEpisode(formData: FormData) {
  // 1. Authenticate
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (!user || error) redirect('/login')

  // 2. Validate
  const parsed = EpisodeSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description'),
    seasonId: formData.get('seasonId'),
  })

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  // 3. Mutate
  await prisma.episode.create({
    data: {
      ...parsed.data,
      createdById: user.id,
    },
  })

  // 4. Revalidate and redirect
  revalidateTag('episodes')
  revalidatePath('/admin/episodes')
  redirect('/admin/episodes')
}
```

Use `revalidateTag` when the same data appears on multiple pages. Use `revalidatePath` for page-specific invalidation. ([revalidateTag docs](https://nextjs.org/docs/app/api-reference/functions/revalidateTag), [revalidatePath docs](https://nextjs.org/docs/app/api-reference/functions/revalidatePath))

---

## 2. Prisma with Supabase PostgreSQL

### Schema Configuration

For **Prisma 6.x** (recommended for Next.js 15), the schema uses `url` and `directUrl` in the datasource block. ([Prisma + Supabase Docs](https://supabase.com/docs/guides/database/prisma))

```prisma
// prisma/schema.prisma

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["relationJoins"]
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")          // Pooled connection (Supavisor)
  directUrl = env("DATABASE_DIRECT_URL")   // Direct connection (for migrations)
}

model Episode {
  id          String   @id @default(cuid())
  title       String
  description String?
  status      EpisodeStatus @default(DRAFT)
  videoUrl    String?
  thumbnailUrl String?
  duration    Int?
  seasonId    String
  season      Season   @relation(fields: [seasonId], references: [id])
  createdById String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([seasonId])
  @@index([status])
  @@index([createdAt])
}

enum EpisodeStatus {
  DRAFT
  PROCESSING
  PUBLISHED
  ARCHIVED
}
```

### Environment Variables for Supabase

```env
# .env

# Pooled connection via Supavisor (port 6543) - used by Prisma Client at runtime
# The ?pgbouncer=true disables prepared statements for compatibility
DATABASE_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"

# Direct connection (port 5432) - used ONLY for migrations
DATABASE_DIRECT_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"

# Supabase Auth
NEXT_PUBLIC_SUPABASE_URL="https://[PROJECT_REF].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."
SUPABASE_SERVICE_ROLE_KEY="eyJ..."    # Server-only, never expose to client
```

**Why two connection strings?** The `DATABASE_URL` routes through Supabase's connection pooler (Supavisor, similar to PgBouncer) in transaction mode, which is required for serverless environments where each function invocation would otherwise open a new connection. The `directUrl` is used only by `prisma migrate` and `prisma db push`, which need a single persistent connection and do not work through poolers. ([Prisma PgBouncer docs](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/pgbouncer))

### Prisma Client Singleton

Without this pattern, Next.js hot-reload in development creates a new `PrismaClient` on every file change, exhausting database connections. ([Prisma Next.js Guide](https://www.prisma.io/docs/orm/more/help-and-troubleshooting/nextjs-help))

```typescript
// lib/prisma.ts

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

### Migration Strategy

```bash
# Development: create and apply migrations
npx prisma migrate dev --name add_episodes_table

# Production (Vercel build): apply pending migrations only
npx prisma migrate deploy

# Emergency: push schema without migration history (use sparingly)
npx prisma db push
```

Add to your `package.json` build script:

```json
{
  "scripts": {
    "build": "prisma generate && prisma migrate deploy && next build",
    "postinstall": "prisma generate"
  }
}
```

The `postinstall` hook ensures `prisma generate` runs after `npm install` on Vercel, which is necessary for the Prisma Client to be available during the build.

---

## 3. Supabase Auth Integration

### Client Utilities

**Browser client** (used in Client Components): ([Supabase SSR Client Creation](https://supabase.com/docs/guides/auth/server-side/creating-a-client))

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**Server client** (used in Server Components, Server Actions, Route Handlers):

```typescript
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method is called from a Server Component
            // where cookies cannot be set. This can be ignored if
            // middleware is refreshing user sessions.
          }
        },
      },
    }
  )
}
```

**Admin/service client** (bypasses RLS -- server-only):

```typescript
// lib/supabase/admin.ts
import { createClient } from '@supabase/supabase-js'

// This client uses the service role key and bypasses RLS entirely.
// NEVER import this in client components or expose the key.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)
```

([Supabase Service Role Security](https://supabase.com/docs/guides/api/api-keys))

### Middleware for Auth

This is the single most important piece for Supabase Auth with Next.js. The middleware refreshes expired tokens and passes them to both Server Components and the browser. ([Setting up Server-Side Auth for Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs))

```typescript
// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Use getUser(), NOT getSession().
  // getUser() sends a request to the Supabase Auth server every time
  // to revalidate the token. getSession() reads from cookies which
  // can be spoofed.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protect admin routes
  if (
    !user &&
    request.nextUrl.pathname.startsWith('/admin')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // IMPORTANT: You must return the supabaseResponse object as-is.
  // If you create a new response object, the refreshed cookies will be lost.
  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

**Critical security note**: Never trust `supabase.auth.getSession()` in server code. It reads from cookies which can be tampered with. Always use `supabase.auth.getUser()` which verifies the token against the Supabase Auth server. ([Supabase Auth Troubleshooting](https://supabase.com/docs/guides/troubleshooting/how-do-you-troubleshoot-nextjs---supabase-auth-issues-riMCZV))

### Auth Callback Route Handler

```typescript
// app/auth/callback/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/admin'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
```

### RLS Policies

Since this is an admin-only app using Prisma for data access (which uses the direct connection, not the Supabase API), RLS policies on your Prisma-managed tables are not strictly needed -- Prisma connects with the database password, not through the PostgREST API. However, if you also use the Supabase client for real-time subscriptions or storage, you will need RLS.

```sql
-- Example: RLS for Supabase Storage (if used alongside R2)
-- or for tables accessed via Supabase Realtime

-- Allow authenticated admin users to read all episodes
CREATE POLICY "Admins can read episodes"
ON public.episodes FOR SELECT
TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM public.admin_users
  )
);

-- Allow admins to insert/update
CREATE POLICY "Admins can modify episodes"
ON public.episodes FOR ALL
TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM public.admin_users
  )
)
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM public.admin_users
  )
);
```

([Supabase RLS Guide](https://supabase.com/docs/guides/database/postgres/row-level-security))

---

## 4. File Upload Patterns (Cloudflare R2)

### R2 Client Configuration

```typescript
// lib/r2.ts
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

export const R2_BUCKET = process.env.R2_BUCKET_NAME!
```

### Simple Presigned Upload (files under 100MB)

For smaller files (thumbnails, images, short clips), a single presigned PUT URL is sufficient. ([Cloudflare R2 Presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/))

```typescript
// app/api/upload/presign/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { r2Client, R2_BUCKET } from '@/lib/r2'
import { createClient } from '@/lib/supabase/server'
import { nanoid } from 'nanoid'

export async function POST(request: NextRequest) {
  // Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { filename, contentType, size } = await request.json()

  // Validate file type and size
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4']
  if (!allowedTypes.includes(contentType)) {
    return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
  }

  const key = `uploads/${nanoid()}/${filename}`

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: contentType,
    ContentLength: size,
  })

  const signedUrl = await getSignedUrl(r2Client, command, {
    expiresIn: 3600, // 1 hour
  })

  return NextResponse.json({
    uploadUrl: signedUrl,
    key,
  })
}
```

### Multipart Upload for Large Video Files (500MB+)

For large video files, you need a three-phase multipart upload: initiate, upload parts with presigned URLs, and complete. ([R2 Multipart Upload](https://developers.cloudflare.com/r2/objects/upload-objects/), [Multipart Upload Example](https://notjoemartinez.com/blog/cloudflare_r2_multipart_upload_s3sdk/))

**Server-side route handlers:**

```typescript
// app/api/upload/multipart/initiate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { CreateMultipartUploadCommand } from '@aws-sdk/client-s3'
import { r2Client, R2_BUCKET } from '@/lib/r2'
import { createClient } from '@/lib/supabase/server'
import { nanoid } from 'nanoid'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { filename, contentType } = await request.json()
  const key = `videos/${nanoid()}/${filename}`

  const command = new CreateMultipartUploadCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: contentType,
  })

  const { UploadId } = await r2Client.send(command)

  return NextResponse.json({ uploadId: UploadId, key })
}
```

```typescript
// app/api/upload/multipart/presign-part/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { UploadPartCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { r2Client, R2_BUCKET } from '@/lib/r2'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { key, uploadId, partNumber } = await request.json()

  const command = new UploadPartCommand({
    Bucket: R2_BUCKET,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
  })

  const signedUrl = await getSignedUrl(r2Client, command, {
    expiresIn: 3600,
  })

  return NextResponse.json({ signedUrl })
}
```

```typescript
// app/api/upload/multipart/complete/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { CompleteMultipartUploadCommand } from '@aws-sdk/client-s3'
import { r2Client, R2_BUCKET } from '@/lib/r2'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { key, uploadId, parts, episodeId } = await request.json()

  // parts: Array<{ ETag: string, PartNumber: number }>
  const command = new CompleteMultipartUploadCommand({
    Bucket: R2_BUCKET,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: {
      Parts: parts.sort(
        (a: { PartNumber: number }, b: { PartNumber: number }) =>
          a.PartNumber - b.PartNumber
      ),
    },
  })

  await r2Client.send(command)

  // Update the episode record with the video URL
  if (episodeId) {
    await prisma.episode.update({
      where: { id: episodeId },
      data: {
        videoUrl: key,
        status: 'PROCESSING',
      },
    })
  }

  return NextResponse.json({ success: true, key })
}
```

**Client-side upload component with progress tracking:**

```tsx
// components/VideoUploader.tsx
'use client'

import { useState, useCallback } from 'react'

const CHUNK_SIZE = 50 * 1024 * 1024 // 50MB per part (min 5MB for R2)
const MAX_CONCURRENT_UPLOADS = 3

interface UploadProgress {
  loaded: number
  total: number
  percentage: number
}

export function VideoUploader({ episodeId }: { episodeId: string }) {
  const [progress, setProgress] = useState<UploadProgress>({
    loaded: 0, total: 0, percentage: 0,
  })
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const uploadFile = useCallback(async (file: File) => {
    setIsUploading(true)
    setError(null)

    try {
      // Phase 1: Initiate multipart upload
      const initRes = await fetch('/api/upload/multipart/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
        }),
      })
      const { uploadId, key } = await initRes.json()

      // Phase 2: Upload parts with concurrency control
      const totalParts = Math.ceil(file.size / CHUNK_SIZE)
      const completedParts: { ETag: string; PartNumber: number }[] = []
      let uploadedBytes = 0

      // Process parts in batches of MAX_CONCURRENT_UPLOADS
      for (let i = 0; i < totalParts; i += MAX_CONCURRENT_UPLOADS) {
        const batch = []

        for (
          let j = i;
          j < Math.min(i + MAX_CONCURRENT_UPLOADS, totalParts);
          j++
        ) {
          const partNumber = j + 1
          const start = j * CHUNK_SIZE
          const end = Math.min(start + CHUNK_SIZE, file.size)
          const chunk = file.slice(start, end)

          batch.push(
            (async () => {
              // Get presigned URL for this part
              const presignRes = await fetch(
                '/api/upload/multipart/presign-part',
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ key, uploadId, partNumber }),
                }
              )
              const { signedUrl } = await presignRes.json()

              // Upload the chunk directly to R2
              const uploadRes = await fetch(signedUrl, {
                method: 'PUT',
                body: chunk,
              })

              const etag = uploadRes.headers.get('ETag')

              uploadedBytes += chunk.size
              setProgress({
                loaded: uploadedBytes,
                total: file.size,
                percentage: Math.round((uploadedBytes / file.size) * 100),
              })

              return { ETag: etag!, PartNumber: partNumber }
            })()
          )
        }

        const results = await Promise.all(batch)
        completedParts.push(...results)
      }

      // Phase 3: Complete the multipart upload
      await fetch('/api/upload/multipart/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key,
          uploadId,
          parts: completedParts,
          episodeId,
        }),
      })

      setProgress({ loaded: file.size, total: file.size, percentage: 100 })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }, [episodeId])

  return (
    <div>
      <input
        type="file"
        accept="video/mp4,video/quicktime,video/webm"
        disabled={isUploading}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) uploadFile(file)
        }}
      />

      {isUploading && (
        <div>
          <div
            style={{ width: `${progress.percentage}%` }}
            className="h-2 bg-blue-600 rounded transition-all"
          />
          <p>
            {progress.percentage}% ({Math.round(progress.loaded / 1024 / 1024)}
            MB / {Math.round(progress.total / 1024 / 1024)}MB)
          </p>
        </div>
      )}

      {error && <p className="text-red-600">{error}</p>}
    </div>
  )
}
```

### Generating Signed Read URLs

```typescript
// lib/r2.ts (add to existing file)
export async function getSignedReadUrl(key: string, expiresIn = 3600) {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
  })

  return getSignedUrl(r2Client, command, { expiresIn })
}
```

**Key constraints for R2 multipart uploads**: minimum part size is 5 MiB (except the last part), maximum 10,000 parts per upload. For a 500MB file with 50MB chunks, that is 10 parts -- well within limits. For files up to 500GB, 50MB chunks give you 10,000 parts maximum.

---

## 5. Supabase Realtime for Live Dashboard

Realtime subscriptions must run in Client Components because they use WebSockets and React hooks. ([Supabase Realtime with Next.js](https://supabase.com/docs/guides/realtime/realtime-with-nextjs))

```tsx
// components/LiveDashboard.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

interface Episode {
  id: string
  title: string
  status: string
  viewCount: number
}

export function LiveDashboard({
  initialEpisodes,
}: {
  initialEpisodes: Episode[]
}) {
  const [episodes, setEpisodes] = useState<Episode[]>(initialEpisodes)
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel('episodes-changes')
      .on(
        'postgres_changes',
        {
          event: '*',        // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'Episode',  // Must match your Prisma table name
        },
        (payload: RealtimePostgresChangesPayload<Episode>) => {
          if (payload.eventType === 'INSERT') {
            setEpisodes((prev) => [payload.new as Episode, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setEpisodes((prev) =>
              prev.map((ep) =>
                ep.id === (payload.new as Episode).id
                  ? (payload.new as Episode)
                  : ep
              )
            )
          } else if (payload.eventType === 'DELETE') {
            setEpisodes((prev) =>
              prev.filter((ep) => ep.id !== (payload.old as Episode).id)
            )
          }
        }
      )
      .subscribe()

    // Cleanup on unmount
    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  return (
    <ul>
      {episodes.map((ep) => (
        <li key={ep.id}>
          {ep.title} - {ep.status} - {ep.viewCount} views
        </li>
      ))}
    </ul>
  )
}
```

**Parent Server Component:**

```tsx
// app/admin/dashboard/page.tsx
import { prisma } from '@/lib/prisma'
import { LiveDashboard } from '@/components/LiveDashboard'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const episodes = await prisma.episode.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  // Server fetches initial data, client subscribes to changes
  return <LiveDashboard initialEpisodes={episodes} />
}
```

**Prerequisite**: You must enable the Realtime publication for your table in the Supabase Dashboard (Database > Replication) or via SQL:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE "Episode";
```

---

## 6. Performance Patterns

### Parallel Data Fetching in Server Components

```tsx
// app/admin/dashboard/page.tsx
import { prisma } from '@/lib/prisma'
import { Suspense } from 'react'

export default async function DashboardPage() {
  // Initiate ALL queries in parallel - do not await sequentially
  const [episodes, seasons, stats] = await Promise.all([
    prisma.episode.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { season: true },
    }),
    prisma.season.findMany({
      orderBy: { number: 'asc' },
    }),
    prisma.episode.aggregate({
      _count: true,
      _sum: { viewCount: true },
    }),
  ])

  return (
    <div>
      <StatsOverview stats={stats} />
      <EpisodeList episodes={episodes} />
      <SeasonList seasons={seasons} />
    </div>
  )
}
```

### Streaming with Suspense Boundaries

Wrap independent sections in Suspense boundaries so the page streams progressively:

```tsx
// app/admin/dashboard/page.tsx
import { Suspense } from 'react'
import { EpisodeList } from './_components/EpisodeList'
import { AnalyticsChart } from './_components/AnalyticsChart'
import { RecentActivity } from './_components/RecentActivity'

export default function DashboardPage() {
  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Fast query - renders immediately */}
      <Suspense fallback={<Skeleton className="h-64" />}>
        <EpisodeList />
      </Suspense>

      {/* Slow analytics query - streams in when ready */}
      <Suspense fallback={<Skeleton className="h-64" />}>
        <AnalyticsChart />
      </Suspense>

      {/* Independent section - streams independently */}
      <Suspense fallback={<Skeleton className="h-48" />}>
        <RecentActivity />
      </Suspense>
    </div>
  )
}
```

Each `<Suspense>` boundary lets Next.js stream the shell immediately and fill in each section as its data resolves. This gives users near-instant page loads even when some queries are slow.

### ISR for Public-Facing Pages

```tsx
// app/episodes/[slug]/page.tsx

// Revalidate every 5 minutes
export const revalidate = 300

// Generate static params at build time
export async function generateStaticParams() {
  const episodes = await prisma.episode.findMany({
    where: { status: 'PUBLISHED' },
    select: { slug: true },
  })
  return episodes.map((ep) => ({ slug: ep.slug }))
}

export default async function EpisodePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params // Next.js 15: params is now a Promise

  const episode = await prisma.episode.findUnique({
    where: { slug },
    include: { season: true },
  })

  if (!episode) notFound()

  return <EpisodeView episode={episode} />
}
```

**Next.js 15 breaking change**: `params` and `searchParams` are now Promises and must be awaited. This is a common migration gotcha. ([Next.js 15 Upgrade Guide](https://nextjs.org/docs/app/guides/upgrading/version-15))

---

## 7. Vercel Deployment Configuration

```typescript
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Enable image optimization for R2 domains
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.r2.cloudflarestorage.com',
      },
      {
        // If you use a custom domain for R2
        protocol: 'https',
        hostname: 'media.yourdomain.com',
      },
    ],
  },

  // Recommended: enable strict mode
  reactStrictMode: true,

  // If you have large API payloads (file upload metadata)
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
}

export default nextConfig
```

**Vercel environment variables** to configure:

```
DATABASE_URL               # Supabase pooled connection
DATABASE_DIRECT_URL        # Supabase direct connection (for build-time migrations)
NEXT_PUBLIC_SUPABASE_URL   # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY  # Supabase anon/public key
SUPABASE_SERVICE_ROLE_KEY  # Supabase service role (server-only)
CLOUDFLARE_ACCOUNT_ID      # R2 account
R2_ACCESS_KEY_ID           # R2 credentials
R2_SECRET_ACCESS_KEY       # R2 credentials
R2_BUCKET_NAME             # R2 bucket name
```

---

## 8. Common Pitfalls and Anti-Patterns

### Pitfall 1: Using `getSession()` instead of `getUser()` in server code

```tsx
// WRONG - getSession() reads from cookies, which can be spoofed
const { data: { session } } = await supabase.auth.getSession()

// CORRECT - getUser() validates against the Supabase Auth server
const { data: { user } } = await supabase.auth.getUser()
```

### Pitfall 2: Creating a new Supabase response object in middleware

```tsx
// WRONG - this drops the refreshed auth cookies
const {
  data: { user },
} = await supabase.auth.getUser()

if (!user) {
  // Creating a NEW NextResponse loses the cookies set by setAll()
  return NextResponse.redirect(new URL('/login', request.url))
}

// CORRECT - always return the supabaseResponse, or clone cookies to your redirect
const url = request.nextUrl.clone()
url.pathname = '/login'
const redirectResponse = NextResponse.redirect(url)
// Copy all cookies from supabaseResponse to the redirect
supabaseResponse.cookies.getAll().forEach((cookie) => {
  redirectResponse.cookies.set(cookie.name, cookie.value)
})
return redirectResponse
```

### Pitfall 3: Running Prisma migrations through the pooler

```bash
# WRONG - migrations through connection pooler will hang or fail
DATABASE_URL="...pooler.supabase.com:6543/postgres?pgbouncer=true" npx prisma migrate deploy

# CORRECT - migrations use directUrl automatically when configured in schema
# Just ensure DATABASE_DIRECT_URL points to port 5432 (direct connection)
npx prisma migrate deploy
```

### Pitfall 4: Placing `"use client"` too high in the tree

```tsx
// WRONG - entire page becomes a client component, losing all RSC benefits
// app/admin/page.tsx
'use client' // <-- this kills server rendering for the entire page

export default function AdminPage() { ... }

// CORRECT - keep the page as a server component, isolate interactivity
// app/admin/page.tsx (server component)
import { InteractiveWidget } from './_components/InteractiveWidget'

export default async function AdminPage() {
  const data = await prisma.thing.findMany() // runs on server
  return (
    <div>
      <StaticSection data={data} />
      <InteractiveWidget /> {/* only this needs "use client" */}
    </div>
  )
}
```

### Pitfall 5: Assuming fetch is cached by default in Next.js 15

```tsx
// In Next.js 14, this was cached by default. In Next.js 15, it is NOT.
const res = await fetch('https://api.example.com/data')

// Explicit opt-in to caching in Next.js 15:
const res = await fetch('https://api.example.com/data', {
  next: { revalidate: 3600, tags: ['my-data'] },
})
```

### Pitfall 6: Not handling the Promise-based params in Next.js 15

```tsx
// WRONG (Next.js 14 pattern - breaks in 15)
export default function Page({ params }: { params: { id: string } }) {
  const id = params.id
}

// CORRECT (Next.js 15)
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
}
```

### Pitfall 7: Exposing the Supabase service role key

```tsx
// WRONG - NEXT_PUBLIC_ prefix exposes this to the browser
NEXT_PUBLIC_SUPABASE_SERVICE_KEY="eyJ..."

// CORRECT - no NEXT_PUBLIC_ prefix, only accessible server-side
SUPABASE_SERVICE_ROLE_KEY="eyJ..."
```

### Pitfall 8: Not configuring the Prisma singleton in development

Without the singleton pattern, each hot reload creates a new PrismaClient, eventually exhausting your database connection limit. In Supabase free tier, that limit is quite low. See the singleton pattern in Section 2 above.

### Pitfall 9: Forgetting to enable Realtime publication

Supabase Realtime will silently receive no events if you forget to enable replication for your table:

```sql
-- Required for Realtime to work on a table
ALTER PUBLICATION supabase_realtime ADD TABLE "Episode";
```

### Pitfall 10: Using `@supabase/auth-helpers` instead of `@supabase/ssr`

The auth-helpers package is deprecated. It will not receive bug fixes or new features. All new projects should use `@supabase/ssr`.

---

## Project Structure Summary

```
app/
  (public)/                   # Public route group
    page.tsx                  # Landing page (static/ISR)
    episodes/
      [slug]/page.tsx         # Episode detail (ISR)
  (auth)/                     # Auth route group
    login/page.tsx            # Login page
    auth/callback/route.ts    # OAuth callback
  admin/                      # Protected admin routes
    layout.tsx                # Admin layout (server component)
    dashboard/
      page.tsx                # Dashboard (server component)
      _components/
        LiveChart.tsx          # "use client" - realtime
        StatsGrid.tsx          # Server component
    episodes/
      page.tsx                # Episode list
      [id]/edit/page.tsx      # Episode editor
      actions.ts              # Server actions
  api/
    upload/
      presign/route.ts        # Simple presigned upload
      multipart/
        initiate/route.ts
        presign-part/route.ts
        complete/route.ts
components/
  VideoUploader.tsx           # "use client" - upload with progress
  LiveDashboard.tsx           # "use client" - realtime subscriptions
lib/
  prisma.ts                   # Prisma singleton
  r2.ts                       # R2/S3 client
  supabase/
    client.ts                 # Browser Supabase client
    server.ts                 # Server Supabase client
    admin.ts                  # Service role client (server-only)
middleware.ts                 # Auth middleware
prisma/
  schema.prisma               # Database schema
  migrations/                 # Migration history
```

---

## Sources

- [Next.js Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [Next.js Caching Guide](https://nextjs.org/docs/app/guides/caching)
- [Next.js 15 Release Notes](https://nextjs.org/blog/next-15)
- [Next.js revalidateTag](https://nextjs.org/docs/app/api-reference/functions/revalidateTag)
- [Next.js revalidatePath](https://nextjs.org/docs/app/api-reference/functions/revalidatePath)
- [Next.js ISR Guide](https://nextjs.org/docs/app/guides/incremental-static-regeneration)
- [Next.js 15 Upgrade Guide](https://nextjs.org/docs/app/guides/upgrading/version-15)
- [Prisma PgBouncer Configuration](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/pgbouncer)
- [Prisma + Supabase Integration](https://supabase.com/docs/guides/database/prisma)
- [Prisma Next.js Troubleshooting](https://www.prisma.io/docs/orm/more/help-and-troubleshooting/nextjs-help)
- [Prisma Database Connections](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections)
- [Supabase SSR Client Creation](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Setting up Server-Side Auth for Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Supabase Auth Troubleshooting](https://supabase.com/docs/guides/troubleshooting/how-do-you-troubleshoot-nextjs---supabase-auth-issues-riMCZV)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase API Keys](https://supabase.com/docs/guides/api/api-keys)
- [Supabase Realtime with Next.js](https://supabase.com/docs/guides/realtime/realtime-with-nextjs)
- [Supabase Realtime Database Changes](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes)
- [Cloudflare R2 Presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
- [Cloudflare R2 Upload Objects](https://developers.cloudflare.com/r2/objects/upload-objects/)
- [Cloudflare R2 AWS SDK v3 Examples](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/)
- [Supabase Connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Migrating to SSR from Auth Helpers](https://supabase.com/docs/guides/auth/server-side/migrating-to-ssr-from-auth-helpers)