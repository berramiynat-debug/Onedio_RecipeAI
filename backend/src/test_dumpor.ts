import axios from 'axios';

async function testDumpor() {
  const url = 'https://dumpor.com/c/CGy410ZJ-vA';
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 8000
    });
    console.log("Dumpor Status:", res.status);
    console.log("HTML length:", res.data.length);
  } catch (error: any) {
    if (error.response) {
      console.error("Failed status:", error.response.status);
    } else {
      console.error("Error:", error.message);
    }
  }
}

testDumpor();
