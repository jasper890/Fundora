// @vitest-environment jsdom
import { createElement, type ComponentType, type PropsWithChildren } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AppShell } from "@/components/AppShell";

vi.mock("next/navigation", () => ({ usePathname: () => "/programs" }));
vi.mock("next/link", () => ({ default: () => null }));

afterEach(cleanup);

it("provides a semantic, focusable main target for the skip link", () => {
  const AppShellWithOptionalChildren = AppShell as unknown as ComponentType<PropsWithChildren>;
  render(createElement(AppShellWithOptionalChildren, null, createElement("h1", null, "Programs")));

  const main = screen.getByRole("main");
  expect(main.id).toBe("main");
  expect(main.tabIndex).toBe(-1);
  expect(screen.getByRole("link", { name: "Skip to content" }).getAttribute("href")).toBe("#main");
});
