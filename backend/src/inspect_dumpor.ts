import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

async function inspectDumpor() {
  const url = 'https://dumpor.com/c/CGy410ZJ-vA';
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      timeout: 8000
    });
    const html = res.data;
    fs.writeFileSync(path.join(__dirname, 'dumpor_success.html'), html);
    
    // Check if the caption or some post elements are inside
    // Search for keywords
    console.log("Searching for keywords in Dumpor HTML...");
    
    // Check for author name or post details
    if (html.includes('instagram') || html.includes('Instagram')) {
      console.log("Found 'instagram' keyword.");
    }
    
    // Let's print the title and some metadata
    const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
    console.log("Title:", titleMatch ? titleMatch[1].trim() : "No title");
    
    // Let's print a snippet of code where caption might reside
    // Often there's a div with class="caption" or class="post-info" or similar
    const bodyStart = html.indexOf('<body');
    if (bodyStart !== -1) {
      console.log("Body snippet:", html.substring(bodyStart, bodyStart + 1000).replace(/\s+/g, ' '));
    }
  } catch (error: any) {
    console.error("Error:", error.message);
  }
}

inspectDumpor();
