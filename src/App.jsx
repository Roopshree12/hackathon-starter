
import { useCallback, useEffect, useState } from "react";
import "./App.css";

const API = "/api";

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      [data.error, ...(data.reasons || [])].filter(Boolean).join("\n")
    );
  }

  return data;
}

const emptyForm = {
  description: "",
  quantity_kg: "5",
  pickup_from: "",
  pickup_until: "",
};

function App() {
  const [data, setData] = useState(null);
  const [role, setRole] = useState("volunteer");
  const [personId, setPersonId] = useState("V1");
  const [form, setForm] = useState(emptyForm);
  const [claimForms, setClaimForms] = useState({});
  const [clock, setClock] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const result = await request("/state");
    setData(result);
    setClock(result.clock);

    const people =
      role === "donor" ? result.donors : result.volunteers;

    if (!people.some((person) => person.id === personId)) {
      setPersonId(people[0]?.id || "");
    }
  }, [role, personId]);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  const donors = data?.donors || [];
  const volunteers = data?.volunteers || [];
  const donations = data?.donations || [];
  const claims = data?.claims || [];
  const dashboard = data?.dashboard;

  const currentPerson =
    role === "donor"
      ? donors.find((p) => p.id === personId)
      : volunteers.find((p) => p.id === personId);

  const visibleDonations =
    role === "donor"
      ? donations.filter((d) => d.donor_id === personId)
      : donations.filter(
        (d) =>
          d.status === "OPEN" &&
          currentPerson?.zones.includes(d.zone)
      );

  async function act(path, body = {}) {
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const result = await request(path, {
        method: "POST",
        body: JSON.stringify(body),
      });

      setNotice(result.message || "Action completed.");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }


  async function resetDemo() {
    const confirmed = window.confirm(
      "Reset SurplusLink to its original demo data? All demo changes and claims will be cleared."
    );

    if (!confirmed) return;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const result = await request("/reset", {
        method: "POST",
      });

      setNotice(result.message || "Demo reset successfully.");
      setClaimForms({});
      setForm(emptyForm);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }


  function updateClaim(id, field, value) {
    setClaimForms((previous) => ({
      ...previous,
      [id]: {
        kg: "1",
        planned_time: "",
        ...previous[id],
        [field]: value,
      },
    }));
  }

  if (!data) {
    return (
      <main className="loading">
        <h1>🥗 SurplusLink</h1>
        <p>Connecting to your food rescue network...</p>
        {error && <pre className="error">{error}</pre>}
        <button onClick={() => load().catch((e) => setError(e.message))}>
          Retry connection
        </button>
      </main>
    );
  }

  const metrics = [
    ["Listed", dashboard.listed, "Total food posted"],
    ["Collected", dashboard.collected, "Food rescued"],
    ["Missed", dashboard.missed, "Food not collected"],
    ["Wasted", dashboard.wasted, "Expired food remaining"],
    ["In progress", dashboard.in_progress, "Reserved kilograms"],
    ["Still open", dashboard.still_open, "Available or unexpired food"],
  ];

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-icon">🥗</span>
          <div>
            <h1>SurplusLink</h1>
            <p>Good food deserves another chance.</p>
          </div>
        </div>

        <div className="topbar-actions">
          <span className="clock-badge">◷ Simulated clock</span>
          <button
            className="secondary"
            type="button"
            disabled={busy}
            onClick={resetDemo}
          >
            ↺ Reset Demo
          </button>
        </div>

      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">COMMUNITY FOOD RESCUE</p>
          <h2>Turn surplus into <span>something meaningful.</span></h2>
          <p className="hero-copy">
            Connect local kitchens with volunteers to rescue food
            before it goes to waste.
          </p>
        </div>
        <div className="hero-symbol">♻️</div>
      </section>

      {error && (
        <div className="alert error" role="alert">
          <strong>Action failed</strong>
          <pre>{error}</pre>
          <button className="text-button" onClick={() => setError("")}>
            Dismiss
          </button>
        </div>
      )}

      {notice && (
        <div className="alert success">
          {notice}
          <button className="text-button" onClick={() => setNotice("")}>
            Dismiss
          </button>
        </div>
      )}

      <section className="panel controls">
        <div className="field">
          <label>Acting as</label>
          <select
            value={role}
            onChange={(e) => {
              const nextRole = e.target.value;
              setRole(nextRole);
              setPersonId(
                nextRole === "donor"
                  ? donors[0]?.id || ""
                  : volunteers[0]?.id || ""
              );
            }}
          >
            <option value="donor">Restaurant / Donor</option>
            <option value="volunteer">Volunteer</option>
          </select>
        </div>

        <div className="field">
          <label>{role === "donor" ? "Restaurant" : "Volunteer"}</label>
          <select
            value={personId}
            onChange={(e) => setPersonId(e.target.value)}
          >
            {(role === "donor" ? donors : volunteers).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.zone || p.zones?.join(", ")}
              </option>
            ))}
          </select>
        </div>

        <form
          className="clock-form"
          onSubmit={(e) => {
            e.preventDefault();
            act("/clock", { clock });
          }}
        >
          <label htmlFor="sim-clock">Simulated date and time</label>
          <div className="clock-row">
            <input
              id="sim-clock"
              type="datetime-local"
              value={clock}
              onChange={(e) => setClock(e.target.value)}
              required
            />
            <button disabled={busy} type="submit">Advance</button>
          </div>
          <small>The clock cannot move backwards.</small>
        </form>
      </section>

      <section className="section-heading">
        <div>
          <p className="eyebrow">LIVE OVERVIEW</p>
          <h2>Food rescue dashboard</h2>
        </div>
        {/* <button className="secondary" onClick={() => load().catch((e) => setError(e.message))}>
          ↻ Refresh
        </button> */}
      </section>

      <section className="metrics-grid">
        {metrics.map(([title, value, subtitle]) => (
          <article className="metric-card" key={title}>
            <p>{title}</p>
            <strong>{value} <span>kg</span></strong>
            <small>{subtitle}</small>
          </article>
        ))}
      </section>

      <div className={`balance ${dashboard.balanced ? "balanced" : "unbalanced"}`}>
        <span>{dashboard.balanced ? "✓" : "!"}</span>
        <div>
          <strong>
            {dashboard.balanced
              ? "Food accounting is balanced"
              : "Food accounting mismatch"}
          </strong>
          <p>
            Listed {dashboard.listed} kg = Collected {dashboard.collected}
            {" + "}Missed {dashboard.missed}
            {" + "}Wasted {dashboard.wasted}
            {" + "}In progress {dashboard.in_progress}
            {" + "}Still open {dashboard.still_open} kg
          </p>
        </div>
      </div>

      <section className="panel breakdown">
        <h3>Community impact</h3>
        <div className="impact-columns">
          <div>
            <h4>Collected by restaurant</h4>
            {dashboard.collected_by_donor.map((d) => (
              <div className="impact-row" key={d.donor_id}>
                <span>{d.name}</span>
                <strong>{d.collected_kg} kg</strong>
              </div>
            ))}
          </div>
          <div>
            <h4>Volunteer performance</h4>
            {dashboard.volunteers.map((v) => (
              <div className="impact-row" key={v.volunteer_id}>
                <span>
                  {v.name}
                  <small>{v.missed_claims} missed claim(s)</small>
                </span>
                <strong>{v.collected_kg} kg</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      {role === "donor" && (
        <section className="panel post-panel">
          <p className="eyebrow">DONATION MANAGEMENT</p>
          <h2>Post surplus food</h2>
          <p className="muted">
            Share available food and give volunteers time to collect it.
          </p>
          <form
            className="donation-form"
            onSubmit={(e) => {
              e.preventDefault();
              act("/donations", {
                donor_id: personId,
                ...form,
                quantity_kg: Number(form.quantity_kg),
              }).then;
            }}
          >
            <div className="field full">
              <label>Food description</label>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="e.g. Fresh vegetable biryani"
                required
              />
            </div>
            <div className="field">
              <label>Quantity (whole kg)</label>
              <input
                type="number"
                min="1"
                step="1"
                value={form.quantity_kg}
                onChange={(e) => setForm({ ...form, quantity_kg: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label>Pickup from</label>
              <input
                type="datetime-local"
                value={form.pickup_from}
                onChange={(e) => setForm({ ...form, pickup_from: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label>Pickup until</label>
              <input
                type="datetime-local"
                value={form.pickup_until}
                onChange={(e) => setForm({ ...form, pickup_until: e.target.value })}
                required
              />
            </div>
            <button className="primary full" disabled={busy} type="submit">
              + Post donation
            </button>
          </form>
          <p className="hint">
            All times use the simulated clock's local time.
          </p>
        </section>
      )}

      <section className="section-heading">
        <div>
          <p className="eyebrow">
            {role === "donor" ? "YOUR RESTAURANT" : "MATCHED BY ZONE"}
          </p>
          <h2>
            {role === "donor" ? "Your donations" : "Available donations"}
          </h2>
        </div>
        <span className="count-pill">{visibleDonations.length} listings</span>
      </section>

      <section className="donation-grid">
        {visibleDonations.map((d) => (
          <article className="donation-card" key={d.id}>
            <div className="card-top">
              <span className={`status status-${d.status.toLowerCase()}`}>
                {d.status.replace("_", " ")}
              </span>
              <span className="zone-tag">{d.zone}</span>
            </div>
            <h3>{d.description}</h3>
            <p className="donor-name">
              {donors.find((x) => x.id === d.donor_id)?.name || d.donor_id}
            </p>
            <div className="quantity-row">
              <div>
                <strong>{d.remaining_kg} kg</strong>
                <small>Remaining of {d.quantity_kg} kg</small>
              </div>
              <div>
                <strong>{d.claims.length}</strong>
                <small>Claims</small>
              </div>
            </div>
            <div className="time-details">
              <p><span>Pickup from</span><strong>{d.pickup_from.replace("T", " ")}</strong></p>
              <p><span>Pickup until</span><strong>{d.pickup_until.replace("T", " ")}</strong></p>
            </div>

            {role === "volunteer" && (
              <form
                className="claim-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const c = claimForms[d.id] || {};
                  act(`/donations/${d.id}/claims`, {
                    volunteer_id: personId,
                    kg: Number(c.kg),
                    planned_time: c.planned_time,
                  });
                }}
              >
                <label>Reserve kilograms</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  max={d.remaining_kg}
                  value={claimForms[d.id]?.kg ?? "1"}
                  onChange={(e) => updateClaim(d.id, "kg", e.target.value)}
                  required
                />
                <label>Planned pickup time</label>
                <input
                  type="datetime-local"
                  min={d.pickup_from}
                  max={d.pickup_until}
                  value={claimForms[d.id]?.planned_time || ""}
                  onChange={(e) => updateClaim(d.id, "planned_time", e.target.value)}
                  required
                />
                <button className="primary" disabled={busy} type="submit">
                  Reserve food
                </button>
              </form>
            )}

            {role === "donor" && (
              <>
                <h4>Claims on this donation</h4>
                {d.claims.length === 0 && (
                  <p className="muted">No volunteers have reserved food yet.</p>
                )}
                {d.claims.map((c) => (
                  <div className="claim-row" key={c.id}>
                    <span>
                      {volunteers.find((v) => v.id === c.volunteer_id)?.name || c.volunteer_id}
                      <small>{c.kg} kg · {c.planned_time}</small>
                    </span>
                    <span className={`status status-${c.status.toLowerCase()}`}>
                      {c.status}
                    </span>
                  </div>
                ))}
                {d.status === "OPEN" && (
                  <button
                    className="secondary danger-button"
                    disabled={busy || d.claims.some((c) => ["ACTIVE", "COLLECTED"].includes(c.status))}
                    onClick={() => act(`/donations/${d.id}/cancel`)}
                  >
                    Cancel donation
                  </button>
                )}
              </>
            )}
          </article>
        ))}
        {visibleDonations.length === 0 && (
          <div className="empty-state">
            <span>🍃</span>
            <h3>No matching donations</h3>
            <p>
              {role === "donor"
                ? "You have not posted any donations yet."
                : "There are no open donations in your zones right now."}
            </p>
          </div>
        )}
      </section>

      {role === "volunteer" && (
        <section className="panel my-claims">
          <p className="eyebrow">YOUR ACTIVITY</p>
          <h2>My reservations</h2>
          {claims.filter((c) => c.volunteer_id === personId).length === 0 && (
            <p className="muted">You haven't made any reservations yet.</p>
          )}
          {claims.filter((c) => c.volunteer_id === personId).map((c) => {
            const donation = donations.find((d) => d.id === c.donation_id);
            return (
              <div className="my-claim-row" key={c.id}>
                <div>
                  <strong>{donation?.description || c.donation_id}</strong>
                  <p>{c.kg} kg · Pickup {c.planned_time.replace("T", " ")}</p>
                  <span className={`status status-${c.status.toLowerCase()}`}>
                    {c.status}
                  </span>
                </div>
                <div className="claim-actions">
                  {c.status === "ACTIVE" && (
                    <>
                      <button
                        className="primary"
                        disabled={busy}
                        onClick={() => act(`/claims/${c.id}/collect`)}
                      >
                        Mark collected
                      </button>
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() => act(`/claims/${c.id}/cancel`)}
                      >
                        Cancel claim
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}

      <footer>
        <strong>SurplusLink</strong> · Less waste, more good.
        <span>Built for community food rescue</span>
      </footer>
    </main>
  );
}

export default App;
