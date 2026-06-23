import React from 'react';
import LegalLayout from '../../components/LegalLayout';

const H2: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="pt-2 text-lg font-medium text-white/90">{children}</h2>
);

/**
 * Public Terms of Service. Template content — must be reviewed by a lawyer
 * before launch. References Paddle as the merchant of record for payments.
 */
const TermsPage: React.FC = () => (
  <LegalLayout title="Terms of Service" lastUpdated="2026-06-23">
    <p>
      These Terms of Service ("Terms") govern your access to and use of Echium
      AI (the "Service"), an AI assistant web application operated by Echium AI
      ("we", "us", "our"). By creating an account or using the Service you agree
      to these Terms.
    </p>

    <H2>1. The Service</H2>
    <p>
      Echium AI provides a hosted, multi-model AI chat workspace with optional
      features such as custom knowledge bases and configurable AI assistants.
      The Service is delivered as software over the internet; we do not sell
      physical goods. Features available to you depend on your plan.
    </p>

    <H2>2. Accounts</H2>
    <p>
      You must provide accurate registration information and keep your
      credentials secure. You are responsible for activity under your account.
      You must be at least 18 years old, or the age of majority in your
      jurisdiction, to use the Service.
    </p>

    <H2>3. Plans, billing and payment</H2>
    <p>
      Paid plans and prepaid usage credits are billed through our payment
      provider, Paddle, which acts as the merchant of record for purchases.
      Paddle handles payment processing and applicable taxes. Subscriptions
      renew automatically for the chosen billing period until cancelled.
      Prepaid credits are consumed as you use the Service and do not expire
      except as stated at purchase.
    </p>

    <H2>4. Acceptable use</H2>
    <p>
      You agree not to use the Service to break the law, infringe others'
      rights, generate harmful or abusive content, attempt to disrupt or
      reverse-engineer the Service, or exceed or circumvent usage limits. We may
      suspend accounts that violate these Terms.
    </p>

    <H2>5. Your content</H2>
    <p>
      You retain ownership of the content you submit. You grant us the limited
      rights needed to operate the Service (for example, processing your inputs
      to generate responses). You are responsible for ensuring you have the
      rights to the content you provide.
    </p>

    <H2>6. AI outputs</H2>
    <p>
      AI-generated responses may be inaccurate or incomplete. The Service is
      provided for general assistance and is not professional advice. You are
      responsible for reviewing outputs before relying on them.
    </p>

    <H2>7. Availability and changes</H2>
    <p>
      We aim to keep the Service available but do not guarantee uninterrupted
      access. We may modify or discontinue features, and we may update these
      Terms; material changes will be communicated through the Service.
    </p>

    <H2>8. Liability</H2>
    <p>
      To the extent permitted by law, the Service is provided "as is" and our
      liability is limited to the amount you paid for the Service in the
      preceding twelve months. Nothing in these Terms excludes liability that
      cannot be excluded under applicable law.
    </p>

    <H2>9. Governing law</H2>
    <p>
      These Terms are governed by the laws of Spain, without regard to conflict
      of law rules, and subject to the mandatory consumer protections of your
      country of residence in the EU.
    </p>

    <H2>10. Contact</H2>
    <p>
      Questions about these Terms can be sent to support@echium.ai.
    </p>
  </LegalLayout>
);

export default TermsPage;
