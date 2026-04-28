const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Order Service Running');
});

app.listen(8003, () => {
  console.log('Server order service running on port 8003');
});