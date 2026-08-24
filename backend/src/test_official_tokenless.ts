import axios from 'axios';

async function testOfficialTokenless() {
  const url = 'https://graph.facebook.com/v18.0/instagram_oembed?url=https://www.instagram.com/p/CGy410ZJ-vA/';
  try {
    const res = await axios.get(url, {
      timeout: 8000
    });
    console.log("Status code:", res.status);
    console.log("JSON response:", JSON.stringify(res.data, null, 2));
  } catch (error: any) {
    if (error.response) {
      console.error("Error status:", error.response.status);
      console.error("Error data:", JSON.stringify(error.response.data, null, 2));
    } else {
      console.error("Error:", error.message);
    }
  }
}

testOfficialTokenless();
