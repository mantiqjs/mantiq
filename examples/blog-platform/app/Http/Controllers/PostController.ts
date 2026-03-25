import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { auth } from '@mantiq/auth'
import { Post } from '../../Models/Post.ts'
import { User } from '../../Models/User.ts'
import { Comment } from '../../Models/Comment.ts'
import { PostTag } from '../../Models/PostTag.ts'
import { Tag } from '../../Models/Tag.ts'
import { Category } from '../../Models/Category.ts'

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export class PostController {
  /**
   * List posts with pagination, search, filtering, and sorting.
   *
   * Query params: search, category_id, status, tag, sort (created_at|title|published_at), dir (asc|desc), page, per_page
   */
  async index(request: MantiqRequest): Promise<Response> {
    const search = request.query('search') ?? ''
    const categoryId = request.query('category_id')
    const status = request.query('status')
    const tagSlug = request.query('tag')
    const sortBy = request.query('sort') ?? 'created_at'
    const sortDir = request.query('dir') === 'asc' ? 'asc' : 'desc'
    const page = Math.max(1, Number(request.query('page') ?? 1))
    const perPage = Math.min(100, Math.max(1, Number(request.query('per_page') ?? 15)))

    // If filtering by tag, get matching post IDs first
    let tagPostIds: number[] | null = null
    if (tagSlug) {
      const tag = await Tag.where('slug', tagSlug).first()
      if (!tag) {
        return MantiqResponse.json({
          data: [],
          meta: { total: 0, page, per_page: perPage, last_page: 1 },
        })
      }
      const tagId = tag.getAttribute('id') as number
      const postTags = await PostTag.where('tag_id', tagId).get() as any[]
      tagPostIds = postTags.map((pt: any) => pt.getAttribute('post_id') as number)
      if (tagPostIds.length === 0) {
        return MantiqResponse.json({
          data: [],
          meta: { total: 0, page, per_page: perPage, last_page: 1 },
        })
      }
    }

    // Build query for counting
    const buildQuery = () => {
      let q = Post.query()

      if (search) {
        q = q.where('title', 'LIKE', `%${search}%`)
          .orWhere('content', 'LIKE', `%${search}%`) as any
      }
      if (categoryId) {
        q = q.where('category_id', Number(categoryId)) as any
      }
      if (status) {
        q = q.where('status', status) as any
      }

      return q
    }

    const total = await buildQuery().count() as number

    // Fetch posts
    let query = buildQuery()
      .orderBy(sortBy, sortDir)
      .limit(perPage)
      .offset((page - 1) * perPage)

    const posts = await query.get() as any[]

    // Filter by tag post IDs if needed (post-fetch filtering for simplicity)
    let filteredPosts = posts
    if (tagPostIds !== null) {
      filteredPosts = posts.filter((p: any) =>
        tagPostIds!.includes(p.getAttribute('id') as number),
      )
    }

    // Enrich posts with author and category info
    const data = await Promise.all(
      filteredPosts.map(async (post: any) => {
        const obj = post.toObject()
        const authorId = post.getAttribute('user_id')
        const catId = post.getAttribute('category_id')

        // Fetch author
        if (authorId) {
          const author = await User.find(Number(authorId))
          if (author) {
            obj.author = { id: author.getAttribute('id'), name: author.getAttribute('name') }
          }
        }

        // Fetch category
        if (catId) {
          const category = await Category.find(Number(catId))
          if (category) {
            obj.category = { id: category.getAttribute('id'), name: category.getAttribute('name'), slug: category.getAttribute('slug') }
          }
        }

        // Fetch tags
        const postTags = await PostTag.where('post_id', post.getAttribute('id')).get() as any[]
        const tagIds = postTags.map((pt: any) => pt.getAttribute('tag_id') as number)
        const tagList: any[] = []
        for (const tid of tagIds) {
          const t = await Tag.find(tid)
          if (t) tagList.push({ id: t.getAttribute('id'), name: t.getAttribute('name'), slug: t.getAttribute('slug') })
        }
        obj.tags = tagList

        return obj
      }),
    )

    const effectiveTotal = tagPostIds !== null ? filteredPosts.length : total

    return MantiqResponse.json({
      data,
      meta: {
        total: effectiveTotal,
        page,
        per_page: perPage,
        last_page: Math.max(1, Math.ceil(effectiveTotal / perPage)),
      },
    })
  }

  /**
   * Get a single post by ID with author, category, tags, and comments.
   */
  async show(request: MantiqRequest): Promise<Response> {
    const id = request.param('id')
    const post = await Post.find(Number(id))

    if (!post) {
      return MantiqResponse.json({ message: 'Post not found.' }, 404)
    }

    const obj = post.toObject()

    // Author
    const authorId = post.getAttribute('user_id')
    if (authorId) {
      const author = await User.find(Number(authorId))
      if (author) {
        obj.author = { id: author.getAttribute('id'), name: author.getAttribute('name'), email: author.getAttribute('email') }
      }
    }

    // Category
    const catId = post.getAttribute('category_id')
    if (catId) {
      const category = await Category.find(Number(catId))
      if (category) {
        obj.category = category.toObject()
      }
    }

    // Tags
    const postTags = await PostTag.where('post_id', Number(id)).get() as any[]
    const tagList: any[] = []
    for (const pt of postTags) {
      const t = await Tag.find(pt.getAttribute('tag_id') as number)
      if (t) tagList.push({ id: t.getAttribute('id'), name: t.getAttribute('name'), slug: t.getAttribute('slug') })
    }
    obj.tags = tagList

    // Comments with authors
    const comments = await Comment.where('post_id', Number(id))
      .where('status', 'approved')
      .orderBy('created_at', 'asc')
      .get() as any[]

    obj.comments = await Promise.all(
      comments.map(async (comment: any) => {
        const cObj = comment.toObject()
        const commentUserId = comment.getAttribute('user_id')
        if (commentUserId) {
          const commentAuthor = await User.find(Number(commentUserId))
          if (commentAuthor) {
            cObj.author = { id: commentAuthor.getAttribute('id'), name: commentAuthor.getAttribute('name') }
          }
        }
        return cObj
      }),
    )

    return MantiqResponse.json({ data: obj })
  }

  /**
   * Create a new post (auth required).
   */
  async store(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user()
    if (!user) return MantiqResponse.json({ message: 'Unauthenticated.' }, 401)

    const body = await request.input() as {
      title?: string
      content?: string
      excerpt?: string
      category_id?: number
      status?: string
      featured_image?: string
      tags?: number[]
    }

    // ── Validation ──────────────────────────────────────────────────────────
    const errors: Record<string, string> = {}
    if (!body.title || !body.title.trim()) errors.title = 'Title is required.'
    if (!body.content || !body.content.trim()) errors.content = 'Content is required.'
    if (!body.category_id) errors.category_id = 'Category is required.'

    if (Object.keys(errors).length > 0) {
      return MantiqResponse.json({ message: 'Validation failed.', errors }, 422)
    }

    // Validate category exists
    if (body.category_id) {
      const category = await Category.find(Number(body.category_id))
      if (!category) {
        return MantiqResponse.json({
          message: 'Validation failed.',
          errors: { category_id: 'Category not found.' },
        }, 422)
      }
    }

    // Generate unique slug
    let slug = slugify(body.title!)
    const existingSlug = await Post.where('slug', slug).first()
    if (existingSlug) {
      slug = `${slug}-${Date.now()}`
    }

    const post = await Post.create({
      title: body.title!.trim(),
      slug,
      excerpt: body.excerpt?.trim() || null,
      content: body.content!.trim(),
      user_id: user.getAuthIdentifier(),
      category_id: body.category_id,
      status: body.status ?? 'draft',
      featured_image: body.featured_image?.trim() || null,
    })

    // Attach tags
    if (body.tags && Array.isArray(body.tags)) {
      const postId = post.getAttribute('id') as number
      for (const tagId of body.tags) {
        const tag = await Tag.find(Number(tagId))
        if (tag) {
          await PostTag.create({ post_id: postId, tag_id: Number(tagId) })
        }
      }
    }

    return MantiqResponse.json({ message: 'Post created.', data: post.toObject() }, 201)
  }

  /**
   * Update a post (auth required, must be author).
   */
  async update(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user()
    if (!user) return MantiqResponse.json({ message: 'Unauthenticated.' }, 401)

    const id = request.param('id')
    const post = await Post.find(Number(id))
    if (!post) return MantiqResponse.json({ message: 'Post not found.' }, 404)

    // Authorization: must be the author
    const postUserId = post.getAttribute('user_id') as number
    if (postUserId !== user.getAuthIdentifier()) {
      return MantiqResponse.json({ message: 'You are not authorized to update this post.' }, 403)
    }

    const body = await request.input() as {
      title?: string
      content?: string
      excerpt?: string
      category_id?: number
      status?: string
      featured_image?: string
      tags?: number[]
    }

    // Update fields
    if (body.title !== undefined) {
      post.setAttribute('title', body.title.trim())
      const newSlug = slugify(body.title)
      const existingSlug = await Post.where('slug', newSlug).first()
      if (!existingSlug || (existingSlug.getAttribute('id') as number) === Number(id)) {
        post.setAttribute('slug', newSlug)
      }
    }
    if (body.content !== undefined) post.setAttribute('content', body.content.trim())
    if (body.excerpt !== undefined) post.setAttribute('excerpt', body.excerpt?.trim() || null)
    if (body.category_id !== undefined) {
      if (body.category_id !== null) {
        const category = await Category.find(Number(body.category_id))
        if (!category) {
          return MantiqResponse.json({
            message: 'Validation failed.',
            errors: { category_id: 'Category not found.' },
          }, 422)
        }
      }
      post.setAttribute('category_id', body.category_id)
    }
    if (body.status !== undefined) post.setAttribute('status', body.status)
    if (body.featured_image !== undefined) post.setAttribute('featured_image', body.featured_image?.trim() || null)

    await post.save()

    // Update tags if provided
    if (body.tags !== undefined && Array.isArray(body.tags)) {
      // Remove existing tags
      const existingPts = await PostTag.where('post_id', Number(id)).get() as any[]
      for (const pt of existingPts) {
        await pt.delete()
      }
      // Add new tags
      for (const tagId of body.tags) {
        const tag = await Tag.find(Number(tagId))
        if (tag) {
          await PostTag.create({ post_id: Number(id), tag_id: Number(tagId) })
        }
      }
    }

    return MantiqResponse.json({ message: 'Post updated.', data: post.toObject() })
  }

  /**
   * Delete a post (auth required, must be author).
   */
  async destroy(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user()
    if (!user) return MantiqResponse.json({ message: 'Unauthenticated.' }, 401)

    const id = request.param('id')
    const post = await Post.find(Number(id))
    if (!post) return MantiqResponse.json({ message: 'Post not found.' }, 404)

    const postUserId = post.getAttribute('user_id') as number
    if (postUserId !== user.getAuthIdentifier()) {
      return MantiqResponse.json({ message: 'You are not authorized to delete this post.' }, 403)
    }

    // Delete associated post_tags
    const postTags = await PostTag.where('post_id', Number(id)).get() as any[]
    for (const pt of postTags) {
      await pt.delete()
    }

    // Delete associated comments
    const comments = await Comment.where('post_id', Number(id)).get() as any[]
    for (const c of comments) {
      await c.delete()
    }

    await post.delete()
    return MantiqResponse.json({ message: 'Post deleted.' })
  }

  /**
   * Publish a post (auth required, must be author).
   */
  async publish(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user()
    if (!user) return MantiqResponse.json({ message: 'Unauthenticated.' }, 401)

    const id = request.param('id')
    const post = await Post.find(Number(id))
    if (!post) return MantiqResponse.json({ message: 'Post not found.' }, 404)

    const postUserId = post.getAttribute('user_id') as number
    if (postUserId !== user.getAuthIdentifier()) {
      return MantiqResponse.json({ message: 'You are not authorized to publish this post.' }, 403)
    }

    post.setAttribute('status', 'published')
    post.setAttribute('published_at', new Date().toISOString())
    await post.save()

    return MantiqResponse.json({ message: 'Post published.', data: post.toObject() })
  }

  /**
   * Get a post by slug.
   */
  async bySlug(request: MantiqRequest): Promise<Response> {
    const slug = request.param('slug')
    const post = await Post.where('slug', slug).first()

    if (!post) {
      return MantiqResponse.json({ message: 'Post not found.' }, 404)
    }

    const obj = post.toObject()

    // Author
    const authorId = post.getAttribute('user_id')
    if (authorId) {
      const author = await User.find(Number(authorId))
      if (author) {
        obj.author = { id: author.getAttribute('id'), name: author.getAttribute('name'), email: author.getAttribute('email') }
      }
    }

    // Category
    const catId = post.getAttribute('category_id')
    if (catId) {
      const category = await Category.find(Number(catId))
      if (category) {
        obj.category = category.toObject()
      }
    }

    // Tags
    const postId = post.getAttribute('id') as number
    const postTags = await PostTag.where('post_id', postId).get() as any[]
    const tagList: any[] = []
    for (const pt of postTags) {
      const t = await Tag.find(pt.getAttribute('tag_id') as number)
      if (t) tagList.push({ id: t.getAttribute('id'), name: t.getAttribute('name'), slug: t.getAttribute('slug') })
    }
    obj.tags = tagList

    // Comments
    const comments = await Comment.where('post_id', postId)
      .where('status', 'approved')
      .orderBy('created_at', 'asc')
      .get() as any[]

    obj.comments = await Promise.all(
      comments.map(async (comment: any) => {
        const cObj = comment.toObject()
        const commentUserId = comment.getAttribute('user_id')
        if (commentUserId) {
          const commentAuthor = await User.find(Number(commentUserId))
          if (commentAuthor) {
            cObj.author = { id: commentAuthor.getAttribute('id'), name: commentAuthor.getAttribute('name') }
          }
        }
        return cObj
      }),
    )

    return MantiqResponse.json({ data: obj })
  }
}
