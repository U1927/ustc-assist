
export default async function handler(req, res) {
  const { ticket, service } = req.query;

  if (!ticket || !service) {
    return res.status(400).json({ error: 'Missing ticket or service parameter' });
  }

  // USTC CAS Validation URL
  const validateUrl = `https://passport.ustc.edu.cn/serviceValidate?ticket=${ticket}&service=${service}`;

  try {
    const response = await fetch(validateUrl);
    const xml = await response.text();

    // Check for success tag
    if (xml.includes('cas:authenticationSuccess')) {
      // Extract Student ID (usually inside <cas:user> or <cas:gid>)
      // Regex to find content between <cas:user> tags
      const userMatch = xml.match(/<cas:user>(.*?)<\/cas:user>/);
      // Sometimes USTC returns generic ID, but usually it's the GID/Student ID
      // You might need to adjust based on specific XML response, but <cas:user> is standard.
      const studentId = userMatch ? userMatch[1].trim().toUpperCase() : null;

      if (studentId) {
        return res.status(200).json({ success: true, studentId });
      } else {
         return res.status(500).json({ error: 'Could not parse Student ID from CAS response', xml });
      }
    } else {
      return res.status(401).json({ success: false, error: 'CAS Validation Failed', xml });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Network error validating ticket', details: error.message });
  }
}
