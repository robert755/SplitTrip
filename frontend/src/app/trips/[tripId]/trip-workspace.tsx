"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  ApiError,
  apiRequest,
  type Expense,
  type Participant,
  type Settlements,
  type Trip,
} from "@/lib/api";

function parseCents(value: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) {
    return null;
  }
  const [whole, fraction = ""] = value.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

function parseSignedCents(value: string): number {
  const isNegative = value.startsWith("-");
  const magnitude = parseCents(isNegative ? value.slice(1) : value) ?? 0;
  return isNegative ? -magnitude : magnitude;
}

function formatCents(value: number): string {
  const whole = Math.floor(value / 100);
  const fraction = (value % 100).toString().padStart(2, "0");
  return `${whole}.${fraction}`;
}

function formatMoney(value: string, currency: string): string {
  return `${value} ${currency}`;
}

function splitEqually(
  amount: string,
  participantIds: string[],
): Record<string, string> {
  const total = parseCents(amount);
  if (total === null || total <= 0 || participantIds.length === 0) {
    return {};
  }

  const baseShare = Math.floor(total / participantIds.length);
  const remainder = total % participantIds.length;
  return Object.fromEntries(
    participantIds.map((participantId, index) => [
      participantId,
      formatCents(baseShare + (index < remainder ? 1 : 0)),
    ]),
  );
}

function apiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function TripWorkspace({ tripId }: { tripId: string }) {
  const router = useRouter();
  const { accessToken, user, isInitializing, logout } = useAuth();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlements | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingParticipant, setIsAddingParticipant] = useState(false);
  const [isDeletingParticipantId, setIsDeletingParticipantId] = useState<
    string | null
  >(null);
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [participantName, setParticipantName] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [payerId, setPayerId] = useState("");
  const [includedParticipantIds, setIncludedParticipantIds] = useState<
    string[]
  >([]);
  const [shareAmounts, setShareAmounts] = useState<Record<string, string>>({});
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [hasCompletedPeopleStep, setHasCompletedPeopleStep] = useState(false);

  useEffect(() => {
    if (isInitializing) {
      return;
    }
    if (!accessToken) {
      router.replace("/login");
      return;
    }

    let active = true;
    const headers = { Authorization: `Bearer ${accessToken}` };

    void apiRequest<Trip[]>("/trips", { headers })
      .then(async (trips) => {
        const selectedTrip = trips.find((candidate) => candidate.id === tripId);
        if (!selectedTrip) {
          throw new ApiError("We couldn't find that trip.", 404);
        }

        const [savedParticipants, savedExpenses] = await Promise.all([
          apiRequest<Participant[]>(`/trips/${tripId}/participants`, {
            headers,
          }),
          apiRequest<Expense[]>(`/trips/${tripId}/expenses`, { headers }),
        ]);

        if (active) {
          setTrip(selectedTrip);
          setParticipants(savedParticipants);
          setExpenses(savedExpenses);
          setPayerId(savedParticipants[0]?.id ?? "");
          setIncludedParticipantIds(
            savedParticipants.map((participant) => participant.id),
          );
          setHasCompletedPeopleStep(savedParticipants.length > 0);
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            apiErrorMessage(
              loadError,
              "We couldn't load this trip. Check your connection and try again.",
            ),
          );
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [accessToken, isInitializing, router, tripId]);

  const totalSpent = useMemo(
    () =>
      expenses.reduce(
        (total, expense) => total + (parseCents(expense.amount) ?? 0),
        0,
      ),
    [expenses],
  );

  async function addParticipant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) {
      router.replace("/login");
      return;
    }

    const name = participantName.trim();
    if (!name) {
      setError("Enter a name for this participant.");
      return;
    }
    if (
      participants.some(
        (participant) =>
          participant.name.trim().toLocaleLowerCase() ===
          name.toLocaleLowerCase(),
      )
    ) {
      setError("A participant with this name already exists in this trip.");
      return;
    }

    setError("");
    setNotice("");
    setIsAddingParticipant(true);
    try {
      const participant = await apiRequest<Participant>(
        `/trips/${tripId}/participants`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ name }),
        },
      );
      const nextParticipantIds = [...includedParticipantIds, participant.id];
      setParticipants((current) =>
        [...current, participant].sort((left, right) =>
          left.name.localeCompare(right.name),
        ),
      );
      setPayerId((current) => current || participant.id);
      setIncludedParticipantIds(nextParticipantIds);
      setShareAmounts(splitEqually(amount, nextParticipantIds));
      setParticipantName("");
      setSettlements(null);
      setNotice(`${participant.name} is in the group.`);
    } catch (createError) {
      setError(
        apiErrorMessage(
          createError,
          "We couldn't add that participant. Please try again.",
        ),
      );
    } finally {
      setIsAddingParticipant(false);
    }
  }

  async function deleteParticipant(participant: Participant) {
    if (
      !window.confirm(
        `Remove ${participant.name} from this trip? People used in expenses cannot be removed.`,
      )
    ) {
      return;
    }
    if (!accessToken) {
      router.replace("/login");
      return;
    }

    setError("");
    setNotice("");
    setIsDeletingParticipantId(participant.id);
    try {
      await apiRequest<void>(
        `/trips/${tripId}/participants/${participant.id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      setParticipants((current) =>
        current.filter(
          (currentParticipant) => currentParticipant.id !== participant.id,
        ),
      );
      setIncludedParticipantIds((current) =>
        current.filter((id) => id !== participant.id),
      );
      setShareAmounts((current) =>
        Object.fromEntries(
          Object.entries(current).filter(([id]) => id !== participant.id),
        ),
      );
      setPayerId((current) =>
        current === participant.id
          ? (participants.find((candidate) => candidate.id !== participant.id)
              ?.id ?? "")
          : current,
      );
      setSettlements(null);
      setNotice(`${participant.name} was removed from the trip.`);
    } catch (deleteError) {
      setError(
        apiErrorMessage(
          deleteError,
          "We couldn't remove this person. Please try again.",
        ),
      );
    } finally {
      setIsDeletingParticipantId(null);
    }
  }

  function changeAmount(value: string) {
    setAmount(value);
    setShareAmounts(splitEqually(value, includedParticipantIds));
  }

  function continueToExpenses() {
    if (participants.length === 0) {
      setError("Add at least one person before continuing.");
      return;
    }
    setError("");
    setHasCompletedPeopleStep(true);
    window.requestAnimationFrame(() => {
      document
        .querySelector(".expense-panel")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function toggleIncludedParticipant(participantId: string) {
    const nextIds = includedParticipantIds.includes(participantId)
      ? includedParticipantIds.filter((id) => id !== participantId)
      : [...includedParticipantIds, participantId];
    setIncludedParticipantIds(nextIds);
    setShareAmounts(splitEqually(amount, nextIds));
  }

  function startEditingExpense(expense: Expense) {
    setEditingExpenseId(expense.id);
    setDescription(expense.description);
    setAmount(expense.amount);
    setPayerId(expense.payer.id);
    const expenseParticipantIds = expense.shares.map(
      (share) => share.participantId,
    );
    setIncludedParticipantIds(expenseParticipantIds);
    setShareAmounts(
      Object.fromEntries(
        expense.shares.map((share) => [share.participantId, share.amount]),
      ),
    );
    setError("");
    setNotice(`Editing "${expense.description}".`);
    document
      .querySelector(".expense-entry-form")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function cancelEditingExpense() {
    setEditingExpenseId(null);
    setDescription("");
    setAmount("");
    setShareAmounts({});
    setIncludedParticipantIds(
      participants.map((participant) => participant.id),
    );
    setPayerId(participants[0]?.id ?? "");
    setNotice("");
  }

  async function addExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) {
      router.replace("/login");
      return;
    }

    const total = parseCents(amount);
    if (total === null || total <= 0) {
      setError(
        "Enter a valid amount greater than zero, with up to 2 decimals.",
      );
      return;
    }
    if (!payerId || includedParticipantIds.length === 0) {
      setError(
        "Choose who paid and at least one person to split this expense.",
      );
      return;
    }

    const shares = includedParticipantIds.map((participantId) => ({
      participantId,
      amount: shareAmounts[participantId] ?? "",
    }));
    const parsedShares = shares.map((share) => parseCents(share.amount));
    if (
      parsedShares.some((share) => share === null || share <= 0) ||
      parsedShares.reduce<number>((sum, share) => sum + (share ?? 0), 0) !==
        total
    ) {
      setError(
        "Each share must be positive and all shares must add up to the total.",
      );
      return;
    }

    setError("");
    setNotice("");
    setIsSubmittingExpense(true);
    try {
      const isEditing = editingExpenseId !== null;
      const expenseBody = {
        description: description.trim(),
        payerId,
        amount: formatCents(total),
        shares: shares.map((share, index) => ({
          ...share,
          amount: formatCents(parsedShares[index] ?? 0),
        })),
      };
      const expense = await apiRequest<Expense>(
        `/trips/${tripId}/expenses${editingExpenseId ? `/${editingExpenseId}` : ""}`,
        {
          method: editingExpenseId ? "PATCH" : "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify(expenseBody),
        },
      );
      setExpenses((current) =>
        editingExpenseId
          ? current
              .map((currentExpense) =>
                currentExpense.id === editingExpenseId ? expense : currentExpense,
              )
              .sort((left, right) =>
                right.createdAt.localeCompare(left.createdAt),
              )
          : [expense, ...current],
      );
      setEditingExpenseId(null);
      setDescription("");
      setAmount("");
      setShareAmounts({});
      setSettlements(null);
      setNotice(
        isEditing
          ? "Expense updated. The settlement plan is ready to recalculate."
          : "Expense added. The settlement plan is ready to recalculate.",
      );
    } catch (createError) {
      setError(
        apiErrorMessage(
          createError,
          "We couldn't add that expense. Please check the details and try again.",
        ),
      );
    } finally {
      setIsSubmittingExpense(false);
    }
  }

  async function calculateSettlements() {
    if (!accessToken) {
      router.replace("/login");
      return;
    }

    setError("");
    setNotice("");
    setIsCalculating(true);
    try {
      const result = await apiRequest<Settlements>(
        `/trips/${tripId}/settlements`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      setSettlements(result);
    } catch (calculateError) {
      setError(
        apiErrorMessage(
          calculateError,
          "We couldn't calculate the settlement plan. Please try again.",
        ),
      );
    } finally {
      setIsCalculating(false);
    }
  }

  async function signOut() {
    setError("");
    setIsSigningOut(true);
    try {
      await logout();
      router.replace("/");
    } catch (logoutError) {
      setError(
        apiErrorMessage(
          logoutError,
          "We couldn't sign you out. Please try again.",
        ),
      );
    } finally {
      setIsSigningOut(false);
    }
  }

  if (isLoading || isInitializing || !accessToken) {
    return (
      <main className="dashboard-loading" aria-live="polite">
        Opening your trip...
      </main>
    );
  }

  return (
    <main className="dashboard-page workspace-page">
      <header className="dashboard-header">
        <Link aria-label="SplitTrip home" className="brand" href="/">
          <span aria-hidden="true" className="brand-mark">
            <span />
            <span />
          </span>
          <span>
            split<span className="brand-light">trip</span>
          </span>
        </Link>
        <div className="dashboard-account">
          <Link className="workspace-back-link" href="/trips">
            All trips
          </Link>
          <span>{user?.email}</span>
          <button
            className="dashboard-signout"
            disabled={isSigningOut}
            onClick={signOut}
            type="button"
          >
            {isSigningOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </header>

      <section className="workspace-content">
        {trip ? (
          <>
            <div className="workspace-heading">
              <div>
                <p className="section-kicker">YOUR SHARED TRIP</p>
                <h1>{trip.name}</h1>
                <p className="workspace-subtitle">
                  Bring the group together. Keep the money part simple.
                </p>
              </div>
              <span className="workspace-currency">{trip.currency}</span>
            </div>

            <div className="workspace-stats">
              <article>
                <span>PEOPLE</span>
                <strong>{participants.length}</strong>
              </article>
              <article>
                <span>EXPENSES</span>
                <strong>{expenses.length}</strong>
              </article>
              <article>
                <span>TOTAL SPENT</span>
                <strong>
                  {formatMoney(formatCents(totalSpent), trip.currency)}
                </strong>
              </article>
            </div>

            {error && (
              <p className="dashboard-error" role="alert">
                {error}
              </p>
            )}
            {notice && <p className="workspace-notice">{notice}</p>}

            <div
              className={`workspace-grid ${hasCompletedPeopleStep ? "" : "people-only-grid"}`}
            >
              <section className="workspace-panel participants-panel">
                <div className="workspace-panel-heading">
                  <div>
                    <p className="section-kicker">THE CREW</p>
                    <h2>People</h2>
                  </div>
                  <span className="workspace-count">{participants.length}</span>
                </div>

                <form
                  className="workspace-inline-form"
                  onSubmit={addParticipant}
                >
                  <label htmlFor="participant-name">
                    Add someone to the trip
                  </label>
                  <div>
                    <input
                      id="participant-name"
                      maxLength={100}
                      onChange={(event) =>
                        setParticipantName(event.target.value)
                      }
                      placeholder="Their name"
                      required
                      value={participantName}
                    />
                    <button disabled={isAddingParticipant} type="submit">
                      {isAddingParticipant ? "Adding..." : "＋ Add"}
                    </button>
                  </div>
                </form>

                {participants.length > 0 ? (
                  <ul className="participant-list">
                    {participants.map((participant, index) => (
                      <li key={participant.id}>
                        <span
                          className={`participant-avatar avatar-${index % 4}`}
                        >
                          {participant.name.slice(0, 1).toUpperCase()}
                        </span>
                        <span className="participant-name">
                          {participant.name}
                        </span>
                        <button
                          aria-label={`Remove ${participant.name}`}
                          className="participant-delete-button"
                          disabled={isDeletingParticipantId !== null}
                          onClick={() => deleteParticipant(participant)}
                          type="button"
                        >
                          {isDeletingParticipantId === participant.id
                            ? "Removing..."
                            : "Delete"}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="workspace-empty compact-empty">
                    <span aria-hidden="true">✳</span>
                    <p>Add your group before recording shared costs.</p>
                  </div>
                )}
                {participants.length > 0 && !hasCompletedPeopleStep && (
                  <button
                    className="workspace-primary-button people-step-button"
                    onClick={continueToExpenses}
                    type="button"
                  >
                    Continue to expenses →
                  </button>
                )}
              </section>

              {hasCompletedPeopleStep && (
              <section className="workspace-panel expense-panel">
                <div className="workspace-panel-heading">
                  <div>
                    <p className="section-kicker">KEEP TRACK</p>
                    <h2>{editingExpenseId ? "Edit expense" : "Add an expense"}</h2>
                  </div>
                  {editingExpenseId ? (
                    <button
                      className="expense-edit-cancel"
                      onClick={cancelEditingExpense}
                      type="button"
                    >
                      Cancel
                    </button>
                  ) : (
                    <span aria-hidden="true" className="panel-sparkle">
                      ↗
                    </span>
                  )}
                </div>

                {participants.length === 0 ? (
                  <div className="workspace-empty">
                    <span aria-hidden="true">＋</span>
                    <h3>First, add your people</h3>
                    <p>Then you can record who paid and split the cost.</p>
                  </div>
                ) : (
                  <form className="expense-entry-form" onSubmit={addExpense}>
                    <label htmlFor="expense-description">
                      What was it for?
                    </label>
                    <input
                      id="expense-description"
                      maxLength={200}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="e.g. Cabin, fuel, groceries"
                      required
                      value={description}
                    />

                    <div className="expense-form-row">
                      <div>
                        <label htmlFor="expense-amount">Total amount</label>
                        <input
                          id="expense-amount"
                          inputMode="decimal"
                          min="0.01"
                          onChange={(event) => changeAmount(event.target.value)}
                          placeholder="0.00"
                          required
                          step="0.01"
                          type="number"
                          value={amount}
                        />
                      </div>
                      <div>
                        <label htmlFor="expense-payer">Paid by</label>
                        <select
                          id="expense-payer"
                          onChange={(event) => setPayerId(event.target.value)}
                          required
                          value={payerId}
                        >
                          <option disabled value="">
                            Choose a person
                          </option>
                          {participants.map((participant) => (
                            <option key={participant.id} value={participant.id}>
                              {participant.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <fieldset className="expense-shares">
                      <legend>Split between</legend>
                      <p>
                        We&apos;ll divide it evenly; adjust shares if needed.
                      </p>
                      {participants.map((participant) => {
                        const isIncluded = includedParticipantIds.includes(
                          participant.id,
                        );
                        return (
                          <div
                            className="share-editor-row"
                            key={participant.id}
                          >
                            <label>
                              <input
                                checked={isIncluded}
                                onChange={() =>
                                  toggleIncludedParticipant(participant.id)
                                }
                                type="checkbox"
                              />
                              <span>{participant.name}</span>
                            </label>
                            {isIncluded && (
                              <input
                                aria-label={`${participant.name}'s share`}
                                inputMode="decimal"
                                min="0.01"
                                onChange={(event) =>
                                  setShareAmounts((current) => ({
                                    ...current,
                                    [participant.id]: event.target.value,
                                  }))
                                }
                                placeholder="0.00"
                                step="0.01"
                                type="number"
                                value={shareAmounts[participant.id] ?? ""}
                              />
                            )}
                          </div>
                        );
                      })}
                      <small>Shares must add up exactly to the total.</small>
                    </fieldset>

                    <button
                      className="workspace-primary-button"
                      disabled={isSubmittingExpense}
                      type="submit"
                    >
                      {isSubmittingExpense
                        ? "Saving expense..."
                        : editingExpenseId
                          ? "Save changes"
                          : "＋ Save expense"}
                    </button>
                  </form>
                )}
              </section>
              )}
            </div>

            <section className="workspace-panel expense-history-panel">
              <div className="workspace-panel-heading">
                <div>
                  <p className="section-kicker">THE RUNNING TOTAL</p>
                  <h2>Expenses</h2>
                </div>
                <span className="workspace-count">{expenses.length}</span>
              </div>
              {expenses.length > 0 ? (
                <div className="workspace-expense-list">
                  {expenses.map((expense) => (
                    <article className="workspace-expense-row" key={expense.id}>
                      <span className="expense-row-icon" aria-hidden="true">
                        ↗
                      </span>
                      <div className="workspace-expense-main">
                        <strong>{expense.description}</strong>
                        <span>Paid by {expense.payer.name}</span>
                        <small>
                          {expense.shares
                            .map(
                              (share) =>
                                `${share.participant.name} ${formatMoney(share.amount, expense.currency)}`,
                            )
                            .join(" · ")}
                        </small>
                      </div>
                      <strong className="workspace-expense-amount">
                        {formatMoney(expense.amount, expense.currency)}
                      </strong>
                      <button
                        className="expense-edit-button"
                        onClick={() => startEditingExpense(expense)}
                        type="button"
                      >
                        Edit
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="workspace-empty compact-empty">
                  <span aria-hidden="true">↗</span>
                  <p>No expenses yet. Add the first shared cost above.</p>
                </div>
              )}
            </section>

            <section className="settlement-workspace">
              <div className="settlement-intro">
                <div>
                  <p className="section-kicker">NO AWKWARD FOLLOW-UPS</p>
                  <h2>Ready to settle up?</h2>
                  <p>
                    We&apos;ll find the fewest transfers to make everyone even.
                  </p>
                </div>
                <button
                  className="workspace-primary-button calculate-button"
                  disabled={isCalculating || participants.length === 0}
                  onClick={calculateSettlements}
                  type="button"
                >
                  {isCalculating
                    ? "Calculating..."
                    : "✳ Calculate minimum transfers"}
                </button>
              </div>

              {settlements && (
                <div className="settlement-result" aria-live="polite">
                  <div className="settlement-result-heading">
                    <span className="settlement-result-icon" aria-hidden="true">
                      ✓
                    </span>
                    <div>
                      <p className="section-kicker">MINIMUM TRANSFER PLAN</p>
                      <h3>
                        {settlements.transferCount === 0
                          ? "Everyone is already even"
                          : `${settlements.transferCount} ${settlements.transferCount === 1 ? "transfer" : "transfers"} to settle`}
                      </h3>
                    </div>
                  </div>

                  {settlements.settlements.length > 0 ? (
                    <ol className="settlement-transfer-list">
                      {settlements.settlements.map((settlement, index) => (
                        <li
                          className="settlement-transfer"
                          key={`${settlement.from.participantId}-${settlement.to.participantId}-${index}`}
                        >
                          <span
                            className={`participant-avatar avatar-${index % 4}`}
                          >
                            {settlement.from.name.slice(0, 1).toUpperCase()}
                          </span>
                          <strong>{settlement.from.name}</strong>
                          <span className="transfer-arrow" aria-hidden="true">
                            →
                          </span>
                          <span
                            className={`participant-avatar avatar-${(index + 1) % 4}`}
                          >
                            {settlement.to.name.slice(0, 1).toUpperCase()}
                          </span>
                          <strong>{settlement.to.name}</strong>
                          <span className="settlement-amount">
                            {formatMoney(
                              settlement.amount,
                              settlements.currency,
                            )}
                          </span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="all-settled-message">
                      No transfers needed for this trip. ✳
                    </p>
                  )}

                  <div className="balance-summary">
                    <h4>Everyone&apos;s balance</h4>
                    <div>
                      {settlements.balances.map((balance) => {
                        const amountCents = parseSignedCents(balance.balance);
                        const isOwed = amountCents > 0;
                        const isOwing = amountCents < 0;
                        const displayAmount = formatCents(
                          isOwing ? -amountCents : amountCents,
                        );
                        return (
                          <p key={balance.participantId}>
                            <strong>{balance.name}</strong>
                            <span
                              className={
                                isOwed
                                  ? "balance-positive"
                                  : isOwing
                                    ? "balance-negative"
                                    : "balance-neutral"
                              }
                            >
                              {isOwed
                                ? `gets back ${formatMoney(displayAmount, settlements.currency)}`
                                : isOwing
                                  ? `owes ${formatMoney(displayAmount, settlements.currency)}`
                                  : "all settled"}
                            </span>
                          </p>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </section>
          </>
        ) : (
          <div className="workspace-not-found">
            <p className="section-kicker">TRIP UNAVAILABLE</p>
            <h1>We couldn&apos;t find that trip.</h1>
            <p>{error}</p>
            <Link className="workspace-primary-button" href="/trips">
              Back to your trips
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
