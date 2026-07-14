import { describe, it, expect } from "vitest";
import {
  countFillers,
  detectRepetitions,
  detectFalseStarts,
  measurePauses,
  analyzeDisfluency,
  aggregateDisfluency,
  fromWordTimestamps,
  type DisfluencyWord,
} from "../disfluency";

const w = (
  text: string,
  start: number,
  end: number,
  extra: Partial<DisfluencyWord> = {}
): DisfluencyWord => ({ text, start, end, ...extra });

describe("countFillers", () => {
  it("counts single-token fillers and reports per-type + per-100-words", () => {
    const r = countFillers([w("um", 0, 0.3), w("uh", 0.5, 0.7), w("so", 1, 1.2), w("hello", 1.5, 2)]);
    expect(r.total).toBe(2);
    expect(r.byType).toEqual({ um: 1, uh: 1 });
    expect(r.per100Words).toBe(50); // 2 of 4 tokens
  });

  it("catches elongated spellings via the lexicon", () => {
    expect(countFillers([w("ummm", 0, 0.6)]).total).toBe(1);
  });

  it("counts a discourse-marker phrase once, not per token", () => {
    const r = countFillers([w("you", 0, 0.2), w("know", 0.2, 0.5), w("the", 1, 1.2), w("answer", 1.2, 1.6)]);
    expect(r.total).toBe(1);
    expect(r.byType).toEqual({ "you know": 1 });
  });

  it("does NOT count ambiguous words like 'like' by default", () => {
    expect(countFillers([w("like", 0, 0.3), w("hello", 1, 1.5)]).total).toBe(0);
  });

  it("DOES count a token the vendor flagged as a filler, even 'like'", () => {
    const r = countFillers([w("like", 0, 0.3, { isFiller: true })]);
    expect(r.total).toBe(1);
    expect(r.byType).toEqual({ like: 1 });
  });
});

describe("detectRepetitions", () => {
  it("counts a consecutive single-word run ('I I I' -> count 3)", () => {
    const r = detectRepetitions([w("I", 0, 0.2), w("I", 0.3, 0.5), w("I", 0.6, 0.8), w("was", 1, 1.3)]);
    expect(r.total).toBe(1);
    expect(r.instances[0]).toMatchObject({ phrase: "I", count: 3 });
  });

  it("counts a doubled word ('the the' -> count 2)", () => {
    const r = detectRepetitions([w("the", 0, 0.2), w("the", 0.3, 0.5), w("cat", 1, 1.3)]);
    expect(r.instances[0]).toMatchObject({ phrase: "the", count: 2 });
  });

  it("detects a repeated phrase ('I was I was')", () => {
    const r = detectRepetitions([
      w("I", 0, 0.2), w("was", 0.2, 0.5), w("I", 0.6, 0.8), w("was", 0.8, 1.1), w("happy", 1.3, 1.7),
    ]);
    expect(r.total).toBe(1);
    expect(r.instances[0]).toMatchObject({ phrase: "I was", count: 2 });
  });

  it("sees through a filler between the repeats ('I um I')", () => {
    const r = detectRepetitions([w("I", 0, 0.2), w("um", 0.3, 0.5), w("I", 0.6, 0.8), w("think", 1, 1.3)]);
    expect(r.instances[0]).toMatchObject({ phrase: "I", count: 2 });
  });

  it("does not flag a fluent sentence", () => {
    expect(detectRepetitions([w("the", 0, 0.2), w("quick", 0.3, 0.6), w("fox", 0.7, 1)]).total).toBe(0);
  });
});

describe("detectFalseStarts", () => {
  it("flags a vendor-marked partial word", () => {
    expect(detectFalseStarts([w("wa", 0, 0.2, { partial: true }), w("water", 0.3, 0.7)]).total).toBe(1);
  });
  it("flags a trailing-hyphen cut-off", () => {
    const r = detectFalseStarts([w("wa-", 0, 0.2), w("water", 0.3, 0.7)]);
    expect(r.instances[0]).toMatchObject({ fragment: "wa-" });
  });
  it("ignores a complete word", () => {
    expect(detectFalseStarts([w("water", 0, 0.5)]).total).toBe(0);
  });
});

describe("measurePauses", () => {
  it("counts only notable gaps but sums all silence", () => {
    const r = measurePauses([w("a", 0, 1), w("b", 1.2, 1.5), w("c", 3, 3.5)]);
    expect(r.count).toBe(1); // only the 1.5s gap clears 0.5s
    expect(r.longestSec).toBe(1.5);
    expect(r.totalSilentSec).toBe(1.7); // 0.2 + 1.5
    expect(r.instances[0]).toMatchObject({ sec: 1.5, atSec: 1.5 });
  });
  it("honours a custom threshold", () => {
    expect(measurePauses([w("a", 0, 1), w("b", 1.2, 1.5), w("c", 3, 3.5)], 0.1).count).toBe(2);
  });
});

describe("analyzeDisfluency (integration)", () => {
  const answer: DisfluencyWord[] = [
    w("um", 0, 0.3), w("I", 0.5, 0.7), w("I", 0.8, 1), w("think", 1.1, 1.5),
    w("the", 2.5, 2.7), w("the", 2.8, 3), w("answer", 3.1, 3.6), w("is", 3.7, 3.9),
    w("uh", 4, 4.3), w("useMemo", 5.5, 6.2),
  ];

  it("reports fillers, repetitions, and notable pauses together", () => {
    const r = analyzeDisfluency(answer);
    expect(r.wordCount).toBe(10);
    expect(r.durationSec).toBe(6.2);
    expect(r.fillers.total).toBe(2); // um, uh
    expect(r.repetitions.total).toBe(2); // "I I", "the the"
    expect(r.falseStarts.total).toBe(0);
    expect(r.pauses.count).toBe(2); // the 1.0s and 1.2s gaps
    expect(r.pauses.longestSec).toBe(1.2);
  });

  it("sorts unordered input by start time", () => {
    const shuffled = [answer[3]!, answer[0]!, answer[9]!, answer[1]!];
    const r = analyzeDisfluency(shuffled);
    expect(r.durationSec).toBeGreaterThan(0);
  });

  it("is empty-safe", () => {
    const r = analyzeDisfluency([]);
    expect(r.wordCount).toBe(0);
    expect(r.fillers.total).toBe(0);
    expect(r.pauses.count).toBe(0);
  });
});

describe("aggregateDisfluency", () => {
  const answer1 = analyzeDisfluency([
    w("um", 0, 0.3), w("I", 0.5, 0.7), w("I", 0.8, 1), w("think", 1.1, 1.5),
    w("uh", 2.5, 2.8), w("yes", 4.5, 5),
  ]);
  const answer2 = analyzeDisfluency([
    w("um", 0, 0.3), w("the", 0.5, 0.7), w("the", 0.8, 1), w("answer", 1.1, 1.6),
  ]);

  it("merges fillers, repeats, and pauses across answers and ranks top fillers", () => {
    const agg = aggregateDisfluency([answer1, answer2])!;
    expect(agg.answersScored).toBe(2);
    expect(agg.fillerTotal).toBe(3); // um, uh, um
    expect(agg.topFillers[0]).toEqual({ token: "um", count: 2 }); // most frequent first
    expect(agg.repetitionTotal).toBe(2); // "I I" + "the the"
    expect(agg.longestPauseSec).toBeGreaterThanOrEqual(1.5);
  });

  it("returns null when no answer has words", () => {
    expect(aggregateDisfluency([])).toBeNull();
  });
});

describe("fromWordTimestamps", () => {
  it("maps Whisper {word,start,end} into the engine's {text,start,end}", () => {
    expect(fromWordTimestamps([{ word: "hi", start: 0, end: 0.5 }])).toEqual([
      { text: "hi", start: 0, end: 0.5 },
    ]);
  });
});
