import { Navbar } from "@/components/navbar"
import { Hero } from "@/components/hero"
import { VideoGenerator } from "@/components/video-generator"
import { ProblemBenefit } from "@/components/problem-benefit"
import { HowItWorks } from "@/components/how-it-works"
import { Features } from "@/components/features"
import { UseCases } from "@/components/use-cases"
import { Testimonials } from "@/components/testimonials"
import { FAQ } from "@/components/faq"
import { SeoLinkBand } from "@/components/seo-link-band"
import { FinalCTA } from "@/components/final-cta"
import { Footer } from "@/components/footer"

export default function Home() {
  return (
    <main className="relative z-0 min-h-screen bg-background overflow-x-hidden">
      <div
        className="absolute top-0 right-0 w-[1400px] h-[1400px] -z-10 bg-primary pointer-events-none"
        style={{
          maskImage: "radial-gradient(ellipse 50% 50% at 100% 0%, rgb(0 0 0 / 0.6), transparent)",
        }}
      >
        <div className="absolute inset-0 bg-cover bg-right-top" style={{ backgroundImage: "url('/grade.png')" }} />
      </div>

      <Navbar />

      <Hero />
      <VideoGenerator />
      <ProblemBenefit />
      <HowItWorks />
      <Features />
      <UseCases />
      <Testimonials />
      <FAQ />
      <SeoLinkBand />
      <FinalCTA />
      <Footer />
    </main>
  )
}
