import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';

export type PostEntry = CollectionEntry<'posts'>;

export async function getPublishedPosts() {
  const posts = await getCollection('posts', ({ data }) => data.draft !== true);

  return posts.sort((a, b) => {
    return b.data.published.valueOf() - a.data.published.valueOf();
  });
}

export function getPostSlug(post: PostEntry) {
  const explicitSlug = post.data.slug?.trim();

  if (explicitSlug) {
    return explicitSlug.replace(/^\/+|\/+$/g, '');
  }

  return post.id
    .replace(/\.(md|mdx)$/i, '')
    .split('/')
    .filter(Boolean)
    .pop() ?? post.id;
}

export function getPostUrl(post: PostEntry) {
  return `/posts/${getPostSlug(post)}/`;
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
}
