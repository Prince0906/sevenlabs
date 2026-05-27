export interface QuickAction {
  title: string;
  description: string;
  gradient: string;
  href: string;
};

export const quickActions: QuickAction[] = [
  {
    title: "Speaking practice",
    description: "Coach your interview delivery — pace, pauses, and fillers",
    gradient: "from-emerald-400 to-emerald-100",
    href: "/practice",
  },
  {
    title: "Review past sessions",
    description: "See your progress and revisit feedback from previous sessions",
    gradient: "from-cyan-400 to-cyan-50",
    href: "/practice/history",
  },
  {
    title: "Practice a job interview",
    description: "Rehearse answering behavioral and technical questions out loud",
    gradient: "from-violet-500 to-violet-100",
    href: "/practice",
  },
  {
    title: "Practice a pitch",
    description: "Nail your startup or project pitch with delivery coaching",
    gradient: "from-pink-400 to-pink-100",
    href: "/practice",
  },
  {
    title: "Practice a presentation",
    description: "Work on pacing and confidence for your next talk or demo",
    gradient: "from-orange-400 to-orange-100",
    href: "/practice",
  },
];
