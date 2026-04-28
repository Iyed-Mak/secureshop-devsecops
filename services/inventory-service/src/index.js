const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Order Service Running');
});

app.listen(8006, () => {
  console.log('Server running on port 8006');
});