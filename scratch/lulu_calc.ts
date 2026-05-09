import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const authId = process.env.LULU_CLIENT_KEY;
  const authSecret = process.env.LULU_CLIENT_SECRET;
  const tokenString = Buffer.from(`${authId}:${authSecret}`).toString('base64');
  
  const tokenResp = await axios.post(`https://api.sandbox.lulu.com/auth/realms/glasstree/protocol/openid-connect/token`, 
    new URLSearchParams({ grant_type: 'client_credentials' }).toString(), 
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Basic ${tokenString}` } }
  );
  
  const token = tokenResp.data.access_token;
  
  const testIds = [
    "0600X0900BWSTDPB060UW444MXX", // 60# Uncoated White
    "0600X0900FCSTDPB080CW444MXX", // 80# Coated White (Color)
    "0600X0900BWSTDPB080CW444MXX", // 80# Coated White (B&W)
    "0600X0900BWSTDHB060UW444MXX", // Hardcover 60#
    "0600X0900BWSTDCW080CW444MXX", // Hardcover Case Wrap 80#
    "0600X0900BWSTDHC080CW444MXX", // Hardcover HC 80#
  ];

  for (const id of testIds) {
    try {
      const calcResp = await axios.post(`https://api.sandbox.lulu.com/print-job-cost-calculations/`, {
        line_items: [{ page_count: 243, quantity: 1, pod_package_id: id }],
        shipping_level: "MAIL",
        shipping_address: {
          country_code: "US", state_code: "NY", postcode: "10001",
          city: "New York", street1: "123 Main St", phone_number: "5551234567"
        }
      }, { headers: { 'Authorization': `Bearer ${token}` }});
      console.log(`✅ ${id} is VALID.`);
    } catch (e: any) {
      console.log(`❌ ${id} FAILED:`, JSON.stringify(e.response?.data, null, 2));
    }
  }
}
run();
