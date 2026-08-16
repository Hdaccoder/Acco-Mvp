export const metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <article className="legal-content max-w-3xl">
      <h1>Privacy</h1>
      <p>Last updated: 12 August 2026</p>
      <p>Acco is designed to show community-level popularity without publicly exposing individual votes or precise locations.</p>
      <h2>Information used</h2>
      <ul>
        <li>An anonymous Firebase account identifier, used to limit each person to one current vote per night.</li>
        <li>Your selected venues, intention, expected arrival window, town or city, and optional expected food spend.</li>
        <li>Approximate location only when you actively choose to share it. Coordinates are rounded on the server to roughly a one-kilometre area before storage.</li>
        <li>Safety reports you submit, associated with your anonymous account for abuse prevention.</li>
        <li>Basic performance analytics provided by the hosting platform.</li>
      </ul>
      <h2>How information is displayed</h2>
      <p>Public pages receive aggregate counts, indexes, trends, and confidence labels. They do not receive individual vote documents, account identifiers, or stored coordinates.</p>
      <h2>Why information is used</h2>
      <p>Votes are used to calculate current local popularity, improve forecasts, prevent duplicate voting, and investigate misuse. Safety reports are shown publicly only as aggregate counts.</p>
      <h2>Your choices</h2>
      <p>Location sharing is optional. You can select a town or city instead. Browser storage remembers your selected area and radius on your device.</p>
      <h2>Retention and deletion</h2>
      <p>Nightly vote history may be retained to improve forecasts. To request deletion or ask a privacy question, use the Report an issue contact in the footer and include enough information to identify your anonymous session where possible.</p>
      <h2>Important limitation</h2>
      <p>Acco shows community signals, not verified occupancy or safety guarantees. Avoid sharing sensitive information in reports.</p>
    </article>
  );
}
