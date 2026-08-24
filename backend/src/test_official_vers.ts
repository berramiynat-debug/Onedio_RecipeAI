import axios from 'axios';

async function testVersions() {
  // Try a different public post and different versions
  const testUrl = 'https://www.instagram.com/reel/C8H5o45s1xY/';
  const endpoints = [
    `https://graph.facebook.com/instagram_oembed?url=${encodeURIComponent(testUrl)}`,
    `https://graph.facebook.com/v20.0/instagram_oembed?url=${encodeURIComponent(testUrl)}`,
    `https://graph.facebook.com/v25.0/instagram_oembed?url=${encodeURIComponent(testUrl)}`
  ];
  
  for (const ep of endpoints) {
    console.log("Testing endpoint:", ep);
    try {
      const res = await axios.get(ep, { timeout: 5000 });
      console.log("SUCCESS!");
      console.log(JSON.stringify(res.data, null, 2));
      return;
    } catch (error: any) {
      if (error.response) {
        console.error("FAILED status:", error.response.status, "message:", error.response.data?.error?.message);
      } else {
        console.error("FAILED:", error.message);
      }
    }
  }
}

testVersions();
