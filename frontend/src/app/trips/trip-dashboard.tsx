"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ApiError, apiRequest, type Trip } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";

export function TripDashboard() {
  const router = useRouter();
  const { accessToken, user, isInitializing, logout } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripName, setTripName] = useState("");
  const [error, setError] = useState("");
  const [isLoadingTrips, setIsLoadingTrips] = useState(true);
  const [isCreatingTrip, setIsCreatingTrip] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (isInitializing) {
      return;
    }
    if (!accessToken) {
      router.replace("/login");
      return;
    }

    let active = true;
    void apiRequest<Trip[]>("/trips", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((savedTrips) => {
        if (active) {
          setTrips(savedTrips);
          setError("");
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof ApiError
              ? loadError.message
              : "We couldn't load your trips. Check your connection and try again.",
          );
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingTrips(false);
        }
      });

    return () => {
      active = false;
    };
  }, [accessToken, isInitializing, router]);

  async function createTrip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) {
      router.replace("/login");
      return;
    }

    setError("");
    setIsCreatingTrip(true);
    try {
      const trip = await apiRequest<Trip>("/trips", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ name: tripName }),
      });
      setTrips((currentTrips) => [trip, ...currentTrips]);
      setTripName("");
      router.push(`/trips/${trip.id}`);
    } catch (createError) {
      setError(
        createError instanceof ApiError
          ? createError.message
          : "We couldn't create your trip. Check your connection and try again.",
      );
    } finally {
      setIsCreatingTrip(false);
    }
  }

  async function signOut() {
    setError("");
    setIsLoggingOut(true);
    try {
      await logout();
      router.replace("/");
    } catch (logoutError) {
      setError(
        logoutError instanceof ApiError
          ? logoutError.message
          : "We couldn't sign you out. Please try again.",
      );
    } finally {
      setIsLoggingOut(false);
    }
  }

  if (isInitializing || !accessToken) {
    return (
      <main className="dashboard-loading" aria-live="polite">
        Restoring your session...
      </main>
    );
  }

  return (
    <main className="dashboard-page">
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
          <span>{user?.email}</span>
          <button
            className="dashboard-signout"
            disabled={isLoggingOut}
            onClick={signOut}
            type="button"
          >
            {isLoggingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </header>

      <section className="dashboard-content">
        <p className="section-kicker">YOUR CREW, ALL IN ONE PLACE</p>
        <div className="dashboard-title-row">
          <div>
            <h1>Welcome back.</h1>
            <p>Your trips, your crew, and the numbers all in one place.</p>
          </div>
          <span aria-hidden="true" className="dashboard-sparkle">
            ✳
          </span>
        </div>

        <form className="trip-create-form" onSubmit={createTrip}>
          <label htmlFor="trip-name">Start a new trip</label>
          <div className="trip-create-row">
            <input
              id="trip-name"
              maxLength={100}
              onChange={(event) => setTripName(event.target.value)}
              placeholder="e.g. Long weekend in the mountains"
              required
              value={tripName}
            />
            <button disabled={isCreatingTrip} type="submit">
              {isCreatingTrip ? "Creating..." : "＋ Create trip"}
            </button>
          </div>
        </form>

        {error && (
          <p className="dashboard-error" role="alert">
            {error}
          </p>
        )}

        <div className="trip-list-heading">
          <h2>Your group trips</h2>
          <span>
            {trips.length} {trips.length === 1 ? "trip" : "trips"}
          </span>
        </div>

        {isLoadingTrips ? (
          <p className="trip-empty">Loading your trips...</p>
        ) : trips.length > 0 ? (
          <div className="trip-grid">
            {trips.map((trip) => (
              <Link
                className="trip-card trip-card-link"
                href={`/trips/${trip.id}`}
                key={trip.id}
              >
                <span aria-hidden="true" className="trip-card-icon">
                  ↗
                </span>
                <h3>{trip.name}</h3>
                <p>
                  {trip.currency.trim()} · Created{" "}
                  {new Intl.DateTimeFormat("en", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  }).format(new Date(trip.createdAt))}
                </p>
                <span className="trip-card-action">Open trip →</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="trip-empty">
            <span aria-hidden="true">✳</span>
            <h3>No trips yet</h3>
            <p>Create your first trip above and invite your crew next.</p>
          </div>
        )}
      </section>
    </main>
  );
}
