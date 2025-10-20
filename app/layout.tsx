// app/layout.tsx
import "./globals.css";
import NoSSR from "./NoSSR";

export const metadata = {
  title: "Asian Nour — Commande à table",
  description: "QR table ordering",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="min-h-dvh bg-[var(--color-background)] text-[var(--color-text)] antialiased font-body" suppressHydrationWarning>
        <div className="fixed inset-0 -z-10 select-none pointer-events-none overflow-hidden">
          <div className="absolute inset-0">
            <span className="emoji-ornament emoji-float-a absolute top-[6%] left-[8%] opacity-[0.26] text-[68px] sm:text-[96px] anim-float-slow" style={{ animationDelay: "0s" }}>🍣</span>
            <span className="emoji-ornament emoji-float-b absolute top-[14%] right-[12%] opacity-[0.18] text-[80px] sm:text-[128px] hidden sm:block anim-float-delayed" style={{ animationDelay: "3s" }}>🍜</span>
            <span className="emoji-ornament absolute top-[28%] left-[28%] rotate-[16deg] opacity-[0.24] text-[64px] sm:text-[96px] hidden sm:block anim-float-slow">🍱</span>
            <span className="emoji-ornament absolute top-[4%] left-[48%] rotate-[-18deg] opacity-[0.2] text-[88px] sm:text-[130px] hidden sm:block anim-rotate-slow">🥢</span>
            <span className="emoji-ornament absolute top-[24%] right-[28%] rotate-[12deg] opacity-[0.24] text-[60px] sm:text-[88px] anim-float-slow">🥟</span>
            <span className="emoji-ornament emoji-float-c absolute top-[36%] left-[6%] opacity-[0.28] text-[56px] sm:text-[82px] anim-float-delayed" style={{ animationDelay: "6s" }}>🍙</span>
            <span className="emoji-ornament absolute top-[42%] left-[50%] rotate-[6deg] opacity-[0.22] text-[52px] sm:text-[78px] hidden sm:block anim-rotate-slow">🥡</span>
            <span className="emoji-ornament emoji-float-d absolute top-[44%] right-[6%] opacity-[0.26] text-[60px] sm:text-[88px] anim-float-slow" style={{ animationDelay: "9s" }}>🍵</span>
            <span className="emoji-ornament absolute top-[56%] left-[22%] rotate-[14deg] opacity-[0.24] text-[52px] sm:text-[78px] anim-float-delayed">🍣</span>
            <span className="emoji-ornament absolute top-[52%] right-[32%] rotate-[-10deg] opacity-[0.26] text-[58px] sm:text-[82px] hidden sm:block anim-float-slow">🥡</span>
            <span className="emoji-ornament absolute top-[64%] right-[18%] rotate-[20deg] opacity-[0.24] text-[54px] sm:text-[80px] anim-float-delayed">🥟</span>
            <span className="emoji-ornament absolute top-[70%] left-[32%] rotate-[-16deg] opacity-[0.26] text-[56px] sm:text-[84px] hidden sm:block anim-rotate-slow">🍙</span>
            <span className="emoji-ornament absolute top-[78%] right-[46%] rotate-[12deg] opacity-[0.28] text-[48px] sm:text-[74px] hidden sm:block anim-float-slow">🍵</span>
            <span className="emoji-ornament emoji-float-e absolute bottom-[16%] left-[12%] opacity-[0.26] text-[60px] sm:text-[88px] anim-float-delayed" style={{ animationDelay: "12s" }}>🍣</span>
            <span className="emoji-ornament emoji-float-f absolute bottom-[6%] right-[18%] opacity-[0.24] text-[62px] sm:text-[92px] anim-rotate-slow" style={{ animationDelay: "15s" }}>🥢</span>
            <span className="emoji-ornament absolute bottom-[24%] right-[30%] rotate-[6deg] opacity-[0.18] text-[72px] sm:text-[120px] hidden sm:block anim-float-delayed">🍜</span>
          </div>
          <div className="absolute -top-12 left-1/5 h-[16rem] w-[16rem] bg-[#F2B39B33] blur-[120px] sm:h-[24rem] sm:w-[24rem] sm:blur-[200px]" />
          <div className="absolute top-1/4 right-[-10%] h-64 w-64 bg-[#B6D6F233] blur-[120px] sm:h-[26rem] sm:w-[26rem] sm:blur-[220px]" />
          <div className="absolute bottom-10 left-10 h-[15rem] w-[15rem] bg-[#F6D68B2B] blur-[120px] sm:h-[22rem] sm:w-[22rem] sm:blur-[200px]" />
          <div className="absolute bottom-1/3 right-1/4 h-60 w-60 bg-[#F5EFE640] blur-[130px] sm:h-[20rem] sm:w-[20rem] sm:blur-[210px]" />
        </div>
        <div className="relative z-10">
          <NoSSR>{children}</NoSSR>
        </div>
      </body>
    </html>
  );
}
