
import axios from 'axios';
import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { ticket, service } = req.query;

  if (!ticket || !service) {
    return res.status(400).json({ error: 'Missing ticket or service parameter' });
  }

  // USTC CAS Validation URL (Service Validate returns XML)
  const validateUrl = `https://passport.ustc.edu.cn/serviceValidate?ticket=${ticket}&service=${service}`;

  try {
    const response = await axios.get(validateUrl, { responseType: 'text' });
    const xml = response.data;

    const $ = cheerio.load(xml, { xmlMode: true });
    
    // Check for success tag: <cas:authenticationSuccess>
    const successNode = $('cas\\:authenticationSuccess');

    if (successNode.length > 0) {
      // Extract User: <cas:user>PBxxxx</cas:user>
      let studentId = $('cas\\:user').text().trim();
      
      // Sometimes it might be in attributes or different tag depending on CAS version
      if (!studentId) {
          // Fallback regex
          const match = xml.match(/<cas:user>(.*?)<\/cas:user>/);
          if (match) studentId = match[1].trim();
      }

      // USTC IDs are uppercase usually
      if (studentId) {
        return res.status(200).json({ 
            success: true, 
            studentId: studentId.toUpperCase(),
            // You can extract attributes if needed (gid, name, etc.)
            // attributes: { ... } 
        });
      } else {
         return res.status(500).json({ success: false, error: 'Parsed XML but could not find Student ID', debugXml: xml });
      }
    } else {
      // Failure: <cas:authenticationFailure code="...">...</cas:authenticationFailure>
      const failureNode = $('cas\\:authenticationFailure');
      const errorMsg = failureNode.text().trim() || 'Unknown CAS Error';
      return res.status(401).json({ success: false, error: `CAS Validation Failed: ${errorMsg}` });
    }
  } catch (error) {
    console.error("CAS Validation Error:", error);
    return res.status(500).json({ success: false, error: 'Network error validating ticket', details: error.message });
  }
}
