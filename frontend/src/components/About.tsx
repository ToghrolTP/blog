import { SEO } from "./SEO";
import { useLanguage } from "../contexts/LanguageContext";

export function About() {
  const { language } = useLanguage();

  const title =
    language === "fa"
      ? "طغرل — مهندس سیستم و توسعه‌دهنده راست | Log40"
      : "Toghrol — Systems Engineer & Rust Developer | Log40";
  const description =
    language === "fa"
      ? "طغرل، توسعه‌دهنده راست و مهندس سیستم است که مقالات تخصصی درباره لینوکس، معماری سیستم و بک‌اند می‌نویسد. بیوگرافی و مهارت‌های او را اینجا بخوانید."
      : "Toghrol is a systems engineer & Rust developer writing deep-dive articles on Linux, backend architecture, and systems programming. Read my bio and skills.";

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
            url: "https://github.com/toghroltp",
            sameAs: ["https://github.com/toghroltp"],
            jobTitle: "Systems & Rust Software Engineer",
            description: description,
            image: `${window.location.origin}/avatar.png`,
            knowsAbout: [
              "Rust (Programming Language)",
              "Software Engineering",
              "Linux",
              "Backend Development",
              "Systems Programming",
            ],
          })}
        </script>
      </SEO>

      <div className="flex flex-col md:flex-row items-center gap-6 mb-8 border-b border-gb-bg-soft pb-6">
        <img
          src="/avatar.png"
          alt="Toghrol - Systems & Rust Software Engineer"
          className="w-24 h-24 rounded-full border-2 border-gb-orange-light bg-gb-bg-dark"
        />
        <div>
          <h1 className="text-3xl font-bold text-gb-fg">
            {language === "fa" ? "درباره من" : "About Me"}
          </h1>
          <p className="text-gb-fg-dark text-sm mt-1">
            {language === "fa" ? "توسعه‌دهنده راست" : "Rust Developer"}
          </p>
        </div>
      </div>

      {/* Summary Card / TL;DR */}
      <div className="p-4 mb-6 border border-gb-orange-light/30 bg-gb-bg-soft/10 rounded-md">
        <span className="text-xs font-bold text-gb-orange-light uppercase tracking-wider block mb-2">
          {language === "fa"
            ? "⚡ خلاصه در یک نگاه (TL;DR)"
            : "⚡ Quick Summary (TL;DR)"}
        </span>
        <p className="text-sm text-gb-fg-dark leading-relaxed">
          {language === "fa"
            ? "اسمم طغرله؛ توسعه‌دهنده راست (Rust) و عاشق لینوکس. در لاگ۴۰ (تلفظ: لاگ‌فورتی) مقالات فنی عمیق، انواع سیستم‌ها و ابزارهای کاربردی متن‌باز را با شما به اشتراک می‌گذارم."
            : "I'm Toghrol, a Rust developer and Linux enthusiast. At Log40, I share deep-dive technical articles, systems engineering insights, and useful open-source tools."}
        </p>
      </div>

      <div className="space-y-6 leading-relaxed">
        <p>
          {language === "fa" ? (
            <>
              سلام! من <strong>طغرل</strong> هستم؛ مهندس سیستم و توسعه‌دهنده
              راست (Rust). تخصص اصلی من توسعه سیستم‌های بک‌اند با پرفورمنس بالا،
              ابزارهای کاربردی سیستم‌عامل لینوکس و رابط‌های کاربری ترمینال (TUI)
              است.
            </>
          ) : (
            <>
              Hi! I'm <strong>Toghrol</strong>, a Rust developer specialized in
              building high-performance backend systems, low-level Linux
              utilities, and terminal user interfaces (TUIs).
            </>
          )}
        </p>

        <p>
          {language === "fa" ? (
            <>
              وبلاگ <strong>لاگ۴۰</strong> را به عنوان محلی برای مقالات تخصصی،
              تحلیل‌های عمیق مدیریت حافظه در راست و معماری سیستم‌ها راه‌اندازی
              کردم. هدفم اینه که با انتشار مقالات فنی و معرفی ابزارهای متن‌باز
              به بهبود روند توسعه شما کمک کنم.
              <br />
              این وبلاگ همچنان درحال توسعه است و پذیرای هرگونه بازخوردی از طرف
              شما (از طریق دکمه فیدبک پایین سمت راست) هستیم
            </>
          ) : (
            <>
              I started <strong>Log40</strong> to share deep dives into Rust
              memory management, systems architecture, and Linux internals. The
              goal is to optimize your engineering workflow by introducing
              open-source projects and technical articles.
              <br />
              The blog is still under development, and I highly appreciate your
              feedback via the dedicated feedback button.
            </>
          )}
        </p>

        <h2 className="text-xl font-bold text-gb-orange-light mt-8 mb-4">
          {language === "fa" ? "۱. مهارت‌های اصلی" : "1. Core Skills"}
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
          {language === "fa" ? "۲. راه‌های ارتباطی" : "2. Connect With Me"}
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
