import { SEO } from "./SEO";
import { useLanguage } from "../contexts/LanguageContext";

export function About() {
  const { language } = useLanguage();

  const title = language === "fa" ? "درباره من | Log40" : "About Me | Log40";
  const description =
    language === "fa"
      ? "بیوگرافی و مهارت‌های طغرل، مهندس سیستم و توسعه‌دهنده راست."
      : "Biography and skills of Toghrol, systems engineer and Rust developer.";

  const url = `${window.location.origin}${language === "fa" ? "/fa" : ""}/about`;

  return (
    <div
      className="animate-in fade-in duration-700 max-w-2xl mx-auto font-mono text-gb-fg"
      dir={language === "fa" ? "rtl" : "ltr"}
    >
      <SEO title={title} description={description} url={url}>
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Person",
            "@id": `${window.location.origin}/#person`,
            name: "Toghrol",
            url: "https://github.com/toghrol",
            sameAs: ["https://linkedin.com/in/toghrol"],
            jobTitle: "Systems & Rust Software Engineer",
            description: description,
          })}
        </script>
      </SEO>

      <h1 className="text-3xl font-bold mb-8 text-gb-fg border-b border-gb-bg-soft pb-4">
        {language === "fa" ? "درباره من" : "About Me"}
      </h1>

      <div className="space-y-6 leading-relaxed">
        <p>
          {language === "fa" ? (
            <>
              سلام! من <strong>طغرل</strong> هستم. دانشجوی مهندسی نرم‌افزار
              متمرکز بر سیستم‌های لینوکس، توسعه بک‌اند، و زبان برنامه‌نویسی راست
              (Rust).
            </>
          ) : (
            <>
              Hello! I'm <strong>Toghrol</strong>, a software engineer college
              student focused on Linux systems, backend development, and the
              Rust programming language.
            </>
          )}
        </p>

        <p>
          {language === "fa" ? (
            <>
              این وبلاگ رو برای اشتراک‌گذاری آموخته‌هام در دنیای لینوکس، توسعه
              ابزار‌های ترمینال و سیستم‌های بک‌‌‌اند High Performance راه‌اندازی
              کردم.
            </>
          ) : (
            <>
              I started this blog to share my learnings in the Linux world,
              building terminal tools, and high-performance backend systems.
            </>
          )}
        </p>

        <h2 className="text-xl font-bold text-gb-orange-light mt-8 mb-4">
          {language === "fa" ? "مهارت‌های اصلی" : "Core Skills"}
        </h2>
        <ul className="list-disc list-inside space-y-2 pl-4 rtl:pl-0 rtl:pr-4">
          <li>
            {language === "fa"
              ? "زبان برنامه‌نویسی راست (Rust)"
              : "Rust Programming Language"}
          </li>
          <li>
            {language === "fa"
              ? "سیستم‌های لینوکس و ابزارهای ترمینال"
              : "Linux Systems & Terminal Utilities"}
          </li>
          <li>
            {language === "fa"
              ? "توسعه بک‌اند و پایگاه‌داده (Axum, SQLite, PostgreSQL)"
              : "Backend & Database Development (Axum, SQLite, PostgreSQL)"}
          </li>
        </ul>

        <h2 className="text-xl font-bold text-gb-orange-light mt-8 mb-4">
          {language === "fa" ? "راه‌های ارتباطی" : "Links"}
        </h2>
        <div className="flex gap-4">
          <a
            href="https://github.com/toghroltp"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gb-aqua-light hover:underline"
          >
            GitHub
          </a>
        </div>
      </div>
    </div>
  );
}
