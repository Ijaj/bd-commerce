/** Structured data. `<` is escaped so a title containing "</script>" cannot break out. */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON.stringify output with < escaped
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
