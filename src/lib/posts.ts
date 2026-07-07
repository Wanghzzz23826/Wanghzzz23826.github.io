import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';

export type PostEntry = CollectionEntry<'posts'>;

export interface TagStat {
  name: string;
  slug: string;
  count: number;
}

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

export function getTagSlug(tag: string) {
  const trimmed = tag.trim();
  const asciiSlug = trimmed
    .normalize('NFKD')
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return asciiSlug || encodeURIComponent(trimmed);
}

export function getTagUrl(tag: string) {
  return `/blog/tags/${getTagSlug(tag)}/`;
}

export function getTagStats(posts: PostEntry[]) {
  const counts = new Map<string, number>();

  for (const post of posts) {
    for (const tag of post.data.tags) {
      const normalizedTag = tag.trim();

      if (!normalizedTag) continue;

      counts.set(normalizedTag, (counts.get(normalizedTag) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([name, count]) => ({
      name,
      slug: getTagSlug(name),
      count
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function getPostsByTag(posts: PostEntry[], tag: string) {
  return posts.filter((post) => post.data.tags.some((postTag) => getTagSlug(postTag) === getTagSlug(tag)));
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
}
