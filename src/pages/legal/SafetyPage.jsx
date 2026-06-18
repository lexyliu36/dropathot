import LegalLayout from './LegalLayout'

export default function SafetyPage() {
  return (
    <LegalLayout title="Safety Policy" updated="June 9, 2026">
      <div className="callout">
        dropathot™ is built for anonymous expression — not a platform for harm. This policy explains how we protect our community, what we prohibit, and what to do if something goes wrong.
      </div>

      <h2>Our Commitment</h2>
      <p>Dropathot™ lets people share thoughts tied to where they are in the world. We believe strongly in free expression and the value of anonymous speech — but not at the cost of safety. Every feature we build is designed to balance openness with protection. We take safety seriously and invest in both automated and human moderation.</p>

      <h2>1. Age Requirement — 18+</h2>
      <p>Dropathot is strictly for adults. You must be 18 or older to use the Service. We enforce this through an age gate at enrollment and through our Terms of Service. If we detect or are informed that a user is under 18, we will terminate their account immediately and delete any associated content. We have zero tolerance for the grooming, solicitation, or sexual exploitation of minors in any form.</p>
      <p><strong>Child Safety:</strong> Any content that sexually exploits minors — including written descriptions, solicitations, or any form of child sexual abuse material (CSAM) — is strictly prohibited. We report all discovered CSAM to the National Center for Missing and Exploited Children (NCMEC) via CyberTipline and cooperate fully with law enforcement investigations. There are no exceptions to this rule.</p>

      <h2>2. Violence and Threats</h2>
      <p>We do not allow content that:</p>
      <ul>
        <li>Threatens violence against any specific person, group, or location;</li>
        <li>Calls for, incites, or coordinates real-world acts of violence or terrorism;</li>
        <li>Glorifies, promotes, or celebrates acts of violence, mass shootings, or terrorism;</li>
        <li>Provides instructions for making weapons capable of mass harm.</li>
      </ul>
      <p>Posts of this nature are blocked by automated moderation and/or removed immediately upon discovery. We report credible threats to law enforcement.</p>

      <h2>3. Harassment and Bullying</h2>
      <p>Dropathot is location-based and community-oriented. We do not allow:</p>
      <ul>
        <li>Targeted harassment, bullying, or sustained negative campaigns against any individual;</li>
        <li>Content designed to make a specific person fear for their safety;</li>
        <li>Coordinated pile-ons or brigading of another user;</li>
        <li>Posting personal insults, slurs, or degrading content directed at a specific person.</li>
      </ul>
      <p>Pen names are designed to encourage authentic expression, not shields for abuse. Anonymous speech does not grant a license to harass.</p>

      <h2>4. Hate Speech</h2>
      <p>We remove content that promotes, glorifies, or dehumanizes people based on protected characteristics including but not limited to: race, ethnicity, national origin, religion, gender, gender identity, sexual orientation, disability, and age. This includes slurs, dehumanizing comparisons, calls for discrimination, and content that reinforces harmful stereotypes with the intent to degrade a group.</p>
      <p>Critique, satire, and commentary on topics involving these groups is permitted when it does not cross into dehumanization. We recognize these are difficult lines and exercise judgment with care.</p>

      <h2>5. Doxxing and Privacy Violations</h2>
      <p>You may not post another person's private information without their explicit consent. This includes:</p>
      <ul>
        <li>Real name, home address, phone number, email, or financial information;</li>
        <li>Workplace, school, or daily routine information intended to enable stalking or harassment;</li>
        <li>Private photographs or intimate images shared without consent ("non-consensual intimate imagery" or NCII).</li>
      </ul>
      <p>We will remove doxxing content immediately upon identification or report and may share relevant information with law enforcement where threats to safety are involved.</p>

      <h2>6. Self-Harm and Suicide</h2>
      <p>We care about the wellbeing of everyone in our community. Content that explicitly promotes, glorifies, or provides detailed methods for self-harm or suicide is not permitted. We recognize that people may post about mental health struggles — this is allowed. Our line is content that encourages or instructs others to harm themselves.</p>
      <p>If you or someone you know is in crisis, please reach out for help:</p>
      <ul>
        <li><strong>988 Suicide and Crisis Lifeline:</strong> Call or text <strong>988</strong> (US)</li>
        <li><strong>Crisis Text Line:</strong> Text HOME to <strong>741741</strong></li>
        <li><strong>International Association for Suicide Prevention:</strong> <a href="https://www.iasp.info/resources/Crisis_Centres/" target="_blank" rel="noopener noreferrer">iasp.info</a></li>
      </ul>

      <h2>7. Spam and Manipulation</h2>
      <p>We prohibit:</p>
      <ul>
        <li>Coordinated inauthentic behavior — using multiple accounts or coordinated groups to artificially manipulate the map or leaderboard;</li>
        <li>Posting repetitive or near-identical content to flood the local feed;</li>
        <li>Using automated tools or bots to post content;</li>
        <li>Misleading content designed to deceive users about its origin, purpose, or facts.</li>
      </ul>

      <h2>8. Illegal Activity</h2>
      <p>Dropathot may not be used to facilitate, promote, or coordinate illegal activity, including but not limited to: drug distribution, sex trafficking, prostitution, weapons trafficking, fraud, or any other criminal enterprise. Posts of this nature are removed and, where appropriate, reported to law enforcement.</p>

      <h2>9. How Moderation Works</h2>
      <p><strong>Automated pre-screening:</strong> Every post passes through the Google Perspective API (toxicity scoring) and OpenAI Moderation API before publication. Posts that exceed our thresholds for toxicity, threats, or severe content are blocked and never published. Blocked attempts are logged with session ID and hashed IP.</p>
      <p><strong>Community reporting:</strong> Any user can report any post using the report button on the detail sheet. Posts that accumulate three or more reports from different users are automatically hidden from the map pending manual review.</p>
      <p><strong>Manual review:</strong> Our team reviews reported and flagged content and may remove posts, restrict accounts, or permanently ban users. Bans apply to the account and the associated session/device — ban evasion via new accounts violates our Terms.</p>
      <p><strong>Appeals:</strong> If you believe your content was removed in error, email <strong>safety@dropathot.com</strong> with your pen name and a description of the post in question. We review all appeals.</p>

      <h2>10. Anonymity Is Not Impunity</h2>
      <p>Dropathot is designed for anonymous expression — your pen name and identity are not shown to other users unless you choose to disclose them. However, anonymity does not mean untraceability. We retain hashed IP addresses and session identifiers for all posts. This information is disclosed to law enforcement in response to valid legal process. If you engage in illegal activity on the platform, you can be identified through lawful investigation.</p>

      <h2>11. Law Enforcement Cooperation</h2>
      <p>We take our legal obligations seriously and cooperate with law enforcement agencies worldwide. We respond to:</p>
      <ul>
        <li>Valid subpoenas, court orders, and search warrants;</li>
        <li>Emergency disclosure requests where there is an imminent threat to life or safety — no legal process required in these cases.</li>
      </ul>
      <p>All law enforcement requests are logged and reviewed by us before disclosure. We provide only the specific data requested and nothing more.</p>

      <h2>12. Reporting a Safety Concern</h2>
      <p>To report a post: tap the post on the map, open the detail sheet, and tap the Report button. To report a serious safety concern, imminent threat, or CSAM directly to our team, email <strong>safety@dropathot.com</strong>. We treat all safety reports as high priority.</p>
      <p>For emergencies, always contact local law enforcement (911 in the US) first. Do not rely solely on in-app reporting for urgent situations.</p>

      <h2>13. Contact</h2>
      <p>Safety team: <strong>safety@dropathot.com</strong><br/>Legal and law enforcement requests: <strong>legal@dropathot.com</strong><br/>Privacy concerns: <strong>privacy@dropathot.com</strong></p>
    </LegalLayout>
  )
}
