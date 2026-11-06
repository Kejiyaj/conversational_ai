import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { Button } from "@convai/ui/button";

import App from "../App";

// Spec 007: the starter screen runs on the shared Button and shared logic.
describe("mobile starter screen", () => {
  it("shows text produced by shared logic", async () => {
    await render(<App />);
    expect(screen.getByText("Shared logic is working.")).toBeTruthy();
    expect(screen.getByText("Demo data.")).toBeTruthy();
  });

  it("responds to the shared Button", async () => {
    await render(<App />);
    expect(screen.queryByText("Button pressed")).toBeNull();
    await fireEvent.press(screen.getByText("Try the shared Button"));
    expect(screen.getByText("Button pressed")).toBeTruthy();
  });
});

describe("native Button", () => {
  it("wraps plain text and calls onPress", async () => {
    const onPress = jest.fn();
    await render(<Button onPress={onPress}>Send</Button>);
    await fireEvent.press(screen.getByText("Send"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("applies the classes for its variant and size", async () => {
    await render(
      <Button variant="outline" size="lg">
        Send
      </Button>,
    );
    expect(screen.getByRole("button").props.className).toContain("border-border");
    expect(screen.getByRole("button").props.className).toContain("h-9");
  });

  it("does not call onPress when disabled", async () => {
    const onPress = jest.fn();
    await render(
      <Button disabled onPress={onPress}>
        Send
      </Button>,
    );
    await fireEvent.press(screen.getByText("Send"));
    expect(onPress).not.toHaveBeenCalled();
  });
});
