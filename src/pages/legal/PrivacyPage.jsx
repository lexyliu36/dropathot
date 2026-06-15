import LegalLayout from './LegalLayout'

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated="June 9, 2026">
      <p>dropathot ("we," "us," "our") is committed to being transparent about how we collect, use, and protect your information. This Privacy Policy explains our practices for our website at dropathot.com and all associated services (the "Service"). By using the Service, you agree to the collection and use of information in accordance with this Policy.</p>

      <h2>1. Information We Collect</h2>
      <p><strong>Information you provide directly:</strong></p>
      <ul>
        <li><strong>Registered accounts:</strong> email address, pen name, and password (stored as a hash — we never store plaintext passwords). Your birth year is collected during age verification to confirm you meet the minimum age requirement, and is stored persistently to maintain compliance with age-gating obligations.</li>
        <li><strong>Content:</strong> the text of every thot you post, comment, or reply you submit.</li>
      </ul>
      <p><strong>Information we collect automatically:</strong></p>
      <ul>
        <li><strong>Location data:</strong> when you post a thot, your device's geographic coordinates (latitude and longitude) are captured and stored with that post. This is core to the Service's functionality. Location is only transmitted at the moment of posting — we do not continuously track your location in the background.</li>
        <li><strong>Session identifier:</strong> a randomly-generated UUID assigned to your browser session. For registered users, this is your account identifier. This identifier persists across sessions via an httpOnly, Secure cookie and is used to associate your posts for moderation and legal compliance. A one-way hash of your IP address (SHA-256 with a server-side salt) is stored alongside each post for law enforcement cooperation purposes; the plaintext IP is never stored.</li>
        <li><strong>Hashed IP address:</strong> your IP address is hashed (SHA-256 with a server-side salt) before storage. We never store your plaintext IP address. The hash is retained for law enforcement cooperation purposes only and cannot be used to identify you without access to our private salt.</li>
        <li><strong>Device and usage data:</strong> standard server logs including browser type, operating system, referring URL, and page interactions. These are used for debugging and service improvement and are not linked to your identity.</li>
      </ul>
      <p><strong>Information we do not collect:</strong></p>
      <ul>
        <li>Photos, videos, or any media — the Service is text-only.</li>
        <li>Your real name, phone number, or government ID.</li>
        <li>Continuous or background location data.</li>
        <li>Any information from minors. Users under 18 are prohibited from using the Service.</li>
      </ul>

      <h2>2. How We Use Your Information</h2>
      <ul>
        <li><strong>To operate the Service:</strong> displaying your thots on the map, enabling comments, processing hypes (likes), and delivering nearby content to other users.</li>
        <li><strong>Content moderation:</strong> post content is sent to Google Perspective API and OpenAI Moderation API for automated toxicity screening before being published. We retain blocked post attempts with your session ID and hashed IP for law enforcement logging.</li>
        <li><strong>Authentication:</strong> email and hashed password are used to verify your identity at login. We use Supabase Auth for session management and token issuance.</li>
        <li><strong>Email communications:</strong> we send a one-time email verification link when you register. We do not send marketing emails unless you explicitly opt in (we currently do not have a marketing program).</li>
        <li><strong>Safety and legal compliance:</strong> session identifiers and hashed IPs are retained to respond to law enforcement requests, investigate abuse, and enforce our Terms of Service.</li>
        <li><strong>Service improvement:</strong> anonymized, aggregated usage data helps us understand how the Service is used and improve it.</li>
      </ul>

      <h2>3. How We Share Your Information</h2>
      <p>We do not sell, rent, or trade your personal information to any third party. We share information only in the following limited circumstances:</p>
      <ul>
        <li><strong>Service providers:</strong> we share data with Supabase (database and authentication), Railway (backend hosting), Vercel (frontend hosting), Google (Perspective API moderation), OpenAI (moderation), Resend (transactional email), and Mapbox (map rendering). Each of these providers processes data solely to perform services on our behalf and under confidentiality obligations.</li>
        <li><strong>Law enforcement:</strong> we will disclose session identifiers, hashed IPs, post content, timestamps, and associated location data to law enforcement agencies in response to valid legal process (subpoenas, warrants, court orders) or in emergency situations involving an imminent threat to life or safety.</li>
        <li><strong>Business transfers:</strong> if dropathot is acquired, merged, or its assets are transferred, your information may be part of that transfer. We will notify you via a prominent notice on the Service prior to your information becoming subject to a different privacy policy.</li>
        <li><strong>With your consent:</strong> we may share information for other purposes with your explicit consent.</li>
      </ul>
      <p>Your <strong>public</strong> information — pen name (if registered), post content, location (shown on map), and post timestamp — is visible to other users of the Service by design. The Service requires a registered account to post content.</p>

      <h2>4. Location Data</h2>
      <p>Location is the foundation of dropathot. When you post a thot, your device shares its coordinates with us and those coordinates are stored permanently with the post record (subject to expiry). Posts are visible to other users within a configurable radius. Your precise coordinates are never shown to other users — only the pin on the map indicates your general location at time of posting.</p>
      <p>Location is requested via your browser's Geolocation API and only transmitted when you actively post. You may deny location permissions, in which case you can still browse the map but cannot post.</p>

      <h2>5. Data Retention</h2>
      <ul>
        <li><strong>Thots:</strong> post records are retained in our database indefinitely for legal compliance, even after they expire and are hidden from the public map. Users may contact us to request deletion of their content.</li>
        <li><strong>Account data:</strong> retained until you delete your account or we terminate it. Email us at <strong>privacy@dropathot.com</strong> to request account deletion.</li>
        <li><strong>Moderation logs:</strong> blocked post attempts and report data are retained for a minimum of 3 years to support law enforcement investigations.</li>
        <li><strong>Session data:</strong> anonymous session cookies expire after 30 days of inactivity.</li>
      </ul>

      <h2>6. Security</h2>
      <p>We implement industry-standard technical and organizational measures to protect your information, including TLS encryption in transit, hashed passwords, hashed IPs (never stored in plaintext), httpOnly Secure cookies, and access controls limiting who on our team can access the database. No method of transmission over the Internet is 100% secure, and we cannot guarantee absolute security.</p>

      <h2>7. Cookies and Tracking</h2>
      <p>We use a single session cookie (httpOnly, Secure, SameSite=Lax) to maintain your login state. We do not use advertising cookies, third-party tracking pixels, or analytics cookies from ad networks. Mapbox may set cookies to render the map — see <a href="https://www.mapbox.com/legal/privacy" target="_blank" rel="noopener noreferrer">Mapbox's Privacy Policy</a> for details.</p>

      <h2>8. Your Rights</h2>
      <p>Depending on your jurisdiction, you may have the right to:</p>
      <ul>
        <li>Access the personal data we hold about you;</li>
        <li>Request correction of inaccurate data;</li>
        <li>Request deletion of your account and associated personal data (subject to our legal retention obligations);</li>
        <li>Object to or restrict certain processing;</li>
        <li>Withdraw consent (where processing is based on consent).</li>
      </ul>
      <p>To exercise any of these rights, email us at <strong>privacy@dropathot.com</strong>. We will respond within 30 days. We may need to verify your identity before fulfilling a request.</p>

      <h2>9. Children's Privacy</h2>
      <p>The Service is not directed to anyone under 18. We do not knowingly collect personal information from minors. If we become aware that we have collected data from someone under 18, we will delete it promptly and terminate their account. If you believe we have inadvertently collected such information, contact us at <strong>privacy@dropathot.com</strong>.</p>

      <h2>10. California Privacy Rights (CCPA)</h2>
      <p>California residents have additional rights under the California Consumer Privacy Act (CCPA), including the right to know what personal information we collect, the right to delete it, the right to opt-out of sale (we do not sell personal information), and the right not to be discriminated against for exercising your rights. To submit a CCPA request, email <strong>privacy@dropathot.com</strong>.</p>

      <h2>11. International Transfers</h2>
      <p>Our services are hosted in the United States. If you access the Service from outside the U.S., your information will be transferred to and processed in the U.S. By using the Service, you consent to this transfer. We take reasonable steps to ensure your data is treated securely regardless of where it is processed.</p>

      <h2>12. Changes to This Policy</h2>
      <p>We may update this Privacy Policy from time to time. We will notify you of material changes by posting the new policy on this page with an updated "Last updated" date. For significant changes, we will also display a notice in the app. Your continued use of the Service after changes take effect constitutes your acceptance.</p>

      <h2>13. Contact</h2>
      <p>For privacy-related questions, data requests, or to report a concern, contact us at <strong>privacy@dropathot.com</strong>.</p>
    </LegalLayout>
  )
}
