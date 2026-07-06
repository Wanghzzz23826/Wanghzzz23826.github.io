import { defineCollection, z } from 'astro:content';

const posts = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    slug: z.string().optional(),
    published: z.coerce.date(),
    description: z.string().default(''),
    image: z.string().default(''),
    tags: z.array(z.string()).default([]),
    category: z.string().default('Notes'),
    draft: z.boolean().default(false),
    lang: z.string().default('en'),
    pinned: z.boolean().default(false),
    comment: z.boolean().default(true)
  })
});

export const collections = { posts };
