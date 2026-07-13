"use client";

import {
  Waypoints
} from "lucide-react";
import { useEffect, useState } from "react";

import { AnimatePresence, motion } from "framer-motion";
import React from "react";

 function Header() {
  const [lang, setLang] = useState("en"); // Tracks if we are showing English or Devanagari
  const [isIconAnimating, setIsIconAnimating] = useState(false);

  // The Animation Timeline
  useEffect(() => {
    let isMounted = true;

    const runSequence = async () => {
      while (isMounted) {
        // 1. Hold on English Text
        await new Promise((r) => setTimeout(r, 2000));
        if (!isMounted) break;

        // 2. Trigger text change: English turns to Devanagari
        setLang("hi");
        await new Promise((r) => setTimeout(r, 1500)); // Give text time to finish flipping
        if (!isMounted) break;

        // 3. Icon does its animation
        setIsIconAnimating(true);
        await new Promise((r) => setTimeout(r, 1000));
        if (!isMounted) break;
        
        setIsIconAnimating(false);
        await new Promise((r) => setTimeout(r, 1500)); // Hold on Devanagari text

        // 4. Reverse script: Devanagari turns to English
        setLang("en");
        await new Promise((r) => setTimeout(r, 1500)); // Give text time to finish flipping
        if (!isMounted) break;

        // 5. Icon animates again before repeating
        setIsIconAnimating(true);
        await new Promise((r) => setTimeout(r, 1000));
        if (!isMounted) break;
        
        setIsIconAnimating(false);
        // The while loop automatically repeats!
      }
    };

    runSequence();

    return () => {
      isMounted = false; // Cleanup to prevent memory leaks if component unmounts
    };
  }, []);

  // Text Arrays
  const enText = ["M", "A", "N", "T", "R", "A", "N", "A"];
  const hiText = ["मं", "त्र", "णा"];

  // Staggering variants for the words
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }, // Turns letters one by one
    },
    exit: {
      opacity: 0,
      transition: { staggerChildren: 0.1, staggerDirection: -1 }, // Reverses the turn order when leaving
    },
  };

  // Flip effect for individual letters
  const letterVariants = {
    hidden: { rotateY: 90, opacity: 0 }, // Starts sideways (invisible)
    show: { rotateY: 0, opacity: 1, transition: { duration: 0.3 } }, // Flips to flat
    exit: { rotateY: -90, opacity: 0, transition: { duration: 0.3 } }, // Flips sideways the other way
  };

  return (
    <header className="relative flex h-16 w-full max-w-full items-center overflow-hidden border-y border-zinc-800 bg-gradient-to-b from-zinc-900 to-black font-mono text-[11px] text-zinc-300">
      
      <div className="flex h-full shrink-0 items-center gap-3 border-r border-zinc-800 px-5">
        {/* The Icon */}
        <motion.div
          animate={
            isIconAnimating
              ? { rotate: [0, 180, 360], scale: [1, 1.2, 1] }
              : { rotate: 0, scale: 1 }
          }
          transition={{ duration: 1, ease: "easeInOut" }}
        >
          <Waypoints className="h-8 w-8 text-amber-400" />
        </motion.div>

        {/* The Text Container */}
        {/* We use a fixed width (w-[280px]) and absolute positioning inside so the layout doesn't jump when switching from 8 letters to 3 */}
        <div className="relative flex h-10 w-[280px] items-center leading-none">
          
          {/* AnimatePresence with mode="wait" ensures the first word completely flips away BEFORE the next word starts flipping in */}
          <AnimatePresence mode="wait">
            {lang === "en" ? (
              <motion.div
                key="en"
                variants={containerVariants}
                initial="hidden"
                animate="show"
                exit="exit"
                className="absolute flex text-[33px] font-bold tracking-[0.35em] text-amber-400"
              >
                {enText.map((char, i) => (
                  <motion.span key={i} variants={letterVariants} className="inline-block origin-center">
                    {char}
                  </motion.span>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="hi"
                variants={containerVariants}
                initial="hidden"
                animate="show"
                exit="exit"
                className="absolute flex text-[33px] font-bold tracking-[0.35em] text-amber-400"
              >
                {hiText.map((char, i) => (
                  <motion.span key={i} variants={letterVariants} className="inline-block origin-center">
                    {char}
                  </motion.span>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          
        </div>
      </div>
    </header>
  );
}
type Level = "high" | "med" | "low";

interface Alert {
  lvl: Level;
  loc: string;
  desc: string;
}

const ALERTS: Alert[] = [
  {
    lvl: "high",
    loc: "STRAIT OF HORMUZ",
    desc: "naval traffic disruption reported",
  },
  {
    lvl: "med",
    loc: "EASTERN BORDER",
    desc: "troop movement flagged",
  },
  {
    lvl: "low",
    loc: "CAPITAL REGION",
    desc: "elevated network chatter",
  },
  {
    lvl: "high",
    loc: "PORT AUTHORITY",
    desc: "infrastructure outage",
  },
  {
    lvl: "med",
    loc: "NORTHERN CORRIDOR",
    desc: "supply route rerouted",
  },
];

const levelColor = {
  high: "text-red-400",
  med: "text-amber-400",
  low: "text-cyan-400",
};

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

export default function CommandNavbar() {
  const [zulu, setZulu] = useState("00:00:00Z");
  const [uptime, setUptime] = useState("00:00:00");
  const [feeds, setFeeds] = useState(9);

  useEffect(() => {
    let up = 0;

    const clock = setInterval(() => {
      const d = new Date();

      setZulu(
        `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(
          d.getUTCSeconds()
        )}Z`
      );

      up++;

      const h = Math.floor(up / 3600);
      const m = Math.floor((up % 3600) / 60);
      const s = up % 60;

      setUptime(`${pad(h)}:${pad(m)}:${pad(s)}`);
    }, 1000);

    const feedTimer = setInterval(() => {
      setFeeds(9 + Math.floor(Math.random() * 5));
    }, 8000);

    return () => {
      clearInterval(clock);
      clearInterval(feedTimer);
    };
  }, []);

  return (
    <Header />
  );
}

function Stat({
  label,
  value,
  icon,
  valueClass,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="flex h-full items-center gap-2 border-r border-zinc-800 px-4">
      <span className="text-zinc-500">{label}</span>

      {icon}

      <span className={`font-semibold ${valueClass ?? ""}`}>
        {value}
      </span>
    </div>
  );
}