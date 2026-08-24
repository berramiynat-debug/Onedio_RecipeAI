import * as fs from 'fs';
import * as path from 'path';

function inspect() {
  const filePath = path.join(__dirname, 'embed_headers.html');
  if (!fs.existsSync(filePath)) {
    console.log("embed_headers.html not found.");
    return;
  }
  const html = fs.readFileSync(filePath, 'utf8');
  console.log("Total length:", html.length);
  
  // Search for index 2070
  console.log("Snippet around 2070:");
  console.log(html.substring(2000, 3000));
}

inspect();
