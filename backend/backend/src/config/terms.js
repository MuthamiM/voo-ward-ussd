/**
 * Terms & Conditions for VOO KYAMATU WARD USSD Service
 * Displayed during registration process
 */

const TERMS_SHORT = `By registering, you agree:
1. Your details will be accessed by MCA only
2. Data used for bursary & ward services
3. No sharing with 3rd parties

Reply:
1. Accept & Continue
2. Decline

0:Back 00:Home`;

const TERMS_FULL = `TERMS OF SERVICE - VOO KYAMATU WARD

1. DATA COLLECTION
We collect: Phone, National ID, Name, Area, Village

2. DATA USE
- Process bursary applications
- Provide ward services
- Contact for important updates

3. DATA ACCESS
- Only MCA (Member of County Assembly) can view your details
- No sharing with third parties
- Secure storage

4. YOUR RIGHTS
- Request data deletion
- Update your information
- Withdraw consent (visit office)

5. CONSENT
By accepting, you consent to the above terms.

Contact MCA office for questions.`;

const PRIVACY_NOTICE_USSD = `PRIVACY NOTICE

Your personal data is protected.

ACCESS: MCA (ZAK) only
PURPOSE: Ward services & bursaries  
SHARING: None (MCA access only)

You may withdraw consent at MCA office.

Continue with registration?
1. Yes, I Accept
2. No, Cancel

0:Back`;

module.exports = {
  TERMS_SHORT,
  TERMS_FULL,
  PRIVACY_NOTICE_USSD
};
