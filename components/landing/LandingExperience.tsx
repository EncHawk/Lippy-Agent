"use client";

import Link from "next/link";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";

const protocol = [
  ["01", "Observe", "Every run begins with a clear picture of what is live."],
  ["02", "Verify", "Your contract catches the quiet break before it ships."],
  ["03", "Recover", "A repair is proposed, tested, and explained in context."],
];

const surfaces = [
  ["CONTRACTS", "A shape your product can rely on.", "price    number\nstock    boolean\nregion   string"],
  ["SIGNALS", "The difference between broken and changed.", "price ↓ 12.4%\nconfidence 0.94\nstatus → healthy"],
  ["MEMORY", "Every fix leaves the system wiser.", "selector diff\npassed 12/12\napproved  ·  14ms"],
];

export function LandingExperience() {
  const reducedMotion = useReducedMotion();
  const hero = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({ target: hero, offset: ["start start", "end start"] });
  const orbY = useTransform(scrollYProgress, [0, 1], [0, reducedMotion ? 0 : 160]);
  const copyY = useTransform(scrollYProgress, [0, 1], [0, reducedMotion ? 0 : -64]);

  return (
    <main className="new-landing">
      <div className="grain" aria-hidden="true" />
      <Nav />

      <section ref={hero} className="new-section hero">
        <div className="page-grid" aria-hidden="true" />
        <motion.div className="hero-glow" style={{ y: orbY }} aria-hidden="true">
          <span className="glow-ring glow-ring-a" /><span className="glow-ring glow-ring-b" />
          <span className="glow-orb" />
        </motion.div>
        <div className="wrap hero-wrap">
          <motion.div className="hero-copy-block" style={{ y: copyY }}>
            <Fade delay={0.08}><p className="overline"><i /> WEB CONTRACTS / 01</p></Fade>
            <motion.h1 className="hero-heading" initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .9, delay: .14, ease: [0.16, 1, .3, 1] }}>
              The web is <em>alive.</em><br />Your data should be too.
            </motion.h1>
            <Fade delay={0.32}><p className="hero-text">An adaptive reliability layer for the websites your product quietly depends on. Observe the change. Keep the promise.</p></Fade>
            <Fade delay={0.46}><div className="hero-actions-new"><Link href="/dashboard" className="primary-cta">Open control room <span>↗</span></Link><a href="#protocol" className="quiet-link">Explore the system <span>↓</span></a></div></Fade>
          </motion.div>
          <Fade delay={0.48} className="hero-side-note"><span>ALWAYS ON</span><p>Watch what moves.<br />Know what matters.</p></Fade>
          <div className="hero-card-wrap">
            <Fade delay={0.54} className="live-card">
              <div className="card-top"><span className="live-pip" /> LIVE CONTRACT <b>WC-0048</b></div>
              <div className="pulse-line"><motion.i animate={reducedMotion ? {} : { left: ["-15%", "105%"] }} transition={{ duration: 3.8, repeat: Infinity, ease: "linear" }} /></div>
              <div className="card-main"><p>product.apple-airpods</p><strong>Healthy <span>↗</span></strong><small>updated a moment ago</small></div>
              <div className="card-rows"><span><b>Price</b><code>$189.00</code></span><span><b>Availability</b><code>in_stock</code></span><span><b>Confidence</b><code>0.97</code></span></div>
              <div className="card-foot"><span>schema validated</span><span>12ms</span></div>
            </Fade>
          </div>
          <div className="hero-bottom"><span>SCROLL TO BEGIN</span><span className="scroll-stroke" /><span>RELIABILITY, IN MOTION</span></div>
        </div>
      </section>

      <section id="protocol" className="new-section protocol-section">
        <div className="section-grid" aria-hidden="true" />
        <div className="wrap section-pad">
          <Fade><div className="section-top"><p className="overline"><i /> THE PROTOCOL / 02</p><p>Quietly rigorous.<br />Noticeably calmer.</p></div></Fade>
          <div className="protocol-intro"><Fade><h2>Change is inevitable.<br /><em>Surprises aren’t.</em></h2></Fade><Fade delay={.12}><p>Web Contracts turns a shifting internet into a dependable surface for pricing, catalogs, policies, and the products built around them.</p></Fade></div>
          <div className="protocol-list">
            {protocol.map(([number, title, body], index) => <Fade key={number} delay={index * .12} className="protocol-row"><span>{number}</span><h3>{title}</h3><p>{body}</p><b>↗</b></Fade>)}
          </div>
        </div>
      </section>

      <section className="new-section statement-section">
        <div className="statement-sun" aria-hidden="true" />
        <div className="wrap statement-wrap"><Fade><p className="overline"><i /> A BETTER DEFAULT / 03</p></Fade><Fade delay={.1}><h2>A successful response<br />can still be <em>wrong.</em></h2></Fade><Fade delay={.18}><p className="statement-copy">A green request doesn’t mean your application got what it needed. We validate meaning, not merely delivery—so a redesign becomes a repair signal, not a support ticket.</p></Fade></div>
        <div className="ticker" aria-hidden="true"><div>STAY IN SYNC <i /> KNOW THE DIFFERENCE <i /> STAY IN SYNC <i /> KNOW THE DIFFERENCE <i /></div></div>
      </section>

      <section className="new-section surfaces-section">
        <div className="section-grid" aria-hidden="true" />
        <div className="wrap section-pad">
          <Fade><div className="section-top"><p className="overline"><i /> WHAT HOLDS / 04</p><p>One dependable signal.<br />Everywhere it matters.</p></div></Fade>
          <div className="surfaces-intro"><Fade><h2>From living websites<br />to <em>lasting certainty.</em></h2></Fade></div>
          <div className="surface-columns">
            {surfaces.map(([label, title, code], index) => <Fade key={label} delay={index * .11} className="surface"><span className="surface-number">0{index + 1}</span><p className="surface-label-new">{label}</p><h3>{title}</h3><pre>{code}</pre><a href="#close">Learn more <span>↗</span></a></Fade>)}
          </div>
        </div>
      </section>

      <section id="close" className="new-section close-new">
        <div className="close-grid" aria-hidden="true" />
        <div className="wrap close-wrap"><Fade><p className="overline"><i /> BUILT TO KEEP UP / 05</p></Fade><Fade delay={.08}><h2>Less firefighting.<br /><em>More building.</em></h2></Fade><Fade delay={.18}><p>Start with one contract and leave the web’s chaos at the edge of your system.</p><Link href="/dashboard" className="secondary-cta">Enter the control room <span>↗</span></Link></Fade><footer><span>WEB CONTRACTS © 2026</span><span>EXTRACTION WITH A MEMORY</span><span>MADE FOR THE MOVING WEB</span></footer></div>
      </section>
    </main>
  );
}

function Nav() {
  return <motion.nav className="new-nav" initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .65 }}><Link href="/" className="new-brand"><span className="new-brand-mark">W</span><span>WEB CONTRACTS</span></Link><div><a href="#protocol">System</a><a href="#close">About</a><Link href="/dashboard" className="nav-cta">Dashboard <span>↗</span></Link></div></motion.nav>;
}

function Fade({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return <motion.div className={className} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .18 }} transition={{ duration: .75, delay, ease: [0.16, 1, .3, 1] }}>{children}</motion.div>;
}
