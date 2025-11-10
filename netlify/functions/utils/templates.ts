import { promises as fs } from 'node:fs';
import path from 'node:path';

export const TEMPLATE_DIR = path.join(process.cwd(), 'email-templates');
export const MUSTACHE_EXTENSION = '.mustache';
export const SKIP_PREFIX = 'skip-';

export type TemplateConfig = {
  copyHtmlButton?: boolean;
  [key: string]: unknown;
};

export type TemplateContent = {
  content: string;
  config: TemplateConfig;
};

const CONFIG_PATTERN = /^\s*\{\{!\s*config\s+(.+?)\s*\}\}\s*/i;

const sanitizeSlug = (slug: string): string => {
  if (!slug || slug.includes('\0') || slug.includes('/') || slug.includes('\\') || slug.includes('..')) {
    throw new Error('Invalid template slug');
  }
  return slug;
};

const parseTemplateMetadata = (raw: string): TemplateContent => {
  const match = raw.match(CONFIG_PATTERN);
  if (!match) {
    return { content: raw, config: {} };
  }

  const [, jsonPayload] = match;
  let config: TemplateConfig = {};
  try {
    config = JSON.parse(jsonPayload) as TemplateConfig;
  } catch (error) {
    console.warn('Failed to parse template config metadata:', error);
    config = {};
  }

  const content = raw.slice(match[0].length);
  return { content, config };
};

export const formatDisplayName = (input: string): string => {
  const baseName = input.replace(/\.[^/.]+$/, '');

  if (baseName.includes('-') || baseName.includes('_')) {
    return baseName
      .split(/[-_]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }

  if (/[a-z][A-Z]/.test(baseName)) {
    return baseName
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .split(' ')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  return baseName;
};

export const listTemplates = async () => {
  const entries = await fs.readdir(TEMPLATE_DIR, { withFileTypes: true });

  return entries
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith(MUSTACHE_EXTENSION) &&
        !entry.name.toLowerCase().startsWith(SKIP_PREFIX),
    )
    .map((entry) => {
      const slug = entry.name.slice(0, -MUSTACHE_EXTENSION.length);
      return {
        slug,
        fileName: entry.name,
        displayName: formatDisplayName(entry.name),
      };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
};

export const readTemplateContent = async (slug: string): Promise<TemplateContent> => {
  const safeSlug = sanitizeSlug(slug);
  const templatePath = path.join(TEMPLATE_DIR, `${safeSlug}${MUSTACHE_EXTENSION}`);
  const raw = await fs.readFile(templatePath, 'utf-8');
  return parseTemplateMetadata(raw);
};

