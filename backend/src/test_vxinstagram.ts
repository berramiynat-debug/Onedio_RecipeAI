import axios from 'axios';

async function testVxInstagram() {
  const url = 'https://vxinstagram.com/p/C0f9kpxsc1_/';
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      timeout: 8000
    });
    const html = res.data;
    console.log("vxinstagram HTML length:", html.length);
    
    // Extract og:description
    const propertyReg = new RegExp(`<meta[^>]*(?:property|name)=["']og:description["'][^>]*content=["']([^"']*)["']`, 'i');
    const match = html.match(propertyReg);
    if (match && match[1]) {
      console.log("Found og:description via vxinstagram!");
      console.log("Caption content:", match[1]);
    } else {
      console.log("og:description not found in vxinstagram HTML. Let's print meta tags:");
      const metas = html.match(/<meta[^>]*>/gi) || [];
      metas.forEach((m: string) => console.log(m));
    }
  } catch (error: any) {
    console.error("Error fetching vxinstagram:", error.message);
  }
}

testVxInstagram();
