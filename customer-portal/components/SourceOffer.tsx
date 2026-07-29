/**
 * AGPL-3.0 §13 network-use notice.
 *
 * The AGPL requires that all users interacting with this software over a
 * network are offered the Corresponding Source. This footer provides that
 * offer on every portal page (including the pre-auth login screen).
 */
const SOURCE_URL = "https://github.com/digitalvibers-cmd/fleet-vibe";

export default function SourceOffer() {
  return (
    <footer className="mt-auto py-4 text-center text-xs text-foreground/50">
      <span>
        FlyBox Delivery portal — powered by{" "}
        <a
          href="https://fleetbase.io"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground/80"
        >
          Fleetbase
        </a>
        {" · "}
        <a
          href={SOURCE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground/80"
        >
          Izvorni kod (AGPL-3.0)
        </a>
      </span>
    </footer>
  );
}
