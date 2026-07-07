import { Client } from '@notionhq/client';
import { NotionToMarkdown } from 'notion-to-md';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const token = process.env.NOTION_TOKEN;
const databaseId = process.env.NOTION_DATABASE_ID;
const outputDir = path.join(process.cwd(), 'src', 'content', 'posts', 'notion');

if (!token) {
  throw new Error('Missing NOTION_TOKEN. Add it to your environment or GitHub Actions Secrets.');
}

if (!databaseId) {
  throw new Error('Missing NOTION_DATABASE_ID. Add it to your environment or GitHub Actions Secrets.');
}

const notion = new Client({ auth: token });
const notionToMarkdown = new NotionToMarkdown({ notionClient: notion });

function getProperty(page, name) {
  return page.properties?.[name];
}

function firstTextValue(page, names) {
  for (const name of names) {
    const value = textValue(getProperty(page, name));

    if (value) return value;
  }

  return '';
}

function textValue(property) {
  if (!property) return '';

  if (property.type === 'title') {
    return property.title.map((item) => item.plain_text).join('').trim();
  }

  if (property.type === 'rich_text') {
    return property.rich_text.map((item) => item.plain_text).join('').trim();
  }

  if (property.type === 'select') {
    return property.select?.name ?? '';
  }

  if (property.type === 'url') {
    return property.url ?? '';
  }

  if (property.type === 'date') {
    return property.date?.start ?? '';
  }

  return '';
}

function checkboxValue(property) {
  return property?.type === 'checkbox' ? property.checkbox : false;
}

function multiSelectValue(property) {
  if (property?.type !== 'multi_select') return [];
  return property.multi_select.map((item) => item.name);
}

function notionCoverUrl(page) {
  if (page.cover?.type === 'external') {
    return page.cover.external?.url ?? '';
  }

  if (page.cover?.type === 'file') {
    return page.cover.file?.url ?? '';
  }

  return '';
}

function slugify(value, fallback) {
  const slug = value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);

  return slug || fallback;
}

function dateOnly(value) {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.valueOf())) {
    return new Date().toISOString().slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
}

function yamlString(value) {
  return JSON.stringify(value ?? '');
}

function yamlArray(values) {
  return `[${values.map((value) => yamlString(value)).join(', ')}]`;
}

function frontmatterFor(post) {
  return [
    '---',
    `title: ${yamlString(post.title)}`,
    `slug: ${yamlString(post.slug)}`,
    `published: ${post.published}`,
    `description: ${yamlString(post.description)}`,
    `image: ${yamlString(post.image)}`,
    `tags: ${yamlArray(post.tags)}`,
    `category: ${yamlString(post.category)}`,
    'draft: false',
    `lang: ${yamlString(post.lang)}`,
    `pinned: ${post.pinned}`,
    `comment: ${post.comment}`,
    '---'
  ].join('\n');
}

async function queryAllPages() {
  const pages = [];
  let startCursor;

  do {
    const response = await notion.databases.query({
      database_id: databaseId,
      start_cursor: startCursor
    });

    pages.push(...response.results);
    startCursor = response.has_more ? response.next_cursor : undefined;
  } while (startCursor);

  return pages;
}

async function pageToPost(page) {
  const title = textValue(getProperty(page, 'Title')) || 'Untitled';
  const rawSlug = textValue(getProperty(page, 'Slug'));
  const fallbackSlug = `post-${page.id.replace(/-/g, '').slice(0, 10)}`;
  const slug = slugify(rawSlug || title, fallbackSlug);
  const published = dateOnly(firstTextValue(page, ['Published', 'Publish date']));
  const description = textValue(getProperty(page, 'Description'));
  const tags = multiSelectValue(getProperty(page, 'Tags'));
  const category = textValue(getProperty(page, 'Category')) || tags[0] || 'Notes';
  const image = textValue(getProperty(page, 'Image')) || notionCoverUrl(page);

  const blocks = await notionToMarkdown.pageToMarkdown(page.id);
  const markdownResult = notionToMarkdown.toMarkdownString(blocks);

  const markdown =
    typeof markdownResult === 'string'
      ? markdownResult.trim()
      : (markdownResult.parent ?? '').trim();

  return {
    title,
    slug,
    published,
    description,
    image,
    tags,
    category,
    draft: false,
    lang: 'en',
    pinned: false,
    comment: true,
    markdown
  };
}

async function main() {
  const pages = await queryAllPages();
  const publishedPages = pages.filter((page) => !checkboxValue(getProperty(page, 'Draft')));

  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  for (const page of publishedPages) {
    const post = await pageToPost(page);
    const filePath = path.join(outputDir, `${post.slug}.md`);
    const body = [frontmatterFor(post), '', post.markdown || '_No content yet._', ''].join('\n');

    await writeFile(filePath, body, 'utf8');
    console.log(`Synced Notion post: ${post.slug}`);
  }

  console.log(`Synced ${publishedPages.length} published Notion post(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
