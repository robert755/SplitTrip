import Link from "next/link";

const expenses = [
  {
    icon: "⌂",
    name: "Cabin",
    person: "Alex paid",
    amount: "€850",
    tone: "blue",
  },
  {
    icon: "↗",
    name: "Fuel",
    person: "Maya paid",
    amount: "€320",
    tone: "lime",
  },
  {
    icon: "✳",
    name: "Groceries",
    person: "Jordan paid",
    amount: "€180",
    tone: "violet",
  },
];

const transfers = [
  { from: "Casey", to: "Alex", amount: "€150", color: "coral" },
  { from: "Jordan", to: "Maya", amount: "€20", color: "blue" },
];

function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 12h14m-6-6 6 6-6 6"
      />
    </svg>
  );
}

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <Link aria-label="SplitTrip home" className="brand" href="/">
          <span aria-hidden="true" className="brand-mark">
            <span />
            <span />
          </span>
          <span>
            split<span className="brand-light">trip</span>
          </span>
        </Link>
        <nav className="header-actions" aria-label="Main navigation">
          <a className="header-link" href="#how-it-works">
            How it works <span aria-hidden="true">↗</span>
          </a>
          <Link className="header-signin" href="/login">
            Sign in
          </Link>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="eyebrow-dot" />
            GROUP EXPENSES, WITHOUT THE MATH
          </div>
          <h1>
            More memories.
            <br />
            <span className="title-highlight">Less money</span>
            <br />
            math<span className="title-period">.</span>
          </h1>
          <p className="hero-description">
            Track shared costs, see who owes what, and settle up with the fewest
            possible transfers.
          </p>
          <Link className="primary-link" href="/login">
            Start your trip <ArrowIcon />
          </Link>
          <div className="hero-note">
            <span aria-hidden="true" className="note-sparkle">
              ✳
            </span>
            Made for the group chat crew.
          </div>
        </div>

        <div
          aria-label="Illustrative group trip expenses and settlement"
          className="demo-area"
        >
          <div className="floating-label label-top">
            3 nights away <span>↗</span>
          </div>
          <div className="expense-card">
            <div className="card-heading">
              <div>
                <p className="card-kicker">YOUR TRIP</p>
                <h2>Cabin in the pines</h2>
              </div>
              <div className="avatar-stack" aria-label="Four people">
                <span className="avatar avatar-one">A</span>
                <span className="avatar avatar-two">M</span>
                <span className="avatar avatar-three">J</span>
                <span className="avatar avatar-more">+1</span>
              </div>
            </div>

            <div className="expense-list">
              {expenses.map((expense) => (
                <div className="expense-row" key={expense.name}>
                  <span
                    className={`expense-icon ${expense.tone}`}
                    aria-hidden="true"
                  >
                    {expense.icon}
                  </span>
                  <span className="expense-details">
                    <strong>{expense.name}</strong>
                    <small>{expense.person}</small>
                  </span>
                  <strong className="expense-amount">{expense.amount}</strong>
                </div>
              ))}
            </div>

            <div className="total-row">
              <span>Total spent</span>
              <strong>€1,350</strong>
            </div>

            <div className="settlement-card">
              <div className="settlement-heading">
                <span className="settlement-check" aria-hidden="true">
                  ✓
                </span>
                <div>
                  <p className="card-kicker">ALL SQUARED AWAY</p>
                  <strong>Just 2 transfers</strong>
                </div>
                <span className="minimum-badge">MINIMUM</span>
              </div>
              <div className="transfer-list">
                {transfers.map((transfer) => (
                  <div className="transfer-row" key={transfer.from}>
                    <span className={`transfer-avatar ${transfer.color}`}>
                      {transfer.from[0]}
                    </span>
                    <span className="transfer-name">{transfer.from}</span>
                    <span className="transfer-arrow" aria-hidden="true">
                      →
                    </span>
                    <span className="transfer-avatar receiver">
                      {transfer.to[0]}
                    </span>
                    <span className="transfer-name">{transfer.to}</span>
                    <strong className="transfer-amount">
                      {transfer.amount}
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="floating-label label-bottom">
            <span aria-hidden="true">✳</span> everyone&apos;s even
          </div>
          <span aria-hidden="true" className="decor decor-one">
            ✳
          </span>
          <span aria-hidden="true" className="decor decor-two">
            ✳
          </span>
        </div>
      </section>

      <section className="how-section" id="how-it-works">
        <div className="section-intro">
          <p className="section-kicker">
            NO SPREADSHEETS. NO AWKWARD FOLLOW-UPS.
          </p>
          <h2>Trip costs, sorted.</h2>
          <p>Three simple steps, then back to the good stuff.</p>
        </div>
        <div className="steps-grid">
          <Link className="step-card step-card-link" href="/login">
            <span className="step-number">01</span>
            <span className="step-symbol step-symbol-blue" aria-hidden="true">
              ＋
            </span>
            <h3>
              Start a trip <span aria-hidden="true">↗</span>
            </h3>
            <p>Bring your people together in one shared space.</p>
          </Link>
          <article className="step-card">
            <span className="step-number">02</span>
            <span className="step-symbol step-symbol-violet" aria-hidden="true">
              ↗
            </span>
            <h3>Add expenses</h3>
            <p>Keep track of who paid and everyone&apos;s share.</p>
          </article>
          <article className="step-card">
            <span className="step-number">03</span>
            <span className="step-symbol step-symbol-lime" aria-hidden="true">
              ✓
            </span>
            <h3>Settle with less</h3>
            <p>Get the fewest transfers needed to make things even.</p>
          </article>
        </div>
      </section>

      <footer className="site-footer">
        <Link
          aria-label="SplitTrip home"
          className="brand footer-brand"
          href="/"
        >
          <span aria-hidden="true" className="brand-mark">
            <span />
            <span />
          </span>
          <span>
            split<span className="brand-light">trip</span>
          </span>
        </Link>
        <span>More memories. Less money math.</span>
        <span>Made for the group chat crew.</span>
      </footer>
    </main>
  );
}
