import LegalLayout from './LegalLayout'

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" updated="June 9, 2026">
      <div className="callout">
        You must be 18 years of age or older to access or use dropathot. By continuing, you confirm that you meet this requirement and that you agree to these Terms in full.
      </div>

      <h2>1. Agreement to Terms</h2>
      <p>These Terms of Service ("Terms") govern your access to and use of dropathot ("we," "us," "our"), including our website at dropathot.com and any associated services (collectively, the "Service"). By creating an account, posting content, or using the Service, you agree to be bound by these Terms and our <a href="/legal/privacy">Privacy Policy</a> and <a href="/legal/safety">Safety Policy</a>.</p>
      <p>If you do not agree to these Terms, you may not access or use the Service. We reserve the right to update these Terms at any time. Continued use after any update constitutes your acceptance of the revised Terms.</p>

      <h2>2. Eligibility</h2>
      <p>You must be at least 18 years old to use dropathot. By using the Service, you represent and warrant that you are 18 or older. If we discover or reasonably suspect that you are under 18, we will terminate your access immediately and without notice. We do not knowingly collect personal information from anyone under 18.</p>
      <p>You may not use the Service if you have previously been banned, are prohibited from receiving our services under applicable law, or if your account has been suspended or terminated for any reason.</p>

      <h2>3. Your Account and Anonymous Sessions</h2>
      <p>You must register an account (identified by a pen name and email) to use the Service and post content. A unique session identifier is assigned to your device and retained server-side for moderation and legal compliance. See our <a href="/legal/privacy">Privacy Policy</a> for details.</p>
      <p>Registered accounts require a valid email and a unique pen name. You are responsible for securing your credentials. You may not share your account, impersonate another person, or choose a pen name that is misleading, offensive, or that infringes on another's rights.</p>

      <h2>4. Content You Post ("Thots")</h2>
      <p>Drop-a-thot allows users to post short text messages ("thots") tied to their geographic location. Posts are text-only — no images, videos, or files. By posting, you grant us a non-exclusive, royalty-free, worldwide, sublicensable license to display and distribute that content solely to operate and improve the Service. You retain ownership of your content.</p>
      <p>By posting, you represent and warrant that: (i) you own or have the right to post the content; (ii) the content does not violate any law or these Terms; and (iii) the content does not infringe any third party's intellectual property or privacy rights.</p>
      <p>Registered user thots expire and are hidden from the public map after 72 hours. Anonymous thots expire after 3 hours. Posting a new thot hides your previous one from the map. Expired content may still be retained on our servers for legal compliance.</p>

      <h2>5. Prohibited Conduct</h2>
      <p>You agree not to use the Service to:</p>
      <ul>
        <li>Post content that is threatening, harassing, abusive, hateful, or discriminatory based on race, ethnicity, religion, sex, sexual orientation, gender identity, national origin, disability, or age;</li>
        <li>Post content that sexually exploits, endangers, or depicts minors in any form — we have zero tolerance for CSAM and report all instances to NCMEC and law enforcement;</li>
        <li>Doxx or threaten to expose another person's private information without their consent;</li>
        <li>Solicit, coordinate, or facilitate real-world violence or illegal activity;</li>
        <li>Impersonate any person or entity or misrepresent your affiliation;</li>
        <li>Spam or repeatedly post the same or similar content;</li>
        <li>Scrape or extract data from the Service using automated means;</li>
        <li>Use the Service if you are a registered sex offender;</li>
        <li>Solicit personal information from other users;</li>
        <li>Post content that facilitates prostitution, sex trafficking, or commercial sexual exploitation.</li>
      </ul>

      <h2>6. Content Moderation</h2>
      <p>All posts are screened using automated tools (Google Perspective API and OpenAI Moderation API) prior to publication. Posts above our toxicity threshold are blocked. Posts receiving three or more user reports are automatically hidden pending review. We reserve the right to remove any content and terminate any account at our sole discretion.</p>
      <p>Consistent with Section 230 of the Communications Decency Act (47 U.S.C. § 230), we are not the publisher of user-generated content. We never editorially alter post content — moderation blocks posts entirely but does not modify their text.</p>

      <h2>7. Rate Limits</h2>
      <p>Registered users may post subject to per-session velocity limits, which we may adjust at any time to ensure service quality and prevent abuse.</p>

      <h2>8. Copyright and DMCA</h2>
      <p>We respect intellectual property rights. To submit a DMCA takedown notice, email <strong>legal@dropathot.com</strong> with: (i) identification of the copyrighted work; (ii) location of the infringing material; (iii) your contact information; (iv) a good faith belief statement; and (v) a statement under penalty of perjury that you are authorized to act, with your electronic signature. We will process valid notices promptly. We are in the process of completing our DMCA agent registration with the U.S. Copyright Office.</p>

      <h2>9. Privacy and Location Data</h2>
      <p>The Service is fundamentally location-based. When you post a thot, your approximate geographic coordinates are stored with the post and displayed on the map. We do not sell your location data to third parties. See our <a href="/legal/privacy">Privacy Policy</a> for full details.</p>

      <h2>10. Law Enforcement Cooperation</h2>
      <p>Anonymity on dropathot does not mean untraceability. We log session identifiers and hashed IP addresses for every post. These records may be disclosed to law enforcement in response to valid legal process — including subpoenas, court orders, and emergency requests involving risk of imminent harm. We cooperate fully with law enforcement investigations.</p>

      <h2>11. Disclaimers</h2>
      <p>THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND. TO THE FULLEST EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.</p>

      <h2>12. Limitation of Liability</h2>
      <p>TO THE FULLEST EXTENT PERMITTED BY LAW, DROP-A-THOT AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE SERVICE.</p>

      <h2>13. Arbitration and Class Action Waiver</h2>
      <p>Any dispute arising out of these Terms or the Service shall be resolved by binding individual arbitration under AAA rules — not in court. <strong>You waive your right to participate in any class action.</strong> This does not apply to small claims or requests for injunctive relief.</p>

      <h2>14. Governing Law</h2>
      <p>These Terms are governed by the laws of the State of Delaware, without regard to conflict of law principles.</p>

      <h2>15. Termination</h2>
      <p>We may suspend or terminate your access at any time, with or without cause or notice. Provisions that by their nature survive termination (IP rights, disclaimers, indemnity, arbitration) will do so.</p>

      <h2>16. Contact</h2>
      <p>Questions? Email us at <strong>legal@dropathot.com</strong>.</p>
    </LegalLayout>
  )
}
