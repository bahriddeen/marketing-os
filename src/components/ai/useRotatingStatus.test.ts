// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRotatingStatus } from "./useRotatingStatus";

function mockMatchMedia(reduceMotion: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: reduceMotion,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("useRotatingStatus", () => {
  it("returns an empty string when inactive", () => {
    mockMatchMedia(false);
    const { result } = renderHook(() =>
      useRotatingStatus(false, ["A", "B", "C"]),
    );
    expect(result.current).toBe("");
  });

  it("starts on the first message and cycles on the interval", () => {
    mockMatchMedia(false);
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useRotatingStatus(true, ["A", "B", "C"], 1000),
    );
    expect(result.current).toBe("A");

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe("B");

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe("C");
  });

  it("loops back to the first message after the last one", () => {
    mockMatchMedia(false);
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useRotatingStatus(true, ["A", "B"], 1000),
    );
    act(() => {
      vi.advanceTimersByTime(1000); // -> B
      vi.advanceTimersByTime(1000); // -> loop to A
    });
    expect(result.current).toBe("A");
  });

  it("resets to the first message when reactivated", () => {
    mockMatchMedia(false);
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ active }) => useRotatingStatus(active, ["A", "B", "C"], 1000),
      { initialProps: { active: true } },
    );
    act(() => {
      vi.advanceTimersByTime(1000); // -> B
    });
    expect(result.current).toBe("B");

    rerender({ active: false });
    expect(result.current).toBe("");

    rerender({ active: true });
    expect(result.current).toBe("A");
  });

  it("holds on the first message under prefers-reduced-motion", () => {
    mockMatchMedia(true);
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useRotatingStatus(true, ["A", "B", "C"], 1000),
    );
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current).toBe("A");
  });
});
