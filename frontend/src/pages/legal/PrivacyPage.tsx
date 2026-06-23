import React from 'react';
import LegalLayout from '../../components/LegalLayout';

const H2: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="pt-2 text-lg font-medium text-white/90">{children}</h2>
);

/**
 * Public Privacy Policy. Template content — must be reviewed by a lawyer and
 * aligned with your actual data processing before launch. Reflects EU data
 * residency (eu-west-1) and Paddle as merchant of record.
 */
const PrivacyPage: React.FC = () => (
  <LegalLayout title="Privacy Policy" lastUpdated="2026-06-23">
    <p>
      This Privacy Policy explains how Echium AI ("we", "us") collects, uses and
      protects personal data when you use the Service. We are committed to
      handling your data in line with the EU General Data Protection Regulation
      (GDPR).
    </p>

    <H2>Data we collect</H2>
    <p>
      We collect account information (such as your email address), the content
      of your conversations and any documents you add to knowledge bases, and
      usage data needed to operate the Service and enforce plan limits. Payment
      details are handled by our payment provider, Paddle, and are not stored on
      our servers.
    </p>

    <H2>How we use data</H2>
    <p>
      We use your data to provide and improve the Service, generate AI
      responses to your requests, manage your subscription and usage, and
      communicate with you about your account. We do not sell your personal
      data.
    </p>

    <H2>Where data is processed</H2>
    <p>
      Service data is hosted and processed in the European Union (AWS Europe,
      Ireland region). AI inference is performed on EU-based infrastructure. Some
      sub-processors (such as our payment provider) may process limited data
      under appropriate safeguards.
    </p>

    <H2>Data retention</H2>
    <p>
      We retain your data for as long as your account is active and as needed to
      provide the Service. You can delete conversations within the app, and you
      may request deletion of your account and associated data.
    </p>

    <H2>Your rights</H2>
    <p>
      Under the GDPR you have the right to access, correct, delete and port your
      personal data, and to object to or restrict certain processing. To
      exercise these rights, contact us at privacy@echium.ai.
    </p>

    <H2>Sub-processors</H2>
    <p>
      We use trusted providers to operate the Service, including Amazon Web
      Services (hosting and AI infrastructure in the EU) and Paddle (payment
      processing as merchant of record). Each processes data only as needed to
      provide their service.
    </p>

    <H2>Contact</H2>
    <p>
      For privacy questions or requests, email privacy@echium.ai.
    </p>
  </LegalLayout>
);

export default PrivacyPage;
