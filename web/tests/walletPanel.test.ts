// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WalletPanel } from "@/components/WalletPanel";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/wallet/freighter", () => ({ freighterAvailable: vi.fn(), freighterConnect: vi.fn(), freighterSign: vi.fn() }));

const props = {
  awardId: "award-1", awardStatus: "FUNDED" as const,
  isSponsor: true, isVerifier: false, isRecipient: false,
  hasLedger: true, expectedVersion: "3", ownHold: false,
  hasHold: false, verifierSyncRequired: false,
  claimDeadline: "2100-01-01T00:00:00Z", reviewDeadline: "2100-01-02T00:00:00Z",
  payoutDeadline: "2100-01-03T00:00:00Z",
  replacementVerifierOptions: [{ id: "verifier-2", username: "Other verifier", wallet: "G-OTHER" }],
};

const fetchMock = vi.fn();
beforeEach(() => {
  sessionStorage.clear();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (_url, init) => new Response(JSON.stringify(init ? {
    id: "op-1", status: "PREPARED", unsigned_xdr: "FAKE-XDR", preview: { mode: "fakerpc" },
  } : { operation: null }), { status: 200 }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function preparedBody() {
  const request = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
  return { url: request?.[0], body: JSON.parse(request?.[1]?.body ?? "null") };
}

describe("wallet secondary controls", () => {
  it("prepares sponsor cancellation with the current version", async () => {
    render(createElement(WalletPanel, { ...props, awardStatus: "CREATED" }));
    fireEvent.click(screen.getByRole("button", { name: "Prepare award cancellation" }));
    await waitFor(() => expect(preparedBody()).toEqual({
      url: "/api/v1/awards/award-1/prepare/CANCEL",
      body: { expected_version: "3", params: {} },
    }));
  });

  it("prepares expiry refund with the current version even when held", async () => {
    render(createElement(WalletPanel, {
      ...props,
      awardStatus: "REJECTED",
      ownHold: true,
      hasHold: true,
      payoutDeadline: "2020-01-01T00:00:00Z",
    }));
    fireEvent.click(screen.getByRole("button", { name: "Prepare expiry refund" }));
    await waitFor(() => expect(preparedBody()).toEqual({
      url: "/api/v1/awards/award-1/prepare/REFUND",
      body: { expected_version: "3", params: {} },
    }));
  });

  it("prepares only the actor's hold with the current version", async () => {
    render(createElement(WalletPanel, { ...props, ownHold: true, hasHold: true }));
    fireEvent.click(screen.getByRole("button", { name: "Prepare removal of your hold" }));
    await waitFor(() => expect(preparedBody()).toEqual({
      url: "/api/v1/awards/award-1/prepare/SET_HOLD",
      body: { expected_version: "3", params: { held: false } },
    }));
  });

  it("prepares verifier rejection while held using the current version and no ABI params", async () => {
    render(createElement(WalletPanel, {
      ...props,
      awardStatus: "SUBMITTED",
      isSponsor: false,
      isVerifier: true,
      ownHold: true,
      hasHold: true,
    }));
    fireEvent.click(screen.getByRole("button", { name: "Prepare rejection" }));
    expect(screen.getByRole("link", { name: "Open evidence review" }).getAttribute("href")).toBe("/awards/award-1/review");
    await waitFor(() => expect(preparedBody()).toEqual({
      url: "/api/v1/awards/award-1/prepare/REJECT",
      body: { expected_version: "3", params: {} },
    }));
  });

  it("prepares verifier reopening using the current version and no ABI params", async () => {
    render(createElement(WalletPanel, {
      ...props,
      awardStatus: "REJECTED",
      isSponsor: false,
      isVerifier: true,
    }));
    fireEvent.click(screen.getByRole("button", { name: "Prepare reopening" }));
    await waitFor(() => expect(preparedBody()).toEqual({
      url: "/api/v1/awards/award-1/prepare/REOPEN",
      body: { expected_version: "3", params: {} },
    }));
  });

  it("requires a selected program verifier and sends the membership id", async () => {
    render(createElement(WalletPanel, props));
    const button = screen.getByRole("button", { name: "Prepare verifier replacement" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByRole("combobox", { name: "Replacement verifier" }), { target: { value: "verifier-2" } });
    fireEvent.click(button);
    await waitFor(() => expect(preparedBody()).toEqual({
      url: "/api/v1/awards/award-1/prepare/REPLACE_VERIFIER",
      body: { expected_version: "3", params: { new_verifier_member_id: "verifier-2" } },
    }));
  });

  it("prepares TTL maintenance without a business version", async () => {
    render(createElement(WalletPanel, { ...props, awardStatus: "PAID" as never }));
    fireEvent.click(screen.getByRole("button", { name: "Prepare storage lifetime extension" }));
    await waitFor(() => expect(preparedBody()).toEqual({
      url: "/api/v1/awards/award-1/prepare/EXTEND_TTL", body: { params: {} },
    }));
    expect(screen.queryByRole("button", { name: "Prepare your hold" })).toBeNull();
  });

  it("disables secondary preparation while an operation reserves the source", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ operation: { id: "existing", status: "UNKNOWN" } }), { status: 200 }));
    render(createElement(WalletPanel, props));
    await screen.findByText(/Resumed operation/);
    expect((screen.getByRole("group", { name: "Recovery and maintenance" }) as HTMLFieldSetElement).disabled).toBe(true);
  });
});
