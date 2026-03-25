import { Seeder } from '@mantiq/database'
import { HashManager } from '@mantiq/core'
import { User } from '../../app/Models/User.ts'
import { Category } from '../../app/Models/Category.ts'
import { Tag } from '../../app/Models/Tag.ts'
import { Post } from '../../app/Models/Post.ts'
import { Comment } from '../../app/Models/Comment.ts'
import { PostTag } from '../../app/Models/PostTag.ts'

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export default class DatabaseSeeder extends Seeder {
  override async run() {
    const hasher = new HashManager({ bcrypt: { rounds: 10 } })
    const hashed = await hasher.make('password')

    // ── Users ────────────────────────────────────────────────────────────────
    const users = [
      { name: 'Admin', email: 'admin@blog.com', bio: 'Platform administrator and chief editor.' },
      { name: 'Jane Editor', email: 'jane@blog.com', bio: 'Senior editor with 10 years of experience in tech journalism.' },
      { name: 'Bob Reader', email: 'bob@blog.com', bio: 'Avid reader and occasional contributor.' },
    ]

    const userIds: number[] = []
    for (const u of users) {
      const existing = await User.where('email', u.email).first()
      if (existing) {
        userIds.push(existing.getAttribute('id') as number)
      } else {
        const user = await User.create({ ...u, password: hashed })
        userIds.push(user.getAttribute('id') as number)
      }
    }

    // ── Categories ───────────────────────────────────────────────────────────
    const categories = [
      { name: 'Technology', slug: 'technology', description: 'Latest in software, hardware, and digital innovation.' },
      { name: 'Science', slug: 'science', description: 'Discoveries, research, and the natural world.' },
      { name: 'Business', slug: 'business', description: 'Markets, startups, and entrepreneurship.' },
      { name: 'Lifestyle', slug: 'lifestyle', description: 'Health, wellness, and modern living.' },
      { name: 'Travel', slug: 'travel', description: 'Destinations, guides, and travel stories.' },
    ]

    const categoryIds: number[] = []
    for (const c of categories) {
      const existing = await Category.where('slug', c.slug).first()
      if (existing) {
        categoryIds.push(existing.getAttribute('id') as number)
      } else {
        const cat = await Category.create(c)
        categoryIds.push(cat.getAttribute('id') as number)
      }
    }

    // ── Tags ─────────────────────────────────────────────────────────────────
    const tags = [
      'JavaScript', 'TypeScript', 'Bun', 'Web Development', 'AI',
      'Machine Learning', 'Cloud Computing', 'Open Source', 'DevOps', 'Security',
    ]

    const tagIds: number[] = []
    for (const name of tags) {
      const slug = slugify(name)
      const existing = await Tag.where('slug', slug).first()
      if (existing) {
        tagIds.push(existing.getAttribute('id') as number)
      } else {
        const tag = await Tag.create({ name, slug })
        tagIds.push(tag.getAttribute('id') as number)
      }
    }

    // ── Posts ─────────────────────────────────────────────────────────────────
    const posts = [
      {
        title: 'Getting Started with Bun: The JavaScript Runtime Revolution',
        excerpt: 'Bun is redefining what a JavaScript runtime can do. Here is everything you need to know to get started.',
        content: 'Bun is an all-in-one JavaScript runtime that bundles a transpiler, package manager, and test runner. Built on JavaScriptCore instead of V8, it offers remarkable performance improvements for server-side JavaScript. In this comprehensive guide, we will walk through installation, project setup, and key features that make Bun a compelling choice for your next project.\n\nBun ships with a built-in SQLite driver, native TypeScript support without transpilation overhead, and a Web-standard API surface that makes code portable between server and browser environments. Its package manager is up to 25x faster than npm, and its test runner provides a familiar Jest-like API with significantly faster execution times.\n\nWhether you are building a REST API, a real-time application, or a CLI tool, Bun provides the primitives you need without reaching for dozens of third-party packages.',
        category_idx: 0, user_idx: 0, status: 'published',
        tags_idx: [2, 0, 1],
      },
      {
        title: 'Building Type-Safe APIs with TypeScript and Mantiq',
        excerpt: 'Learn how to leverage TypeScript strict mode and Mantiq conventions to build APIs that catch errors at compile time.',
        content: 'TypeScript strict mode combined with a well-designed framework can eliminate entire categories of runtime errors. Mantiq embraces this philosophy by providing fully typed route definitions, model attributes, and middleware chains.\n\nIn this article, we explore how to define models with proper type casting, create validated request handlers using FormRequest classes, and structure your application for maximum type safety. We will cover patterns for handling nullable fields, union types in API responses, and generic repository patterns.\n\nThe result is an API where most bugs are caught by the compiler rather than by your users in production.',
        category_idx: 0, user_idx: 1, status: 'published',
        tags_idx: [1, 3],
      },
      {
        title: 'The Rise of AI-Powered Code Assistants',
        excerpt: 'How AI coding tools are transforming developer productivity and what it means for the future of software engineering.',
        content: 'The landscape of software development has been permanently altered by AI-powered code assistants. Tools like GitHub Copilot, Claude, and specialized coding agents are not just autocomplete on steroids — they represent a fundamental shift in how developers interact with codebases.\n\nThese tools excel at boilerplate generation, test writing, refactoring suggestions, and even architectural planning. However, they also raise important questions about code quality, security vulnerabilities introduced by generated code, and the evolving skill set required of professional developers.\n\nIn this deep dive, we examine real-world productivity data, common pitfalls, and best practices for integrating AI assistants into your development workflow without sacrificing code quality or team knowledge.',
        category_idx: 0, user_idx: 0, status: 'published',
        tags_idx: [4, 5],
      },
      {
        title: 'Understanding WebSocket Performance at Scale',
        excerpt: 'A deep dive into WebSocket scaling challenges and solutions for real-time applications.',
        content: 'Real-time applications are everywhere — from chat systems and collaborative editors to live dashboards and multiplayer games. WebSockets provide the bidirectional communication channel these applications need, but scaling them presents unique challenges.\n\nUnlike HTTP request-response patterns, WebSocket connections are long-lived and stateful. This means your server must manage connection state, handle reconnections gracefully, and distribute messages efficiently across a cluster of servers. We explore horizontal scaling strategies, message broker integration, and connection pooling techniques.\n\nWe also benchmark different runtime environments — Node.js, Deno, and Bun — to understand their WebSocket performance characteristics under various load patterns.',
        category_idx: 0, user_idx: 1, status: 'published',
        tags_idx: [3, 6],
      },
      {
        title: 'Quantum Computing Explained for Software Developers',
        excerpt: 'No physics degree required — here is a practical introduction to quantum computing concepts for programmers.',
        content: 'Quantum computing has moved from theoretical curiosity to practical reality. With cloud-accessible quantum processors from IBM, Google, and Amazon, software developers can now experiment with quantum algorithms without a background in quantum physics.\n\nThis article introduces qubits, superposition, and entanglement through the lens of classical programming concepts. We draw parallels between quantum gates and logic gates, explain quantum circuits using familiar control flow patterns, and walk through a simple quantum algorithm implementation.\n\nWhile general-purpose quantum computing remains years away, specific applications in optimization, cryptography, and simulation are already showing promise. Understanding these concepts now positions you to take advantage of quantum capabilities as they mature.',
        category_idx: 1, user_idx: 0, status: 'published',
        tags_idx: [4],
      },
      {
        title: 'The Future of Cloud-Native Development',
        excerpt: 'Container orchestration, serverless functions, and edge computing are converging. Where is cloud development headed?',
        content: 'Cloud-native development has evolved rapidly from simple VM provisioning to sophisticated container orchestration platforms. Today, we are witnessing another shift as serverless computing, edge functions, and WebAssembly-based runtimes challenge our assumptions about deployment architecture.\n\nKubernetes remains the industry standard for container orchestration, but emerging alternatives like Fly.io, Railway, and Cloudflare Workers offer simpler deployment models that cover many common use cases. Meanwhile, technologies like WASM and edge computing are enabling new patterns where code runs closer to users than ever before.\n\nThis article examines the trade-offs between these approaches and provides a framework for choosing the right deployment strategy for your application.',
        category_idx: 0, user_idx: 1, status: 'published',
        tags_idx: [6, 8],
      },
      {
        title: 'Securing Your REST API: A Comprehensive Checklist',
        excerpt: 'From authentication to rate limiting, every security measure your API needs in production.',
        content: 'API security is not an afterthought — it is a fundamental requirement. Every public-facing API is a potential attack vector, and the consequences of a breach can be severe. This checklist covers the essential security measures every API should implement before going to production.\n\nWe cover authentication strategies (JWT vs session-based), authorization patterns (RBAC vs ABAC), input validation and sanitization, rate limiting, CORS configuration, HTTPS enforcement, and security headers. Each section includes practical code examples using Mantiq middleware and configuration.\n\nBeyond the basics, we also discuss advanced topics like PKCE for OAuth flows, CSRF protection for session-based APIs, encrypted cookies, and audit logging for compliance requirements.',
        category_idx: 0, user_idx: 0, status: 'published',
        tags_idx: [9, 3],
      },
      {
        title: 'Open Source Sustainability: Beyond the Stars',
        excerpt: 'GitHub stars do not pay bills. Exploring sustainable business models for open source maintainers.',
        content: 'The open source ecosystem powers virtually all modern software, yet many critical projects are maintained by unpaid volunteers working in their spare time. This sustainability crisis has led to security vulnerabilities, burnout, and project abandonment.\n\nIn this article, we examine successful funding models that have emerged: dual licensing, open core, sponsorships, managed hosting, and consulting. We interview maintainers who have found sustainable paths and share their lessons learned.\n\nWe also discuss the role of corporations in open source sustainability, the ethics of relicensing, and emerging platforms like GitHub Sponsors, Open Collective, and Polar that are creating new funding channels for developers.',
        category_idx: 2, user_idx: 2, status: 'published',
        tags_idx: [7],
      },
      {
        title: 'Database Migration Strategies for Zero-Downtime Deployments',
        excerpt: 'How to evolve your database schema without taking your application offline.',
        content: 'Schema migrations are one of the most anxiety-inducing aspects of deployment. A poorly executed migration can lock tables, corrupt data, or bring down your entire application. Zero-downtime migrations require careful planning and specific techniques.\n\nThis guide covers the expand-contract pattern, backward-compatible migrations, online schema changes for large tables, and data migration strategies. We walk through real-world scenarios including adding non-nullable columns, renaming tables, splitting tables, and migrating between database engines.\n\nUsing Mantiq migration tooling, we demonstrate how to write migrations that are safe to run alongside live traffic and can be rolled back if something goes wrong.',
        category_idx: 0, user_idx: 1, status: 'published',
        tags_idx: [8, 3],
      },
      {
        title: 'Machine Learning in the Browser: Practical Applications',
        excerpt: 'TensorFlow.js and ONNX Runtime Web are bringing ML inference directly to the browser. Here is what you can build.',
        content: 'Machine learning inference is no longer confined to powerful servers. Modern browsers can run sophisticated ML models directly on the user device, enabling real-time predictions without network latency or server costs.\n\nWe explore practical applications including real-time image classification, text sentiment analysis, pose estimation, and anomaly detection — all running entirely in the browser. Each example includes performance benchmarks and tips for optimizing model size and inference speed.\n\nThe privacy benefits are compelling: sensitive data never leaves the user device. Combined with WebGPU acceleration and model quantization techniques, browser-based ML is becoming viable for production applications.',
        category_idx: 1, user_idx: 0, status: 'published',
        tags_idx: [4, 5, 0],
      },
      {
        title: 'Remote Work Productivity: Lessons from Five Years',
        excerpt: 'What we have learned about remote work since the pandemic, backed by data and personal experience.',
        content: 'Five years into the remote work revolution, we have enough data to move beyond opinions and examine what actually works. Studies from Microsoft Research, Gitlab, and Buffer consistently show that remote workers report higher productivity but also higher rates of burnout and isolation.\n\nThis article synthesizes the research and presents practical strategies for maintaining productivity while preserving wellbeing. We cover asynchronous communication protocols, meeting-free days, home office ergonomics, the importance of boundaries, and techniques for building team cohesion across time zones.\n\nWhether you are a remote work veteran or transitioning from an office environment, these evidence-based strategies will help you find your optimal working pattern.',
        category_idx: 3, user_idx: 2, status: 'published',
        tags_idx: [],
      },
      {
        title: 'DevOps Pipeline Optimization: From 30 Minutes to 3 Minutes',
        excerpt: 'How we reduced our CI/CD pipeline duration by 10x through caching, parallelization, and smart test splitting.',
        content: 'Slow CI/CD pipelines are a hidden tax on developer productivity. Every minute spent waiting for a pipeline is a minute of lost focus and context switching. Our team reduced our pipeline from 30 minutes to 3 minutes through systematic optimization.\n\nThis case study details every optimization we made: Docker layer caching, dependency caching strategies, test parallelization across multiple runners, smart test splitting based on historical timing data, and selective test running based on changed files.\n\nWe also cover the organizational changes that supported these technical improvements, including pipeline ownership, alerting on regression, and establishing performance budgets for CI duration.',
        category_idx: 0, user_idx: 1, status: 'published',
        tags_idx: [8, 6],
      },
      {
        title: 'Exploring Japan Beyond Tokyo: A Developer Digital Nomad Guide',
        excerpt: 'The best cities in Japan for remote workers, from coworking spaces to cafe culture.',
        content: 'Japan offers a unique combination of excellent infrastructure, safety, culinary excellence, and cultural richness that makes it an ideal destination for digital nomads. While Tokyo is the obvious choice, smaller cities offer lower costs, less crowding, and equally reliable internet.\n\nThis guide covers Fukuoka (thriving startup scene, affordable), Osaka (incredible food culture, central location), Kyoto (historical beauty, quiet work environment), and Sapporo (outdoor lifestyle, cool climate). For each city, we list recommended coworking spaces, neighborhoods for short-term rentals, average costs, and tips for navigating the visa situation.\n\nWe also cover practical considerations like pocket WiFi rental, SIM cards, working hours that overlap with Western time zones, and essential Japanese phrases for daily life.',
        category_idx: 4, user_idx: 2, status: 'published',
        tags_idx: [],
      },
      {
        title: 'Web Performance Optimization in 2025',
        excerpt: 'Core Web Vitals, server-side rendering, and edge caching strategies for modern web applications.',
        content: 'Web performance directly impacts user engagement, conversion rates, and search rankings. With Google Core Web Vitals now a ranking factor, performance optimization is a business imperative, not just a technical nice-to-have.\n\nThis guide covers the latest techniques for optimizing each Core Web Vital: Largest Contentful Paint (image optimization, critical CSS, server-side rendering), Interaction to Next Paint (reducing JavaScript execution time, web workers, virtual scrolling), and Cumulative Layout Shift (proper image dimensions, font loading strategies, dynamic content handling).\n\nWe also explore cutting-edge strategies including edge-side rendering, streaming SSR, partial hydration, and the islands architecture pattern that frameworks like Astro and Fresh have popularized.',
        category_idx: 0, user_idx: 0, status: 'draft',
        tags_idx: [3, 0],
      },
      {
        title: 'The Psychology of Clean Code',
        excerpt: 'Why readable code matters more than clever code, and the cognitive science that explains it.',
        content: 'Clean code is not about aesthetics — it is about cognitive load. Research in software psychology shows that developers spend far more time reading code than writing it, and the cognitive effort required to understand complex code leads to more bugs and slower development.\n\nThis article explores the psychological principles behind clean code practices: chunking (why functions should do one thing), the magical number seven (why parameter lists should be short), recognition over recall (why naming matters), and the principle of least surprise (why conventions exist).\n\nWe examine common code patterns through the lens of cognitive science and provide evidence-based guidelines for writing code that is not just correct, but comprehensible.',
        category_idx: 0, user_idx: 1, status: 'draft',
        tags_idx: [7],
      },
    ]

    const postIds: number[] = []
    for (const p of posts) {
      const slug = slugify(p.title)
      const existing = await Post.where('slug', slug).first()
      if (existing) {
        postIds.push(existing.getAttribute('id') as number)
        continue
      }

      const publishedAt = p.status === 'published' ? new Date().toISOString() : null
      const post = await Post.create({
        title: p.title,
        slug,
        excerpt: p.excerpt,
        content: p.content,
        user_id: userIds[p.user_idx]!,
        category_id: categoryIds[p.category_idx]!,
        status: p.status,
        published_at: publishedAt,
      })
      const postId = post.getAttribute('id') as number
      postIds.push(postId)

      // Attach tags
      for (const tagIdx of p.tags_idx) {
        const tid = tagIds[tagIdx]
        if (tid !== undefined) {
          await PostTag.create({ post_id: postId, tag_id: tid })
        }
      }
    }

    // ── Comments ──────────────────────────────────────────────────────────────
    const comments = [
      { body: 'Great introduction to Bun! I switched from Node.js last month and the speed difference is remarkable.', post_idx: 0, user_idx: 2 },
      { body: 'How does Bun handle native modules compared to Node.js? Any compatibility issues?', post_idx: 0, user_idx: 1 },
      { body: 'We migrated our production API to Bun and saw 40% reduction in response times. Highly recommended.', post_idx: 0, user_idx: 0 },
      { body: 'TypeScript strict mode has saved us from countless bugs. This article explains the value perfectly.', post_idx: 1, user_idx: 0 },
      { body: 'The FormRequest pattern is exactly what I was looking for. Clean validation without cluttering controllers.', post_idx: 1, user_idx: 2 },
      { body: 'AI coding assistants are a double-edged sword. The productivity gains are real, but code review becomes even more important.', post_idx: 2, user_idx: 1 },
      { body: 'I would love to see a follow-up comparing different AI assistant tools head to head.', post_idx: 2, user_idx: 2 },
      { body: 'We hit scaling issues at 50K concurrent WebSocket connections. The message broker approach described here solved it.', post_idx: 3, user_idx: 0 },
      { body: 'Fascinating read. The qubit analogy to probabilistic bits really helped my understanding.', post_idx: 4, user_idx: 2 },
      { body: 'Edge computing with Cloudflare Workers has been a game changer for our global API latency.', post_idx: 5, user_idx: 0 },
      { body: 'PKCE for OAuth is not optional anymore. Every API should implement it. Great checklist.', post_idx: 6, user_idx: 1 },
      { body: 'The security headers section alone is worth bookmarking. So many APIs get this wrong.', post_idx: 6, user_idx: 2 },
      { body: 'As a maintainer of a popular OSS library, this article resonates deeply. GitHub Sponsors has been helpful but not sufficient.', post_idx: 7, user_idx: 0 },
      { body: 'The expand-contract pattern saved our last major migration. Cannot recommend it enough.', post_idx: 8, user_idx: 2 },
      { body: 'We ran ONNX models in our web app for real-time fraud detection. The latency is good enough for most use cases.', post_idx: 9, user_idx: 1 },
      { body: 'The privacy angle is compelling. No data leaves the device, so GDPR compliance becomes much simpler.', post_idx: 9, user_idx: 0 },
      { body: 'Async-first communication changed our team dynamics completely. Fewer meetings, more deep work.', post_idx: 10, user_idx: 1 },
      { body: 'Our pipeline went from 45 minutes to 5 minutes using similar techniques. The test splitting approach is key.', post_idx: 11, user_idx: 0 },
      { body: 'Fukuoka is an underrated gem. The startup visa program makes it very accessible for tech workers.', post_idx: 12, user_idx: 1 },
      { body: 'The cognitive science perspective on clean code is refreshing. Most articles just list rules without explaining why.', post_idx: 14, user_idx: 0 },
    ]

    for (const c of comments) {
      const postId = postIds[c.post_idx]
      const userId = userIds[c.user_idx]
      if (postId === undefined || userId === undefined) continue

      // Check if a comment with this body already exists on this post by this user
      const existing = await Comment.where('post_id', postId)
        .where('user_id', userId)
        .where('body', c.body)
        .first()

      if (!existing) {
        await Comment.create({
          body: c.body,
          post_id: postId,
          user_id: userId,
          status: 'approved',
        })
      }
    }
  }
}
