const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Serve static files from the 'dist' directory (where Vite builds the app)
app.use(express.static(path.join(__dirname, 'dist')));

// Handle SPA routing: for any request that doesn't match a static file,
// send back index.html so React Router can handle it.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
