import { describe, it, expect } from "vitest";
import type { PanelSeatPublic } from "@sevenlabs/shared-types";
import {
  panelReducer,
  initialPanelState,
  type PanelState,
} from "../lib/panel-machine";

function seats(): PanelSeatPublic[] {
  return [
    { id: "s0", personaName: "Maya", ownedLPs: [], isBarRaiser: false, voice: "alloy" },
    { id: "s1", personaName: "Dev", ownedLPs: [], isBarRaiser: false, voice: "verse" },
    { id: "s2", personaName: "Priya", ownedLPs: [], isBarRaiser: true, voice: "sage" },
  ];
}

function driveToLive(): PanelState {
  let s = panelReducer(initialPanelState(), { type: "START" });
  s = panelReducer(s, { type: "MIC_GRANTED" });
  s = panelReducer(s, {
    type: "CREATE_OK",
    sessionId: "sess1",
    seats: seats(),
    maxDurationSec: 2700,
    ephemeralExpiresAt: 1000,
  });
  s = panelReducer(s, { type: "DC_OPEN" });
  s = panelReducer(s, { type: "PATCH_LIVE_OK" });
  return s;
}

function reconnectToLive(s: PanelState): PanelState {
  s = panelReducer(s, { type: "DC_OPEN" });
  return panelReducer(s, { type: "RESUMED_LIVE" });
}

describe("panelReducer — happy path to live", () => {
  it("reaches live with reachedLive set and seat 0 active", () => {
    const s = driveToLive();
    expect(s.phase).toBe("live");
    expect(s.reachedLive).toBe(true);
    expect(s.activeSeatIndex).toBe(0);
  });
});

describe("panelReducer — seat handoff", () => {
  it("hands off seat0 -> seat1 on the closing sentinel", () => {
    let s = driveToLive();
    s = panelReducer(s, { type: "COACH_DONE", transcript: "Great. Handing you to my colleague." });
    expect(s.phase).toBe("handing-off");
    s = panelReducer(s, { type: "MINT_OK", ephemeralExpiresAt: 2000 });
    expect(s.phase).toBe("connecting");
    expect(s.activeSeatIndex).toBe(1);
    expect(s.completedSeatIndexes).toEqual([0]);
    expect(s.exchangeCount).toBe(0);
  });

  it("hands off via the exchange budget cap when the sentinel is absent", () => {
    let s = driveToLive();
    for (let i = 0; i < 3; i++) s = panelReducer(s, { type: "USER_TURN" });
    expect(s.exchangeCount).toBe(3);
    s = panelReducer(s, { type: "COACH_DONE", transcript: "ok, next question" });
    expect(s.phase).toBe("handing-off");
  });

  it("sequences 0 -> 1 -> 2 then wraps after the last (Bar Raiser) seat", () => {
    let s = driveToLive();
    s = panelReducer(s, { type: "COACH_DONE", transcript: "Handing you to my colleague." });
    s = panelReducer(s, { type: "MINT_OK", ephemeralExpiresAt: 2 });
    s = reconnectToLive(s);
    expect(s.activeSeatIndex).toBe(1);
    expect(s.phase).toBe("live");

    s = panelReducer(s, { type: "COACH_DONE", transcript: "Handing you to my colleague." });
    s = panelReducer(s, { type: "MINT_OK", ephemeralExpiresAt: 3 });
    s = reconnectToLive(s);
    expect(s.activeSeatIndex).toBe(2);

    // last seat: no sentinel, budget cap of 4
    for (let i = 0; i < 4; i++) s = panelReducer(s, { type: "USER_TURN" });
    s = panelReducer(s, { type: "COACH_DONE", transcript: "thank you" });
    expect(s.phase).toBe("wrapping");
    expect(s.completedSeatIndexes).toEqual([0, 1]);
  });
});

describe("panelReducer — create recovery", () => {
  it("adopts the sessionId on a duplicate create (never nav to undefined)", () => {
    let s = panelReducer(initialPanelState(), { type: "START" });
    s = panelReducer(s, { type: "MIC_GRANTED" });
    s = panelReducer(s, { type: "CREATE_DUPLICATE", sessionId: "existing-1" });
    expect(s.sessionId).toBe("existing-1");
    s = panelReducer(s, { type: "ADOPTED", status: "DEBRIEF" });
    expect(s.phase).toBe("debrief-polling");
  });

  it("surfaces already-live recovery without a session id", () => {
    let s = panelReducer(initialPanelState(), { type: "START" });
    s = panelReducer(s, { type: "MIC_GRANTED" });
    s = panelReducer(s, { type: "CREATE_ALREADY_LIVE" });
    expect(s.phase).toBe("error");
    expect(s.recovery).toBe("already-live");
    expect(s.sessionId).toBeNull();
  });
});

describe("panelReducer — mint / ceiling recovery", () => {
  it("routes a 410 SESSION_EXPIRED mint at handoff to wrapping", () => {
    let s = driveToLive();
    s = panelReducer(s, { type: "COACH_DONE", transcript: "Handing you to my colleague." });
    expect(s.phase).toBe("handing-off");
    s = panelReducer(s, { type: "MINT_EXPIRED" });
    expect(s.phase).toBe("wrapping");
    expect(s.hitCeiling).toBe(true);
  });

  it("reconciles a not-renewable mint by server status", () => {
    const base = { ...driveToLive(), phase: "reconnecting" as const };
    expect(panelReducer(base, { type: "MINT_NOT_RENEWABLE", status: "DEBRIEF" }).phase).toBe("debrief-polling");
    expect(panelReducer(base, { type: "MINT_NOT_RENEWABLE", status: "COMPLETED" }).phase).toBe("report");
    expect(panelReducer(base, { type: "MINT_NOT_RENEWABLE", status: "PENDING" }).recovery).toBe("not-startable");
  });

  it("a turns sessionExpired routes to wrapping (judge what exists)", () => {
    const s = panelReducer(driveToLive(), { type: "SESSION_EXPIRED" });
    expect(s.phase).toBe("wrapping");
    expect(s.hitCeiling).toBe(true);
  });
});

describe("panelReducer — complete / report", () => {
  it("treats complete-not-completable as not-startable", () => {
    let s = panelReducer(initialPanelState(), { type: "START" });
    s = panelReducer(s, { type: "COMPLETE_NOT_COMPLETABLE" });
    expect(s.phase).toBe("error");
    expect(s.recovery).toBe("not-startable");
  });

  it("distinguishes judgment-timeout from session-failed on report FAILED", () => {
    const live = driveToLive();
    expect(panelReducer(live, { type: "REPORT_FAILED", reason: "judgment_timeout" }).recovery).toBe("judgment-timeout");
    expect(panelReducer(live, { type: "REPORT_FAILED" }).recovery).toBe("session-failed");
  });
});

describe("panelReducer — barge-in / disconnect", () => {
  it("counts a barge-in only when speech starts during an in-flight coach response", () => {
    let s = driveToLive();
    s = panelReducer(s, { type: "SPEECH_STARTED" });
    expect(s.bargeIns).toBe(0);
    s = panelReducer(s, { type: "COACH_RESPONSE_START" });
    s = panelReducer(s, { type: "SPEECH_STARTED" });
    expect(s.bargeIns).toBe(1);
    s = panelReducer(s, { type: "COACH_RESPONSE_DONE", cancelled: true });
    expect(s.coachResponseInFlight).toBe(false);
    expect(s.interruptions).toBe(1);
  });

  it("reconnects when live, but a disconnect before LIVE is not-startable", () => {
    expect(panelReducer(driveToLive(), { type: "DISCONNECTED" }).phase).toBe("reconnecting");
    const preLive = panelReducer(
      panelReducer(initialPanelState(), { type: "START" }),
      { type: "MIC_GRANTED" }
    );
    expect(panelReducer(preLive, { type: "DISCONNECTED" }).recovery).toBe("not-startable");
  });
});
