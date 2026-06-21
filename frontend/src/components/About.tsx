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
            "name": "Toghrol",
            "url": "https://github.com/toghrol",
            "sameAs": [
              "https://github.com/toghrol",
              "https://www.linkedin.com/in/toghrol/"
            ],
            "jobTitle": "Systems & Rust Software Engineer",
            "description": description,
            "image": `${window.location.origin}/favicon.png`
          })}
        </script>
      </SEO>

      <div className="flex flex-col md:flex-row items-center gap-6 mb-8 border-b border-gb-bg-soft pb-6">
        <img 
          src="/favicon.png" 
          alt="Toghrol - Systems & Rust Software Engineer" 
          className="w-24 h-24 rounded-full border-2 border-gb-orange-light bg-gb-bg-dark"
        />
        <div>
          <h1 className="text-3xl font-bold text-gb-fg">
            {language === "fa" ? "درباره من" : "About Me"}
          </h1>
          <p className="text-gb-fg-dark text-sm mt-1">
            {language === "fa" ? "مهندس نرم‌افزار و سیستم‌ها" : "Systems & Rust Software Engineer"}
          </p>
        </div>
      </div>

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
            href="https://github.com/toghrol"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gb-aqua-light hover:underline"
          >
            GitHub
          </a>
          <a
            href="https://www.linkedin.com/in/toghrol/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gb-aqua-light hover:underline"
          >
            LinkedIn
          </a>
        </div>
      </div>
    </div>
  );
}
