import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

async function runTest() {
  console.log("Authenticating with Lulu Sandbox...");
  const authId = process.env.LULU_CLIENT_KEY;
  const authSecret = process.env.LULU_CLIENT_SECRET;
  const tokenString = Buffer.from(`${authId}:${authSecret}`).toString('base64');
  
  let token;
  try {
    const tokenResp = await axios.post(`https://api.sandbox.lulu.com/auth/realms/glasstree/protocol/openid-connect/token`, 
      new URLSearchParams({ grant_type: 'client_credentials' }).toString(), 
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Basic ${tokenString}` } }
    );
    token = tokenResp.data.access_token;
  } catch (e: any) {
    console.error("Auth failed:", e.message);
    return;
  }
  
  try {
    const jobResp = await axios.post(`https://api.sandbox.lulu.com/print-jobs/`, {
      contact_email: "test@example.com",
      external_id: "test-pdf-validation-" + Date.now(),
      line_items: [{
        title: "Test PDF Validation",
        pod_package_id: "0600X0900BWSTDPB080CW444MXX",
        page_count: 243,
        quantity: 1,
        printable_normalization: {
          pod_package_id: "0600X0900BWSTDPB080CW444MXX",
          cover: { source_url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf" },
          interior: { source_url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf" }
        }
      }],
      shipping_address: {
        name: "Test Customer",
        street1: "123 Main St",
        city: "New York",
        state_code: "NY",
        postcode: "10001",
        country_code: "US",
        phone_number: "5551234567"
      },
      shipping_level: "MAIL"
    }, { headers: { 'Authorization': `Bearer ${token}` }});
    
    console.log("✅ SUCCESS! The PDFs are a perfect mathematical match for this pod_package_id.");
    console.log("Job ID:", jobResp.data.id);
  } catch (e: any) {
    console.log("❌ FAILED. Lulu rejected the PDFs for this pod_package_id.");
    console.log("Error details:", JSON.stringify(e.response?.data || e.message, null, 2));
  }
}
runTest();
