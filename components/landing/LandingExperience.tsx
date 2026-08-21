"use client";

import Link from "next/link";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { SiteFooter } from "@/components/SiteFooter";

const failureModes = [
  {
    number: "01",
    title: "Structural drift",
    body: "The page still responds, but the shape your extractor depends on has moved.",
    code: "selector: .product-price\nexpected: number\nreceived: undefined",
    signal: "shape changed",
  },
  {
    number: "02",
    title: "Semantic drift",
    body: "The fields are present and valid, but the meaning underneath them has changed.",
    code: "price: 189.00\nconfidence: 0.94\nmeaning: uncertain",
    signal: "meaning changed",
  },
];

const pipeline = [
  ["01", "Extract", "Capture the live surface."],
  ["02", "Validate", "Compare it to the contract."],
  ["03", "Heal", "Propose a tested repair."],
  ["04", "Verify", "Check meaning, not just shape."],
  ["05", "Emit", "Return a dependable response."],
];

const integrations = [
  ["REST", "POST /v1/contracts/run", "curl -X POST /v1/contracts/run\n  -H 'x-contract: WC-0048'\n  -d '{\"url\": \"…\"}'"],
  ["WEBHOOKS", "contract.healed", "{\n  \"event\": \"contract.healed\",\n  \"contract\": \"WC-0048\",\n  \"confidence\": 0.99\n}"],
  ["MCP", "get_data(contract_id)", "tool: get_data\ncontract: WC-0048\nreturn: validated\nhealing: remembered"],
];

type DiffPhase = "valid" | "broken" | "healing" | "restored";

const diffStates: Record<DiffPhase, { label: string; caption: string }> = {
  valid: { label: "VALID", caption: "contract matches live data" },
  broken: { label: "VIOLATED", caption: "price field returned null" },
  healing: { label: "HEALING", caption: "selector diff proposed" },
  restored: { label: "RESTORED", caption: "contract verified in 14ms" },
};

const TRACE_PATHS = [
  "M 860 -40 C 1030 120 930 280 730 350 C 540 420 430 300 500 180 C 565 70 760 125 770 300 C 785 515 520 570 260 680 C 40 775 90 1015 340 1035",
  "M 120 -50 C -20 160 100 290 300 260 C 520 225 590 390 460 500 C 315 625 70 535 65 740 C 60 910 260 930 440 820 C 650 690 850 790 910 1040",
  "M 920 -50 C 720 110 735 265 895 330 C 1040 390 920 540 720 495 C 500 445 340 585 465 720 C 590 850 805 755 875 900 C 920 990 830 1030 740 1050",
  "M 60 -50 C 240 100 190 255 45 350 C -90 440 30 585 230 520 C 445 450 610 585 535 730 C 470 855 255 810 190 940 C 155 1010 245 1040 350 1050",
  "M 850 -50 C 1030 150 850 260 680 220 C 500 175 405 320 550 445 C 700 575 920 480 930 690 C 940 865 750 875 625 790 C 470 685 295 780 330 935 C 345 1000 420 1035 500 1050",
];

export function LandingExperience() {
  const reducedMotion = useReducedMotion();
  const hero = useRef<HTMLElement | null>(null);
  const failure = useRef<HTMLElement | null>(null);
  const pipelineSection = useRef<HTMLElement | null>(null);
  const integrationsSection = useRef<HTMLElement | null>(null);
  const foundation = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({ target: hero, offset: ["start start", "end start"] });
  const orbY = useTransform(scrollYProgress, [0, 1], [0, reducedMotion ? 0 : 160]);
  const copyY = useTransform(scrollYProgress, [0, 1], [0, reducedMotion ? 0 : -42]);

  return (
    <main className="new-landing">
      <div className="grain" aria-hidden="true" />
      <Nav />

      <section id="hero" ref={hero} className="landing-screen hero-screen">
        <ScrollTrace target={hero} variant={0} />
        <motion.div className="hero-orbit" style={{ y: orbY }} aria-hidden="true" />
        <motion.div className="hero-glow" style={{ y: orbY }} aria-hidden="true">
          <span className="glow-ring glow-ring-a" /><span className="glow-ring glow-ring-b" />
          <span className="glow-orb" />
        </motion.div>
        <div className="wrap screen-inner hero-inner">
          <motion.div className="hero-copy-block" style={{ y: copyY }}>
            <Fade delay={0.08}><p className="eyebrow"><i /> LIPPY / RELIABILITY LAYER</p></Fade>
            <motion.h1 className="hero-heading" initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .9, delay: .14, ease: [0.16, 1, .3, 1] }}>
              Websites change.<br />Your API <em>shouldn&apos;t.</em>
            </motion.h1>
            <Fade delay={0.32}><p className="hero-text">Lippy turns any website into a typed, self-repairing API. When the web shifts, your application gets a proven response instead of a silent break.</p></Fade>
            <Fade delay={0.46}><div className="hero-actions-new"><Link href="#pipeline" className="primary-cta">View the loop <span>↗</span></Link><a href="#integrations" className="quiet-link">Read the interface <span>↓</span></a></div></Fade>
          </motion.div>
          <Fade delay={0.42} className="hero-panel"><HealingDiff reducedMotion={reducedMotion} /></Fade>
          <div className="hero-bottom"><span>SCROLL TO BEGIN</span><span className="scroll-stroke" /><span>FAILURE IN / PROOF OUT</span></div>
        </div>
      </section>

      <section id="failure-modes" ref={failure} className="landing-screen light-screen failure-screen">
        <ScrollTrace target={failure} variant={1} />
        <div className="wrap screen-inner">
          <Fade><div className="section-top"><p className="eyebrow"><i /> THE PROBLEM / 01</p><p className="section-note">A successful response<br />can still be wrong.</p></div></Fade>
          <div className="section-heading-row"><Fade><h2>Two ways the web lies<br />to your <em>scraper.</em></h2></Fade><Fade delay={.12}><p>Traditional extraction catches a page that disappears. A contract catches the page that quietly changes meaning.</p></Fade></div>
          <div className="failure-grid">
            {failureModes.map((mode, index) => <Fade key={mode.title} delay={index * .1} className="failure-card"><div className="card-kicker"><span>{mode.number}</span><span className="mono-label">{mode.signal}</span></div><h3>{mode.title}</h3><p>{mode.body}</p><pre>{mode.code}</pre><span className="card-arrow">↗</span></Fade>)}
          </div>
        </div>
      </section>

      <section id="pipeline" ref={pipelineSection} className="landing-screen pipeline-screen">
        <ScrollTrace target={pipelineSection} variant={2} />
        <div className="pipeline-halo" aria-hidden="true" />
        <div className="wrap screen-inner">
          <Fade><div className="section-top"><p className="eyebrow"><i /> THE PIPELINE / 02</p><p className="section-note">Observe the change.<br />Keep the promise.</p></div></Fade>
          <div className="pipeline-heading"><Fade><h2>From live page<br />to <em>lasting certainty.</em></h2></Fade><Fade delay={.12}><p>One ordered loop turns a moving website into a dependable response your product can build on.</p></Fade></div>
          <div className="pipeline-list">
            {pipeline.map(([number, title, body], index) => <Fade key={number} delay={index * .08} className="pipeline-row"><span>{number}</span><h3>{title}</h3><p>{body}</p><b>↗</b></Fade>)}
          </div>
        </div>
      </section>

      <section id="integrations" ref={integrationsSection} className="landing-screen light-screen integrations-screen">
        <ScrollTrace target={integrationsSection} variant={3} />
        <div className="wrap screen-inner">
          <Fade><div className="section-top"><p className="eyebrow"><i /> THE INTERFACE / 03</p><p className="section-note">Meet the system<br />where you already work.</p></div></Fade>
          <div className="section-heading-row"><Fade><h2>Three ways <em>in.</em></h2></Fade><Fade delay={.12}><p>Use the contract from your backend, subscribe to its changes, or let an agent query verified data through MCP.</p></Fade></div>
          <div className="integration-grid">
            {integrations.map(([label, title, code], index) => <Fade key={label} delay={index * .1} className="integration-card"><div className="card-kicker"><span>0{index + 1}</span><span className="mono-label">{label}</span></div><h3>{title}</h3><pre>{code}</pre><a href="/dashboard">Open control room <span>↗</span></a></Fade>)}
          </div>
        </div>
      </section>

      <section id="foundation" ref={foundation} className="landing-screen light-screen foundation-screen">
        <ScrollTrace target={foundation} variant={4} />
        <div className="wrap screen-inner foundation-inner">
          <Fade><div className="section-top"><p className="eyebrow"><i /> THE FOUNDATION / 04</p><p className="section-note">Built for the moving web.<br />Grounded in proof.</p></div></Fade>
          <div className="foundation-heading"><Fade><h2>Less firefighting.<br /><em>More building.</em></h2></Fade><Fade delay={.12}><p>Bright Data handles extraction and self-healing. Parallel verifies semantic change. Lippy joins both into a contract your API can trust.</p></Fade></div>
          <div className="foundation-grid"><Fade><div className="foundation-card"><span className="mono-label">EXTRACTION + SELF-HEALING</span><h3>Bright Data</h3><p>Find the live surface, recover when selectors move, and keep the repair explainable.</p></div></Fade><Fade delay={.1}><div className="foundation-card"><span className="mono-label">SEMANTIC VERIFICATION</span><h3>Parallel</h3><p>Check whether a valid response still means what your application expects it to mean.</p></div></Fade></div>
          <div className="foundation-cta"><Link href="/dashboard" className="primary-cta">Enter the control room <span>↗</span></Link><p>Start with one contract. Leave the web&apos;s chaos at the edge of your system.</p></div>
          <SiteFooter absolute />
        </div>
      </section>
    </main>
  );
}

function Nav() {
  return <motion.nav className="new-nav" initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .65 }}><Link href="/" className="new-brand"><span className="new-brand-mark">L</span><span>LIPPY</span></Link><div><a href="#failure-modes">Product</a><a href="#integrations">Docs</a><Link href="/dashboard" className="nav-cta">Dashboard <span>↗</span></Link></div></motion.nav>;
}

function ScrollTrace({ target, variant }: { target: RefObject<HTMLElement | null>; variant: number }) {
  const reducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target, offset: ["start end", "end start"] });
  const draw = useTransform(scrollYProgress, [0, .74], [0, 1]);
  const opacity = useTransform(scrollYProgress, [0, .08, .55, .86, 1], [0, .78, .58, .16, .025]);
  const gradientId = `trace-blue-${variant}`;

  return (
    <div className="scroll-trace" aria-hidden="true">
      <svg viewBox="0 0 1000 1000" preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1000" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#2aa4ff" stopOpacity=".78" />
            <stop offset=".42" stopColor="#168dff" stopOpacity=".58" />
            <stop offset=".78" stopColor="#168dff" stopOpacity=".24" />
            <stop offset="1" stopColor="#168dff" stopOpacity=".025" />
          </linearGradient>
        </defs>
        <motion.path className="scroll-trace-path" d={TRACE_PATHS[variant]} pathLength={1} style={{ pathLength: reducedMotion ? 1 : draw, opacity: reducedMotion ? .08 : opacity }} stroke={`url(#${gradientId})`} />
      </svg>
    </div>
  );
}

function HealingDiff({ reducedMotion }: { reducedMotion: boolean | null }) {
  const [phase, setPhase] = useState<DiffPhase>(reducedMotion ? "restored" : "valid");

  useEffect(() => {
    if (reducedMotion === null) return;
    if (reducedMotion) {
      setPhase("restored");
      return;
    }
    const phases: DiffPhase[] = ["valid", "broken", "healing", "restored"];
    const timer = window.setInterval(() => {
      setPhase((current) => phases[(phases.indexOf(current) + 1) % phases.length]!);
    }, 2400);
    return () => window.clearInterval(timer);
  }, [reducedMotion]);

  const state = diffStates[phase];
  const price = phase === "broken" ? "null" : "189.00";

  return (
    <div className={`healing-diff diff-${phase}`}>
      <div className="diff-top"><span className="mono-label">HEALING DIFF</span><span className="diff-contract">WC-0048</span></div>
      <div className="diff-status-row"><span className="status-mark" /><strong>{state.label}</strong><span>{state.caption}</span></div>
      <div className="diff-code" aria-live="polite">
        <span className="code-muted">&#123;</span>
        <span><b>&quot;product&quot;</b>: &quot;apple-airpods&quot;,</span>
        <span className={phase === "broken" ? "code-alert" : ""}><b>&quot;price&quot;</b>: {price},</span>
        <span><b>&quot;stock&quot;</b>: &quot;in_stock&quot;,</span>
        <span><b>&quot;confidence&quot;</b>: {phase === "healing" ? "0.97" : "0.94"}</span>
        <span className="code-muted">&#125;</span>
      </div>
      <div className="diff-repair"><span className="repair-line" /><code>{phase === "healing" ? "selector .price -> .product-price" : "schema: product.v1"}</code><span className="repair-time">{phase === "restored" ? "14ms" : "live"}</span></div>
      <div className="diff-foot"><span>contract response</span><span>{phase === "restored" ? "verified" : "watching"}</span></div>
    </div>
  );
}

function Fade({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reducedMotion = useReducedMotion();
  return <motion.div className={className} initial={reducedMotion ? false : { opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .18 }} transition={{ duration: reducedMotion ? 0 : .75, delay, ease: [0.16, 1, .3, 1] }}>{children}</motion.div>;
}
