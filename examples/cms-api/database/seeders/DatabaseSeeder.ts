import { Seeder } from '@mantiq/database'
import { HashManager } from '@mantiq/core'
import { User } from '../../app/Models/User.ts'
import { ContentType } from '../../app/Models/ContentType.ts'
import { Entry } from '../../app/Models/Entry.ts'
import { Revision } from '../../app/Models/Revision.ts'
import { Taxonomy } from '../../app/Models/Taxonomy.ts'
import { EntryTaxonomy } from '../../app/Models/EntryTaxonomy.ts'

export default class DatabaseSeeder extends Seeder {
  override async run() {
    const existing = await User.where('email', 'admin@example.com').first()
    if (existing) return

    const hasher = new HashManager({ bcrypt: { rounds: 10 } })
    const hashed = await hasher.make('password')

    // ── Users ──
    const admin = await User.create({ name: 'Admin', email: 'admin@example.com', password: hashed, role: 'admin' })
    const editor = await User.create({ name: 'Editor', email: 'editor@example.com', password: hashed, role: 'editor' })
    const author = await User.create({ name: 'Author', email: 'author@example.com', password: hashed, role: 'author' })

    const adminId = admin.getAttribute('id') as number
    const editorId = editor.getAttribute('id') as number
    const authorId = author.getAttribute('id') as number

    // ── Content Types ──
    const pageSchema = JSON.stringify([
      { name: 'body', type: 'richtext', required: true },
      { name: 'meta_title', type: 'string', required: false },
      { name: 'meta_description', type: 'string', required: false },
      { name: 'featured_image', type: 'media', required: false },
    ])

    const blogSchema = JSON.stringify([
      { name: 'body', type: 'richtext', required: true },
      { name: 'excerpt', type: 'text', required: true },
      { name: 'featured_image', type: 'media', required: false },
      { name: 'author_bio', type: 'text', required: false },
      { name: 'read_time', type: 'number', required: false },
    ])

    const faqSchema = JSON.stringify([
      { name: 'question', type: 'string', required: true },
      { name: 'answer', type: 'richtext', required: true },
      { name: 'category', type: 'string', required: false },
      { name: 'order', type: 'number', required: false },
    ])

    const pageCT = await ContentType.create({ name: 'Page', slug: 'page', description: 'Static pages for the website', fields_schema: pageSchema, icon: 'file-text' })
    const blogCT = await ContentType.create({ name: 'Blog Post', slug: 'blog-post', description: 'Blog articles and news', fields_schema: blogSchema, icon: 'edit' })
    const faqCT = await ContentType.create({ name: 'FAQ', slug: 'faq', description: 'Frequently asked questions', fields_schema: faqSchema, icon: 'help-circle' })

    const pageCtId = pageCT.getAttribute('id') as number
    const blogCtId = blogCT.getAttribute('id') as number
    const faqCtId = faqCT.getAttribute('id') as number

    // ── Entries ──
    const now = new Date().toISOString()

    const entries = [
      // Pages
      {
        content_type_id: pageCtId, title: 'Home', slug: 'home',
        data: JSON.stringify({ body: '<h1>Welcome</h1><p>Welcome to our website.</p>', meta_title: 'Home | Our Site', meta_description: 'Welcome to our website' }),
        status: 'published', author_id: adminId, published_at: now, version: 1, locale: 'en',
      },
      {
        content_type_id: pageCtId, title: 'About Us', slug: 'about-us',
        data: JSON.stringify({ body: '<h1>About Us</h1><p>We are a passionate team building great software.</p>', meta_title: 'About Us', meta_description: 'Learn more about our team' }),
        status: 'published', author_id: adminId, published_at: now, version: 1, locale: 'en',
      },
      {
        content_type_id: pageCtId, title: 'Contact', slug: 'contact',
        data: JSON.stringify({ body: '<h1>Contact</h1><p>Reach out to us at hello@example.com</p>' }),
        status: 'draft', author_id: editorId, published_at: null, version: 1, locale: 'en',
      },
      // Blog Posts
      {
        content_type_id: blogCtId, title: 'Getting Started with Headless CMS', slug: 'getting-started-headless-cms',
        data: JSON.stringify({ body: '<p>Headless CMS architecture separates content management from presentation...</p>', excerpt: 'Learn the basics of headless CMS and why it matters.', read_time: 5 }),
        status: 'published', author_id: authorId, published_at: now, version: 2, locale: 'en',
      },
      {
        content_type_id: blogCtId, title: 'API-First Content Strategy', slug: 'api-first-content-strategy',
        data: JSON.stringify({ body: '<p>An API-first approach puts your content API at the center of your architecture...</p>', excerpt: 'How to design content with API consumers in mind.', read_time: 8 }),
        status: 'published', author_id: editorId, published_at: now, version: 1, locale: 'en',
      },
      {
        content_type_id: blogCtId, title: 'Content Modeling Best Practices', slug: 'content-modeling-best-practices',
        data: JSON.stringify({ body: '<p>Good content modeling is the foundation of a scalable CMS...</p>', excerpt: 'Tips for structuring your content types effectively.', read_time: 6 }),
        status: 'draft', author_id: authorId, published_at: null, version: 1, locale: 'en',
      },
      {
        content_type_id: blogCtId, title: 'Multi-Language Content Delivery', slug: 'multi-language-content-delivery',
        data: JSON.stringify({ body: '<p>Supporting multiple languages requires careful planning...</p>', excerpt: 'Strategies for delivering localized content via API.', read_time: 7 }),
        status: 'published', author_id: editorId, published_at: now, version: 1, locale: 'en',
      },
      // FAQs
      {
        content_type_id: faqCtId, title: 'What is a headless CMS?', slug: 'what-is-headless-cms',
        data: JSON.stringify({ question: 'What is a headless CMS?', answer: '<p>A headless CMS is a content management system that provides content via API without a built-in frontend.</p>', category: 'General', order: 1 }),
        status: 'published', author_id: adminId, published_at: now, version: 1, locale: 'en',
      },
      {
        content_type_id: faqCtId, title: 'How do I create content?', slug: 'how-to-create-content',
        data: JSON.stringify({ question: 'How do I create content?', answer: '<p>Use the API to create entries by specifying a content type and providing the required fields.</p>', category: 'Usage', order: 2 }),
        status: 'published', author_id: adminId, published_at: now, version: 1, locale: 'en',
      },
      {
        content_type_id: faqCtId, title: 'Can I use custom fields?', slug: 'can-i-use-custom-fields',
        data: JSON.stringify({ question: 'Can I use custom fields?', answer: '<p>Yes! Define your field schema when creating a content type and all entries will validate against it.</p>', category: 'Usage', order: 3 }),
        status: 'published', author_id: adminId, published_at: now, version: 1, locale: 'en',
      },
    ]

    const entryRecords: any[] = []
    for (const e of entries) {
      entryRecords.push(await Entry.create(e))
    }

    // ── Revisions (5 revisions for various entries) ──
    await Revision.create({
      entry_id: entryRecords[3]!.getAttribute('id') as number, version: 1,
      data: JSON.stringify({ body: '<p>Draft version of headless CMS article...</p>', excerpt: 'Initial draft.', read_time: 3 }),
      title: 'Getting Started with Headless CMS', status: 'draft', changed_by: authorId,
      change_summary: 'Initial draft',
    })
    await Revision.create({
      entry_id: entryRecords[0]!.getAttribute('id') as number, version: 1,
      data: JSON.stringify({ body: '<h1>Welcome</h1><p>First version of home page.</p>' }),
      title: 'Home', status: 'draft', changed_by: adminId,
      change_summary: 'Initial home page draft',
    })
    await Revision.create({
      entry_id: entryRecords[1]!.getAttribute('id') as number, version: 1,
      data: JSON.stringify({ body: '<h1>About</h1><p>Original about page text.</p>' }),
      title: 'About', status: 'draft', changed_by: adminId,
      change_summary: 'Renamed from About to About Us',
    })
    await Revision.create({
      entry_id: entryRecords[4]!.getAttribute('id') as number, version: 1,
      data: JSON.stringify({ body: '<p>Early draft of API-first article...</p>', excerpt: 'Draft excerpt.', read_time: 5 }),
      title: 'API-First Content Strategy', status: 'draft', changed_by: editorId,
      change_summary: 'Expanded content and revised read time',
    })
    await Revision.create({
      entry_id: entryRecords[7]!.getAttribute('id') as number, version: 1,
      data: JSON.stringify({ question: 'What is a headless CMS?', answer: '<p>A headless CMS manages content without a frontend.</p>', category: 'General', order: 1 }),
      title: 'What is a headless CMS?', status: 'draft', changed_by: adminId,
      change_summary: 'Improved answer with more detail',
    })

    // ── Taxonomies ──
    const cat1 = await Taxonomy.create({ name: 'Technology', slug: 'technology', type: 'category', description: 'Technology-related content', parent_id: null })
    const cat2 = await Taxonomy.create({ name: 'Tutorials', slug: 'tutorials', type: 'category', description: 'Step-by-step guides', parent_id: null })
    const cat3 = await Taxonomy.create({ name: 'Architecture', slug: 'architecture', type: 'category', description: 'Software architecture topics', parent_id: null })
    const tag1 = await Taxonomy.create({ name: 'API', slug: 'api', type: 'tag', description: null, parent_id: null })
    const tag2 = await Taxonomy.create({ name: 'CMS', slug: 'cms', type: 'tag', description: null, parent_id: null })
    const tag3 = await Taxonomy.create({ name: 'Best Practices', slug: 'best-practices', type: 'tag', description: null, parent_id: null })

    // ── Entry-Taxonomy Relationships ──
    // Blog post 1 (Getting Started): Technology, Tutorials, CMS
    const blogEntry1Id = entryRecords[3]!.getAttribute('id') as number
    await EntryTaxonomy.create({ entry_id: blogEntry1Id, taxonomy_id: cat1.getAttribute('id') as number })
    await EntryTaxonomy.create({ entry_id: blogEntry1Id, taxonomy_id: cat2.getAttribute('id') as number })
    await EntryTaxonomy.create({ entry_id: blogEntry1Id, taxonomy_id: tag2.getAttribute('id') as number })

    // Blog post 2 (API-First): Architecture, API, Best Practices
    const blogEntry2Id = entryRecords[4]!.getAttribute('id') as number
    await EntryTaxonomy.create({ entry_id: blogEntry2Id, taxonomy_id: cat3.getAttribute('id') as number })
    await EntryTaxonomy.create({ entry_id: blogEntry2Id, taxonomy_id: tag1.getAttribute('id') as number })
    await EntryTaxonomy.create({ entry_id: blogEntry2Id, taxonomy_id: tag3.getAttribute('id') as number })

    // Blog post 3 (Content Modeling): Architecture, CMS, Best Practices
    const blogEntry3Id = entryRecords[5]!.getAttribute('id') as number
    await EntryTaxonomy.create({ entry_id: blogEntry3Id, taxonomy_id: cat3.getAttribute('id') as number })
    await EntryTaxonomy.create({ entry_id: blogEntry3Id, taxonomy_id: tag2.getAttribute('id') as number })
    await EntryTaxonomy.create({ entry_id: blogEntry3Id, taxonomy_id: tag3.getAttribute('id') as number })

    // Blog post 4 (Multi-Language): Technology, API
    const blogEntry4Id = entryRecords[6]!.getAttribute('id') as number
    await EntryTaxonomy.create({ entry_id: blogEntry4Id, taxonomy_id: cat1.getAttribute('id') as number })
    await EntryTaxonomy.create({ entry_id: blogEntry4Id, taxonomy_id: tag1.getAttribute('id') as number })
  }
}
