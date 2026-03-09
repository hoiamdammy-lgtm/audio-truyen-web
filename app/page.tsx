import Link from "next/link";
import { Film, BookOpen, Headphones, ArrowRight } from "lucide-react";

const sections = [
  {
    href: "/phim",
    title: "Xem Phim",
    desc: "Kho phim đam mỹ reup, vietsub, dễ tìm và dễ xem.",
    icon: Film,
    gradient: "from-pink-500 via-rose-500 to-red-500",
    glow: "group-hover:shadow-[0_0_50px_rgba(244,63,94,0.35)]",
  },
  {
    href: "/truyen-chu",
    title: "Đọc Truyện Chữ",
    desc: "Truyện chữ dịch/edit, trình bày rõ ràng, tập trung trải nghiệm đọc.",
    icon: BookOpen,
    gradient: "from-fuchsia-500 via-pink-500 to-purple-500",
    glow: "group-hover:shadow-[0_0_50px_rgba(217,70,239,0.35)]",
  },
  {
    href: "/audio",
    title: "Nghe Audio",
    desc: "Radio và kịch truyền thanh để nghe thư giãn mọi lúc.",
    icon: Headphones,
    gradient: "from-emerald-500 via-teal-500 to-cyan-500",
    glow: "group-hover:shadow-[0_0_50px_rgba(20,184,166,0.35)]",
  },
];

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07070c] text-white">
      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(236,72,153,0.18),transparent_30%),radial-gradient(circle_at_20%_80%,rgba(168,85,247,0.14),transparent_25%),radial-gradient(circle_at_80%_70%,rgba(20,184,166,0.12),transparent_30%)]" />
      <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:40px_40px]" />

      <section className="relative mx-auto flex min-h-screen max-w-7xl flex-col justify-center px-6 py-16 md:px-10">
        {/* Hero */}
        <div className="mx-auto mb-14 max-w-3xl text-center">
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl md:text-7xl">
            <span className="bg-gradient-to-r from-pink-400 via-fuchsia-300 to-violet-300 bg-clip-text text-transparent">
              Hồi Âm Đam Mỹ
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-gray-300 md:text-lg">
            Tập trung vào ba trải nghiệm chính: xem phim, đọc truyện chữ và nghe audio.
          </p>
        </div>

        {/* 3 main sections */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {sections.map((section) => {
            const Icon = section.icon;

            return (
              <Link key={section.href} href={section.href} className="group block">
                <article
                  className={`relative overflow-hidden rounded-[30px] border border-white/10 bg-white/5 p-8 backdrop-blur-2xl transition duration-300 hover:-translate-y-2 ${section.glow}`}
                >
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${section.gradient} opacity-10 transition duration-300 group-hover:opacity-20`}
                  />

                  <div className="relative flex min-h-[340px] flex-col">
                    <div
                      className={`mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${section.gradient} shadow-lg`}
                    >
                      <Icon className="h-8 w-8 text-white" />
                    </div>

                    <h2 className="text-3xl font-bold tracking-tight text-white">
                      {section.title}
                    </h2>

                    <p className="mt-4 flex-1 text-base leading-7 text-gray-300">
                      {section.desc}
                    </p>

                    <div className="mt-8 flex items-center justify-between border-t border-white/10 pt-5 text-sm font-medium text-gray-200">
                      <span>Khám phá ngay</span>
                      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                    </div>
                  </div>
                </article>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}