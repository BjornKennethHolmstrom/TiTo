// Example with Node.js and Express
const express = require('express');
const app = express();

app.use(express.json());

app.post('/save-time', (req, res) => {
    // Save the time entry to a database
    res.send('Time entry saved');
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});

