// app/privacy-policy/page.tsx
export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 text-sm leading-6">
      <h1 className="text-2xl font-bold mb-4">Privacy Policy</h1>
      <p>
        This Privacy Policy describes how the Location Information Management
        System ({'"'}the System{'"'}) collects, uses, stores, and protects the
        personal data of location residents.
      </p>

      <h2 className="mt-6 text-lg font-semibold">1. Purpose</h2>
      <p>
        The system is used by the Location Secretary to maintain accurate and
        up-to-date records of residents and households, which are essential for
        disaster response, local governance, health programs, and community
        services.
      </p>

      <h2 className="mt-6 text-lg font-semibold">2. Data Collected</h2>
      <p>The system may collect and store the following information:</p>
      <ul className="list-disc ml-6">
        <li>Full name</li>
        <li>Date of birth</li>
        <li>Address / Location</li>
        <li>Household information</li>
      </ul>

      <h2 className="mt-6 text-lg font-semibold">3. Legal Basis</h2>
      <p>
        Data is collected and processed under Section 12(c) of the Data Privacy
        Act of 2012, which permits processing for the fulfillment of
        constitutional or statutory mandates of public authorities.
      </p>

      <h2 className="mt-6 text-lg font-semibold">4. Data Access</h2>
      <p>
        Only authorized location officials and staff may access resident
        information. Data will not be shared with third parties without legal
        authority or resident consent.
      </p>

      <h2 className="mt-6 text-lg font-semibold">5. Data Protection</h2>
      <p>
        The System implements technical and organizational safeguards to protect
        data, including secure logins, role-based access, and encrypted data
        storage.
      </p>

      <h2 className="mt-6 text-lg font-semibold">6. Data Subject Rights</h2>
      <p>Residents have the right to:</p>
      <ul className="list-disc ml-6">
        <li>Access their personal data</li>
        <li>Request correction or deletion</li>
        <li>Inquire about how their data is used</li>
      </ul>

      <h2 className="mt-6 text-lg font-semibold">7. Contact Information</h2>
      <p>
        For inquiries or requests, contact the Location Secretary at your local
        location hall.
      </p>

      <p className="mt-8 text-xs text-gray-500">Last updated: May 2025</p>
    </div>
  )
}
