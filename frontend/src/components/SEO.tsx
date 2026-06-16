import { ReactNode } from 'react';

interface SEOProps {
  title: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
  alternateLanguageUrls?: { lang: string; url: string }[];
  children?: ReactNode;
}

export function SEO({
  title,
  description = "A personal blog sharing insights on software engineering, web development, and technology.",
  image, // We can set a default site-wide thumbnail here if one exists
  url,
  type = "website",
  alternateLanguageUrls,
  children
}: SEOProps) {
  const currentUrl = url || (typeof window !== 'undefined' ? window.location.href : '');
  
  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={currentUrl} />
      {alternateLanguageUrls?.map(({ lang, url }) => (
        <link key={lang} rel="alternate" hrefLang={lang} href={url} />
      ))}
      
      {/* Open Graph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      {image && <meta property="og:image" content={image} />}
      <meta property="og:url" content={currentUrl} />
      <meta property="og:type" content={type} />
      
      {/* Twitter */}
      <meta name="twitter:card" content={image ? "summary_large_image" : "summary"} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {image && <meta name="twitter:image" content={image} />}

      {children}
    </>
  );
}
