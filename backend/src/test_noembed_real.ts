import axios from 'axios';

async function testNoembed() {
  const targetUrl = 'https://www.instagram.com/p/CGy410ZJ-vA/';
  const url = `https://noembed.com/embed?url=${encodeURIComponent(targetUrl)}`;
  try {
    const res = await axios.get(url, {
      timeout: 8000
    });
    console.log("Noembed Status:", res.status);
    console.log("Data:", JSON.stringify(res.data, null, 2));
  } catch (error: any) {
    if (error.response) {
      console.error("Failed status:", error.response.status);
    } else {
      console.error("Error:", error.message);
    }
  }
}

testNoembed();
