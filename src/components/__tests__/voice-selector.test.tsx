import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { VoiceSelector, type VoiceOption } from "@/components/voice-selector";

const mockVoices: VoiceOption[] = [
  {
    id: "v1",
    name: "Rachel",
    category: "CONVERSATIONAL",
    variant: "SYSTEM",
    language: "en-US",
  },
  {
    id: "v2",
    name: "Adam",
    category: "NARRATIVE",
    variant: "SYSTEM",
    language: "en-US",
  },
  {
    id: "v3",
    name: "My Voice",
    category: "GENERAL",
    variant: "CUSTOM",
    language: "en-US",
  },
];

describe("VoiceSelector", () => {
  it("renders without crashing", () => {
    render(<VoiceSelector voices={mockVoices} value="" onValueChange={vi.fn()} />);
    expect(screen.getByText("Select a voice...")).toBeInTheDocument();
  });

  it("renders with empty voices array", () => {
    render(<VoiceSelector voices={[]} value="" onValueChange={vi.fn()} />);
    expect(screen.getByText("Select a voice...")).toBeInTheDocument();
  });

  it("accepts disabled prop", () => {
    const { container } = render(
      <VoiceSelector voices={mockVoices} value="" onValueChange={vi.fn()} disabled />
    );
    const trigger = container.querySelector("[data-slot='select-trigger']");
    expect(trigger).toBeTruthy();
  });
});
