import { Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldAlert } from "lucide-react";

import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — Prachar Studio" },
      {
        name: "description",
        content:
          "Terms and conditions governing the use of the Prachar Studio WhatsApp CRM and administration platform.",
      },
    ],
  }),
  component: TermsPage,
});

function createFileRoute(path: string) {
  // This local wrapper keeps the route declaration explicit for generated TanStack route typing.
  // The build-time router plugin replaces this with the imported route helper.
  return undefined as never;
}

function TermsPage() {
  return (
    <div className="min-h-screen bg-surface text-foreground">
      <header className="border-b border-border bg-navy">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-5 lg:px-8">
          <Logo onDark />
          <Link
            to="/"
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/15 px-3 text-sm font-medium text-white/85 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-5 py-10 lg:px-8 lg:py-14">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold tracking-wide text-primary">LEGAL</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
            Terms & Conditions
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            These terms govern your access to and use of Prachar Studio and its WhatsApp CRM,
            messaging, automation, and administration features.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">Last updated: 8 September 2026</p>
        </div>

        <div className="mt-8 rounded-xl border border-primary/20 bg-primary/5 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-bold text-navy">Important notice</h2>
              <p className="mt-1 text-sm leading-relaxed text-foreground/80">
                Prachar Studio is a communication and CRM tool. You are responsible for how you
                use it, what you send, who you contact, and whether your activity complies with
                applicable law and third-party platform policies. Additional WhatsApp-specific
                risks are stated in Sections 20 and 21 below.
              </p>
            </div>
          </div>
        </div>

        <article className="mt-10 max-w-3xl space-y-10">
          <Section title="1. Acceptance of Terms">
            <p>
              By accessing or using Prachar Studio, you agree to be bound by these Terms &
              Conditions. If you do not agree with these terms, you must not use the application.
            </p>
            <p>
              If you use Prachar Studio on behalf of a business or other organization, you confirm
              that you are authorized to accept these terms on its behalf.
            </p>
          </Section>

          <Section title="2. About Prachar Studio">
            <p>
              Prachar Studio provides a software workspace for managing leads, contacts, WhatsApp
              conversations, templates, campaigns, automations, team access, and related
              administrative workflows.
            </p>
            <p>
              Features may change, be added, limited, suspended, or removed as the product evolves
              or as third-party services change.
            </p>
          </Section>

          <Section title="3. Eligibility and Account Registration">
            <p>
              You must provide accurate information when creating or using an account and must keep
              your access credentials secure. You are responsible for activity carried out through
              your account and for restricting access to authorized users.
            </p>
            <p>
              Do not share credentials in a manner that allows unauthorized persons to access your
              workspace or connected services.
            </p>
          </Section>

          <Section title="4. Acceptable Use and Prohibited Activities">
            <p>You may not use Prachar Studio to:</p>
            <ul>
              <li>send spam, unsolicited bulk messages, or deceptive communications;</li>
              <li>harass, threaten, impersonate, defraud, or mislead any person or organization;</li>
              <li>distribute malware, phishing content, malicious links, or harmful code;</li>
              <li>scrape, collect, process, or disclose personal information without appropriate authorization;</li>
              <li>circumvent or attempt to bypass third-party restrictions, rate limits, or enforcement systems;</li>
              <li>interfere with, probe, reverse engineer, or compromise the security of the application or connected services;</li>
              <li>conduct activity that violates applicable law, regulation, or a third-party service policy.</li>
            </ul>
          </Section>

          <Section title="5. User Responsibility">
            <p>
              You are solely responsible for your use of Prachar Studio, including your account,
              contacts, lead data, campaigns, automations, templates, recipients, and business
              processes.
            </p>
            <p>
              You must ensure that your use of the platform is lawful and that you have all
              permissions, notices, consents, or other authorizations required to contact and
              process information relating to your recipients or customers.
            </p>
          </Section>

          <Section title="6. Customer Data and Privacy">
            <p>
              You remain responsible for the customer, lead, contact, conversation, and other data
              that you enter, import, store, or process through Prachar Studio.
            </p>
            <p>
              You must have the legal right and appropriate basis to collect and process such data.
              You should also maintain appropriate internal controls for access, retention, and
              deletion of sensitive information.
            </p>
            <p>
              Where a separate Privacy Policy applies, it forms part of the rules governing your
              use of the service.
            </p>
          </Section>

          <Section title="7. Messaging Responsibility">
            <p>
              Prachar Studio provides technology to facilitate communications. We do not control,
              approve, or endorse the messages you send.
            </p>
            <p>
              You are solely responsible for the content, accuracy, legality, recipients,
              frequency, timing, and purpose of messages sent through your account.
            </p>
          </Section>

          <Section title="8. Third-Party Services">
            <p>
              Prachar Studio may depend on third-party services, APIs, libraries, infrastructure,
              hosting providers, communication platforms, and network providers.
            </p>
            <p>
              Third-party services may change their functionality, policies, access requirements,
              limits, pricing, availability, or enforcement practices at any time. Prachar Studio
              cannot guarantee the continued availability or compatibility of any third-party
              integration.
            </p>
          </Section>

          <Section title="9. Message Delivery Disclaimer">
            <p>
              Prachar Studio does not guarantee that any message will be sent, delivered, received,
              read, or responded to.
            </p>
            <p>
              Delivery can be affected by recipient settings, connectivity, account status, rate
              limits, third-party enforcement, technical issues, network failures, or other
              circumstances outside our control.
            </p>
          </Section>

          <Section title="10. Subscriptions and Payments">
            <p>
              Where paid plans are offered, the applicable pricing, billing cycle, taxes, renewal,
              payment failure, cancellation, upgrade, downgrade, and refund terms will be presented
              at the time of purchase or in the applicable order or plan documentation.
            </p>
          </Section>

          <Section title="11. Intellectual Property">
            <p>
              Prachar Studio and its licensors retain all rights in the software, interface,
              branding, logos, designs, documentation, and underlying technology of the service,
              except for rights that belong to third parties.
            </p>
            <p>
              You retain ownership of content and business data that you lawfully provide to the
              platform, subject to the rights required for Prachar Studio to operate the service.
            </p>
          </Section>

          <Section title="12. Service Availability">
            <p>
              We aim to keep the service available and reliable, but we do not guarantee uninterrupted
              or error-free operation. The service may be unavailable because of maintenance,
              upgrades, outages, infrastructure issues, network interruptions, security events, or
              third-party failures.
            </p>
          </Section>

          <Section title="13. Account Suspension and Termination">
            <p>
              Prachar Studio may suspend or terminate access where reasonably necessary to address
              misuse, unlawful activity, security concerns, non-payment, violations of these terms,
              or requirements from a third-party service provider or applicable law.
            </p>
            <p>
              You may stop using the service at any time. Any provisions that by their nature should
              survive termination will continue to apply.
            </p>
          </Section>

          <Section title="14. Disclaimer of Warranties">
            <p>
              Except where a warranty cannot lawfully be excluded, Prachar Studio is provided on an
              “as is” and “as available” basis. We do not warrant that the service will always meet
              every requirement, operate without interruption, or remain compatible with every
              third-party platform or device.
            </p>
          </Section>

          <Section title="15. Limitation of Liability">
            <p>
              To the maximum extent permitted by applicable law, Prachar Studio and its operators,
              personnel, and service providers will not be liable for indirect, incidental,
              special, consequential, exemplary, or punitive losses arising from your use of the
              service, including loss of business, revenue, goodwill, or access to third-party
              services.
            </p>
            <p>
              Nothing in these terms excludes or limits liability that cannot lawfully be excluded
              or limited under applicable law.
            </p>
          </Section>

          <Section title="16. Indemnification">
            <p>
              To the extent permitted by law, you agree to defend, indemnify, and hold harmless
              Prachar Studio from claims, losses, liabilities, damages, and expenses arising from
              your misuse of the service, your communications, your content or data, your violation
              of law, or your violation of third-party terms or rights.
            </p>
          </Section>

          <Section title="17. Changes to These Terms">
            <p>
              We may update these Terms & Conditions from time to time. The updated version will be
              published with a revised “Last updated” date. Continued use of Prachar Studio after
              an update constitutes acceptance of the revised terms to the extent permitted by law.
            </p>
          </Section>

          <Section title="18. Governing Law and Jurisdiction">
            <p>
              These terms will be governed by the laws applicable to Prachar Studio and its
              contracting entity. Any dispute will be subject to the courts or other competent
              authority having jurisdiction under applicable law.
            </p>
            <p>
              The final contracting entity, governing law, and jurisdiction should be confirmed in
              the production legal documentation before commercial launch.
            </p>
          </Section>

          <Section title="19. Contact Us">
            <p>
              For questions regarding these terms, use the official contact details provided by
              Prachar Studio through its website or your account documentation.
            </p>
          </Section>

          <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 sm:p-6">
            <p className="text-xs font-bold tracking-widest text-primary uppercase">Final risk notice</p>
            <h2 className="mt-2 text-lg font-bold text-navy">20. WhatsApp Account & Number Risk</h2>
            <div className="mt-4 space-y-3 text-sm leading-relaxed text-foreground/85">
              <p>
                Prachar Studio may provide WhatsApp connectivity, automation, and messaging
                functionality through third-party technologies and libraries, including Baileys.
                Such technologies may not be official products or services of WhatsApp or Meta.
              </p>
              <p>
                Use of WhatsApp-related functionality through Prachar Studio may involve risks
                including temporary restrictions, permanent suspension, disconnection, logout,
                reduced messaging functionality, delivery limitations, or loss of access to a
                WhatsApp account or phone number.
              </p>
              <p className="font-semibold text-navy">
                You acknowledge that you use the WhatsApp functionality at your own risk.
              </p>
              <p>
                Prachar Studio does not guarantee that any WhatsApp account, phone number, session,
                connection, or messaging capability will remain active, available, or unrestricted.
              </p>
              <p>
                You are solely responsible for the WhatsApp account and phone number connected to
                Prachar Studio and for ensuring that your use complies with applicable law and
                relevant third-party policies.
              </p>
            </div>
          </div>

          <Section title="21. Bulk Messaging, Spam and Misuse">
            <p>
              Prachar Studio must not be used for spam, abusive messaging, unsolicited bulk
              communication, harassment, deceptive communication, fraudulent activity, or any
              other misuse.
            </p>
            <p>
              Sending large volumes of messages, repetitive messages, unsolicited messages, or
              messages to recipients who have not provided an appropriate basis for communication
              may increase the risk of restrictions, suspension, or other enforcement actions by
              WhatsApp or other third-party services.
            </p>
            <p className="font-semibold text-navy">
              You are solely responsible for the messages sent through your account, including their
              content, recipients, frequency, timing, and purpose.
            </p>
            <p>
              Prachar Studio is not responsible for consequences resulting from your misuse of the
              application, including restrictions, suspension, termination, loss of access, or other
              action taken against your connected WhatsApp account or phone number, except to the
              extent such liability cannot legally be excluded.
            </p>
          </Section>
        </article>
      </main>

      <footer className="border-t border-border bg-white">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-5 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <span>© {new Date().getFullYear()} Prachar Studio</span>
          <div className="flex items-center gap-4">
            <Link to="/terms" className="font-medium text-navy hover:text-primary">
              Terms & Conditions
            </Link>
            <Link to="/" className="font-medium text-navy hover:text-primary">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-bold text-navy sm:text-xl">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-7 text-foreground/80">{children}</div>
    </section>
  );
}
