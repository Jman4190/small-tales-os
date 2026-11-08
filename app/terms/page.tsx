import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  alternates: {
    canonical: '/terms',
  },
}

export default function TermsOfService() {
  return (
    <>
      <Header />
      <main className="container mx-auto px-4 py-12 min-h-screen">
        <div className="prose max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-2">TERMS AND CONDITIONS</h1>
          <p className="text-sm text-muted-foreground mb-6">Last Updated: May 1, 2025</p>
          
          <div className="bg-accent p-6 rounded-lg mb-8">
            <p className="mb-4">Please read these Terms and Conditions ("Terms") carefully before using the https://www.example.com website (the "Service") operated by Storybook Starter Inc. ("we," "us," or "our"). These Terms set forth the legally binding terms and conditions for your use of our website and the services we provide, including the creation of custom illustration books based on user-uploaded material ("Goods").</p>
          </div>
          
          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">1. Interpretation and Definitions</h2>
            <div className="pl-4 border-l-2 border-accent mb-6">
              <h3 className="text-xl font-medium mb-2">Interpretation</h3>
              <p className="mb-4">Words with an initial capital letter have specific meanings defined under the following conditions. These definitions shall have the same meaning regardless of whether they appear in singular or in plural.</p>
            </div>
            
            <div className="pl-4 border-l-2 border-accent">
              <h3 className="text-xl font-medium mb-2">Definitions</h3>
              <ul className="space-y-4 mb-6">
                <li className="bg-muted p-3 rounded">
                  <p><strong>Account</strong> means a unique account created by You to access certain parts of our Service.</p>
                </li>
                <li className="bg-muted p-3 rounded">
                  <p><strong>Affiliate</strong> means any entity that controls, is controlled by, or is under common control with a party, where "control" means ownership of at least 50% of the shares or other securities entitled to vote for election of directors or other managing authority.</p>
                </li>
                <li className="bg-muted p-3 rounded">
                  <p><strong>Company</strong> (referred to as "Storybook Starter Inc.," "we," "us," or "our") refers to Storybook Starter Inc.</p>
                </li>
                <li className="bg-muted p-3 rounded">
                  <p><strong>Content</strong> means text, images, or any other information posted, uploaded, linked to, or otherwise made available by You on the Service, regardless of its form.</p>
                </li>
                <li className="bg-muted p-3 rounded">
                  <p><strong>Device</strong> means any device that can access the Service such as a computer, mobile phone, or digital tablet.</p>
                </li>
                <li className="bg-muted p-3 rounded">
                  <p><strong>Goods</strong> refers to the items offered for sale on the Service, such as custom illustration books based on user-uploaded material.</p>
                </li>
                <li className="bg-muted p-3 rounded">
                  <p><strong>Orders</strong> means a request by You to purchase Goods from Us.</p>
                </li>
                <li className="bg-muted p-3 rounded">
                  <p><strong>Service</strong> refers to the Website and any related services offered by us.</p>
                </li>
                <li className="bg-muted p-3 rounded">
                  <p><strong>Terms</strong> refers to these Terms and Conditions.</p>
                </li>
                <li className="bg-muted p-3 rounded">
                  <p><strong>Website</strong> refers to https://www.example.com.</p>
                </li>
                <li className="bg-muted p-3 rounded">
                  <p><strong>You</strong> (also referred to as "User") means the individual or legal entity accessing or using the Service, as applicable.</p>
                </li>
              </ul>
            </div>
          </section>
          
          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">2. Acceptance and Acknowledgment</h2>
            
            <div className="pl-4 border-l-2 border-accent mb-6">
              <h3 className="text-xl font-medium mb-2">Binding Agreement</h3>
              <p className="mb-4">By accessing or using our Service in any way—including visiting, browsing, or placing an Order—You agree to be bound by these Terms. If You do not agree with any part of these Terms, You must not access or use our Service.</p>
            </div>
            
            <div className="pl-4 border-l-2 border-accent mb-6">
              <h3 className="text-xl font-medium mb-2">Age Requirement</h3>
              <p className="mb-4">You represent that You are at least 18 years old. If You are under 18, You must obtain express permission from a parent or guardian before using our Service.</p>
            </div>
            
            <div className="pl-4 border-l-2 border-accent mb-6">
              <h3 className="text-xl font-medium mb-2">Additional Policies</h3>
              <p className="mb-4">Your use of our Service is also subject to our <a href="/privacy" className="underline hover:text-blue-600">Privacy Policy</a>, which describes how we collect, use, and disclose your personal information. Please read our Privacy Policy carefully before using our Service.</p>
            </div>
          </section>
          
          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">3. User Accounts</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="bg-muted p-5 rounded-lg">
                <h3 className="text-xl font-medium mb-3">Registration</h3>
                <p>When You create an Account, You must provide accurate, complete, and current information at all times. Failure to do so constitutes a breach of these Terms.</p>
              </div>
              
              <div className="bg-muted p-5 rounded-lg">
                <h3 className="text-xl font-medium mb-3">Security</h3>
                <p>You are responsible for maintaining the confidentiality of your Account credentials and for any and all activities that occur under your Account. You agree to notify us immediately of any unauthorized use of your Account or any other breach of security.</p>
              </div>
              
              <div className="bg-muted p-5 rounded-lg">
                <h3 className="text-xl font-medium mb-3">Termination or Suspension</h3>
                <p>We reserve the right to terminate or suspend your Account, without prior notice or liability, for any reason whatsoever, including if You breach these Terms.</p>
              </div>
            </div>
          </section>
          
          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">4. Placing Orders</h2>
            
            <div className="pl-4 border-l-2 border-accent mb-6">
              <h3 className="text-xl font-medium mb-2">Order Process</h3>
              <p className="mb-4">By placing an Order for Goods through our Service, You represent and warrant that (i) You are legally capable of entering into binding contracts; and (ii) the information You provide is true, accurate, and complete.</p>
            </div>
            
            <div className="pl-4 border-l-2 border-accent mb-6">
              <h3 className="text-xl font-medium mb-2">User Content for Custom Orders</h3>
              <ul className="space-y-4 mb-4">
                <li className="bg-muted p-3 rounded">
                  <p><strong>Ownership and Permissions:</strong> You must own all rights to the Content You upload or otherwise have the legal right to grant us permission to use it to create custom illustration books.</p>
                </li>
                <li className="bg-muted p-3 rounded">
                  <p><strong>Acceptable Content:</strong> You agree not to upload Content that is illegal, defamatory, pornographic, obscene, harassing, hateful, or that otherwise violates any third-party rights or these Terms.</p>
                </li>
                <li className="bg-muted p-3 rounded">
                  <p><strong>License Grant:</strong> By uploading Content, You grant us a non-exclusive, worldwide, royalty-free license to use, reproduce, adapt, modify, and display such Content strictly for the purpose of fulfilling your Order.</p>
                </li>
                <li className="bg-muted p-3 rounded">
                  <p><strong>Content Review:</strong> We reserve the right to reject or remove any Content in our sole discretion.</p>
                </li>
              </ul>
            </div>
            
            <div className="pl-4 border-l-2 border-accent mb-6">
              <h3 className="text-xl font-medium mb-2">Payment</h3>
              <p className="mb-4">All Orders require payment through the methods we have available (e.g., credit card, PayPal). You acknowledge and agree that we may use third-party payment processors. You are responsible for any fees imposed by your selected payment method.</p>
            </div>
            
            <div className="pl-4 border-l-2 border-accent mb-6">
              <h3 className="text-xl font-medium mb-2">Order Confirmation and Cancellation</h3>
              <ul className="space-y-4 mb-4">
                <li className="bg-muted p-3 rounded">
                  <p><strong>Confirmation:</strong> Once an Order is placed, You will receive an email confirmation summarizing your Order details.</p>
                </li>
                <li className="bg-muted p-3 rounded">
                  <p><strong>SMS Notifications for Order Approval:</strong> Upon completing your Order, You agree to receive an SMS message via Twilio containing a link to preview your custom book PDF. Standard message and data rates may apply. Your approval of the preview via the provided link is required before we proceed with printing.</p>
                </li>
                <li className="bg-muted p-3 rounded">
                  <p><strong>Cancellation by Us:</strong> We may cancel your Order for reasons including but not limited to unavailability of Goods, errors in pricing, or suspicion of fraud.</p>
                </li>
                <li className="bg-muted p-3 rounded">
                  <p><strong>Cancellation by You:</strong> Because of the custom nature of our Goods, cancellations and refunds are only possible if production has not yet commenced. Once the production process has started, no cancellation or refund will be issued.</p>
                </li>
              </ul>
            </div>
          </section>
          
          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">5. Returns, Refunds, and Replacement</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-muted p-5 rounded-lg">
                <h3 className="text-xl font-medium mb-3">Custom Goods</h3>
                <p>Due to the personalized nature of our products, all sales are final once production has begun. We do not accept returns or issue refunds for custom books unless the Goods are defective or damaged upon arrival.</p>
              </div>
              
              <div className="bg-muted p-5 rounded-lg">
                <h3 className="text-xl font-medium mb-3">Damaged or Defective Items</h3>
                <p>If you receive a damaged or defective book, please contact us at <a href="mailto:contact@example.com" className="underline hover:text-blue-600">contact@example.com</a> within 7 days of delivery. We may request photographs or additional information to process a replacement.</p>
              </div>
            </div>
          </section>
          
          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">6. Pricing and Availability</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="bg-muted p-5 rounded-lg">
                <h3 className="text-xl font-medium mb-3">Price Changes</h3>
                <p>We reserve the right to change our prices at any time without prior notice. The price charged will be the price at the time You place your Order.</p>
              </div>
              
              <div className="bg-muted p-5 rounded-lg">
                <h3 className="text-xl font-medium mb-3">Availability</h3>
                <p>We continually update our products and may experience delays in updating information on the Website regarding availability. We do not guarantee that any product will be available at the time You place an Order.</p>
              </div>
              
              <div className="bg-muted p-5 rounded-lg">
                <h3 className="text-xl font-medium mb-3">Inaccuracies</h3>
                <p>In the event of any pricing or availability inaccuracy, we reserve the right to cancel or refuse any Order placed for the affected Goods. If your credit card has been charged, we will promptly issue a refund.</p>
              </div>
            </div>
          </section>
          
          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">7. Intellectual Property</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="bg-muted p-5 rounded-lg">
                <h3 className="text-xl font-medium mb-3">Ownership</h3>
                <p>The Service and its original content (excluding Content provided by You or other Users), features, and functionality are and will remain the exclusive property of Storybook Starter Inc. and its licensors.</p>
              </div>
              
              <div className="bg-muted p-5 rounded-lg">
                <h3 className="text-xl font-medium mb-3">Trademarks</h3>
                <p>Our trademarks may not be used in connection with any product or service without our express prior written consent.</p>
              </div>
              
              <div className="bg-muted p-5 rounded-lg">
                <h3 className="text-xl font-medium mb-3">User-Generated Content</h3>
                <p>You retain all rights to Content You upload. However, by uploading Content, You grant us the limited rights outlined in Section 4(2) of these Terms.</p>
              </div>
            </div>
          </section>
          
          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">8. User Conduct and Prohibited Uses</h2>
            
            <div className="bg-accent p-5 rounded-lg mb-6">
              <p className="mb-4">You agree not to use the Service for any unlawful or prohibited purpose, including but not limited to:</p>
              <ul className="list-disc pl-6 space-y-2 mb-4">
                <li>Violating any applicable local, state, national, or international law.</li>
                <li>Infringing upon or violating our intellectual property rights or the rights of others.</li>
                <li>Harassing, abusing, insulting, defaming, intimidating, or discriminating against any individual or group.</li>
                <li>Uploading or transmitting viruses or other malicious code.</li>
                <li>Submitting false or misleading information.</li>
                <li>Attempting to circumvent or compromise the security of the Service.</li>
              </ul>
              <p>We reserve the right to terminate your use of the Service if You violate any of these prohibited uses.</p>
            </div>
          </section>
          
          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">9. Limitation of Liability</h2>
            
            <div className="bg-accent p-5 rounded-lg mb-6">
              <p className="mb-4">To the maximum extent permitted by law:</p>
              
              <div className="pl-4 border-l-2 border-muted mb-4">
                <h3 className="text-xl font-medium mb-2">Indirect Damages</h3>
                <p className="mb-4">Storybook Starter Inc. and its directors, officers, employees, agents, and affiliates will not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or relating to your use of the Service or the Goods.</p>
              </div>
              
              <div className="pl-4 border-l-2 border-muted mb-4">
                <h3 className="text-xl font-medium mb-2">Limit on Liability</h3>
                <p className="mb-4">Our total liability for any claims under these Terms, including those arising out of or related to the purchase of any Goods, will be limited to the amount You paid us for the specific Goods giving rise to the claim (or $100 USD if You have not purchased anything).</p>
              </div>
              
              <p>Some jurisdictions do not allow the exclusion or limitation of certain liabilities, so some of the above limitations may not apply to You.</p>
            </div>
          </section>
          
          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">10. Disclaimer of Warranties</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-muted p-5 rounded-lg">
                <h3 className="text-xl font-medium mb-3">"As Is" and "As Available"</h3>
                <p>The Service and Goods are provided "AS IS" and "AS AVAILABLE" without warranty of any kind. We expressly disclaim all warranties, whether express, implied, statutory, or otherwise, including implied warranties of merchantability and fitness for a particular purpose.</p>
              </div>
              
              <div className="bg-muted p-5 rounded-lg">
                <h3 className="text-xl font-medium mb-3">No Guarantee</h3>
                <p>We do not guarantee that the Service will be uninterrupted, secure, or error-free, or that any defects will be corrected. We make no warranty regarding the quality, accuracy, timeliness, or completeness of any information on the Service.</p>
              </div>
            </div>
          </section>
          
          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">11. Indemnification</h2>
            
            <div className="bg-accent p-5 rounded-lg mb-6">
              <p>You agree to indemnify, defend, and hold harmless Storybook Starter Inc. and its officers, directors, agents, subsidiaries, affiliates, and employees from any claim or demand (including reasonable attorneys' fees) arising out of or related to your breach of these Terms, your violation of any law, or your infringement of any third-party rights.</p>
            </div>
          </section>
          
          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">12. Privacy and COPPA Compliance</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-muted p-5 rounded-lg">
                <h3 className="text-xl font-medium mb-3">Children's Privacy</h3>
                <p>We do not knowingly collect personal information from children under the age of 13 without parental consent. If You believe we might have any information from or about a child under 13 without proper consent, please contact us at <a href="mailto:contact@example.com" className="underline hover:text-blue-600">contact@example.com</a>.</p>
              </div>
              
              <div className="bg-muted p-5 rounded-lg">
                <h3 className="text-xl font-medium mb-3">Parental Responsibility</h3>
                <p>If You are uploading images or personal data related to minors, You represent and warrant that You have the legal right to do so, including any necessary consents from the minor's parent or guardian.</p>
              </div>
            </div>
            
            <p className="mb-4">For more details on how we handle personal data, please refer to our <a href="/privacy" className="underline hover:text-blue-600">Privacy Policy</a>.</p>
          </section>
          
          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">13. Governing Law and Dispute Resolution</h2>
            
            <div className="bg-accent p-5 rounded-lg mb-6">
              <p className="mb-4">These Terms and any disputes arising from or related to your use of the Service or any Goods will be governed by and construed in accordance with the laws of the jurisdiction in which Storybook Starter Inc. is located, without regard to conflict-of-law rules.</p>
              <p>Any dispute arising out of or relating to these Terms shall be subject to the exclusive jurisdiction of the state or federal courts located in that same jurisdiction, and You hereby consent to the personal jurisdiction and venue of such courts.</p>
            </div>
          </section>
          
          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">14. Changes to These Terms</h2>
            
            <div className="bg-accent p-5 rounded-lg mb-6">
              <p>We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material, we will make reasonable efforts to provide at least 30 days' notice prior to any new Terms taking effect. Your continued use of the Service after any changes become effective will constitute your acceptance of those revised Terms. If You do not agree to the new Terms, please stop using the Service.</p>
            </div>
          </section>
          
          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">15. Severability and Waiver</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-muted p-5 rounded-lg">
                <h3 className="text-xl font-medium mb-3">Severability</h3>
                <p>If any provision of these Terms is deemed invalid or unenforceable, such provision shall be modified and interpreted to fulfill the objectives of the original provision to the greatest extent possible under applicable law. All remaining provisions will remain in effect.</p>
              </div>
              
              <div className="bg-muted p-5 rounded-lg">
                <h3 className="text-xl font-medium mb-3">Waiver</h3>
                <p>No failure or delay by Storybook Starter Inc. in exercising any right or remedy provided by law or under these Terms will impair or operate as a waiver of that right or remedy.</p>
              </div>
            </div>
          </section>
          
          <section className="mb-10">
            <h2 className="text-2xl font-semibold mb-4">16. Entire Agreement</h2>
            
            <div className="bg-accent p-5 rounded-lg mb-6">
              <p>These Terms, along with any additional policies referenced herein (including our <a href="/privacy" className="underline hover:text-blue-600">Privacy Policy</a>), constitute the entire agreement between You and Storybook Starter Inc. regarding the use of the Service. They supersede any prior agreements, understandings, or communications.</p>
            </div>
          </section>
          
          <section className="mb-10">
            <div className="bg-muted p-6 rounded-lg text-center">
              <h2 className="text-2xl font-semibold mb-4">17. Contact Information</h2>
              <p className="mb-4">If You have any questions about these Terms, please contact us:</p>
              <p className="mb-2">By Email: <a href="mailto:contact@example.com" className="underline hover:text-blue-600">contact@example.com</a></p>
              <p>Website: <a href="https://www.example.com" className="underline hover:text-blue-600">example.com</a></p>
            </div>
          </section>
          
          <div className="bg-accent p-5 rounded-lg text-center mb-6">
            <p className="font-medium">Thank you for reading and agreeing to these Terms and Conditions.</p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
} 