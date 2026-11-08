// Export-time presentation changes only. Preserve source attribution and stable
// application identifiers such as small-tales, table names and artwork paths.
export function neutralizePublicBranding(file, source) {
  if (!/^(?:app|components|lib|__tests__)\//.test(file)) return source;
  return source
    .replace(/\bSmall Tales(?: Books)?\b/gi, 'Storybook Starter')
    .replace(/https?:\/\/(?:www\.)?instagram\.com\/smalltalesbooks(?=[/?#"'`\s]|$)(?:[/?#][^"'`\s]*)?/gi, 'https://example.com/social/instagram')
    .replace(/https?:\/\/(?:www\.)?tiktok\.com\/@smalltalesbooks(?=[/?#"'`\s]|$)(?:[/?#][^"'`\s]*)?/gi, 'https://example.com/social/tiktok');
}
