import { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';

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
  image,
  url,
  type = "website",
  alternateLanguageUrls,
  children
}: SEOProps) {
  useEffect(() => {
    // 1. Title
    document.title = title;

    // 2. Meta description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', description);

    // 3. Canonical Link
    const currentUrl = url || window.location.href;
    let linkCanonical = document.querySelector('link[rel="canonical"]');
    if (!linkCanonical) {
      linkCanonical = document.createElement('link');
      linkCanonical.setAttribute('rel', 'canonical');
      document.head.appendChild(linkCanonical);
    }
    linkCanonical.setAttribute('href', currentUrl);

    // 4. Open Graph Tags
    const absoluteImage = image 
      ? (image.startsWith('/') ? `${window.location.origin}${image}` : image)
      : `${window.location.origin}/og-image.png`;

    const ogTags = [
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:url', content: currentUrl },
      { property: 'og:type', content: type },
      { property: 'og:site_name', content: 'Log40' },
    ];
    
    // Clean up old og:image to avoid duplicates
    const oldOgImg = document.querySelector('meta[property="og:image"]');
    if (oldOgImg) oldOgImg.remove();
    
    ogTags.push({ property: 'og:image', content: absoluteImage });

    ogTags.forEach(({ property, content }) => {
      let tag = document.querySelector(`meta[property="${property}"]`);
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('property', property);
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', content);
    });

    // 5. Twitter Card Tags
    const twitterTags = [
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
    ];

    const oldTwitterImg = document.querySelector('meta[name="twitter:image"]');
    if (oldTwitterImg) oldTwitterImg.remove();

    twitterTags.push({ name: 'twitter:image', content: absoluteImage });

    twitterTags.forEach(({ name, content }) => {
      let tag = document.querySelector(`meta[name="${name}"]`);
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('name', name);
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', content);
    });

    // 6. Language Alternate Links
    const existingAlternates = document.querySelectorAll('link[rel="alternate"][hreflang]');
    existingAlternates.forEach(el => el.remove());

    if (alternateLanguageUrls) {
      alternateLanguageUrls.forEach(({ lang, url }) => {
        const linkAlt = document.createElement('link');
        linkAlt.setAttribute('rel', 'alternate');
        linkAlt.setAttribute('hreflang', lang);
        linkAlt.setAttribute('href', url);
        document.head.appendChild(linkAlt);
      });
    }
  }, [title, description, image, url, type, alternateLanguageUrls]);

  // Portals any children (like JSON-LD scripts) directly to document.head
  if (children) {
    return createPortal(children, document.head);
  }

  return null;
}
