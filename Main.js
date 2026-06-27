/* ===================================================================
   WIN I LOSE — main.js
   Vanilla JS modules: loader, cursor, theme, smooth scroll, reveals,
   journal modal, counters, gallery lazy-load, mailto form.
   No frameworks. Organized as small self-contained modules (IIFEs).
   =================================================================== */

(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasGSAP = typeof window.gsap !== "undefined";
  if (hasGSAP && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  /* ============================================================
     MODULE: Loader
     Simulates asset-aware progress, then reveals the page.
     ============================================================ */
  var Loader = {
    init: function () {
      var loader = document.getElementById("loader");
      var fill = document.getElementById("loaderFill");
      var pct = document.getElementById("loaderPct");
      if (!loader) return;

      var progress = 0;
      var target = 0;
      var raf;

      function bump(to) {
        target = Math.min(100, to);
      }

      function tick() {
        progress += (target - progress) * 0.12;
        if (target - progress < 0.5) progress = target;
        var shown = Math.round(progress);
        if (fill) fill.style.width = shown + "%";
        if (pct) pct.textContent = shown + "%";
        if (progress < 100) {
          raf = requestAnimationFrame(tick);
        }
      }
      raf = requestAnimationFrame(tick);

      bump(35);
      window.addEventListener("DOMContentLoaded", function () { bump(70); }, { once: true });

      function finish() {
        bump(100);
        setTimeout(function () {
          loader.classList.add("is-hidden");
          document.body.style.overflow = "";
          document.dispatchEvent(new CustomEvent("app:loaded"));
        }, 450);
      }

      if (document.readyState === "complete") {
        finish();
      } else {
        window.addEventListener("load", finish);
        // safety fallback so a slow/failed asset never traps the user
        setTimeout(finish, 4000);
      }

      document.body.style.overflow = "hidden";
    }
  };

  /* ============================================================
     MODULE: Theme (dark / light) with localStorage persistence
     ============================================================ */
  var Theme = {
    key: "wil-theme",
    init: function () {
      var toggle = document.getElementById("themeToggle");
      var stored = null;
      try { stored = localStorage.getItem(this.key); } catch (e) {}
      var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      var initial = stored || (prefersDark ? "dark" : "light");
      this.apply(initial);

      if (toggle) {
        toggle.addEventListener("click", function () {
          var current = document.documentElement.getAttribute("data-theme") || "light";
          var next = current === "dark" ? "light" : "dark";
          Theme.apply(next);
          try { localStorage.setItem(Theme.key, next); } catch (e) {}
        });
      }
    },
    apply: function (mode) {
      if (mode === "dark") {
        document.documentElement.setAttribute("data-theme", "dark");
      } else {
        document.documentElement.removeAttribute("data-theme");
      }
      var toggle = document.getElementById("themeToggle");
      if (toggle) toggle.setAttribute("aria-pressed", mode === "dark" ? "true" : "false");
    }
  };

  /* ============================================================
     MODULE: Smooth scroll (Lenis if available, native fallback)
     ============================================================ */
  var SmoothScroll = {
    lenis: null,
    init: function () {
      if (reduceMotion) return; // respect user preference, skip custom smoothing
      if (typeof window.Lenis === "function") {
        this.lenis = new window.Lenis({
          duration: 1.05,
          easing: function (t) { return 1 - Math.pow(1 - t, 3); },
          smoothWheel: true
        });
        var lenis = this.lenis;
        function raf(time) {
          lenis.raf(time);
          requestAnimationFrame(raf);
        }
        requestAnimationFrame(raf);

        if (hasGSAP && window.ScrollTrigger) {
          lenis.on("scroll", ScrollTrigger.update);
          gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
          gsap.ticker.lagSmoothing(0);
        }
      }
    },
    scrollTo: function (target) {
      if (this.lenis) {
        this.lenis.scrollTo(target, { offset: -10 });
      } else {
        var el = typeof target === "string" ? document.querySelector(target) : target;
        if (el) el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      }
    }
  };

  /* ============================================================
     MODULE: Navigation (active link tracking, scroll-to buttons,
     hide-on-scroll-down navbar, mobile drawer, scroll progress bar)
     ============================================================ */
  var Nav = {
    init: function () {
      var navbar = document.getElementById("navbar");
      var progress = document.getElementById("scrollProgress");
      var lastY = window.scrollY;
      var sections = Array.prototype.slice.call(document.querySelectorAll("main > section[id]"));
      var navLinks = Array.prototype.slice.call(document.querySelectorAll("[data-nav]"));

      // scroll-to buttons (hero CTAs, scroll cue)
      Array.prototype.slice.call(document.querySelectorAll("[data-scroll-to]")).forEach(function (btn) {
        btn.addEventListener("click", function () {
          SmoothScroll.scrollTo(btn.getAttribute("data-scroll-to"));
        });
      });

      navLinks.concat(Array.prototype.slice.call(document.querySelectorAll("[data-nav-drawer]"))).forEach(function (link) {
        link.addEventListener("click", function (e) {
          e.preventDefault();
          var target = link.getAttribute("href");
          SmoothScroll.scrollTo(target);
          Drawer.close();
        });
      });

      var navLetterCta = document.getElementById("navLetterCta");
      if (navLetterCta) {
        navLetterCta.addEventListener("click", function () { SmoothScroll.scrollTo("#letter"); });
      }

      function onScroll() {
        var y = window.scrollY;
        var docHeight = document.documentElement.scrollHeight - window.innerHeight;
        if (progress) progress.style.width = (docHeight > 0 ? (y / docHeight) * 100 : 0) + "%";

        if (navbar) {
          if (y > lastY && y > 140) {
            navbar.classList.add("nav-hidden");
          } else {
            navbar.classList.remove("nav-hidden");
          }
        }
        lastY = y;

        // active section highlight
        var current = sections[0];
        sections.forEach(function (sec) {
          var rect = sec.getBoundingClientRect();
          if (rect.top <= 140) current = sec;
        });
        if (current) {
          navLinks.forEach(function (link) {
            link.classList.toggle("active", link.getAttribute("href") === "#" + current.id);
          });
        }
      }

      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    }
  };

  var Drawer = {
    init: function () {
      var burger = document.getElementById("navBurger");
      var drawer = document.getElementById("navDrawer");
      var close = document.getElementById("navDrawerClose");
      if (!burger || !drawer) return;

      burger.addEventListener("click", function () {
        drawer.classList.add("is-open");
        burger.setAttribute("aria-expanded", "true");
        document.body.style.overflow = "hidden";
      });
      if (close) close.addEventListener("click", Drawer.close);
      drawer.addEventListener("click", function (e) {
        if (e.target === drawer) Drawer.close();
      });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") Drawer.close();
      });
    },
    close: function () {
      var burger = document.getElementById("navBurger");
      var drawer = document.getElementById("navDrawer");
      if (drawer) drawer.classList.remove("is-open");
      if (burger) burger.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
    }
  };

  /* ============================================================
     MODULE: Custom cursor (desktop only — CSS hides below 1280px)
     ============================================================ */
  var Cursor = {
    init: function () {
      if (window.innerWidth < 1280 || reduceMotion) return;
      var dot = document.getElementById("cursorDot");
      var ring = document.getElementById("cursorRing");
      if (!dot || !ring) return;

      var mouseX = window.innerWidth / 2, mouseY = window.innerHeight / 2;
      var ringX = mouseX, ringY = mouseY;

      window.addEventListener("mousemove", function (e) {
        mouseX = e.clientX; mouseY = e.clientY;
        dot.style.transform = "translate(" + mouseX + "px," + mouseY + "px) translate(-50%,-50%)";
      });

      function loop() {
        ringX += (mouseX - ringX) * 0.18;
        ringY += (mouseY - ringY) * 0.18;
        ring.style.transform = "translate(" + ringX + "px," + ringY + "px) translate(-50%,-50%)";
        requestAnimationFrame(loop);
      }
      loop();

      var hoverables = "a, button, .j-card, .g-item, textarea";
      document.addEventListener("mouseover", function (e) {
        if (e.target.closest(hoverables)) ring.classList.add("is-hover");
      });
      document.addEventListener("mouseout", function (e) {
        if (e.target.closest(hoverables)) ring.classList.remove("is-hover");
      });
    }
  };

  /* ============================================================
     MODULE: Scroll reveals (GSAP ScrollTrigger if present,
     IntersectionObserver fallback otherwise)
     ============================================================ */
  var Reveal = {
    init: function () {
      var targets = Array.prototype.slice.call(
        document.querySelectorAll("[data-reveal], .t-card, .g-item, .j-card")
      );
      if (reduceMotion) {
        targets.forEach(function (el) { el.classList.add("is-revealed"); });
        return;
      }
      if (!("IntersectionObserver" in window)) {
        targets.forEach(function (el) { el.classList.add("is-revealed"); });
        return;
      }
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.18, rootMargin: "0px 0px -40px 0px" });
      targets.forEach(function (el) { io.observe(el); });
    }
  };

  /* ============================================================
     MODULE: Hero split-text intro + parallax backgrounds
     ============================================================ */
  var HeroFX = {
    init: function () {
      var heroBg = document.getElementById("heroBg");
      var vowBg = document.getElementById("vowBg");

      if (hasGSAP) {
        var splits = document.querySelectorAll("[data-split]");
        splits.forEach(function (line) {
          var text = line.textContent;
          line.innerHTML = "<span>" + text + "</span>";
        });

        document.addEventListener("app:loaded", function () {
          gsap.timeline()
            .from(splits, {
              yPercent: 110, opacity: 0, duration: 1.1, ease: "power4.out", stagger: 0.12
            })
            .from("[data-reveal]", {
              opacity: 0, y: 24, duration: 0.9, ease: "power3.out", stagger: 0.1
            }, "-=0.5");
        }, { once: true });

        if (!reduceMotion && window.ScrollTrigger) {
          [heroBg, vowBg].forEach(function (bg) {
            if (!bg) return;
            gsap.to(bg, {
              yPercent: 12,
              ease: "none",
              scrollTrigger: {
                trigger: bg.closest("section"),
                start: "top top",
                end: "bottom top",
                scrub: true
              }
            });
          });
        }
      } else {
        // No GSAP fallback: just reveal immediately
        document.querySelectorAll("[data-split], [data-reveal]").forEach(function (el) {
          el.style.opacity = "1";
        });
      }
    }
  };

  /* ============================================================
     MODULE: Timeline spine fill (tracks scroll progress through
     the timeline section specifically — encodes "how far along")
     ============================================================ */
  var TimelineSpine = {
    init: function () {
      var wrap = document.querySelector(".timeline-wrap");
      var fill = document.getElementById("spineFill");
      if (!wrap || !fill) return;

      function update() {
        var rect = wrap.getBoundingClientRect();
        var vh = window.innerHeight;
        var total = rect.height + vh * 0.5;
        var seen = Math.min(total, Math.max(0, vh * 0.6 - rect.top));
        var pct = total > 0 ? (seen / total) * 100 : 0;
        fill.style.height = Math.min(100, Math.max(0, pct)) + "%";
      }
      window.addEventListener("scroll", update, { passive: true });
      window.addEventListener("resize", update);
      update();
    }
  };

  /* ============================================================
     MODULE: Stat counters ("100%", "0", "1") — animate on reveal
     ============================================================ */
  var Counters = {
    init: function () {
      var nodes = Array.prototype.slice.call(document.querySelectorAll("[data-count]"));
      if (!nodes.length) return;

      function animate(el) {
        var end = parseInt(el.getAttribute("data-count"), 10);
        var suffix = el.getAttribute("data-suffix") || "";
        if (reduceMotion) {
          el.textContent = end + suffix;
          return;
        }
        var start = 0;
        var duration = 1100;
        var startTime = null;
        function step(ts) {
          if (!startTime) startTime = ts;
          var progress = Math.min(1, (ts - startTime) / duration);
          var eased = 1 - Math.pow(1 - progress, 3);
          var val = Math.round(start + (end - start) * eased);
          el.textContent = val + suffix;
          if (progress < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      }

      if ("IntersectionObserver" in window) {
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              animate(entry.target);
              io.unobserve(entry.target);
            }
          });
        }, { threshold: 0.6 });
        nodes.forEach(function (el) { io.observe(el); });
      } else {
        nodes.forEach(animate);
      }
    }
  };

  /* ============================================================
     MODULE: Gallery lazy-load (manual data-src swap + skeleton)
     ============================================================ */
  var Gallery = {
    init: function () {
      var imgs = Array.prototype.slice.call(document.querySelectorAll(".g-item img[data-src]"));
      if (!imgs.length) return;

      function load(img) {
        var src = img.getAttribute("data-src");
        if (!src) return;
        img.src = src;
        img.addEventListener("load", function () { img.classList.add("is-loaded"); }, { once: true });
        img.removeAttribute("data-src");
      }

      if ("IntersectionObserver" in window) {
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              load(entry.target);
              io.unobserve(entry.target);
            }
          });
        }, { rootMargin: "200px 0px" });
        imgs.forEach(function (img) { io.observe(img); });
      } else {
        imgs.forEach(load);
      }
    }
  };

  /* ============================================================
     MODULE: Journal modal (accessible dialog, focus trap-lite)
     ============================================================ */
  var Journal = {
    entries: [
      {
        date: "Entry 01",
        title: "I rehearsed this and still messed it up",
        body: [
          "Had a whole speech ready. Said none of it right in person.",
          "Writing it down because apparently that's the only format I don't fumble.",
          "If you're reading this instead of hearing it from me face to face — that's on me too. I'm working on saying things out loud, not just typing them well."
        ]
      },
      {
        date: "Entry 02",
        title: "Being right is overrated",
        body: [
          "Mistakes might be what make this whole thing interesting. Doesn't make them fun to admit to.",
          "I'd rather be the guy who admits it fast than the guy who needs a whole apology website to get there. Slightly too late for that second one, but here we are.",
          "Noted, and not repeating this one."
        ]
      },
      {
        date: "Entry 03",
        title: "Shazma, if you're reading this",
        body: [
          "I'm not asking you to forget it happened.",
          "I'm asking for a chance to not do it again — starting now, not from some imaginary improved version of me.",
          "This whole site is a lot, I know. But a text felt too easy for how wrong I was."
        ]
      }
    ],
    init: function () {
      var overlay = document.getElementById("journalModal");
      var closeBtn = document.getElementById("journalModalClose");
      var dateEl = document.getElementById("jModalDate");
      var titleEl = document.getElementById("jModalTitle");
      var bodyEl = document.getElementById("jModalBody");
      if (!overlay) return;
      var lastFocused = null;

      function open(index) {
        var entry = Journal.entries[index];
        if (!entry) return;
        dateEl.textContent = entry.date;
        titleEl.textContent = entry.title;
        bodyEl.innerHTML = entry.body.map(function (p) { return "<p>" + p + "</p>"; }).join("");
        lastFocused = document.activeElement;
        overlay.classList.add("is-open");
        document.body.style.overflow = "hidden";
        closeBtn.focus();
      }

      function close() {
        overlay.classList.remove("is-open");
        document.body.style.overflow = "";
        if (lastFocused) lastFocused.focus();
      }

      document.querySelectorAll("[data-journal]").forEach(function (card) {
        card.addEventListener("click", function () {
          open(parseInt(card.getAttribute("data-journal"), 10));
        });
        card.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            open(parseInt(card.getAttribute("data-journal"), 10));
          }
        });
      });

      closeBtn.addEventListener("click", close);
      overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && overlay.classList.contains("is-open")) close();
      });
    }
  };

  /* ============================================================
     MODULE: Vow form — builds a mailto: link with the message
     ============================================================ */
  var VowForm = {
    recipient: "theadeebalam@gmail.com",
    init: function () {
      var form = document.getElementById("vowForm");
      var textarea = document.getElementById("vowMessage");
      var sentMsg = document.getElementById("vowSentMsg");
      if (!form) return;

      form.addEventListener("submit",
