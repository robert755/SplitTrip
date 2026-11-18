import { Suspense } from "react";
import { TripWorkspace } from "./trip-workspace";

export const metadata = {
  title: "Trip details — SplitTrip",
};

async function TripPageContent({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  return <TripWorkspace tripId={tripId} />;
}

export default function TripPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  return (
    <Suspense
      fallback={
        <main className="dashboard-loading" aria-live="polite">
          Opening your trip...
        </main>
      }
    >
      <TripPageContent params={params} />
    </Suspense>
  );
}
