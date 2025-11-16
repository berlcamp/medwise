// app/data-processing-agreement/page.tsx
export default function DataProcessingAgreementPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 text-sm leading-6">
      <h1 className="text-2xl font-bold mb-4">Data Processing Agreement</h1>
      <p>
        This Data Processing Agreement ({'"'}Agreement{'"'}) is made between the
        Location (referred to as {'"'}Data Controller{'"'}) and the System
        Developer (referred to as {'"'}Data Processor{'"'}) to ensure compliance
        with the Data Privacy Act of 2012.
      </p>

      <h2 className="mt-6 text-lg font-semibold">1. Purpose</h2>
      <p>
        The Developer provides a system used by the Location for managing
        resident and household information for legitimate government purposes.
      </p>

      <h2 className="mt-6 text-lg font-semibold">
        2. Roles and Responsibilities
      </h2>
      <p>
        <strong>Data Controller (Location):</strong> Determines the purpose and
        legal basis for processing personal data.
        <br />
        <strong>Data Processor (Developer):</strong> Processes data only on
        documented instructions from the Controller and shall not use it for any
        other purpose.
      </p>

      <h2 className="mt-6 text-lg font-semibold">3. Data Security</h2>
      <p>
        The Developer agrees to implement appropriate security measures to
        protect resident data from unauthorized access, disclosure, alteration,
        or loss.
      </p>

      <h2 className="mt-6 text-lg font-semibold">4. Confidentiality</h2>
      <p>
        The Developer shall ensure that all personnel with access to the data
        are bound by confidentiality obligations and receive privacy training.
      </p>

      <h2 className="mt-6 text-lg font-semibold">5. Subcontracting</h2>
      <p>
        The Developer shall not subcontract data processing without prior
        written authorization from the Location.
      </p>

      <h2 className="mt-6 text-lg font-semibold">6. Breach Notification</h2>
      <p>
        The Developer shall notify the Location within 24 hours of any data
        breach involving the System or its data.
      </p>

      <h2 className="mt-6 text-lg font-semibold">
        7. Return or Deletion of Data
      </h2>
      <p>
        Upon termination of this Agreement, the Developer shall return all
        personal data to the Location or securely delete it from all systems.
      </p>

      <h2 className="mt-6 text-lg font-semibold">8. Duration</h2>
      <p>
        This Agreement remains in effect for as long as the Developer provides
        services to the Location.
      </p>

      <h2 className="mt-6 text-lg font-semibold">9. Governing Law</h2>
      <p>
        This Agreement shall be governed by the laws of the Republic of the
        Philippines.
      </p>

      <p className="mt-8">
        Signed by the authorized representatives of both parties on the
        effective date of system deployment.
      </p>

      <p className="mt-4">
        <strong>Location:</strong> __________________________ <br />
        <strong>Representative:</strong> _____________________ <br />
        <strong>Date:</strong> _____________________________
      </p>

      <p className="mt-4">
        <strong>Developer:</strong> __________________________ <br />
        <strong>Representative:</strong> _____________________ <br />
        <strong>Date:</strong> _____________________________
      </p>

      <p className="mt-8 text-xs text-gray-500">Last updated: May 2025</p>
    </div>
  )
}
