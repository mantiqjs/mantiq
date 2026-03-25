import type { MantiqRequest } from '@mantiq/core'
import { MantiqResponse } from '@mantiq/core'
import { auth } from '@mantiq/auth'
import { Comment } from '../../Models/Comment.ts'
import { Post } from '../../Models/Post.ts'
import { User } from '../../Models/User.ts'

export class CommentController {
  /**
   * List comments for a post with author info.
   */
  async index(request: MantiqRequest): Promise<Response> {
    const postId = request.param('postId')

    // Verify post exists
    const post = await Post.find(Number(postId))
    if (!post) {
      return MantiqResponse.json({ message: 'Post not found.' }, 404)
    }

    const page = Math.max(1, Number(request.query('page') ?? 1))
    const perPage = Math.min(100, Math.max(1, Number(request.query('per_page') ?? 20)))

    const total = await Comment.where('post_id', Number(postId))
      .where('status', 'approved')
      .count() as number

    const comments = await Comment.where('post_id', Number(postId))
      .where('status', 'approved')
      .orderBy('created_at', 'asc')
      .limit(perPage)
      .offset((page - 1) * perPage)
      .get() as any[]

    const data = await Promise.all(
      comments.map(async (comment: any) => {
        const obj = comment.toObject()
        const userId = comment.getAttribute('user_id')
        if (userId) {
          const author = await User.find(Number(userId))
          if (author) {
            obj.author = { id: author.getAttribute('id'), name: author.getAttribute('name') }
          }
        }
        return obj
      }),
    )

    return MantiqResponse.json({
      data,
      meta: {
        total,
        page,
        per_page: perPage,
        last_page: Math.max(1, Math.ceil(total / perPage)),
      },
    })
  }

  /**
   * Add a comment to a post (auth required).
   */
  async store(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user()
    if (!user) return MantiqResponse.json({ message: 'Unauthenticated.' }, 401)

    const postId = request.param('postId')

    // Verify post exists
    const post = await Post.find(Number(postId))
    if (!post) {
      return MantiqResponse.json({ message: 'Post not found.' }, 404)
    }

    const body = await request.input() as {
      body?: string
      parent_id?: number
    }

    // ── Validation ──────────────────────────────────────────────────────────
    if (!body.body || !body.body.trim()) {
      return MantiqResponse.json({
        message: 'Validation failed.',
        errors: { body: 'Comment body is required.' },
      }, 422)
    }

    // Validate parent comment exists if specified
    if (body.parent_id) {
      const parentComment = await Comment.find(Number(body.parent_id))
      if (!parentComment) {
        return MantiqResponse.json({
          message: 'Validation failed.',
          errors: { parent_id: 'Parent comment not found.' },
        }, 422)
      }
      // Ensure parent comment belongs to the same post
      const parentPostId = parentComment.getAttribute('post_id') as number
      if (parentPostId !== Number(postId)) {
        return MantiqResponse.json({
          message: 'Validation failed.',
          errors: { parent_id: 'Parent comment does not belong to this post.' },
        }, 422)
      }
    }

    const comment = await Comment.create({
      body: body.body.trim(),
      post_id: Number(postId),
      user_id: user.getAuthIdentifier(),
      parent_id: body.parent_id ?? null,
      status: 'approved',
    })

    const obj = comment.toObject()
    obj.author = { id: user.getAuthIdentifier(), name: (user as any).getAttribute?.('name') ?? null }

    return MantiqResponse.json({ message: 'Comment added.', data: obj }, 201)
  }

  /**
   * Update a comment (auth required, must be author).
   */
  async update(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user()
    if (!user) return MantiqResponse.json({ message: 'Unauthenticated.' }, 401)

    const id = request.param('id')
    const comment = await Comment.find(Number(id))
    if (!comment) return MantiqResponse.json({ message: 'Comment not found.' }, 404)

    const commentUserId = comment.getAttribute('user_id') as number
    if (commentUserId !== user.getAuthIdentifier()) {
      return MantiqResponse.json({ message: 'You are not authorized to update this comment.' }, 403)
    }

    const body = await request.input() as { body?: string }

    if (!body.body || !body.body.trim()) {
      return MantiqResponse.json({
        message: 'Validation failed.',
        errors: { body: 'Comment body is required.' },
      }, 422)
    }

    comment.setAttribute('body', body.body.trim())
    await comment.save()

    return MantiqResponse.json({ message: 'Comment updated.', data: comment.toObject() })
  }

  /**
   * Delete a comment (auth required, must be author).
   */
  async destroy(request: MantiqRequest): Promise<Response> {
    const manager = auth()
    manager.setRequest(request)
    const user = await manager.user()
    if (!user) return MantiqResponse.json({ message: 'Unauthenticated.' }, 401)

    const id = request.param('id')
    const comment = await Comment.find(Number(id))
    if (!comment) return MantiqResponse.json({ message: 'Comment not found.' }, 404)

    const commentUserId = comment.getAttribute('user_id') as number
    if (commentUserId !== user.getAuthIdentifier()) {
      return MantiqResponse.json({ message: 'You are not authorized to delete this comment.' }, 403)
    }

    await comment.delete()
    return MantiqResponse.json({ message: 'Comment deleted.' })
  }
}
