import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GenerationSettings, type GenerationParams } from "@/components/generation-settings";

describe("GenerationSettings", () => {
  const defaultParams: GenerationParams = {
    temperature: 0.7,
    topP: 0.9,
    topK: 50,
    repetitionPenalty: 1.0,
  };

  it("renders the Voice Settings title", () => {
    render(<GenerationSettings params={defaultParams} onChange={vi.fn()} />);
    expect(screen.getByText("Voice Settings")).toBeInTheDocument();
  });

  it("renders all four setting labels", () => {
    render(<GenerationSettings params={defaultParams} onChange={vi.fn()} />);
    expect(screen.getByText("Temperature")).toBeInTheDocument();
    expect(screen.getByText("Top P")).toBeInTheDocument();
    expect(screen.getByText("Top K")).toBeInTheDocument();
    expect(screen.getByText("Repetition Penalty")).toBeInTheDocument();
  });

  it("displays current parameter values", () => {
    render(<GenerationSettings params={defaultParams} onChange={vi.fn()} />);
    expect(screen.getByText("0.70")).toBeInTheDocument();
    expect(screen.getByText("0.90")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.getByText("1.00")).toBeInTheDocument();
  });

  it("displays integer values without decimals for integer-step params", () => {
    const params = { ...defaultParams, topK: 75 };
    render(<GenerationSettings params={params} onChange={vi.fn()} />);
    expect(screen.getByText("75")).toBeInTheDocument();
  });
});
