import { SEO } from "./SEO";
import { useLanguage } from "../contexts/LanguageContext";

export function About() {
  const { language } = useLanguage();

  const title = language === "fa" ? "طغرل — مهندس سیستم و توسعه‌دهنده راست | Log40" : "Toghrol — Systems Engineer & Rust Developer | Log40";
  const description =
    language === "fa"
      ? "طغرل مهندس سیستم و توسعه‌دهنده راست است که مقالاتی عمیق درباره لینوکس، مهندسی بک‌اند و ابزارهای متن‌باز می‌نویسد. بیوگرافی و مهارت‌ها را بخوانید."
      : "Toghrol is a systems engineer and Rust developer writing in-depth guides on Linux, backend engineering, and open-source tooling. Explore my bio and skills.";

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
            "image": `${window.location.origin}/avatar.png`,
            "knowsAbout": ["Rust (Programming Language)", "Software Engineering", "Linux", "Backend Development"]
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
            {language === "fa" ? "مهندس نرم‌افزار و سیستم‌ها" : "Systems & Rust Software Engineer"}
          </p>
        </div>
      </div>

      <div className="space-y-6 leading-relaxed">
        <p>
          {language === "fa" ? (
            <>
              سلام! من <strong>طغرل</strong> هستم، مهندس سیستم و توسعه‌دهنده راست. تخصص من توسعه سیستم‌های بک‌اند با کارایی بالا، ابزارهای کم‌حجم سیستمی لینوکس و رابط‌های کاربری متنی ترمینال (TUI) است. در طول سال‌ها، پروژه‌های مختلفی را توسعه داده و منتشر کرده‌ام؛ از جمله <em>porg</em> (ابزار مدیریت آرشیو و بسته‌بندی در راست)، <em>Log40</em> (همین وبلاگ و فروشگاه با کارایی بالا)، و ابزارهای خط فرمان مختلف شامل داشبورد ترمینالی با کتابخانه <em>ratatui</em> و بازی تتریس متنی ترمینال با پوسته‌های سفارشی.
            </>
          ) : (
            <>
              Hello! I'm <strong>Toghrol</strong>, a systems engineer and Rust developer. I specialize in building high-performance backend systems, low-level Linux utilities, and terminal user interfaces (TUIs). Over the years, I have built and shipped projects like <em>porg</em> (a lightweight Rust packer and archive manager), <em>Log40</em> (this high-performance blogging & digital product store platform), and various command-line applications including a custom <em>ratatui</em>-based TUI dashboard and a themed terminal Tetris game.
            </>
          )}
        </p>

        <p>
          {language === "fa" ? (
            <>
              من وبلاگ لاگ۴۰ را به عنوان پایگاهی برای انتشار مقالات تخصصی، تحلیل‌های عمیق روی مدل مالکیت و مدیریت حافظه در راست، معماری‌های سیستم و لینوکس راه‌اندازی کردم. تمامی ابزارها و قالب‌های موجود در فروشگاه به صورت متن‌باز یا اختصاصی برای توسعه‌دهندگانی طراحی شده‌اند که به دنبال بهبود فرآیندهای مهندسی خود هستند.
            </>
          ) : (
            <>
              I started Log40 as a hub for publishing technical articles, deep dives into Rust ownership and memory management models, Linux system internals, and backend architectural design. All the tools and templates featured in my store are fully open-source or curated for engineers looking to level up their development workflow.
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
