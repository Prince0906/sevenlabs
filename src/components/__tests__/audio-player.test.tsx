import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AudioPlayer } from "@/components/audio-player";

describe("AudioPlayer", () => {
  const defaultProps = {
    audioUrl: "/audio/test.wav",
    voiceName: "Rachel",
    text: "Hello, this is a test of the audio player component.",
  };

  it("renders the voice name", () => {
    render(<AudioPlayer {...defaultProps} />);
    expect(screen.getByText("Rachel")).toBeInTheDocument();
  });

  it("renders the text preview", () => {
    render(<AudioPlayer {...defaultProps} />);
    expect(screen.getByText(defaultProps.text)).toBeInTheDocument();
  });

  it("renders the audio element with correct src", () => {
    const { container } = render(<AudioPlayer {...defaultProps} />);
    const audio = container.querySelector("audio");
    expect(audio).toBeTruthy();
    expect(audio?.getAttribute("src")).toBe("/audio/test.wav");
  });

  it("displays initial time as 0:00 / 0:00", () => {
    render(<AudioPlayer {...defaultProps} />);
    expect(screen.getByText("0:00 / 0:00")).toBeInTheDocument();
  });
});
