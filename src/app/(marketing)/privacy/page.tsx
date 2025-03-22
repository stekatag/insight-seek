import { type Metadata } from "next";
import Link from "next/link";
import {
  ClipboardList,
  Lock,
  Mail,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

import { Navbar } from "@/components/landing/navbar";
import { FooterSection } from "@/components/landing/sections/footer";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Privacy Policy for InsightSeek - Learn how we protect your data.",
};

export default function PrivacyPolicyPage() {
  const lastUpdated = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      <Navbar currentPath="/privacy" />

      <div className="container py-16 sm:py-24">
        <div className="max-w-4xl mx-auto">
          <div className="relative mb-12 border-b pb-6">
            <h1 className="text-3xl md:text-4xl font-bold mb-4">
              Privacy Policy
            </h1>
            <p className="text-lg text-muted-foreground">
              Last updated: {lastUpdated}
            </p>
          </div>

          <div className="space-y-8">
            <section>
              <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
              <div className="prose prose-lg dark:prose-invert max-w-none">
                <p className="text-muted-foreground">
                  At InsightSeek, we are committed to protecting your privacy
                  and handling your data with transparency and care. This
                  Privacy Policy explains how we collect, use, disclose, and
                  safeguard your information when you use our AI-powered code
                  and meeting analysis services.
                </p>
                <p className="text-muted-foreground">
                  By using InsightSeek, you agree to the collection and use of
                  information in accordance with this policy. We will not use or
                  share your information with anyone except as described in this
                  Privacy Policy.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">
                2. Information We Collect
              </h2>
              <div className="bg-card border dark:border-secondary rounded-lg p-6 shadow-sm">
                <h3 className="text-xl font-medium mb-3">
                  Personal Information
                </h3>
                <p className="text-muted-foreground mb-4">
                  We collect information you provide directly to us when you:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                  <li>
                    Create and manage your account (email, name, profile
                    information)
                  </li>
                  <li>Connect your GitHub repositories and access tokens</li>
                  <li>Upload meeting recordings and transcripts</li>
                  <li>Use our AI features to analyze code or meetings</li>
                  <li>Make payments and purchase credits</li>
                  <li>Contact our support team</li>
                  <li>Respond to surveys or communications</li>
                </ul>
              </div>

              <div className="bg-card border dark:border-secondary rounded-lg p-6 shadow-sm mt-4">
                <h3 className="text-xl font-medium mb-3">
                  Automatically Collected Information
                </h3>
                <p className="text-muted-foreground mb-4">
                  We automatically collect certain information when you visit or
                  use our service:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                  <li>
                    Log data (IP address, browser type, pages visited, time
                    spent)
                  </li>
                  <li>Device information (hardware model, operating system)</li>
                  <li>Cookie and tracking technology data</li>
                  <li>Usage patterns and feature interaction</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">
                3. How We Use Your Information
              </h2>
              <p className="text-muted-foreground mb-4">
                We use the information we collect to:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-primary/5 border border-primary/10 rounded-lg p-4">
                  <p className="font-medium">Service Provision</p>
                  <p className="text-sm text-muted-foreground">
                    Provide, maintain, and improve our services to enhance your
                    experience
                  </p>
                </div>
                <div className="bg-primary/5 border border-primary/10 rounded-lg p-4">
                  <p className="font-medium">Code & Meeting Analysis</p>
                  <p className="text-sm text-muted-foreground">
                    Process and analyze your code repositories and meeting
                    recordings
                  </p>
                </div>
                <div className="bg-primary/5 border border-primary/10 rounded-lg p-4">
                  <p className="font-medium">Communication</p>
                  <p className="text-sm text-muted-foreground">
                    Send notifications, updates, and respond to your inquiries
                  </p>
                </div>
                <div className="bg-primary/5 border border-primary/10 rounded-lg p-4">
                  <p className="font-medium">Product Improvement</p>
                  <p className="text-sm text-muted-foreground">
                    Develop new features, analyze usage patterns, and fix bugs
                  </p>
                </div>
                <div className="bg-primary/5 border border-primary/10 rounded-lg p-4">
                  <p className="font-medium">Security</p>
                  <p className="text-sm text-muted-foreground">
                    Protect against fraud, abuse, and unauthorized access
                  </p>
                </div>
                <div className="bg-primary/5 border border-primary/10 rounded-lg p-4">
                  <p className="font-medium">Legal Compliance</p>
                  <p className="text-sm text-muted-foreground">
                    Comply with applicable laws, regulations, and legal
                    processes
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">
                4. GDPR Compliance
              </h2>
              <div className="border-l-4 border-primary pl-4 py-2">
                <p className="text-muted-foreground mb-3">
                  For users in the European Economic Area (EEA), we comply with
                  the General Data Protection Regulation (GDPR) by ensuring:
                </p>
              </div>
              <div className="space-y-4 mt-4">
                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                    1
                  </div>
                  <div>
                    <h4 className="font-medium">Lawful Basis for Processing</h4>
                    <p className="text-sm text-muted-foreground">
                      We only process your data when we have a legal basis to do
                      so, such as with your consent, to fulfill a contract, or
                      for our legitimate business interests.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                    2
                  </div>
                  <div>
                    <h4 className="font-medium">Data Subject Rights</h4>
                    <p className="text-sm text-muted-foreground">
                      You have the right to access, correct, update, port, or
                      delete your personal information, and to restrict or
                      object to our processing of your data.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                    3
                  </div>
                  <div>
                    <h4 className="font-medium">Data Transfers</h4>
                    <p className="text-sm text-muted-foreground">
                      When we transfer data outside the EEA, we ensure
                      appropriate safeguards are in place, including standard
                      contractual clauses or adequacy decisions.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">5. Data Retention</h2>
              <p className="text-muted-foreground mb-4">
                We retain your personal information for as long as necessary to
                fulfill the purposes outlined in this Privacy Policy, unless a
                longer retention period is required or permitted by law. When we
                no longer need your data, we will securely delete or anonymize
                it.
              </p>
              <div className="bg-card border dark:border-secondary rounded-lg p-5 shadow-sm">
                <h4 className="font-medium mb-2">
                  Specific Retention Periods:
                </h4>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                  <li>
                    <span className="font-medium">Account Information:</span>{" "}
                    Retained while your account is active and for a period
                    afterward to comply with legal obligations
                  </li>
                  <li>
                    <span className="font-medium">Repository Data:</span> Stored
                    until you disconnect the repository or delete your account
                  </li>
                  <li>
                    <span className="font-medium">Meeting Recordings:</span>{" "}
                    Retained according to your storage plan settings
                  </li>
                  <li>
                    <span className="font-medium">Payment Information:</span>{" "}
                    Stored as required by financial regulations
                  </li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">6. Data Security</h2>
              <p className="text-muted-foreground mb-4">
                We implement appropriate technical and organizational measures
                to protect your personal information against unauthorized
                access, alteration, disclosure, or destruction. These measures
                include:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-start gap-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <Lock className="size-4" />
                  </div>
                  <div>
                    <h4 className="font-medium">Encryption</h4>
                    <p className="text-sm text-muted-foreground">
                      Data-in-transit and data-at-rest encryption
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <ShieldCheck className="size-4" />
                  </div>
                  <div>
                    <h4 className="font-medium">Access Controls</h4>
                    <p className="text-sm text-muted-foreground">
                      Strict authentication and authorization
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <TriangleAlert className="size-4" />
                  </div>
                  <div>
                    <h4 className="font-medium">Monitoring</h4>
                    <p className="text-sm text-muted-foreground">
                      Continuous security monitoring and alerts
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <ClipboardList className="size-4" />
                  </div>
                  <div>
                    <h4 className="font-medium">Regular Audits</h4>
                    <p className="text-sm text-muted-foreground">
                      Security assessments and vulnerability testing
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">7. Your Rights</h2>
              <p className="text-muted-foreground mb-4">
                Depending on your location, you may have certain rights
                regarding your personal information:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-card border dark:border-secondary rounded-lg p-4">
                  <h4 className="font-medium mb-2">Right to Access</h4>
                  <p className="text-sm text-muted-foreground">
                    Request access to your personal data
                  </p>
                </div>
                <div className="bg-card border dark:border-secondary rounded-lg p-4">
                  <h4 className="font-medium mb-2">Right to Rectification</h4>
                  <p className="text-sm text-muted-foreground">
                    Update or correct inaccurate data
                  </p>
                </div>
                <div className="bg-card border dark:border-secondary rounded-lg p-4">
                  <h4 className="font-medium mb-2">Right to Erasure</h4>
                  <p className="text-sm text-muted-foreground">
                    Request deletion of your data (right to be forgotten)
                  </p>
                </div>
                <div className="bg-card border dark:border-secondary rounded-lg p-4">
                  <h4 className="font-medium mb-2">
                    Right to Restrict Processing
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Limit how we use your data
                  </p>
                </div>
                <div className="bg-card border dark:border-secondary rounded-lg p-4">
                  <h4 className="font-medium mb-2">
                    Right to Data Portability
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Receive your data in a structured, common format
                  </p>
                </div>
                <div className="bg-card border dark:border-secondary rounded-lg p-4">
                  <h4 className="font-medium mb-2">Right to Object</h4>
                  <p className="text-sm text-muted-foreground">
                    Object to processing of your data
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">
                8. Changes to This Privacy Policy
              </h2>
              <p className="text-muted-foreground mb-4">
                We may update this Privacy Policy from time to time to reflect
                changes in our practices or for other operational, legal, or
                regulatory reasons. We will notify you of any material changes
                by:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>Posting the new Privacy Policy on this page</li>
                <li>
                  Updating the "Last updated" date at the top of this page
                </li>
                <li>
                  Sending an email notification if we have your contact
                  information
                </li>
                <li>Providing a notice through our application</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                We encourage you to review this Privacy Policy periodically to
                stay informed about how we protect your information.
              </p>
            </section>

            <section className="bg-primary/5 border border-primary/20 rounded-lg p-6 shadow-sm">
              <h2 className="text-2xl font-semibold mb-4">9. Contact Us</h2>
              <p className="text-muted-foreground mb-4">
                If you have any questions about this Privacy Policy, please
                contact us at:
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="mailto:support@insightseek.vip"
                  className="flex items-center gap-2 text-primary hover:underline"
                >
                  <Mail className="size-4" />
                  support@insightseek.vip
                </Link>
              </div>
            </section>
          </div>
        </div>
      </div>

      <FooterSection isStandalonePage={true} />
    </>
  );
}
